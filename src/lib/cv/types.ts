// ─── Neuro Class AI — Computer Vision Pipeline Types ────────────────────────
// Single source of truth for all CV module interfaces.

// ─── Geometry ───────────────────────────────────────────────────────────────

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ─── Module Base ────────────────────────────────────────────────────────────

export interface CVModule<TOutput = unknown> {
  readonly name: string;
  process(ctx: FrameContext): TOutput;
  reset(): void;
}

// ─── Frame Context ──────────────────────────────────────────────────────────
// Shared mutable context passed through the pipeline for a single frame.

export interface FrameContext {
  /** Raw timestamp (ms) */
  timestamp: number;
  /** The video element being processed */
  videoElement: HTMLVideoElement;
  /** MediaPipe face landmarks (multi-face) — written by face-detector */
  faceLandmarks: Point3D[][] | null;
  /** Detected faces — written by face-detector */
  detectedFaces: DetectedFace[];
  /** Tracked students — written by tracker */
  trackedStudents: TrackedStudent[];
  /** Per-student analysis results — keyed by trackingId */
  studentAnalysis: Map<string, StudentAnalysis>;
  /** Object detections — written by object-detector */
  objectDetections: ObjectDetection[];
  /** Shared mutable StudentStateStore instance */
  store: any;
}

// ─── Module 1 — Face Detection ──────────────────────────────────────────────

export interface DetectedFace {
  /** Index in the landmarks array */
  index: number;
  /** Bounding box in normalized coords (0–1) */
  bbox: BoundingBox;
  /** Detection confidence (0–1) */
  confidence: number;
  /** Detection timestamp (ms) */
  timestamp: number;
  /** The raw landmarks for this face */
  landmarks: Point3D[];
}

// ─── Module 2 — Student Tracking ────────────────────────────────────────────

export type VisibilityState = 'visible' | 'occluded' | 'lost';

export interface TrackedStudent {
  /** Stable tracking ID across frames */
  trackingId: string;
  /** External student ID (if linked) */
  studentId: string | null;
  /** First detection timestamp */
  firstSeen: number;
  /** Last detection timestamp */
  lastSeen: number;
  /** Current bounding box */
  currentPosition: BoundingBox;
  /** Current visibility */
  visibility: VisibilityState;
  /** Tracking confidence (0–1) */
  trackingConfidence: number;
  /** Index into detectedFaces for the current frame (-1 if occluded) */
  faceIndex: number;
}

// ─── Module 3 — Face Verification ───────────────────────────────────────────

export type VerificationStatus =
  | 'verified'
  | 'unknown'
  | 'possible_impersonation'
  | 'verification_failed';

export interface VerificationResult {
  status: VerificationStatus;
  confidence: number;
  enrolledId: string | null;
}

// ─── Module 4 — Facial Landmarks ────────────────────────────────────────────

export interface StructuredLandmarks {
  /** Full 478 landmarks */
  raw: Point3D[];
  /** Whether all critical landmarks are within frame bounds */
  faceComplete: boolean;
  /** Eye contour points */
  leftEyeContour: Point3D[];
  rightEyeContour: Point3D[];
  /** Iris landmarks */
  leftIrisCenter: Point3D;
  leftIrisRing: Point3D[];
  rightIrisCenter: Point3D;
  rightIrisRing: Point3D[];
  /** EAR landmarks (6 points per eye) */
  leftEyeEAR: Point3D[];
  rightEyeEAR: Point3D[];
  /** Eye vertical bounds */
  leftEyeTop: Point3D;
  leftEyeBottom: Point3D;
  rightEyeTop: Point3D;
  rightEyeBottom: Point3D;
  /** Head pose landmarks */
  noseTip: Point3D;
  forehead: Point3D;
  chin: Point3D;
  leftCheek: Point3D;
  rightCheek: Point3D;
  leftEyeCenter: Point3D;
  rightEyeCenter: Point3D;
  /** Mouth landmarks */
  mouthTop: Point3D;
  mouthBottom: Point3D;
  mouthLeft: Point3D;
  mouthRight: Point3D;
}

