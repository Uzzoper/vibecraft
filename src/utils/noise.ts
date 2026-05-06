// Simple 2D value noise for terrain height generation

const PERMUTATION: number[] = [];

function buildPermutation(): void {
  for (let i = 0; i < 256; i++) {
    PERMUTATION[i] = i;
  }
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [PERMUTATION[i], PERMUTATION[j]] = [PERMUTATION[j], PERMUTATION[i]];
  }
  for (let i = 0; i < 256; i++) {
    PERMUTATION[256 + i] = PERMUTATION[i];
  }
}

buildPermutation();

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a: number, b: number, t: number): number {
  return a + t * (b - a);
}

function grad(hash: number, x: number, y: number): number {
  const h = hash & 3;
  const u = h < 2 ? x : y;
  const v = h < 2 ? y : x;
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
}

export function noise2D(x: number, y: number): number {
  const xi = Math.floor(x) & 255;
  const yi = Math.floor(y) & 255;
  const xf = x - Math.floor(x);
  const yf = y - Math.floor(y);

  const u = fade(xf);
  const v = fade(yf);

  const aa = PERMUTATION[PERMUTATION[xi] + yi];
  const ab = PERMUTATION[PERMUTATION[xi] + yi + 1];
  const ba = PERMUTATION[PERMUTATION[xi + 1] + yi];
  const bb = PERMUTATION[PERMUTATION[xi + 1] + yi + 1];

  const x1 = lerp(grad(aa, xf, yf), grad(ba, xf - 1, yf), u);
  const x2 = lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u);

  return lerp(x1, x2, v);
}

export function octaveNoise2D(
  x: number,
  y: number,
  octaves: number,
  persistence: number = 0.5
): number {
  let total = 0;
  let frequency = 1;
  let amplitude = 1;
  let maxValue = 0;

  for (let i = 0; i < octaves; i++) {
    total += noise2D(x * frequency, y * frequency) * amplitude;
    maxValue += amplitude;
    amplitude *= persistence;
    frequency *= 2;
  }

  return total / maxValue;
}
