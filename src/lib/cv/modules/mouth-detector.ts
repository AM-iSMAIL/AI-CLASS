// ─── Module 8 — Mouth Activity Detection ────────────────────────────────────
// MAR-based yawn/talking detection.

import type { CVModule, MouthState, FrameContext } from '../types';
import type { CVConfig } from '../config';
import { dist3D } from '../filters';

interface PerStudentMouthState {
  mouthOpenSince: number | null;
  isYawning: boolean;
}

export class MouthDetectorModule implements CVModule<Map<string, MouthState | null>> {
  readonly name = 'mouth-detector';

  private config: CVConfig | null = null;
  private state = new Map<string, PerStudentMouthState>();

  setConfig(config: CVConfig): void {
    this.config = config;
  }

  private getState(trackingId: string): PerStudentMouthState {
    let s = this.state.get(trackingId);
    if (!s) {
      s = { mouthOpenSince: null, isYawning: false };
      this.state.set(trackingId, s);
    }
    return s;
  }

  process(ctx: FrameContext): Map<string, MouthState | null> {
    const config = this.config;
    if (!config) return new Map();

    const results = new Map<string, MouthState | null>();
    const now = ctx.timestamp;

    for (const student of ctx.trackedStudents) {
      const analysis = ctx.studentAnalysis.get(student.trackingId);
      const lm = analysis?.landmarks;

      if (!lm || !lm.faceComplete) {
        results.set(student.trackingId, null);
        continue;
      }

      const s = this.getState(student.trackingId);

      // Calculate Mouth Aspect Ratio
      const vertical = dist3D(lm.mouthTop, lm.mouthBottom);
      const horizontal = dist3D(lm.mouthLeft, lm.mouthRight);
      const mar = horizontal > 0 ? vertical / horizontal : 0;

      // Yawn detection (sustained opening)
      if (mar > config.marYawnThreshold) {
        if (s.mouthOpenSince === null) s.mouthOpenSince = now;
        if (now - s.mouthOpenSince > config.yawnMinDurationMs) {
          s.isYawning = true;
        }
      } else {
        s.mouthOpenSince = null;
        s.isYawning = false;
      }

      // Talking detection (moderate opening, not yawning)
      const isTalking = !s.isYawning && mar > config.marTalkingThreshold;

      // Mouth covered detection
      // ponytail: heuristic — if face is complete but mouth landmarks are
      // extremely close together, something may be covering the mouth.
      // Upgrade path: dedicated hand-over-face detector.
      const mouthCovered = lm.faceComplete && horizontal < 0.01;

      const mouth: MouthState = {
        mar: Math.round(mar * 1000) / 1000,
        isYawning: s.isYawning,
        isTalking,
        mouthCovered,
      };

      results.set(student.trackingId, mouth);
      if (analysis) analysis.mouth = mouth;
    }

    return results;
  }

  reset(): void {
    this.state.clear();
  }
}
