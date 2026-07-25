// ─── Neuro Class AI — Frame Source ──────────────────────────────────────────
// Handles starting, stopping, and reusing existing webcam feeds without duplicate calls.

import type { CVConfig } from './config';

export class FrameSource {
  private activeStream: MediaStream | null = null;
  private cameraInstance: any = null;
  private isCancelled = false;

  constructor(
    private videoElement: HTMLVideoElement,
    private config: CVConfig
  ) {}

  async start(onFrameCallback: () => Promise<void>): Promise<MediaStream | null> {
    this.isCancelled = false;

    // 1. If videoElement already has an active stream, reuse it and start the loop
    if (this.videoElement.srcObject instanceof MediaStream) {
      console.log('[FrameSource] Reusing existing MediaStream from video element');
      this.activeStream = this.videoElement.srcObject;
      this.startFallbackLoop(onFrameCallback);
      return this.activeStream;
    }

    // 2. Otherwise request a new stream
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: this.config.captureWidth },
          height: { ideal: this.config.captureHeight },
          facingMode: 'user',
        },
        audio: false,
      });

      if (this.isCancelled) {
        stream.getTracks().forEach((track) => track.stop());
        throw new Error('FrameSource start cancelled');
      }

      this.activeStream = stream;
      this.videoElement.srcObject = stream;
      this.videoElement.setAttribute('playsinline', 'true');
      this.videoElement.setAttribute('webkit-playsinline', 'true');
      this.videoElement.muted = true;
      this.videoElement.play().catch(() => {});

      // Try to initialize MediaPipe Camera helper
      try {
        const cameraUtilsMod = await import('@mediapipe/camera_utils');
        const CameraConstructor = cameraUtilsMod.Camera || (window as any).Camera;

        this.cameraInstance = new CameraConstructor(this.videoElement, {
          onFrame: async () => {
            if (this.isCancelled) return;
            await onFrameCallback();
          },
          width: this.config.captureWidth,
          height: this.config.captureHeight,
        });

        this.cameraInstance.start();
        return stream;
      } catch (err) {
        console.error('[FrameSource] Failed to initialise MediaPipe Camera helper:', err);
        this.startFallbackLoop(onFrameCallback);
      }

      return stream;
    } catch (err) {
      console.error('[FrameSource] Failed to get user media:', err);
      throw err;
    }
  }

  private startFallbackLoop(callback: () => Promise<void>): void {
    let isProcessing = false;
    const loop = async () => {
      if (this.isCancelled) return;
      if (this.videoElement && this.videoElement.readyState >= 2) {
        if (!isProcessing) {
          isProcessing = true;
          try {
            await callback();
          } catch (err) {
            console.warn('[FrameSource] Frame callback execution error:', err);
          } finally {
            isProcessing = false;
          }
        }
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  stop(): void {
    this.isCancelled = true;
    if (this.cameraInstance) {
      try {
        this.cameraInstance.stop();
      } catch {
        /* ignore */
      }
      this.cameraInstance = null;
    }
    // Only stop tracks if they were created by this FrameSource instance
    // to avoid stopping a stream owned by another component
    if (this.activeStream && !this.videoElement.srcObject) {
      this.activeStream.getTracks().forEach((track) => track.stop());
    }
    this.activeStream = null;
  }
}
