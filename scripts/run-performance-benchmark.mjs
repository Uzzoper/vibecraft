import path from "node:path";
import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const label = process.argv[2] ?? path.basename(root);
const samples = Number(process.env.BENCHMARK_SAMPLES ?? 8);
const warmup = Number(process.env.BENCHMARK_WARMUP ?? 2);

globalThis.performance = performance;
globalThis.localStorage = {
  getItem() {
    return null;
  },
  setItem() {},
  removeItem() {},
  clear() {},
};

class BenchmarkWorker {
  static instances = [];

  messages = [];
  listeners = new Map();

  constructor(url, options) {
    this.url = String(url);
    this.options = options;
    BenchmarkWorker.instances.push(this);
  }

  postMessage(message) {
    this.messages.push(message);
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }

  removeEventListener(type) {
    this.listeners.delete(type);
  }

  terminate() {}
}

globalThis.Worker = BenchmarkWorker;

const THREE = await import("three");
if (THREE.TextureLoader?.prototype) {
  THREE.TextureLoader.prototype.load = function loadBenchmarkTexture() {
    return new THREE.Texture();
  };
}

function stats(timings) {
  const sorted = [...timings].sort((a, b) => a - b);
  const percentile = value => sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * value) - 1)];
  return {
    average: timings.reduce((sum, time) => sum + time, 0) / timings.length,
    median: percentile(0.5),
    p95: percentile(0.95),
    min: sorted[0],
    max: sorted[sorted.length - 1],
  };
}

function checksum(blocks) {
  let total = 0;
  for (let i = 0; i < blocks.length; i += 257) {
    total += blocks[i];
  }
  return total;
}

async function importFromRoot(relativePath) {
  return import(pathToFileURL(path.join(root, relativePath)).href);
}

const { generateTerrain } = await importFromRoot("src/world/terrain.ts");
const { World } = await importFromRoot("src/world/World.ts");

function benchmarkTerrain() {
  for (let i = 0; i < warmup; i++) {
    generateTerrain(i, -i);
  }

  const timings = [];
  let lastChecksum = 0;
  for (let i = 0; i < samples; i++) {
    const start = performance.now();
    const blocks = generateTerrain(i * 13, -i * 7);
    timings.push(performance.now() - start);
    lastChecksum = checksum(blocks);
  }

  return { ...stats(timings), checksum: lastChecksum };
}

function createScene() {
  return {
    add() {},
    remove() {},
    traverse() {},
  };
}

function benchmarkInitialWorldUpdate() {
  for (let i = 0; i < warmup; i++) {
    const world = new World(createScene());
    world.update(i * 1024, -i * 1024);
  }

  const timings = [];
  let workerMessages = 0;
  for (let i = 0; i < samples; i++) {
    const beforeWorkers = BenchmarkWorker.instances.length;
    const world = new World(createScene());
    const start = performance.now();
    world.update(i * 2048, -i * 2048);
    timings.push(performance.now() - start);

    const worker = BenchmarkWorker.instances[beforeWorkers];
    workerMessages = worker?.messages.length ?? 0;
  }

  return { ...stats(timings), workerMessages };
}

console.log(
  JSON.stringify(
    {
      label,
      root,
      samples,
      warmup,
      terrain: benchmarkTerrain(),
      initialWorldUpdate: benchmarkInitialWorldUpdate(),
    },
    null,
    2,
  ),
);
