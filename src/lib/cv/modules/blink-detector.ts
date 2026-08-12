// ─── Module 7 — Blink Detection ─────────────────────────────────────────────
// EAR-based blink/drowsy detection with rolling blink rate.

import type { CVModule, BlinkState, BlinkStatus, FrameContext } from '../types';
import type { CVConfig } from '../config';
import { distByIndex } from '../filters';
import { LEFT_EYE_EAR, RIGHT_EYE_EAR } from './landmark-detector';

interface PerStudentBlinkState {
  eyeClosedSince: number | null;
  blinkTimestamps: number[];
}

export class BlinkDetectorModule implements CVModule<Map<string, BlinkState | null>> {
  readonly name = 'blink-detector';

  private config: CVConfig | null = null;
  private state = new Map<string, PerStudentBlinkState>();

  setConfig(config: CVConfig): void {
    this.config = config;
  }

  private getState(trackingId: string): PerStudentBlinkState {
    let s = this.state.get(trackingId);
    if (!s) {
      s = { eyeClosedSince: null, blinkTimestamps: [] };
      this.state.set(trackingId, s);
    }
    return s;
  }

  process(ctx: FrameContext): Map<string, BlinkState | null> {
    const config = this.config;
    if (!config) return new Map();

    const results = new Map<string, BlinkState | null>();
    const now = ctx.timestamp;

    for (const student of ctx.trackedStudents) {
      const analysis = ctx.studentAnalysis.get(student.trackingId);
      const lm = analysis?.landmarks;

      if (!lm || !lm.raw) {
        results.set(student.trackingId, null);
        continue;
      }

      const raw = lm.raw;
      const s = this.getState(student.trackingId);

      // Calculate EAR for each eye
      const leftEAR = singleEAR(raw, LEFT_EYE_EAR);
      const rightEAR = singleEAR(raw, RIGHT_EYE_EAR);
      const ear = (leftEAR + rightEAR) / 2;

      const rawClosed = ear < config.earClosedThreshold;

      let isDrowsy = false;
      let eyesOpen = true;
      let closureDuration = 0;

      if (rawClosed) {
        if (s.eyeClosedSince === null) {
          s.eyeClosedSince = now;
        }
        closureDuration = now - s.eyeClosedSince;

        if (closureDuration > config.blinkMaxDurationMs) {
          isDrowsy = true;
          eyesOpen = false;
        }
      } else {
        // Eyes reopened
        if (s.eyeClosedSince !== null) {
          const dur = now - s.eyeClosedSince;
          if (dur <= config.blinkMaxDurationMs) {
            s.blinkTimestamps.push(now);
          }
          s.eyeClosedSince = null;
        }
      }

      // Calculate blink rate (blinks per minute over last 60s)
      const oneMinAgo = now - 60_000;
      s.blinkTimestamps = s.blinkTimestamps.filter(t => t > oneMinAgo);
      const blinkRate = s.blinkTimestamps.length;

      // Classify status
      let status: BlinkStatus = 'normal';
      if (!eyesOpen && isDrowsy) status = 'eyes_closed';
      else if (blinkRate > config.blinkRateFatigueThreshold) status = 'sleepy';

      const blink: BlinkState = {
        eyesOpen,
        ear: Math.round(ear * 1000) / 1000,
        isDrowsy,
        blinkRate,
        closureDuration,
        status,
      };

      results.set(student.trackingId, blink);
      if (analysis) analysis.blink = blink;
    }

    return results;
  }

  reset(): void {
    this.state.clear();
  }
}

function singleEAR(lm: import('../types').Point3D[], pts: number[]): number {
  const v1 = distByIndex(lm, pts[1], pts[5]);
  const v2 = distByIndex(lm, pts[2], pts[4]);
  const h = distByIndex(lm, pts[0], pts[3]);
  return h > 0 ? (v1 + v2) / (2 * h) : 0;
}
