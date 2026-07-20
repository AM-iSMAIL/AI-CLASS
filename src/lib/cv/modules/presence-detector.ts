// ─── Module 10 — Presence Detection ─────────────────────────────────────────
// Combines face detection, landmarks, and objects to determine presence status.

import type { CVModule, PresenceState, PresenceStatus, FrameContext } from '../types';
import type { CVConfig } from '../config';

interface PerStudentPresenceState {
  status: PresenceStatus;
  since: number;
}

export class PresenceDetectorModule implements CVModule<Map<string, PresenceState>> {
  readonly name = 'presence-detector';

  private config: CVConfig | null = null;
  private state = new Map<string, PerStudentPresenceState>();

  setConfig(config: CVConfig): void {
    this.config = config;
  }

  private getState(trackingId: string, now: number): PerStudentPresenceState {
    let s = this.state.get(trackingId);
    if (!s) {
      s = { status: 'present', since: now };
      this.state.set(trackingId, s);
    }
    return s;
  }

  process(ctx: FrameContext): Map<string, PresenceState> {
    const config = this.config;
    if (!config) return new Map();

    const results = new Map<string, PresenceState>();
    const now = ctx.timestamp;

    for (const student of ctx.trackedStudents) {
      const analysis = ctx.studentAnalysis.get(student.trackingId);
      const s = this.getState(student.trackingId, now);

      let newStatus: PresenceStatus;

      // Check if camera might be blocked (object detection)
      const cameraBlocked = ctx.objectDetections.some(
        d => d.class === 'hand_covering_camera',
      );

      if (cameraBlocked) {
        newStatus = 'camera_blocked';
      } else if (student.visibility === 'lost') {
        newStatus = 'absent';
      } else if (student.visibility === 'occluded') {
        // Face was previously seen but not in current frame
        const occludedDuration = now - student.lastSeen;
        if (occludedDuration > config.absentThresholdMs) {
          newStatus = 'left_seat';
        } else {
          newStatus = 'no_face';
        }
      } else if (student.faceIndex < 0) {
        newStatus = 'no_face';
      } else if (analysis?.landmarks && !analysis.landmarks.faceComplete) {
        newStatus = 'partial_face';
      } else if (analysis?.landmarks?.faceComplete) {
        newStatus = 'present';
      } else {
        newStatus = 'no_face';
      }

      // Update state tracking
      if (newStatus !== s.status) {
        s.status = newStatus;
        s.since = now;
      }

      const presence: PresenceState = {
        status: s.status,
        duration: now - s.since,
        since: s.since,
      };

      results.set(student.trackingId, presence);
      if (analysis) analysis.presence = presence;
    }

    return results;
  }

  reset(): void {
    this.state.clear();
  }
}