// ─── Module 5 — Head Pose ───────────────────────────────────────────────────

export type HeadDirection = 'forward' | 'left' | 'right' | 'down' | 'up';

export interface HeadPose {
  yaw: number;    // degrees, positive = right
  pitch: number;  // degrees, positive = down
  roll: number;   // degrees, positive = tilt right
  direction: HeadDirection;
}

// ─── Module 6 — Eye Gaze ───────────────────────────────────────────────────

export type GazeTarget =
  | 'at_lecture'
  | 'away'
  | 'second_monitor'
  | 'downward'
  | 'unknown';

export type GazeDirection = 'center' | 'left' | 'right' | 'up' | 'down' | 'unknown';

export interface GazeEstimate {
  /** Left eye gaze vector (yaw, pitch in degrees) */
  leftEye: { yaw: number; pitch: number };
  /** Right eye gaze vector */
  rightEye: { yaw: number; pitch: number };
  /** Combined (averaged + filtered) */
  combined: { yaw: number; pitch: number };
  /** Raw (pre-filter) combined */
  raw: { yaw: number; pitch: number };
  /** Classified direction */
  direction: GazeDirection;
  /** Classified target */
  target: GazeTarget;
  /** Pupil engagement index 0–100 */
  irisEngagement: number;
}

// ─── Module 7 — Blink Detection ────────────────────────────────────────────

export type BlinkStatus = 'normal' | 'sleepy' | 'eyes_closed';

export interface BlinkState {
  /** True when eyes are currently open */
  eyesOpen: boolean;
  /** Current Eye Aspect Ratio */
  ear: number;
  /** Drowsiness detected (sustained closure) */
  isDrowsy: boolean;
  /** Blinks per minute (rolling 60s window) */
  blinkRate: number;
  /** Current closure duration (ms), 0 if open */
  closureDuration: number;
  /** Classified status */
  status: BlinkStatus;
}

// ─── Module 8 — Mouth Activity ─────────────────────────────────────────────

export interface MouthState {
  /** Current Mouth Aspect Ratio */
  mar: number;
  /** Sustained yawn detected */
  isYawning: boolean;
  /** Mouth appears to be moving (talking) */
  isTalking: boolean;
  /** Lower face occluded / covered */
  mouthCovered: boolean;
}

// ─── Module 9 — Object Detection ───────────────────────────────────────────

export type DetectedObjectClass =
  | 'cell_phone'
  | 'tablet'
  | 'laptop'
  | 'book'
  | 'suspicious_device'
  | 'hand_covering_camera'
  | 'person';

export interface ObjectDetection {
  class: DetectedObjectClass;
  /** Raw COCO-SSD class label */
  rawClass: string;
  confidence: number;
  bbox: BoundingBox;
  timestamp: number;
}

// ─── Module 10 — Presence ──────────────────────────────────────────────────

export type PresenceStatus =
  | 'present'
  | 'absent'
  | 'left_seat'
  | 'camera_blocked'
  | 'partial_face'
  | 'no_face';

export interface PresenceState {
  status: PresenceStatus;
  /** How long (ms) the student has been in this state */
  duration: number;
  /** Timestamp when this state started */
  since: number;
}

// ─── Module 11 — Behaviour Analysis ────────────────────────────────────────

export type BehaviorLabel =
  | 'focused'
  | 'distracted'
  | 'sleeping'
  | 'reading_notes'
  | 'phone_usage'
  | 'looking_away'
  | 'camera_covered'
  | 'left_seat'
  | 'multiple_people'
  | 'suspicious';

export interface BehaviorState {
  current: BehaviorLabel;
  confidence: number;
  /** Timestamp when this behavior started */
  since: number;
  /** Duration in current behavior (ms) */
  duration: number;
  /** Previous behavior (for transition tracking) */
  previous: BehaviorLabel | null;
}

