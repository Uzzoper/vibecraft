type MetricMetadata = Record<string, number | string | boolean>;

interface PerfGlobal {
  __vibecraftPerfEvents?: Array<{
    name: string;
    duration: number;
    metadata?: MetricMetadata;
  }>;
}

export function recordPerformanceMetric(
  name: string,
  duration: number,
  metadata?: MetricMetadata,
): void {
  const events = (globalThis as PerfGlobal).__vibecraftPerfEvents;
  if (!events) return;
  events.push({ name, duration, metadata });
}
