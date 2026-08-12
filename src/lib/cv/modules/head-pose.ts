// ─── Module 5 — Head Pose Estimation ────────────────────────────────────────
// Calculates yaw, pitch, roll from facial landmarks.

import type { CVModule, HeadPose, HeadDirection, FrameContext } from '../types';
import type { CVConfig } from '../config';
import { roundTo } from '../filters';

export class HeadPoseModule implements CVModule<Map<string, HeadPose | null>> {
  readonly name = 'head-pose';

  private config: CVConfig | null = null;

  setConfig(config: CVConfig): void {
    this.config = config;
  }

  process(ctx: FrameContext): Map<string, HeadPose | null> {
    const config = this.config;
    if (!config) return new Map();

    const results = new Map<string, HeadPose | null>();

    for (const student of ctx.trackedStudents) {
      const analysis = ctx.studentAnalysis.get(student.trackingId);
      const lm = analysis?.landmarks;

      if (!lm || !lm.raw) {
        results.set(student.trackingId, null);
        continue;
      }

      // Yaw — nose tip offset from midpoint of cheeks
      const cheekMidX = (lm.leftCheek.x + lm.rightCheek.x) / 2;
      const cheekSpan = Math.abs(lm.leftCheek.x - lm.rightCheek.x);
      const yaw = cheekSpan > 0
        ? ((lm.noseTip.x - cheekMidX) / cheekSpan) * 90
        : 0;

      // Pitch — nose tip Y relative to forehead↔chin span
      const foreheadChinSpan = Math.abs(lm.forehead.y - lm.chin.y);
      const midY = (lm.forehead.y + lm.chin.y) / 2;
      const rawPitch = foreheadChinSpan > 0
        ? ((lm.noseTip.y - midY) / foreheadChinSpan) * 90
        : 0;
      // Calibration offset: nose tip naturally sits below face center
      const pitch = rawPitch - 12;

      // Roll — angle of the line connecting eye centres
      const dx = lm.rightEyeCenter.x - lm.leftEyeCenter.x;
      const dy = lm.rightEyeCenter.y - lm.leftEyeCenter.y;
      const roll = Math.atan2(dy, dx) * (180 / Math.PI);

      // Classify direction
      const direction = classifyDirection(yaw, pitch, config);

      const pose: HeadPose = {
        yaw: roundTo(yaw, 1),
        pitch: roundTo(pitch, 1),
        roll: roundTo(roll, 1),
        direction,
      };

      results.set(student.trackingId, pose);
      if (analysis) analysis.headPose = pose;
    }

    return results;
  }

  reset(): void {
    // Stateless
  }
}

function classifyDirection(yaw: number, pitch: number, config: CVConfig): HeadDirection {
  // Check pitch (vertical) first for strong deviations
  if (pitch < -config.headPitchThreshold) return 'up';
  if (pitch > config.headPitchThreshold) return 'down';
  if (yaw < -config.headYawThreshold) return 'left';
  if (yaw > config.headYawThreshold) return 'right';
  return 'forward';
}
