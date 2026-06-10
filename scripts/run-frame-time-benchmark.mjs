import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { createServer } from "vite";

class CdpClient {
  static connect(url) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      ws.addEventListener("open", () => resolve(new CdpClient(ws)));
      ws.addEventListener("error", reject);
    });
  }

  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();

    ws.addEventListener("message", event => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result ?? {});
        return;
      }

      const listeners = this.listeners.get(message.method) ?? [];
      for (const listener of listeners) {
        listener(message.params ?? {});
      }
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }

  on(method, listener) {
    const listeners = this.listeners.get(method) ?? [];
    listeners.push(listener);
    this.listeners.set(method, listeners);
  }

  waitFor(method, timeoutMs) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Timed out waiting for ${method}`));
      }, timeoutMs);
      this.on(method, params => {
        clearTimeout(timeout);
        resolve(params);
      });
    });
  }

  close() {
    this.ws.close();
  }
}

const root = process.cwd();
const label = process.argv[2] ?? path.basename(root);
const durationMs = Number(process.env.FRAME_BENCHMARK_DURATION_MS ?? 7000);
const chromePath = process.env.CHROME_BIN ?? "/usr/bin/google-chrome";

if (!fs.existsSync(chromePath)) {
  throw new Error(`Chrome not found at ${chromePath}. Set CHROME_BIN to override.`);
}

const server = await createServer({
  root,
  configFile: path.join(root, "vite.config.ts"),
  logLevel: "error",
  server: {
    host: "127.0.0.1",
    port: 0,
    strictPort: false,
  },
});

const chromeDebugPort = await getFreePort();
const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "vibecraft-chrome-"));
let chrome;

try {
  await server.listen();
  const appUrl = server.resolvedUrls?.local[0];
  if (!appUrl) {
    throw new Error("Vite did not expose a local URL.");
  }

  chrome = spawn(chromePath, [
    "--headless=new",
    "--disable-background-timer-throttling",
    "--disable-default-apps",
    "--disable-dev-shm-usage",
    "--disable-extensions",
    "--disable-renderer-backgrounding",
    "--enable-unsafe-swiftshader",
    "--enable-webgl",
    "--ignore-gpu-blocklist",
    "--mute-audio",
    "--no-default-browser-check",
    "--no-first-run",
    "--no-sandbox",
    "--use-angle=swiftshader",
    "--use-gl=angle",
    `--remote-debugging-port=${chromeDebugPort}`,
    `--user-data-dir=${userDataDir}`,
    "about:blank",
  ], {
    stdio: ["ignore", "ignore", "pipe"],
  });

  let chromeStderr = "";
  chrome.stderr.on("data", chunk => {
    chromeStderr += chunk.toString();
  });

  const pageWebSocketUrl = await createChromePage(chromeDebugPort);
  const cdp = await CdpClient.connect(pageWebSocketUrl);
  const consoleMessages = [];
  const exceptions = [];

  cdp.on("Runtime.consoleAPICalled", event => {
    consoleMessages.push({
      type: event.type,
      text: event.args?.map(arg => arg.value ?? arg.description).join(" "),
    });
  });
  cdp.on("Runtime.exceptionThrown", event => {
    exceptions.push(event.exceptionDetails?.text ?? "Runtime exception");
  });

  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
    source: frameMetricCollectorSource(),
  });

  const loaded = cdp.waitFor("Page.loadEventFired", 30000);
  await cdp.send("Page.navigate", {
    url: `${appUrl}?frameBenchmark=1&t=${Date.now()}`,
  });
  await loaded;
  await delay(durationMs);

  const metricsResult = await cdp.send("Runtime.evaluate", {
    expression: "window.__vibecraftFrameBenchmark.getMetrics()",
    returnByValue: true,
  });

  await cdp.close();

  const metrics = metricsResult.result.value;
  if (!metrics || metrics.frameCount === 0) {
    throw new Error(
      [
        "No animation frames collected.",
        `Exceptions: ${exceptions.join(" | ") || "none"}`,
        `Console: ${consoleMessages.map(message => `${message.type}: ${message.text}`).join(" | ") || "none"}`,
        `Chrome stderr:\n${chromeStderr}`,
      ].join("\n"),
    );
  }

  console.log(
    JSON.stringify(
      {
        label,
        root,
        durationMs,
        url: appUrl,
        metrics,
        consoleMessages: consoleMessages.slice(0, 20),
        exceptions,
      },
      null,
      2,
    ),
  );
} finally {
  if (chrome && chrome.exitCode === null) {
    chrome.kill("SIGTERM");
    await Promise.race([waitForProcessExit(chrome), delay(1000)]);
    if (chrome.exitCode === null) {
      chrome.kill("SIGKILL");
      await Promise.race([waitForProcessExit(chrome), delay(1000)]);
    }
  }
  await server.close();
  try {
    fs.rmSync(userDataDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  } catch {}
}

function frameMetricCollectorSource() {
  return String.raw`
