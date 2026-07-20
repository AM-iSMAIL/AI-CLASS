// ─── Module 14 — Memory Engine ──────────────────────────────────────────────
// Appends per-frame metrics to the persistent student history in StudentStateStore.
// Constrains memory sizes to config.memoryHistorySize to prevent memory leaks/bloat.

import type { CVModule, FrameContext, PresenceStatus } from '../types';
import type { CVConfig } from '../config';

export class MemoryEngine implements CVModule<void> {
  readonly name = 'memory-engine';

  private config: CVConfig | null = null;

  setConfig(config: CVConfig): void {
    this.config = config;
  }

  process(ctx: FrameContext): void {
    const config = this.config;
    if (!config || !ctx.store) return;

    const now = ctx.timestamp;

    for (const student of ctx.trackedStudents) {
      const record = ctx.store.getOrCreate(student.trackingId);
      const analysis = ctx.studentAnalysis.get(student.trackingId);
      if (!analysis) continue;

      const memory = record.memory;
      const limit = config.memoryHistorySize;

      // Update last activity
      if (student.visibility === 'visible') {
        memory.lastActivity = now;
      }

      // 1. Focus History
      if (analysis.focus) {
        memory.focusHistory.push(analysis.focus.score);
        if (memory.focusHistory.length > limit) memory.focusHistory.shift();
      }

      // 2. Gaze History
      if (analysis.gaze) {
        memory.gazeHistory.push({
          yaw: analysis.gaze.combined.yaw,
          pitch: analysis.gaze.combined.pitch,
          t: now,
        });
        if (memory.gazeHistory.length > limit) memory.gazeHistory.shift();
      }

      // 3. Head Pose History
      if (analysis.headPose) {
        memory.headPoseHistory.push({
          yaw: analysis.headPose.yaw,
          pitch: analysis.headPose.pitch,
          roll: analysis.headPose.roll,
          t: now,
        });
        if (memory.headPoseHistory.length > limit) memory.headPoseHistory.shift();
      }

      // 4. Phone History
      const phoneDetected = ctx.objectDetections.some(
        d => d.class === 'cell_phone' || d.class === 'tablet' || d.class === 'laptop',
      );
      memory.phoneHistory.push({
        detected: phoneDetected,
        t: now,
      });
      if (memory.phoneHistory.length > limit) memory.phoneHistory.shift();

      // 5. Absence History
      if (analysis.presence) {
        const currentStatus = analysis.presence.status;
        const lastAbsence = memory.absenceHistory[memory.absenceHistory.length - 1];

        if (currentStatus !== 'present') {
          if (!lastAbsence || lastAbsence.to < now - 5000 || lastAbsence.status !== currentStatus) {
            // Start a new absence block
            memory.absenceHistory.push({
              status: currentStatus,
              from: now,
              to: now,
            });
          } else {
            // Extend current absence block
            lastAbsence.to = now;
          }
        }
        if (memory.absenceHistory.length > limit) memory.absenceHistory.shift();
      }
    }
  }

  reset(): void {
    // Stateless
  }
}
