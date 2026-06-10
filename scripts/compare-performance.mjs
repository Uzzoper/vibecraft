import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const repoRoot = run("git", ["rev-parse", "--show-toplevel"], { cwd: process.cwd() }).stdout.trim();
const masterRef = process.env.BENCHMARK_BASE_REF ?? "master";
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "vibecraft-benchmark-"));
const masterWorktree = path.join(tempRoot, "master");
const loaderPath = path.join(repoRoot, "node_modules", "ts-node", "esm.mjs");
const runnerPath = path.join(repoRoot, "scripts", "run-performance-benchmark.mjs");

if (!fs.existsSync(loaderPath)) {
  throw new Error("ts-node is not installed. Run npm install before benchmarking.");
}

try {
  run("git", ["worktree", "add", "--detach", masterWorktree, masterRef], {
    cwd: repoRoot,
    stdio: "inherit",
  });

  const currentNodeModules = path.join(repoRoot, "node_modules");
  const worktreeNodeModules = path.join(masterWorktree, "node_modules");
  if (fs.existsSync(currentNodeModules) && !fs.existsSync(worktreeNodeModules)) {
    fs.symlinkSync(currentNodeModules, worktreeNodeModules, "dir");
  }

  const current = runBenchmark(repoRoot, "current");
  const base = runBenchmark(masterWorktree, masterRef);

  printComparison(current, base);
} finally {
  run("git", ["worktree", "remove", "--force", masterWorktree], {
    cwd: repoRoot,
    stdio: "ignore",
    allowFailure: true,
  });
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

function runBenchmark(cwd, label) {
  const result = run(
    process.execPath,
    [
      "--loader",
      loaderPath,
      "--experimental-specifier-resolution=node",
      runnerPath,
      label,
    ],
    {
      cwd,
      env: {
        ...process.env,
        NODE_NO_WARNINGS: "1",
        TS_NODE_PROJECT: path.join(cwd, "tsconfig.json"),
        TS_NODE_TRANSPILE_ONLY: "true",
      },
    },
  );

  return JSON.parse(result.stdout);
}

function printComparison(current, base) {
  const rows = [
    ["terrain avg", current.terrain.average, base.terrain.average],
    ["terrain median", current.terrain.median, base.terrain.median],
    ["terrain p95", current.terrain.p95, base.terrain.p95],
    ["initial update avg", current.initialWorldUpdate.average, base.initialWorldUpdate.average],
    ["initial update median", current.initialWorldUpdate.median, base.initialWorldUpdate.median],
    ["initial update p95", current.initialWorldUpdate.p95, base.initialWorldUpdate.p95],
  ];

  console.log(`Performance comparison: ${current.label} vs ${base.label}`);
  console.log(`Samples: ${current.samples}, warmup: ${current.warmup}`);
  console.log("");
  console.log("metric                 current      base         delta");
  console.log("------------------------------------------------------------");

  for (const [metric, currentValue, baseValue] of rows) {
    const delta = ((currentValue - baseValue) / baseValue) * 100;
    const sign = delta >= 0 ? "+" : "";
    console.log(
      `${metric.padEnd(22)} ${formatMs(currentValue).padStart(9)} ${formatMs(baseValue).padStart(11)} ${`${sign}${delta.toFixed(1)}%`.padStart(10)}`,
    );
  }

  console.log("");
  console.log(
    `Initial update worker messages: current=${current.initialWorldUpdate.workerMessages}, base=${base.initialWorldUpdate.workerMessages}`,
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
