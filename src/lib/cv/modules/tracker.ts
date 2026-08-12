// ─── Module 2 — Multi-Person Tracker ────────────────────────────────────────
// Assigns stable IDs to detected faces across frames using IoU matching.

import type { CVModule, DetectedFace, TrackedStudent, FrameContext, BoundingBox, VisibilityState } from '../types';
import type { CVConfig } from '../config';

let nextTrackId = 1;

export class TrackerModule implements CVModule<TrackedStudent[]> {
  readonly name = 'tracker';

  private tracks: TrackedStudent[] = [];
  private config: CVConfig | null = null;

  setConfig(config: CVConfig): void {
    this.config = config;
  }

  process(ctx: FrameContext): TrackedStudent[] {
    const config = this.config;
    if (!config) return [];

    const now = ctx.timestamp;
    const faces = ctx.detectedFaces;

    if (faces.length === 0) {
      // Mark all tracks as lost if timeout exceeded
      for (const track of this.tracks) {
        if (track.visibility === 'visible') {
          track.visibility = 'occluded';
        }
        if (now - track.lastSeen > config.trackingLostTimeout) {
          track.visibility = 'lost';
        }
        track.faceIndex = -1;
      }
      // Remove fully lost tracks
      this.tracks = this.tracks.filter(t => t.visibility !== 'lost');
      ctx.trackedStudents = this.tracks;
      return this.tracks;
    }

    // ── Match faces to existing tracks via IoU ──
    const used = new Set<number>();
    const matched = new Set<string>();

    // Greedy matching: for each track, find the best IoU face
    for (const track of this.tracks) {
      let bestIoU = 0;
      let bestIdx = -1;

      for (let i = 0; i < faces.length; i++) {
        if (used.has(i)) continue;
        const iou = computeIoU(track.currentPosition, faces[i].bbox);
        if (iou > bestIoU) {
          bestIoU = iou;
          bestIdx = i;
        }
      }

      const isSingleTrackMatch = faces.length === 1 && this.tracks.length === 1 && bestIdx === 0;

      if (bestIdx >= 0 && (bestIoU >= config.trackingIoUThreshold || isSingleTrackMatch)) {
        // Matched — update track
        track.currentPosition = faces[bestIdx].bbox;
        track.lastSeen = now;
        track.visibility = 'visible';
        track.trackingConfidence = bestIoU;
        track.faceIndex = bestIdx;
        used.add(bestIdx);
        matched.add(track.trackingId);
      } else {
        // Not matched — mark occluded
        track.faceIndex = -1;
        if (track.visibility === 'visible') {
          track.visibility = 'occluded';
        }
        if (now - track.lastSeen > config.trackingLostTimeout) {
          track.visibility = 'lost';
        }
      }
    }

    // Remove fully lost tracks
    this.tracks = this.tracks.filter(t => t.visibility !== 'lost');

    // ── Create new tracks for unmatched faces ──
    for (let i = 0; i < faces.length; i++) {
      if (used.has(i)) continue;
      const face = faces[i];
      const trackingId = `track_${nextTrackId++}`;
      this.tracks.push({
        trackingId,
        studentId: null,
        firstSeen: now,
        lastSeen: now,
        currentPosition: face.bbox,
        visibility: 'visible' as VisibilityState,
        trackingConfidence: face.confidence,
        faceIndex: i,
      });
    }

    ctx.trackedStudents = this.tracks;
    return this.tracks;
  }

  /** Link a tracking ID to a student ID */
  linkStudent(trackingId: string, studentId: string): void {
    const track = this.tracks.find(t => t.trackingId === trackingId);
    if (track) track.studentId = studentId;
  }

  /** Get the primary (first/longest) tracked student */
  get primaryTrack(): TrackedStudent | null {
    return this.tracks.find(t => t.visibility === 'visible') ?? this.tracks[0] ?? null;
  }

  reset(): void {
    this.tracks = [];
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function computeIoU(a: BoundingBox, b: BoundingBox): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);

  if (x2 <= x1 || y2 <= y1) return 0;

  const intersection = (x2 - x1) * (y2 - y1);
  const areaA = a.width * a.height;
  const areaB = b.width * b.height;
  const union = areaA + areaB - intersection;

  return union > 0 ? intersection / union : 0;
}
