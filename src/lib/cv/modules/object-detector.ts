// ─── Module 9 — Object Detection ────────────────────────────────────────────
// COCO-SSD for phone/device detection. Runs async on a throttled interval.

import type { CVModule, ObjectDetection, DetectedObjectClass, FrameContext } from '../types';
import type { CVConfig } from '../config';

export class ObjectDetectorModule implements CVModule<ObjectDetection[]> {
  readonly name = 'object-detector';

  private config: CVConfig | null = null;
  private model: any = null;
  private initialized = false;
  private initializing = false;
  private lastDetectionTime = 0;
  private lastResults: ObjectDetection[] = [];

  setConfig(config: CVConfig): void {
    this.config = config;
  }

  async init(): Promise<void> {
    if (this.initialized || this.initializing) return;
    this.initializing = true;

    try {
      const loadScript = (src: string): Promise<void> => {
        return new Promise((resolve, reject) => {
          if (document.querySelector(`script[src="${src}"]`)) {
            resolve();
            return;
          }
          const script = document.createElement('script');
          script.src = src;
          script.onload = () => resolve();
          script.onerror = (err) => reject(err);
          document.head.appendChild(script);
        });
      };

      await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs');
      await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd');

      const cocoSsd = (window as any).cocoSsd;
      if (cocoSsd) {
        this.model = await cocoSsd.load();
        this.initialized = true;
        console.log('[ObjectDetector] COCO-SSD loaded');
      }
    } catch (e) {
      console.warn('[ObjectDetector] Failed to load TFJS/COCO-SSD:', e);
    } finally {
      this.initializing = false;
    }
  }

  process(ctx: FrameContext): ObjectDetection[] {
    // Return cached results — actual detection runs async via detectAsync()
    ctx.objectDetections = this.lastResults;
    return this.lastResults;
  }

  /** Run detection asynchronously (called from the pipeline on interval) */
  async detectAsync(video: HTMLVideoElement, timestamp: number): Promise<ObjectDetection[]> {
    const config = this.config;
    if (!config || !this.model) return this.lastResults;
    if (timestamp - this.lastDetectionTime < config.objectDetectionIntervalMs) return this.lastResults;

    this.lastDetectionTime = timestamp;

    try {
      const predictions = await this.model.detect(video);
      const detections: ObjectDetection[] = [];

      for (const pred of predictions) {
        const mapped = mapClass(pred.class);
        if (!mapped) continue;

        const normClass = pred.class.toLowerCase();
        const isForbidden = config.forbiddenObjects.includes(pred.class) ||
          normClass.includes('phone') ||
          normClass.includes('cell') ||
          normClass.includes('remote') ||
          normClass.includes('mobile') ||
          normClass.includes('tablet') ||
          pred.class === 'person';
        if (!isForbidden) continue;

        detections.push({
          class: mapped,
          rawClass: pred.class,
          confidence: pred.score,
          bbox: {
            x: pred.bbox[0],
            y: pred.bbox[1],
            width: pred.bbox[2],
            height: pred.bbox[3],
          },
          timestamp,
        });
      }

      this.lastResults = detections;
    } catch (err) {
      console.warn('[ObjectDetector] Detection error:', err);
    }

    return this.lastResults;
  }

  get isInitialized(): boolean {
    return this.initialized;
  }

  reset(): void {
    this.lastResults = [];
    this.lastDetectionTime = 0;
  }

  destroy(): void {
    this.model = null;
    this.initialized = false;
    this.lastResults = [];
  }
}

function mapClass(rawClass: string): DetectedObjectClass | null {
  const norm = rawClass.toLowerCase();
  if (norm.includes('phone') || norm.includes('cell') || norm.includes('remote') || norm.includes('mobile') || norm.includes('tablet') || norm.includes('device')) {
    return 'cell_phone';
  }
  switch (rawClass) {
    case 'cell phone': return 'cell_phone';
    case 'laptop': return 'laptop';
    case 'tablet': return 'tablet';
    case 'book': return 'book';
    case 'person': return 'person';
    default: return null;
  }
}
