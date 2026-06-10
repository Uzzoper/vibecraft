import { generateTerrain } from "../src/world/terrain";

interface TimingStats {
  average: number;
  median: number;
  p95: number;
  min: number;
  max: number;
}

function percentile(sorted: number[], percentileValue: number): number {
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * percentileValue) - 1);
  return sorted[index];
}

function calculateStats(timings: number[]): TimingStats {
  const sorted = [...timings].sort((a, b) => a - b);
  return {
    average: timings.reduce((a, b) => a + b, 0) / timings.length,
    median: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    min: sorted[0],
    max: sorted[sorted.length - 1],
  };
}

function measureTerrainGeneration(iterations = 12, warmup = 3): TimingStats {
  for (let i = 0; i < warmup; i++) {
    generateTerrain(i, -i);
  }

  const timings: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    const blocks = generateTerrain(i, i);
    const end = performance.now();

    expect(blocks.length).toBe(16 * 64 * 16);
    timings.push(end - start);
  }

  return calculateStats(timings);
}

describe('Terrain generation performance', () => {
  it('should keep typical chunk generation under the smoke-test budget', () => {
    const stats = measureTerrainGeneration();

    console.log(
      `Terrain generation ms: avg=${stats.average.toFixed(2)} median=${stats.median.toFixed(2)} p95=${stats.p95.toFixed(2)} min=${stats.min.toFixed(2)} max=${stats.max.toFixed(2)}`,
    );
    expect(stats.median).toBeLessThan(75);
    expect(stats.p95).toBeLessThan(150);
  });
});
