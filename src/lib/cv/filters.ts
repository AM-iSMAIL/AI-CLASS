// ─── Neuro Class AI — Signal Processing Filters ────────────────────────────
// Reusable filter primitives. No external dependencies.

/**
 * One-Euro Filter — adaptive low-pass filter.
 * Low jitter when still, low latency when moving.
 */
export class OneEuroFilter {
  private minCutoff: number;
  private beta: number;
  private dCutoff: number;
  private xPrev = 0;
  private dxPrev = 0;
  private tPrev = 0;
  private initialized = false;

  constructor(minCutoff = 1.0, beta = 0.007, dCutoff = 1.0) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
  }

  private smoothingFactor(cutoff: number, dt: number): number {
    const tau = 1.0 / (2 * Math.PI * cutoff);
    return 1.0 / (1.0 + tau / dt);
  }

  filter(value: number, timestamp: number): number {
    if (!this.initialized) {
      this.xPrev = value;
      this.dxPrev = 0;
      this.tPrev = timestamp;
      this.initialized = true;
      return value;
    }

    const dt = Math.max(timestamp - this.tPrev, 1e-6);
    this.tPrev = timestamp;

    const dx = (value - this.xPrev) / dt;
    const alphaDx = this.smoothingFactor(this.dCutoff, dt);
    const dxFiltered = alphaDx * dx + (1 - alphaDx) * this.dxPrev;
    this.dxPrev = dxFiltered;

    const cutoff = this.minCutoff + this.beta * Math.abs(dxFiltered);
    const alpha = this.smoothingFactor(cutoff, dt);

    const filtered = alpha * value + (1 - alpha) * this.xPrev;
    this.xPrev = filtered;
    return filtered;
  }

  reset(): void {
    this.initialized = false;
  }
}

/**
 * Exponential Moving Average filter.
 */
export class EMAFilter {
  private value: number;
  private initialized = false;

  constructor(private alpha: number, private initial = 100) {
    this.value = initial;
  }

  filter(raw: number): number {
    if (!this.initialized) {
      this.value = raw;
      this.initialized = true;
      return raw;
    }
    this.value = this.alpha * raw + (1 - this.alpha) * this.value;
    return this.value;
  }

  get current(): number {
    return this.value;
  }

  reset(): void {
    this.value = this.initial;
    this.initialized = false;
  }
}

/**
 * Bounded circular buffer for rolling history.
 * O(1) push, O(n) average/iteration — fine for small windows.
 */
export class RollingWindow<T> {
  private buffer: T[] = [];

  constructor(private maxSize: number) {}

  push(value: T): void {
    this.buffer.push(value);
    if (this.buffer.length > this.maxSize) {
      this.buffer.shift();
    }
  }

  get values(): readonly T[] {
    return this.buffer;
  }

  get length(): number {
    return this.buffer.length;
  }

  get last(): T | undefined {
    return this.buffer[this.buffer.length - 1];
  }

  /** Average for number arrays */
  average(): number {
    if (this.buffer.length === 0) return 0;
    const sum = (this.buffer as unknown as number[]).reduce((a, b) => a + b, 0);
    return sum / this.buffer.length;
  }

  /** Filter entries newer than a timestamp (for entries that have a `t` field) */
  since(timestampMs: number): T[] {
    return this.buffer.filter((entry: any) => (entry.t ?? entry) >= timestampMs);
  }

  clear(): void {
    this.buffer = [];
  }
}

// ─── Geometry Helpers ───────────────────────────────────────────────────────

import type { Point3D } from './types';

/** Euclidean distance between two 3D points */
export function dist3D(a: Point3D, b: Point3D): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/** Euclidean distance between two landmarks by index in an array */
export function distByIndex(lm: Point3D[], i1: number, i2: number): number {
  return dist3D(lm[i1], lm[i2]);
}

/** Centroid of a set of 3D points */
export function centroid(points: Point3D[]): Point3D {
  const n = points.length;
  if (n === 0) return { x: 0, y: 0, z: 0 };
  let x = 0, y = 0, z = 0;
  for (const p of points) {
    x += p.x;
    y += p.y;
    z += p.z;
  }
  return { x: x / n, y: y / n, z: z / n };
}

/** Clamp a number between min and max */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Round to N decimal places */
export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
