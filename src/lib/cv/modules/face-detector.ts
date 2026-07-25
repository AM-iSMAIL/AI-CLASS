// ─── Module 1 — Face Detection ──────────────────────────────────────────────
// Wraps MediaPipe FaceMesh. Returns DetectedFace[] with bounding boxes.

import type { CVModule, DetectedFace, FrameContext, Point3D, BoundingBox } from '../types';
import type { CVConfig } from '../config';

export class FaceDetectorModule implements CVModule<DetectedFace[]> {
  readonly name = 'face-detector';

  private faceMesh: any = null;
  private pendingResults: any = null;
  private initialized = false;
  private initializing = false;

  async init(config: CVConfig): Promise<void> {
    if (this.initialized || this.initializing) return;
    this.initializing = true;

    try {
      const faceMeshMod = await import('@mediapipe/face_mesh');
      const FaceMeshConstructor = faceMeshMod.FaceMesh || (globalThis as any).FaceMesh;

      this.faceMesh = new FaceMeshConstructor({
        locateFile: (file: string) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
      });

      this.faceMesh.setOptions({
        maxNumFaces: config.maxNumFaces,
        refineLandmarks: true,
        minDetectionConfidence: config.minDetectionConfidence,
        minTrackingConfidence: config.minTrackingConfidence,
      });

      this.faceMesh.onResults((results: any) => {
        this.pendingResults = results;
      });

      this.initialized = true;
    } catch (err) {
      console.error('[FaceDetector] Failed to initialize MediaPipe:', err);
    } finally {
      this.initializing = false;
    }
  }

  /** Send a frame to MediaPipe for processing */
  async sendFrame(video: HTMLVideoElement): Promise<void> {
    if (!this.faceMesh || !this.initialized) return;
    if (!video || video.readyState < 2 || video.paused || video.ended || video.videoWidth === 0) return;
    try {
      await this.faceMesh.send({ image: video });
    } catch (err) {
      console.warn('[FaceDetector] Frame send error:', err);
    }
  }

  process(ctx: FrameContext): DetectedFace[] {
    const results = this.pendingResults;
    if (!results?.multiFaceLandmarks?.length) {
      ctx.faceLandmarks = null;
      ctx.detectedFaces = [];
      return [];
    }

    const now = ctx.timestamp;
    const faces: DetectedFace[] = [];
    const allLandmarks: Point3D[][] = [];

    for (let i = 0; i < results.multiFaceLandmarks.length; i++) {
      const rawLm = results.multiFaceLandmarks[i];
      const landmarks: Point3D[] = rawLm.map((p: any) => ({
        x: p.x,
        y: p.y,
        z: p.z ?? 0,
      }));

      allLandmarks.push(landmarks);

      const bbox = computeBoundingBox(landmarks);
      const confidence = rawLm.length >= 468 ? 0.95 : 0.7; // ponytail: rough proxy; MediaPipe doesn't expose detection confidence per-face

      faces.push({
        index: i,
        bbox,
        confidence,
        timestamp: now,
        landmarks,
      });
    }

    ctx.faceLandmarks = allLandmarks;
    ctx.detectedFaces = faces;
    return faces;
  }

  reset(): void {
    this.pendingResults = null;
  }

  destroy(): void {
    if (this.faceMesh) {
      try { this.faceMesh.close(); } catch { /* ignore */ }
      this.faceMesh = null;
    }
    this.initialized = false;
    this.pendingResults = null;
  }

  get isInitialized(): boolean {
    return this.initialized;
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function computeBoundingBox(landmarks: Point3D[]): BoundingBox {
  let minX = 1, minY = 1, maxX = 0, maxY = 0;
  for (const p of landmarks) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}
