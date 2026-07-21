// ─── Module 11 — Behavior Analysis Engine ───────────────────────────────────
// Temporal behavior classification. NEVER classifies from a single frame.

import type { CVModule, BehaviorState, BehaviorLabel, FrameContext } from '../types';
import type { CVConfig } from '../config';
import { RollingWindow } from '../filters';

interface BehaviorSnapshot {
  label: BehaviorLabel;
  t: number;
}

interface PerStudentBehavior {
  history: RollingWindow<BehaviorSnapshot>;
  current: BehaviorLabel;
  since: number;
  previous: BehaviorLabel | null;
  /** Candidate label being considered (needs dwell time before committing) */
  candidate: BehaviorLabel | null;
  candidateSince: number;
}

export class BehaviorEngine implements CVModule<Map<string, BehaviorState>> {
  readonly name = 'behavior-engine';

  private config: CVConfig | null = null;
  private state = new Map<string, PerStudentBehavior>();

  setConfig(config: CVConfig): void {
    this.config = config;
  }

  private getState(trackingId: string, now: number): PerStudentBehavior {
    let s = this.state.get(trackingId);
    if (!s) {
      s = {
        history: new RollingWindow<BehaviorSnapshot>(100),
        current: 'focused',
        since: now,
        previous: null,
        candidate: null,
        candidateSince: 0,
      };
      this.state.set(trackingId, s);
    }
    return s;
  }

  process(ctx: FrameContext): Map<string, BehaviorState> {
    const config = this.config;
    if (!config) return new Map();

    const results = new Map<string, BehaviorState>();
    const now = ctx.timestamp;

    for (const student of ctx.trackedStudents) {
      const analysis = ctx.studentAnalysis.get(student.trackingId);
      const s = this.getState(student.trackingId, now);

      // ── Infer instantaneous behavior from current detections ──
      const instantLabel = inferInstantBehavior(analysis, ctx);

      // ── Temporal gating: don't switch until dwell time met ──
      if (instantLabel !== s.current) {
        if (s.candidate === instantLabel) {
          // Same candidate — check dwell time
          if (now - s.candidateSince >= config.behaviorMinDwellMs) {
            // Commit transition
            s.previous = s.current;
            s.current = instantLabel;
            s.since = now;
            s.candidate = null;
          }
        } else {
          // New candidate
          s.candidate = instantLabel;
          s.candidateSince = now;
        }
      } else {
        // Matches current — reset candidate
        s.candidate = null;
      }

      s.history.push({ label: s.current, t: now });

      // Compute confidence based on how consistently this behavior has been observed
      const recentWindow = 5_000; // last 5 seconds
      const recentEntries = s.history.values.filter(
        (e) => now - e.t < recentWindow
      );
      const matchCount = recentEntries.filter(
        (e) => e.label === s.current
      ).length;
      const confidence = recentEntries.length > 0
        ? matchCount / recentEntries.length
        : 0.5;

      const behavior: BehaviorState = {
        current: s.current,
        confidence: Math.round(confidence * 100) / 100,
        since: s.since,
        duration: now - s.since,
        previous: s.previous,
      };

      results.set(student.trackingId, behavior);
      if (analysis) analysis.behavior = behavior;
    }

    return results;
  }

  reset(): void {
    this.state.clear();
  }
}

function inferInstantBehavior(
  analysis: import('../types').StudentAnalysis | undefined,
  ctx: FrameContext,
): BehaviorLabel {
  if (!analysis) return 'focused';

  const presence = analysis.presence;
  const blink = analysis.blink;
  const gaze = analysis.gaze;
  const mouth = analysis.mouth;
  const headPose = analysis.headPose;

  // Check presence-based states first
  if (presence?.status === 'camera_blocked') return 'camera_covered';
  if (presence?.status === 'absent' || presence?.status === 'left_seat') return 'left_seat';

  // Check for multiple people
  const personCount = ctx.objectDetections.filter(d => d.class === 'person').length;
  if (personCount > 1) return 'multiple_people';

  // Phone detection
  const phoneDetected = ctx.objectDetections.some(
    d => d.class === 'cell_phone' || d.class === 'tablet',
  );
  if (phoneDetected) return 'phone_usage';

  // Sleeping (eyes closed + drowsy)
  if (blink && !blink.eyesOpen && blink.isDrowsy) return 'sleeping';

  // Looking away (strong gaze or head deviation)
  if (gaze?.target === 'away' || gaze?.target === 'second_monitor') return 'looking_away';
  if (headPose && (headPose.direction === 'left' || headPose.direction === 'right')) return 'looking_away';

  // Distracted (moderate deviation or yawning)
  if (mouth?.isYawning) return 'distracted';
  if (gaze?.target === 'downward') return 'reading_notes';

  // No face (should be caught by presence, but fallback)
  if (presence?.status === 'no_face' || presence?.status === 'partial_face') return 'distracted';

  return 'focused';
}
