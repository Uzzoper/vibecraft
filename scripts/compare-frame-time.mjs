import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const repoRoot = run("git", ["rev-parse", "--show-toplevel"], { cwd: process.cwd() }).stdout.trim();
const baseRef = process.env.BENCHMARK_BASE_REF ?? "master";
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "vibecraft-frame-benchmark-"));
const baseWorktree = path.join(tempRoot, "base");
const runnerPath = path.join(repoRoot, "scripts", "run-frame-time-benchmark.mjs");

try {
  run("git", ["worktree", "add", "--detach", baseWorktree, baseRef], {
    cwd: repoRoot,
    stdio: "inherit",
  });

  const currentNodeModules = path.join(repoRoot, "node_modules");
  const worktreeNodeModules = path.join(baseWorktree, "node_modules");
  if (fs.existsSync(currentNodeModules) && !fs.existsSync(worktreeNodeModules)) {
    fs.symlinkSync(currentNodeModules, worktreeNodeModules, "dir");
  }

  const current = runFrameBenchmark(repoRoot, "current");
  const base = runFrameBenchmark(baseWorktree, baseRef);

  printComparison(current, base);
} finally {
  run("git", ["worktree", "remove", "--force", baseWorktree], {
    cwd: repoRoot,
    stdio: "ignore",
    allowFailure: true,
  });
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

function runFrameBenchmark(cwd, label) {
  const result = run(process.execPath, [runnerPath, label], {
    cwd,
    env: {
      ...process.env,
      NODE_NO_WARNINGS: "1",
    },
  });

  return JSON.parse(result.stdout);
}

function printComparison(current, base) {
  const rows = [
    ["startup", current.metrics.startupMs, base.metrics.startupMs],
    ["frame avg", current.metrics.frame.average, base.metrics.frame.average],
    ["frame median", current.metrics.frame.median, base.metrics.frame.median],
    ["frame p95", current.metrics.frame.p95, base.metrics.frame.p95],
    ["frame p99", current.metrics.frame.p99, base.metrics.frame.p99],
    ["frame max", current.metrics.frame.max, base.metrics.frame.max],
    ["long task total", current.metrics.longTasks.total, base.metrics.longTasks.total],
    ["long task max", current.metrics.longTasks.max, base.metrics.longTasks.max],
  ];

  console.log(`Frame-time comparison: ${current.label} vs ${base.label}`);
  console.log(`Duration: ${current.durationMs}ms`);
  console.log("");
  console.log("metric                 current      base         delta");
  console.log("------------------------------------------------------------");

  for (const [metric, currentValue, baseValue] of rows) {
    const delta = baseValue === 0 ? 0 : ((currentValue - baseValue) / baseValue) * 100;
    const sign = delta >= 0 ? "+" : "";
    console.log(
      `${metric.padEnd(22)} ${formatMs(currentValue).padStart(9)} ${formatMs(baseValue).padStart(11)} ${`${sign}${delta.toFixed(1)}%`.padStart(10)}`,
    );
  }

  console.log("");
  console.log(
    `Frames: current=${current.metrics.frameCount}, base=${base.metrics.frameCount}`,
  );
  console.log(
    `Frames >33ms: current=${current.metrics.frame.over33ms}, base=${base.metrics.frame.over33ms}`,
  );
  console.log(
    `Long tasks: current=${current.metrics.longTasks.count}, base=${base.metrics.longTasks.count}`,
  );
}

function formatMs(value) {
  return `${value.toFixed(2)}ms`;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env,
    encoding: "utf8",
    stdio: options.stdio ?? "pipe",
  });

  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(
      [
        `Command failed: ${command} ${args.join(" ")}`,
        result.stdout,
        result.stderr,
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  return result;
}
