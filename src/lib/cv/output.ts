// ─── Module 17 — Decision Output ────────────────────────────────────────────
// Transforms internal StudentRecord structures into the clean CVOutput contract.
// The CV layer only reports facts; it never executes punishments directly.

import type { StudentRecord } from './store';
import type { CVOutput } from './types';

export function transformToOutput(record: StudentRecord, timestamp: number): CVOutput {
  const analysis = record.analysis;

  const phoneDetected = record.violations.some(
    v => v.type === 'phone_usage' || v.type === 'device_usage'
  );

  return {
    studentId: record.studentId || '',
    trackingId: record.trackingId,
    verified: analysis.verification?.status === 'verified',
    focusScore: analysis.focus?.score ?? 0,
    currentState: analysis.state?.state ?? 'absent',
    behavior: analysis.behavior?.current ?? 'distracted',
    gazeDirection: analysis.gaze?.direction ?? 'unknown',
    headPose: analysis.headPose,
    blinkState: analysis.blink,
    mouthState: analysis.mouth,
    presence: analysis.presence?.status ?? 'absent',
    phoneDetected,
    violations: [...record.violations],
    evidence: [...record.evidence],
    attentionHistory: [...record.memory.focusHistory],
    timestamp,
  };
}
