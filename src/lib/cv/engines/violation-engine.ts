// ─── Module 15 — Violation Engine ──────────────────────────────────────────
// Generates structured violations ONLY after temporal confirmation.
// Manages active violation lifecycles and appends completed/active violations to records.

import type { CVModule, Violation, ViolationType, ViolationSeverity, FrameContext } from '../types';
import type { CVConfig } from '../config';

interface ActiveViolationState {
  type: ViolationType;
  startedAt: number;
  lastSeenAt: number;
  severity: ViolationSeverity;
  reason: string;
  confirmed: boolean;
}

export class ViolationEngine implements CVModule<Map<string, Violation[]>> {
  readonly name = 'violation-engine';

  private config: CVConfig | null = null;
  // Map of student trackingId -> Map of ViolationType -> ActiveViolationState
  private activeViolations = new Map<string, Map<ViolationType, ActiveViolationState>>();
  // Map of student trackingId -> Array of completed/saved Violations
  private confirmedViolations = new Map<string, Violation[]>();

  setConfig(config: CVConfig): void {
    this.config = config;
  }

  process(ctx: FrameContext): Map<string, Violation[]> {
    const config = this.config;
    if (!config) return new Map();

    const results = new Map<string, Violation[]>();
    const now = ctx.timestamp;

    for (const student of ctx.trackedStudents) {
      const analysis = ctx.studentAnalysis.get(student.trackingId);
      if (!analysis) continue;

      let studentActives = this.activeViolations.get(student.trackingId);
      if (!studentActives) {
        studentActives = new Map<ViolationType, ActiveViolationState>();
        this.activeViolations.set(student.trackingId, studentActives);
      }

      let studentConfirmed = this.confirmedViolations.get(student.trackingId);
      if (!studentConfirmed) {
        studentConfirmed = [];
        this.confirmedViolations.set(student.trackingId, studentConfirmed);
      }

      // Check current frame conditions for potential violations
      const conditions = checkViolationConditions(analysis, ctx, config);

      // ── Process Active Conditions ──
      for (const [vType, cond] of Object.entries(conditions)) {
        const type = vType as ViolationType;

        if (cond.active) {
          let active = studentActives.get(type);
          if (!active) {
            // Start tracking a potential violation
            active = {
              type,
              startedAt: now,
              lastSeenAt: now,
              severity: cond.severity,
              reason: cond.reason,
              confirmed: false,
            };
            studentActives.set(type, active);
          } else {
            // Update last seen
            active.lastSeenAt = now;
          }

          // Check if temporal confirmation threshold has been reached
          const duration = now - active.startedAt;
          if (duration >= config.violationMinDurationMs && !active.confirmed) {
            active.confirmed = true;

            // Generate verified violation and add it to the student record
            const newViolation: Violation = {
              id: `${student.trackingId}_${type}_${now}`,
              type,
              confidence: 0.9,
              duration,
              timestamp: active.startedAt,
              studentId: student.studentId || '',
              trackingId: student.trackingId,
              evidenceId: null, // Will be set by Evidence Engine
              severity: active.severity,
              reason: active.reason,
            };

            studentConfirmed.push(newViolation);
            const record = ctx.store.get(student.trackingId);
            if (record) {
              record.memory.lastViolation = now;
            }
          } else if (active.confirmed) {
            // Update the duration of the already-confirmed active violation
            const existing = studentConfirmed.find(v => v.type === type && v.timestamp === active!.startedAt);
            if (existing) {
              existing.duration = duration;
            }
          }
        } else {
          // Condition is not active — if we were tracking it, remove it
          const active = studentActives.get(type);
          if (active) {
            studentActives.delete(type);
          }
        }
      }

      // Clean up orphaned active violations (not seen in the last 2 seconds)
      for (const [type, active] of studentActives.entries()) {
        if (now - active.lastSeenAt > 2000) {
          studentActives.delete(type);
        }
      }

      results.set(student.trackingId, studentConfirmed);
      analysis.violations = studentConfirmed;
      
      const record = ctx.store.get(student.trackingId);
      if (record) {
        record.violations = studentConfirmed;
      }
    }

    return results;
  }

  reset(): void {
    this.activeViolations.clear();
    this.confirmedViolations.clear();
  }
}

interface ConditionCheck {
  active: boolean;
  severity: ViolationSeverity;
  reason: string;
}

function checkViolationConditions(
  analysis: import('../types').StudentAnalysis,
  ctx: FrameContext,
  config: CVConfig,
): Record<ViolationType, ConditionCheck> {
  const presence = analysis.presence?.status;
  const state = analysis.state?.state;
  const behavior = analysis.behavior?.current;

  const phoneDetected = ctx.objectDetections.some(
    d => d.class === 'cell_phone' || d.class === 'tablet',
  );

  const personCount = ctx.objectDetections.filter(d => d.class === 'person').length;

  return {
    device_usage: {
      active: phoneDetected,
      severity: 'critical',
      reason: 'Prohibited electronic device usage detected in camera frame.',
    },
    phone_usage: {
      active: phoneDetected, // Backwards compatibility / redundancy check
      severity: 'critical',
      reason: 'Prohibited electronic device usage detected in camera frame.',
    },
    prolonged_absence: {
      active: presence === 'absent' || presence === 'left_seat',
      severity: 'high',
      reason: 'Student left their seat or is absent from camera view.',
    },
    sleeping: {
      active: state === 'sleeping' || behavior === 'sleeping',
      severity: 'high',
      reason: 'Student appears to have eyes closed or is falling asleep.',
    },
    camera_blocked: {
      active: presence === 'camera_blocked',
      severity: 'high',
      reason: 'Webcam feed is fully covered or blocked.',
    },
    impersonation: {
      active: state === 'verification_failed',
      severity: 'critical',
      reason: 'Student identity could not be verified / possible impersonation.',
    },
    multiple_people: {
      active: personCount > 1,
      severity: 'high',
      reason: 'Multiple people detected in the camera frame.',
    },
    // pony-tail: keep track of general distraction
    sustained_distraction: {
      active: state === 'distracted' || state === 'looking_away',
      severity: 'medium',
      reason: 'Sustained distraction or looking away from the lecture.',
    },
  };
}