// ─── Module 12 — Focus Score ───────────────────────────────────────────────

export interface FocusScore {
  /** Smoothed focus score 0–100 */
  score: number;
  /** Raw (pre-smoothing) score */
  raw: number;
  /** Combined head+gaze deviation (degrees) */
  effectiveDeviation: number;
  /** Individual component contributions */
  components: {
    gaze: number;
    headPose: number;
    presence: number;
    phoneDetection: number;
    behaviorHistory: number;
    recentAttention: number;
  };
}

// ─── Module 13 — Student State ─────────────────────────────────────────────

export type StudentStateName =
  | 'focused'
  | 'listening'
  | 'confused'
  | 'distracted'
  | 'looking_away'
  | 'phone_usage'
  | 'sleeping'
  | 'absent'
  | 'camera_blocked'
  | 'verification_failed'
  | 'multiple_people';

export interface StudentStateResult {
  state: StudentStateName;
  confidence: number;
  since: number;
  duration: number;
}

// ─── Module 14 — Memory ────────────────────────────────────────────────────

export interface StudentMemory {
  focusHistory: number[];
  gazeHistory: Array<{ yaw: number; pitch: number; t: number }>;
  headPoseHistory: Array<{ yaw: number; pitch: number; roll: number; t: number }>;
  phoneHistory: Array<{ detected: boolean; t: number }>;
  absenceHistory: Array<{ status: PresenceStatus; from: number; to: number }>;
  warningHistory: Array<{ type: string; t: number }>;
  lastViolation: number | null;
  lastActivity: number;
}

// ─── Module 15 — Violations ────────────────────────────────────────────────

export type ViolationType =
  | 'phone_usage'
  | 'prolonged_absence'
  | 'sleeping'
  | 'camera_blocked'
  | 'impersonation'
  | 'multiple_people'
  | 'sustained_distraction'
  | 'device_usage';

export type ViolationSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface Violation {
  id: string;
  type: ViolationType;
  confidence: number;
  /** How long the violation has been active (ms) */
  duration: number;
  timestamp: number;
  studentId: string;
  trackingId: string;
  evidenceId: string | null;
  severity: ViolationSeverity;
  reason: string;
}

// ─── Module 16 — Evidence ──────────────────────────────────────────────────

export interface EvidenceSnapshot {
  id: string;
  timestamp: number;
  /** Base64 cropped face image */
  croppedFace: string | null;
  /** Base64 full frame image */
  fullFrame: string | null;
  focusScore: number;
  headPose: HeadPose | null;
  gazeDirection: GazeDirection;
  phoneDetected: boolean;
  trackingId: string;
  studentId: string;
}

// ─── Module 17 — Decision Output ───────────────────────────────────────────

export interface CVOutput {
  studentId: string;
  trackingId: string;
  verified: boolean;
  focusScore: number;
  currentState: StudentStateName;
  behavior: BehaviorLabel;
  gazeDirection: GazeDirection;
  headPose: HeadPose | null;
  blinkState: BlinkState | null;
  mouthState: MouthState | null;
  presence: PresenceStatus;
  phoneDetected: boolean;
  violations: Violation[];
  evidence: EvidenceSnapshot[];
  attentionHistory: number[];
  timestamp: number;
}

// ─── Per-Student Aggregated Analysis ────────────────────────────────────────
// Intermediate container built up by the pipeline for each tracked student.

export interface StudentAnalysis {
  trackingId: string;
  landmarks: StructuredLandmarks | null;
  verification: VerificationResult | null;
  headPose: HeadPose | null;
  gaze: GazeEstimate | null;
  blink: BlinkState | null;
  mouth: MouthState | null;
  presence: PresenceState | null;
  behavior: BehaviorState | null;
  focus: FocusScore | null;
  state: StudentStateResult | null;
  violations: Violation[];
  evidence: EvidenceSnapshot[];
}
