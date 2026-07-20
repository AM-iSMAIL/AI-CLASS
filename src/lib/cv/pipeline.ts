// ─── Neuro Class AI — Computer Vision Pipeline Orchestrator ────────────────
// Runs all detection modules and analysis engines sequentially on each frame.
// Gracefully handles errors to maintain pipeline stability.

import type { FrameContext, CVOutput, TrackedStudent } from './types';
import { DEFAULT_CV_CONFIG, type CVConfig } from './config';
import { StudentStateStore } from './store';
import { FaceDetectorModule } from './modules/face-detector';
import { TrackerModule } from './modules/tracker';
import { FaceVerifierModule } from './modules/face-verifier';
import { LandmarkDetectorModule } from './modules/landmark-detector';
import { HeadPoseModule } from './modules/head-pose';
import { GazeEstimatorModule } from './modules/gaze-estimator';
import { BlinkDetectorModule } from './modules/blink-detector';
import { MouthDetectorModule } from './modules/mouth-detector';
import { ObjectDetectorModule } from './modules/object-detector';
import { PresenceDetectorModule } from './modules/presence-detector';
import { BehaviorEngine } from './engines/behavior-engine';
import { FocusEngine } from './engines/focus-engine';
import { StateEngine } from './engines/state-engine';
import { MemoryEngine } from './engines/memory-engine';
import { ViolationEngine } from './engines/violation-engine';
import { EvidenceEngine } from './engines/evidence-engine';
import { transformToOutput } from './output';

export class CVPipeline {
  private config: CVConfig;
  private store = new StudentStateStore();

  // Detection Modules
  private faceDetector = new FaceDetectorModule();
  private tracker = new TrackerModule();
  private verifier = new FaceVerifierModule();
  private landmarkDetector = new LandmarkDetectorModule();
  private headPose = new HeadPoseModule();
  private gazeEstimator = new GazeEstimatorModule();
  private blinkDetector = new BlinkDetectorModule();
  private mouthDetector = new MouthDetectorModule();
  private objectDetector = new ObjectDetectorModule();
  private presenceDetector = new PresenceDetectorModule();

  // Analysis Engines
  private behaviorEngine = new BehaviorEngine();
  private focusEngine = new FocusEngine();
  private stateEngine = new StateEngine();
  private memoryEngine = new MemoryEngine();
  private violationEngine = new ViolationEngine();
  private evidenceEngine = new EvidenceEngine();

  private isInitialized = false;

  constructor(config: Partial<CVConfig> = {}) {
    this.config = { ...DEFAULT_CV_CONFIG, ...config };
    this.applyConfig();
  }

  private applyConfig(): void {
    const cfg = this.config;
    this.tracker.setConfig(cfg);
    this.landmarkDetector.setConfig(cfg);
    this.headPose.setConfig(cfg);
    this.gazeEstimator.setConfig(cfg);
    this.blinkDetector.setConfig(cfg);
    this.mouthDetector.setConfig(cfg);
    this.objectDetector.setConfig(cfg);
    this.presenceDetector.setConfig(cfg);
    this.behaviorEngine.setConfig(cfg);
    this.focusEngine.setConfig(cfg);
    this.stateEngine.setConfig(cfg);
    this.memoryEngine.setConfig(cfg);
    this.violationEngine.setConfig(cfg);
    this.evidenceEngine.setConfig(cfg);
  }

  async init(config?: Partial<CVConfig>): Promise<void> {
    if (config) {
      this.config = { ...this.config, ...config };
      this.applyConfig();
    }

    // Initialize heavyweight models (FaceMesh, COCO-SSD)
    await Promise.all([
      this.faceDetector.init(this.config),
      this.objectDetector.init(),
    ]);

    this.isInitialized = true;
    console.log('[CVPipeline] Pipeline initialized successfully');
  }

  updateConfig(config: Partial<CVConfig>): void {
    this.config = { ...this.config, ...config };
    this.applyConfig();
  }

