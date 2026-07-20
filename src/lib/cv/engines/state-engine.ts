// ─── Module 13 — Student State Engine ────────────────────────────────────────
// Central state machine keeping track of the authoritative state per student.
// Transitions require temporal confirmation (based on stateTransitionMinMs).

import type { CVModule, StudentStateResult, StudentStateName, FrameContext } from '../types';
import type { CVConfig } from '../config';

interface PerStudentState {
  currentState: StudentStateName;
  since: number;
  candidateState: StudentStateName | null;
  candidateSince: number;
}

export class StateEngine implements CVModule<Map<string, StudentStateResult>> {
  readonly name = 'state-engine';

  private config: CVConfig | null = null;
  private states = new Map<string, PerStudentState>();

  setConfig(config: CVConfig): void {
    this.config = config;
  }

  private getState(trackingId: string, now: number): PerStudentState {
    let s = this.states.get(trackingId);
    if (!s) {
      s = {
        currentState: 'focused',
        since: now,
        candidateState: null,
        candidateSince: 0,
      };
      this.states.set(trackingId, s);
    }
    return s;
  }

  process(ctx: FrameContext): Map<string, StudentStateResult> {
    const config = this.config;
    if (!config) return new Map();

    const results = new Map<string, StudentStateResult>();
    const now = ctx.timestamp;

    for (const student of ctx.trackedStudents) {
      const analysis = ctx.studentAnalysis.get(student.trackingId);
      const s = this.getState(student.trackingId, now);

      // Determine the instantaneous candidate state based on current behavior/presence/focus
      const instantState = determineInstantState(analysis, ctx);

      // Apply temporal confirmation filter before committing to state transition
      if (instantState !== s.currentState) {
        if (s.candidateState === instantState) {
          const durationInCandidate = now - s.candidateSince;
          // Fast-track transition to critical states (absent, camera_blocked, phone_usage) to block keyboard cheating
          const transitionThreshold = (instantState === 'absent' || instantState === 'camera_blocked' || instantState === 'phone_usage')
            ? Math.min(400, config.stateTransitionMinMs)
            : config.stateTransitionMinMs;

          if (durationInCandidate >= transitionThreshold) {
            // Commit transition
            s.currentState = instantState;
            s.since = now;
            s.candidateState = null;
          }
        } else {
          s.candidateState = instantState;
          s.candidateSince = now;
        }
      } else {
        s.candidateState = null;
      }

      // Compute confidence score (heuristic based on duration/temporal confirmation)
      const duration = now - s.since;
      const confidence = Math.min(1.0, 0.5 + duration / 10_000);

      const stateResult: StudentStateResult = {
        state: s.currentState,
        confidence: Math.round(confidence * 100) / 100,
        since: s.since,
        duration,
      };

      results.set(student.trackingId, stateResult);
      if (analysis) analysis.state = stateResult;
    }

    return results;
  }

  reset(): void {
    this.states.clear();
  }
}

function determineInstantState(
  analysis: import('../types').StudentAnalysis | undefined,
  ctx: FrameContext,
): StudentStateName {
  if (!analysis) return 'absent';

  const presence = analysis.presence?.status;
  const behavior = analysis.behavior?.current;
  const verification = analysis.verification?.status;

  // 1. Critical overrides
  if (verification === 'verification_failed' || verification === 'possible_impersonation') {
    return 'verification_failed';
  }
  if (presence === 'camera_blocked') return 'camera_blocked';
  if (presence === 'absent' || presence === 'left_seat') return 'absent';
  if (behavior === 'multiple_people') return 'multiple_people';
  if (behavior === 'phone_usage') return 'phone_usage';
  if (behavior === 'sleeping') return 'sleeping';

  // 2. Behavior-based transitions
  if (behavior === 'looking_away') return 'looking_away';
  if (behavior === 'distracted') return 'distracted';

  // 3. Focus/Engagement-based states
  const score = analysis.focus?.score ?? 100;
  if (score < 40) return 'distracted';
  if (score < 70) return 'confused'; // Heuristic: mid-tier focus represents confusion/distraction

  // 4. Default states
  if (analysis.mouth?.isTalking) return 'listening'; // Or speaking, but mapped to 'listening' or 'focused'

  return 'focused';
}
