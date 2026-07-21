// ─── Neuro Class AI — CV Pipeline Configuration ────────────────────────────
// Single source of truth for every threshold and tuning parameter.
// Nothing is hardcoded in the modules — all values come from here.

export interface CVConfig {
  // ── Frame Acquisition ──
  captureWidth: number;
  captureHeight: number;

  // ── Face Detection ──
  maxNumFaces: number;
  minDetectionConfidence: number;
  minTrackingConfidence: number;
  /** Consecutive missed-face frames before declaring "no face" */
  faceDebounceFrames: number;
  /** Critical landmark bounds margin (0–1, from edge) */
  landmarkBoundsMargin: number;

  // ── Tracking ──
  /** IoU threshold for matching faces across frames */
  trackingIoUThreshold: number;
  /** Ms to hold a lost track before releasing the ID */
  trackingLostTimeout: number;

  // ── Blink / EAR ──
  earClosedThreshold: number;
  blinkMaxDurationMs: number;
  blinkRateFatigueThreshold: number;

  // ── Mouth / MAR ──
  marYawnThreshold: number;
  yawnMinDurationMs: number;
  /** MAR threshold for "talking" (lower than yawn) */
  marTalkingThreshold: number;

  // ── Head Pose ──
  /** Roll angle (degrees) beyond which a penalty applies */
  rollThreshold: number;
  /** Yaw/pitch thresholds for direction classification */
  headYawThreshold: number;
  headPitchThreshold: number;

  // ── Gaze ──
  /** Horizontal threshold for gaze direction classification (degrees) */
  gazeHorizontalThreshold: number;
  /** Vertical threshold for gaze direction classification (degrees) */
  gazeVerticalThreshold: number;
  /** Z-offset to approximate eyeball center behind iris (normalised coords) */
  eyeballZOffset: number;
  /** One-Euro filter params */
  gazeFilterMinCutoff: number;
  gazeFilterBeta: number;
  gazeFilterDCutoff: number;

  // ── Iris Engagement ──
  irisEngagementWindow: number;
  irisBaselineMinSamples: number;

  // ── Focus Scoring ──
  /** Dead zone for effective deviation (degrees) — no penalty inside */
  deviationDeadZone: number;
  /** Points deducted per degree beyond dead zone */
  deviationPenaltyPerDeg: number;
  /** Roll penalty (flat deduction) */
  rollPenalty: number;
  /** Yawn penalty */
  yawnPenalty: number;
  /** High blink-rate penalty */
  blinkFatiguePenalty: number;
  /** Iris engagement score divisor for bonus/penalty */
  irisEngagementDivisor: number;
  /** EMA smoothing alpha */
  emaAlpha: number;
  /** History buffer size for moving average */
  historySize: number;

  // ── Sustained Distraction ──
  sustainScoreThreshold: number;
  sustainTimeMs: number;
  sustainDecayPerSec: number;

  // ── Status Classification ──
  statusFocusedMin: number;
  statusDistractedMin: number;

  // ── Object Detection ──
  /** Minimum confidence for COCO-SSD predictions */
  objectDetectionConfidence: number;
  /** Interval (ms) between object detection scans */
  objectDetectionIntervalMs: number;
  /** Forbidden COCO-SSD class names */
  forbiddenObjects: string[];

  // ── Presence ──
  /** Ms of no-face before marking absent */
  absentThresholdMs: number;

  // ── Behavior Analysis ──
  /** Minimum dwell time (ms) before transitioning behavior state */
  behaviorMinDwellMs: number;

  // ── State Engine ──
  /** Minimum evidence time (ms) before state transition */
  stateTransitionMinMs: number;

  // ── Violation Engine ──
  /** Minimum duration (ms) before generating a violation */
  violationMinDurationMs: number;

  // ── Evidence Engine ──
  /** Max evidence snapshots stored in memory per student */
  maxEvidencePerStudent: number;

  // ── Output Throttle ──
  /** Minimum interval (ms) between output emissions */
  outputThrottleMs: number;

  // ── Memory ──
  /** Max entries in each rolling history buffer */
  memoryHistorySize: number;

  // ── Scoring Weights (must sum to 1.0) ──
  weights: {
    gaze: number;
    headPose: number;
    presence: number;
    phoneDetection: number;
    behaviorHistory: number;
    recentAttention: number;
  };
}

// ─── Default Configuration ──────────────────────────────────────────────────

export const DEFAULT_CV_CONFIG: CVConfig = {
  // Frame
  captureWidth: 640,
  captureHeight: 480,

  // Face Detection
  maxNumFaces: 2,
  minDetectionConfidence: 0.6,
  minTrackingConfidence: 0.6,
  faceDebounceFrames: 3,
  landmarkBoundsMargin: 0.03,

  // Tracking
  trackingIoUThreshold: 0.3,
  trackingLostTimeout: 3_000,

  // Blink / EAR
  earClosedThreshold: 0.20,
  blinkMaxDurationMs: 350,
  blinkRateFatigueThreshold: 25,

  // Mouth / MAR
  marYawnThreshold: 0.55,
  yawnMinDurationMs: 1_800,
  marTalkingThreshold: 0.35,

  // Head Pose
  rollThreshold: 15,
  headYawThreshold: 18,
  headPitchThreshold: 12,

  // Gaze
  gazeHorizontalThreshold: 10,
  gazeVerticalThreshold: 8,
  eyeballZOffset: 0.035,
  gazeFilterMinCutoff: 1.0,
  gazeFilterBeta: 0.007,
  gazeFilterDCutoff: 1.0,

  // Iris
  irisEngagementWindow: 30,
  irisBaselineMinSamples: 10,

  // Focus Scoring
  deviationDeadZone: 6,
  deviationPenaltyPerDeg: 4,
  rollPenalty: 25,
  yawnPenalty: 30,
  blinkFatiguePenalty: 15,
  irisEngagementDivisor: 10,
  emaAlpha: 0.35, // Faster responsiveness (less lag)
  historySize: 10, // Shorter buffer to reflect instant distraction

  // Sustained Distraction
  sustainScoreThreshold: 65,
  sustainTimeMs: 1_500,
  sustainDecayPerSec: 5,

  // Status
  statusFocusedMin: 70,
  statusDistractedMin: 40,

  // Object Detection
  objectDetectionConfidence: 0.35,
  objectDetectionIntervalMs: 800,
  forbiddenObjects: ['cell phone', 'cell_phone', 'mobile phone', 'phone', 'laptop', 'tablet'],

  // Presence
  absentThresholdMs: 3_000,

  // Behavior
  behaviorMinDwellMs: 600, // Faster behavior transition (600ms)

  // State
  stateTransitionMinMs: 500, // Fast state transition (500ms)

  // Violation
  violationMinDurationMs: 2_000,

  // Evidence
  maxEvidencePerStudent: 50,

  // Output
  outputThrottleMs: 500, // Emit updates twice per second

  // Memory
  memoryHistorySize: 300,

  // Scoring Weights (sum = 1.0)
  weights: {
    gaze: 0.35,
    headPose: 0.25,
    presence: 0.15,
    phoneDetection: 0.15,
    behaviorHistory: 0.05,
    recentAttention: 0.05,
  },
};