  /** Run the entire invigilator pipeline for a single frame */
  async processFrame(video: HTMLVideoElement): Promise<CVOutput[]> {
    if (!this.isInitialized) {
      throw new Error('Pipeline not initialized. Call init() first.');
    }

    const now = Date.now();

    // 1. Kick off object detector check asynchronously to avoid blocking the loop
    // (It internally throttles to its own configured interval)
    this.objectDetector.detectAsync(video, now).catch((err) => {
      console.warn('[CVPipeline] Async object detection error:', err);
    });

    // 2. Feed the video element to face detector (starts MediaPipe process)
    await this.faceDetector.sendFrame(video);

    // 3. Create a FrameContext container for this frame
    const ctx: FrameContext = {
      timestamp: now,
      videoElement: video,
      faceLandmarks: null,
      detectedFaces: [],
      trackedStudents: [],
      studentAnalysis: new Map(),
      objectDetections: [],
      store: this.store,
    };

    // ── Execute Pipeline Sequentially ──
    try {
      // Step 1: Detect Faces
      this.faceDetector.process(ctx);

      // Step 2: Track IDs
      this.tracker.process(ctx);

      // Initialize intermediate analysis structures for active tracking IDs
      for (const track of ctx.trackedStudents) {
        ctx.studentAnalysis.set(track.trackingId, {
          trackingId: track.trackingId,
          landmarks: null,
          verification: null,
          headPose: null,
          gaze: null,
          blink: null,
          mouth: null,
          presence: null,
          behavior: null,
          focus: null,
          state: null,
          violations: [],
          evidence: [],
        });
      }

      // Step 3: Identity Verification
      this.verifier.process(ctx);

      // Step 4: Landmark Extraction
      this.landmarkDetector.process(ctx);

      // Step 5: Head Pose
      this.headPose.process(ctx);

      // Step 6: Eye Gaze
      this.gazeEstimator.process(ctx);

      // Step 7: Blinks
      this.blinkDetector.process(ctx);

      // Step 8: Mouth Yawning/Speaking
      this.mouthDetector.process(ctx);

      // Step 9: Collect latest object detections
      this.objectDetector.process(ctx);

      // Step 10: Presence Evaluation
      this.presenceDetector.process(ctx);

      // Step 11: Behavior Analysis
      this.behaviorEngine.process(ctx);

      // Step 12: Focus Score Calculation
      this.focusEngine.process(ctx);

      // Step 13: Authoritative State Engine
      this.stateEngine.process(ctx);

      // Step 14: Log memory history
      this.memoryEngine.process(ctx);

      // Step 15: Flag violations
      this.violationEngine.process(ctx);

      // Step 16: Capture evidence screenshots
      this.evidenceEngine.process(ctx);

    } catch (err) {
      console.error('[CVPipeline] Fatal execution error in pipeline:', err);
    }

    // ── Generate Outputs ──
    const outputs: CVOutput[] = [];
    for (const student of ctx.trackedStudents) {
      const record = this.store.getOrCreate(student.trackingId);
      record.tracking = student;

      // Copy computed frame analysis results into persistent record store
      const frameAnalysis = ctx.studentAnalysis.get(student.trackingId);
      if (frameAnalysis) {
        record.analysis = frameAnalysis;
      }

      const output = transformToOutput(record, ctx.timestamp);
      record.lastOutput = output;
      outputs.push(output);
    }

    // Handle tracking cleanups (remove states for fully lost tracks)
    const activeTrackingIds = new Set(ctx.trackedStudents.map((s) => s.trackingId));
    for (const trackingId of this.store.trackingIds()) {
      const record = this.store.get(trackingId);
      if (record && !activeTrackingIds.has(trackingId)) {
        if (record.tracking?.visibility === 'lost') {
          this.store.remove(trackingId);
          this.behaviorEngine.reset(); // Clear cached dwell states
        }
      }
    }

    return outputs;
  }

  /** Link a physical tracker to an external student record */
  linkStudent(trackingId: string, studentId: string): void {
    this.tracker.linkStudent(trackingId, studentId);
    this.store.linkStudentId(trackingId, studentId);
  }

  getPrimaryTrack(): TrackedStudent | null {
    return this.tracker.primaryTrack;
  }

  reset(): void {
    this.faceDetector.reset();
    this.tracker.reset();
    this.verifier.reset();
    this.landmarkDetector.reset();
    this.headPose.reset();
    this.gazeEstimator.reset();
    this.blinkDetector.reset();
    this.mouthDetector.reset();
    this.objectDetector.reset();
    this.presenceDetector.reset();
    this.behaviorEngine.reset();
    this.focusEngine.reset();
    this.stateEngine.reset();
    this.memoryEngine.reset();
    this.violationEngine.reset();
    this.evidenceEngine.reset();
    this.store.clear();
  }

  destroy(): void {
    this.reset();
    this.faceDetector.destroy();
    this.objectDetector.destroy();
    this.isInitialized = false;
  }
}
