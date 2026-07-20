// ─── Module 16 — Evidence Engine ────────────────────────────────────────────
// Captures full frame and cropped face base64 snapshots from the video element
// whenever a violation is generated. Bounded by config.maxEvidencePerStudent.

import type { CVModule, EvidenceSnapshot, FrameContext } from '../types';
import type { CVConfig } from '../config';

export class EvidenceEngine implements CVModule<Map<string, EvidenceSnapshot[]>> {
  readonly name = 'evidence-engine';

  private config: CVConfig | null = null;
  private offscreenCanvas: HTMLCanvasElement | null = null;

  setConfig(config: CVConfig): void {
    this.config = config;
  }

  process(ctx: FrameContext): Map<string, EvidenceSnapshot[]> {
    const config = this.config;
    if (!config || !ctx.store) return new Map();

    const results = new Map<string, EvidenceSnapshot[]>();

    for (const student of ctx.trackedStudents) {
      const analysis = ctx.studentAnalysis.get(student.trackingId);
      if (!analysis || !analysis.violations?.length) continue;

      const record = ctx.store.get(student.trackingId);
      if (!record) continue;

      // Locate violations that do not have an evidenceId assigned yet
      const pendingViolations = analysis.violations.filter(v => !v.evidenceId);
      if (!pendingViolations.length) continue;

      // Capture screenshots for this frame
      const { fullFrame, croppedFace } = captureSnapshots(
        ctx.videoElement,
        student.currentPosition,
        this.getCanvas()
      );

      for (const violation of pendingViolations) {
        const evidenceId = `ev_${student.trackingId}_${violation.type}_${ctx.timestamp}`;
        
        const evidence: EvidenceSnapshot = {
          id: evidenceId,
          timestamp: ctx.timestamp,
          croppedFace,
          fullFrame,
          focusScore: analysis.focus?.score ?? 100,
          headPose: analysis.headPose,
          gazeDirection: analysis.gaze?.direction ?? 'unknown',
          phoneDetected: violation.type === 'phone_usage' || violation.type === 'device_usage',
          trackingId: student.trackingId,
          studentId: student.studentId || '',
        };

        record.evidence.push(evidence);
        if (record.evidence.length > config.maxEvidencePerStudent) {
          record.evidence.shift();
        }

        // Link the violation to this evidence
        violation.evidenceId = evidenceId;
      }

      results.set(student.trackingId, record.evidence);
      analysis.evidence = record.evidence;
    }

    return results;
  }

  private getCanvas(): HTMLCanvasElement {
    if (typeof window === 'undefined') {
      return {} as HTMLCanvasElement;
    }
    if (!this.offscreenCanvas) {
      this.offscreenCanvas = document.createElement('canvas');
    }
    return this.offscreenCanvas;
  }

  reset(): void {
    this.offscreenCanvas = null;
  }
}

// ─── Capture Helpers ────────────────────────────────────────────────────────

function captureSnapshots(
  video: HTMLVideoElement,
  bbox: import('../types').BoundingBox,
  canvas: HTMLCanvasElement
): { fullFrame: string | null; croppedFace: string | null } {
  if (typeof window === 'undefined' || !video || !canvas) {
    return { fullFrame: null, croppedFace: null };
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) return { fullFrame: null, croppedFace: null };

  const videoWidth = video.videoWidth || 640;
  const videoHeight = video.videoHeight || 480;

  // 1. Capture Full Frame (compressed to keep memory usage low)
  canvas.width = 320;
  canvas.height = 240;
  ctx.drawImage(video, 0, 0, 320, 240);
  const fullFrame = canvas.toDataURL('image/jpeg', 0.5);

  // 2. Capture Cropped Face Bounding Box
  let croppedFace: string | null = null;
  try {
    // Bbox is normalized (0–1). Denormalize it to video pixel size.
    const x = Math.max(0, bbox.x * videoWidth);
    const y = Math.max(0, bbox.y * videoHeight);
    const w = Math.min(videoWidth - x, bbox.width * videoWidth);
    const h = Math.min(videoHeight - y, bbox.height * videoHeight);

    if (w > 5 && h > 5) {
      canvas.width = 96;
      canvas.height = 96;
      ctx.drawImage(video, x, y, w, h, 0, 0, 96, 96);
      croppedFace = canvas.toDataURL('image/jpeg', 0.6);
    }
  } catch (err) {
    console.warn('[EvidenceEngine] Failed to crop face snapshot:', err);
  }

  return { fullFrame, croppedFace };
}
