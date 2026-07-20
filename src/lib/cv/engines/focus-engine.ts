// ─── Module 12 — Focus Score Engine ─────────────────────────────────────────
// Generates a smoothed 0–100 focus score from weighted signal combination.

import type { CVModule, FocusScore, FrameContext } from '../types';
import type { CVConfig } from '../config';
import { EMAFilter, RollingWindow, clamp } from '../filters';

interface PerStudentFocusState {
  ema: EMAFilter;
  history: RollingWindow<number>;
  lowScoreSince: number | null;
}

export class FocusEngine implements CVModule<Map<string, FocusScore>> {
  readonly name = 'focus-engine';

  private config: CVConfig | null = null;
  private state = new Map<string, PerStudentFocusState>();

  setConfig(config: CVConfig): void {
    this.config = config;
  }

  private getState(trackingId: string): PerStudentFocusState {
    let s = this.state.get(trackingId);
    if (!s) {
      const c = this.config!;
      s = {
        ema: new EMAFilter(c.emaAlpha, 100),
        history: new RollingWindow<number>(c.historySize),
        lowScoreSince: null,
      };
      this.state.set(trackingId, s);
    }
    return s;
  }

  process(ctx: FrameContext): Map<string, FocusScore> {
    const config = this.config;
    if (!config) return new Map();

    const results = new Map<string, FocusScore>();
    const now = ctx.timestamp;

    for (const student of ctx.trackedStudents) {
      const analysis = ctx.studentAnalysis.get(student.trackingId);
      const s = this.getState(student.trackingId);

      // ── Compute raw score from components ──
      const components = computeComponents(analysis, ctx, config);
      let raw = computeRawScore(analysis, config);

      // ── Effective deviation ──
      const headPose = analysis?.headPose;
      const gaze = analysis?.gaze;
      const effectiveYaw = (headPose?.yaw ?? 0) + (gaze?.combined.yaw ?? 0);
      const effectivePitch = (headPose?.pitch ?? 0) + (gaze?.combined.pitch ?? 0);
      const effectiveDeviation = Math.sqrt(effectiveYaw ** 2 + effectivePitch ** 2);

      // If face is absent/occluded, drop score instantly to 0 and clear history (prevent keyboard phone cheats)
      const presenceStatus = analysis?.presence?.status;
      const isAbsent = !presenceStatus || presenceStatus === 'absent' || presenceStatus === 'no_face' || presenceStatus === 'left_seat' || presenceStatus === 'camera_blocked' || presenceStatus === 'partial_face';

      let smoothed = 0;
      if (isAbsent) {
        smoothed = 0;
        s.ema.reset();
        s.history.clear();
      } else {
        // ── EMA smoothing ──
        const emaValue = s.ema.filter(raw);

        // ── History averaging ──
        s.history.push(emaValue);
        smoothed = Math.round(s.history.average());
      }

      // ── Sustained distraction decay ──
      if (smoothed < config.sustainScoreThreshold) {
        if (s.lowScoreSince === null) {
          s.lowScoreSince = now;
        } else {
          const sustained = now - s.lowScoreSince;
          if (sustained > config.sustainTimeMs) {
            const extraDecay = Math.floor(
              (sustained - config.sustainTimeMs) / 1000
            ) * config.sustainDecayPerSec;
            smoothed = Math.max(0, smoothed - extraDecay);
          }
        }
      } else {
        s.lowScoreSince = null;
      }

      const focus: FocusScore = {
        score: clamp(smoothed, 0, 100),
        raw: clamp(Math.round(raw), 0, 100),
        effectiveDeviation: Math.round(effectiveDeviation * 10) / 10,
        components,
      };

      results.set(student.trackingId, focus);
      if (analysis) analysis.focus = focus;
    }

    return results;
  }

  reset(): void {
    this.state.clear();
  }
}

function computeRawScore(
  analysis: import('../types').StudentAnalysis | undefined,
  config: CVConfig,
): number {
  if (!analysis) return 0;

  const presence = analysis.presence;
  const blink = analysis.blink;
  const headPose = analysis.headPose;
  const gaze = analysis.gaze;
  const mouth = analysis.mouth;

  // No face / not present / partial face
  if (!presence || presence.status === 'absent' || presence.status === 'no_face' || presence.status === 'partial_face') return 0;
  if (presence.status === 'camera_blocked') return 0;

  // Eyes closed + drowsy
  if (blink && !blink.eyesOpen && blink.isDrowsy) return 15;

  let score = 100;

  // ── Head-Gaze Fusion (signed addition for compensation) ──
  const effectiveYaw = (headPose?.yaw ?? 0) + (gaze?.combined.yaw ?? 0);
  const effectivePitch = (headPose?.pitch ?? 0) + (gaze?.combined.pitch ?? 0);
  const effectiveDeviation = Math.sqrt(effectiveYaw ** 2 + effectivePitch ** 2);

  if (effectiveDeviation > config.deviationDeadZone) {
    const excess = effectiveDeviation - config.deviationDeadZone;
    score -= Math.round(excess * config.deviationPenaltyPerDeg);
  }

  // Roll penalty
  if (headPose && Math.abs(headPose.roll) > config.rollThreshold) {
    score -= config.rollPenalty;
  }

  // Yawn penalty
  if (mouth?.isYawning) score -= config.yawnPenalty;

  // High blink-rate fatigue penalty
  if (blink && blink.blinkRate > config.blinkRateFatigueThreshold) {
    score -= config.blinkFatiguePenalty;
  }

  // Iris engagement bonus/penalty (±5 points)
  if (gaze) {
    const delta = Math.round((gaze.irisEngagement - 50) / config.irisEngagementDivisor);
    score += delta;
  }

  return clamp(Math.round(score), 0, 100);
}

function computeComponents(
  analysis: import('../types').StudentAnalysis | undefined,
  ctx: FrameContext,
  config: CVConfig,
): FocusScore['components'] {
  if (!analysis) {
    return { gaze: 0, headPose: 0, presence: 0, phoneDetection: 100, behaviorHistory: 0, recentAttention: 0 };
  }

  // Gaze component (100 = looking at lecture, 0 = fully away)
  let gazeScore = 100;
  if (analysis.gaze) {
    const dev = Math.sqrt(analysis.gaze.combined.yaw ** 2 + analysis.gaze.combined.pitch ** 2);
    gazeScore = clamp(100 - dev * 3, 0, 100);
  }

  // Head pose component
  let headScore = 100;
  if (analysis.headPose) {
    const dev = Math.sqrt(analysis.headPose.yaw ** 2 + analysis.headPose.pitch ** 2);
    headScore = clamp(100 - dev * 2, 0, 100);
  }

  // Presence component
  const presenceScore = analysis.presence?.status === 'present' ? 100 : 0;

  // Phone detection component (100 = no phone, 0 = phone detected)
  const phoneDetected = ctx.objectDetections.some(
    d => d.class === 'cell_phone' || d.class === 'tablet' || d.class === 'laptop',
  );
  const phoneScore = phoneDetected ? 0 : 100;

  // Behavior history component
  const behaviorScore = analysis.behavior?.current === 'focused' ? 100
    : analysis.behavior?.current === 'distracted' ? 40
    : 0;

  // Recent attention (based on focus score history — uses 100 as default)
  const recentScore = analysis.focus?.score ?? 100;

  return {
    gaze: Math.round(gazeScore),
    headPose: Math.round(headScore),
    presence: Math.round(presenceScore),
    phoneDetection: Math.round(phoneScore),
    behaviorHistory: Math.round(behaviorScore),
    recentAttention: Math.round(recentScore),
  };
}
