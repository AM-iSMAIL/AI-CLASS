// ─── Module 6 — Eye Gaze Estimator ──────────────────────────────────────────
// 3D gaze vector from iris landmarks with One-Euro filtering.

import type { CVModule, GazeEstimate, GazeDirection, GazeTarget, FrameContext, Point3D } from '../types';
import type { CVConfig } from '../config';
import { OneEuroFilter, RollingWindow, centroid, dist3D, roundTo, clamp } from '../filters';

export class GazeEstimatorModule implements CVModule<Map<string, GazeEstimate | null>> {
  readonly name = 'gaze-estimator';

  private config: CVConfig | null = null;

  // Per-student filter state
  private filters = new Map<string, {
    yawFilter: OneEuroFilter;
    pitchFilter: OneEuroFilter;
    irisHistory: RollingWindow<number>;
    baseline: number | null;
  }>();

  setConfig(config: CVConfig): void {
    this.config = config;
  }

  private getFilters(trackingId: string): {
    yawFilter: OneEuroFilter;
    pitchFilter: OneEuroFilter;
    irisHistory: RollingWindow<number>;
    baseline: number | null;
  } {
    let f = this.filters.get(trackingId);
    if (!f) {
      const c = this.config!;
      f = {
        yawFilter: new OneEuroFilter(c.gazeFilterMinCutoff, c.gazeFilterBeta, c.gazeFilterDCutoff),
        pitchFilter: new OneEuroFilter(c.gazeFilterMinCutoff, c.gazeFilterBeta, c.gazeFilterDCutoff),
        irisHistory: new RollingWindow<number>(c.irisEngagementWindow),
        baseline: null,
      };
      this.filters.set(trackingId, f);
    }
    return f;
  }

  process(ctx: FrameContext): Map<string, GazeEstimate | null> {
    const config = this.config;
    if (!config) return new Map();

    const results = new Map<string, GazeEstimate | null>();
    const timestamp = ctx.timestamp / 1000; // One-Euro uses seconds

    for (const student of ctx.trackedStudents) {
      const analysis = ctx.studentAnalysis.get(student.trackingId);
      const lm = analysis?.landmarks;

      // Skip if eyes are closed (blink module may not have run yet, so check landmarks)
      if (!lm || !lm.faceComplete) {
        results.set(student.trackingId, null);
        continue;
      }

      const f = this.getFilters(student.trackingId);

      // ── 3D gaze vector from iris position relative to eyeball center ──

      // Left eye
      const lCenter = centroid(lm.leftEyeContour);
      lCenter.z -= config.eyeballZOffset;
      const lIris = lm.leftIrisCenter;
      const lVx = lIris.x - lCenter.x;
      const lVy = lIris.y - lCenter.y;
      const lVz = lIris.z - lCenter.z;

      // Right eye
      const rCenter = centroid(lm.rightEyeContour);
      rCenter.z -= config.eyeballZOffset;
      const rIris = lm.rightIrisCenter;
      const rVx = rIris.x - rCenter.x;
      const rVy = rIris.y - rCenter.y;
      const rVz = rIris.z - rCenter.z;

      // Per-eye angles
      const leftYaw = Math.atan2(-lVx, lVz + 1e-9) * (180 / Math.PI);
      const leftPitch = Math.atan2(lVy, lVz + 1e-9) * (180 / Math.PI);
      const rightYaw = Math.atan2(-rVx, rVz + 1e-9) * (180 / Math.PI);
      const rightPitch = Math.atan2(rVy, rVz + 1e-9) * (180 / Math.PI);

      // Average
      const avgVx = (lVx + rVx) / 2;
      const avgVy = (lVy + rVy) / 2;
      const avgVz = (lVz + rVz) / 2;

      const rawYaw = Math.atan2(-avgVx, avgVz + 1e-9) * (180 / Math.PI);
      const rawPitch = Math.atan2(avgVy, avgVz + 1e-9) * (180 / Math.PI);

      // One-Euro filter
      const filteredYaw = f.yawFilter.filter(rawYaw, timestamp);
      const filteredPitch = f.pitchFilter.filter(rawPitch, timestamp);

      // ── Iris engagement ──
      const irisEngagement = this.computeIrisEngagement(lm, f, config);

      // ── Direction classification ──
      const direction = classifyDirection(filteredYaw, filteredPitch, config);
      const target = classifyTarget(filteredYaw, filteredPitch, config);

      const estimate: GazeEstimate = {
        leftEye: { yaw: roundTo(leftYaw, 1), pitch: roundTo(leftPitch, 1) },
        rightEye: { yaw: roundTo(rightYaw, 1), pitch: roundTo(rightPitch, 1) },
        combined: { yaw: roundTo(filteredYaw, 1), pitch: roundTo(filteredPitch, 1) },
        raw: { yaw: roundTo(rawYaw, 1), pitch: roundTo(rawPitch, 1) },
        direction,
        target,
        irisEngagement,
      };

      results.set(student.trackingId, estimate);
      if (analysis) analysis.gaze = estimate;
    }

    return results;
  }

  private computeIrisEngagement(
    lm: NonNullable<typeof undefined extends never ? never : import('../types').StructuredLandmarks>,
    f: ReturnType<GazeEstimatorModule['getFilters']>,
    config: CVConfig,
  ): number {
    // Compute iris diameter for each eye
    const irisDiam = (center: Point3D, ring: Point3D[]): number => {
      let total = 0;
      for (const p of ring) total += dist3D(p, center);
      return total / ring.length;
    };

    const leftDiam = irisDiam(lm.leftIrisCenter, lm.leftIrisRing);
    const rightDiam = irisDiam(lm.rightIrisCenter, lm.rightIrisRing);
    const avgDiam = (leftDiam + rightDiam) / 2;

    // Normalise by eye opening height
    const leftH = dist3D(lm.leftEyeTop, lm.leftEyeBottom);
    const rightH = dist3D(lm.rightEyeTop, lm.rightEyeBottom);
    const avgH = (leftH + rightH) / 2;

    const ratio = avgH > 0 ? avgDiam / avgH : 0;
    f.irisHistory.push(ratio);

    // Establish baseline
    if (f.baseline === null && f.irisHistory.length >= config.irisBaselineMinSamples) {
      f.baseline = f.irisHistory.average();
    }

    if (f.baseline === null) return 50;

    const currentAvg = f.irisHistory.average();
    const deviationPct = ((currentAvg - f.baseline) / (f.baseline + 1e-9)) * 100;
    return clamp(Math.round(50 + deviationPct * 2.5), 0, 100);
  }

  reset(): void {
    this.filters.clear();
  }
}

function classifyDirection(yaw: number, pitch: number, config: CVConfig): GazeDirection {
  if (pitch < -config.gazeVerticalThreshold) return 'up';
  if (pitch > config.gazeVerticalThreshold) return 'down';
  if (yaw < -config.gazeHorizontalThreshold) return 'left';
  if (yaw > config.gazeHorizontalThreshold) return 'right';
  return 'center';
}

function classifyTarget(yaw: number, pitch: number, config: CVConfig): GazeTarget {
  const hThresh = config.gazeHorizontalThreshold;
  const vThresh = config.gazeVerticalThreshold;

  if (Math.abs(yaw) <= hThresh && Math.abs(pitch) <= vThresh) return 'at_lecture';
  if (pitch > vThresh * 1.5) return 'downward';
  if (Math.abs(yaw) > hThresh * 2) return 'second_monitor';
  return 'away';
}