(() => {
  class BenchmarkAudioBuffer {
    constructor(numberOfChannels = 1, length = 1, sampleRate = 44100) {
      this.numberOfChannels = numberOfChannels;
      this.length = length;
      this.sampleRate = sampleRate;
      this.channels = Array.from({ length: numberOfChannels }, () => new Float32Array(length));
    }

    getChannelData(channel) {
      return this.channels[channel] ?? this.channels[0];
    }
  }

  class BenchmarkAudioContext {
    constructor() {
      this.state = "running";
      this.destination = {};
    }

    createBuffer(numberOfChannels, length, sampleRate) {
      return new BenchmarkAudioBuffer(numberOfChannels, length, sampleRate);
    }

    createBufferSource() {
      return {
        buffer: null,
        loop: false,
        connect() {},
        start() {},
        stop() {},
      };
    }

    createGain() {
      return {
        gain: { value: 1 },
        connect() {},
      };
    }

    decodeAudioData() {
      return Promise.resolve(new BenchmarkAudioBuffer());
    }

    resume() {
      this.state = "running";
      return Promise.resolve();
    }
  }

  window.AudioContext = BenchmarkAudioContext;
  window.webkitAudioContext = BenchmarkAudioContext;

  const frameIntervals = [];
  const longTasks = [];
  window.__vibecraftPerfEvents = [];
  const startedAt = performance.now();
  let firstFrameAt = null;
  let lastFrameTimestamp = null;

  const originalRequestAnimationFrame = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = callback => originalRequestAnimationFrame(timestamp => {
    if (firstFrameAt === null) firstFrameAt = performance.now();
    if (lastFrameTimestamp !== null) {
      frameIntervals.push(timestamp - lastFrameTimestamp);
    }
    lastFrameTimestamp = timestamp;
    return callback(timestamp);
  });

  try {
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        longTasks.push({
          startTime: entry.startTime,
          duration: entry.duration,
          name: entry.name,
        });
      }
    }).observe({ entryTypes: ["longtask"] });
  } catch {}

  function percentile(sorted, value) {
    if (sorted.length === 0) return 0;
    return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * value) - 1)];
  }

  function summarize(values) {
    if (values.length === 0) {
      return { average: 0, median: 0, p95: 0, p99: 0, min: 0, max: 0 };
    }
    const sorted = [...values].sort((a, b) => a - b);
    return {
      average: values.reduce((sum, value) => sum + value, 0) / values.length,
      median: percentile(sorted, 0.5),
      p95: percentile(sorted, 0.95),
      p99: percentile(sorted, 0.99),
      min: sorted[0],
      max: sorted[sorted.length - 1],
    };
  }

  function summarizePerfEvents(events) {
    const byName = {};
    for (const event of events) {
      byName[event.name] ??= [];
      byName[event.name].push(event.duration);
    }

    const summary = {};
    for (const [name, durations] of Object.entries(byName)) {
      summary[name] = {
        count: durations.length,
        total: durations.reduce((sum, value) => sum + value, 0),
        ...summarize(durations),
      };
    }

    return {
      summary,
      slowest: [...events]
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 20),
    };
  }

  window.__vibecraftFrameBenchmark = {
    getMetrics() {
      const frameStats = summarize(frameIntervals);
      const longTaskDurations = longTasks.map(task => task.duration);
      const longTaskStats = summarize(longTaskDurations);
      return {
        startupMs: firstFrameAt === null ? performance.now() - startedAt : firstFrameAt - startedAt,
        elapsedMs: performance.now() - startedAt,
        frameCount: frameIntervals.length,
        frame: {
          ...frameStats,
          over16ms: frameIntervals.filter(value => value > 16.7).length,
          over33ms: frameIntervals.filter(value => value > 33.4).length,
          over50ms: frameIntervals.filter(value => value > 50).length,
        },
        longTasks: {
          count: longTasks.length,
          total: longTaskDurations.reduce((sum, value) => sum + value, 0),
          ...longTaskStats,
          samples: longTasks.slice(0, 20),
        },
        perfEvents: summarizePerfEvents(window.__vibecraftPerfEvents),
      };
    },
  };
})();
`;
}

async function createChromePage(port) {
  await waitForChrome(port);
  const target = await requestJson({
    port,
    path: `/json/new?${encodeURIComponent("about:blank")}`,
    method: "PUT",
  });
  return target.webSocketDebuggerUrl;
}

async function waitForChrome(port) {
  const started = Date.now();
  while (Date.now() - started < 15000) {
    try {
      await requestJson({ port, path: "/json/version" });
      return;
    } catch {
      await delay(100);
    }
  }
  throw new Error("Chrome DevTools endpoint did not become available.");
}

function requestJson({ port, path: requestPath, method = "GET" }) {
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path: requestPath,
        method,
      },
      response => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", chunk => {
          body += chunk;
        });
        response.on("end", () => {
          if (response.statusCode && response.statusCode >= 400) {
            reject(new Error(`HTTP ${response.statusCode}: ${body}`));
            return;
          }
          try {
            resolve(JSON.parse(body));
          } catch (error) {
            reject(error);
          }
        });
      },
    );
    request.on("error", reject);
    request.end();
  });
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function waitForProcessExit(childProcess) {
  return new Promise(resolve => {
    if (childProcess.exitCode !== null) {
      resolve();
      return;
    }
    childProcess.once("exit", resolve);
  });
}
