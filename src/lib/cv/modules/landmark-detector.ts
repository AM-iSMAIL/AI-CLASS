// ─── Module 4 — Facial Landmark Detector ────────────────────────────────────
// Extracts and structures MediaPipe's 478 landmarks into typed groups.

import type { CVModule, StructuredLandmarks, FrameContext, Point3D } from '../types';
import type { CVConfig } from '../config';

// ─── MediaPipe Landmark Indices ─────────────────────────────────────────────

// EAR landmarks (6 points per eye)
const LEFT_EYE_EAR = [33, 160, 158, 133, 153, 144];
const RIGHT_EYE_EAR = [362, 385, 387, 263, 380, 373];

// Iris (available with refineLandmarks: true)
const LEFT_IRIS_CENTER = 468;
const LEFT_IRIS_RING = [469, 470, 471, 472];
const RIGHT_IRIS_CENTER = 473;
const RIGHT_IRIS_RING = [474, 475, 476, 477];

// Eye contours
const LEFT_EYE_CONTOUR = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
const RIGHT_EYE_CONTOUR = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398];

// Eye vertical bounds
const LEFT_EYE_TOP = 159;
const LEFT_EYE_BOTTOM = 145;
const RIGHT_EYE_TOP = 386;
const RIGHT_EYE_BOTTOM = 374;

// Head pose landmarks
const NOSE_TIP = 1;
const FOREHEAD = 10;
const CHIN = 152;
const LEFT_CHEEK = 234;
const RIGHT_CHEEK = 454;
const LEFT_EYE_CENTER_LM = 33;
const RIGHT_EYE_CENTER_LM = 263;

// Mouth landmarks
const MOUTH_TOP = 13;
const MOUTH_BOTTOM = 14;
const MOUTH_LEFT = 78;
const MOUTH_RIGHT = 308;

// Critical landmarks that must be within frame bounds
const CRITICAL_LANDMARKS = [
  NOSE_TIP, FOREHEAD, CHIN, LEFT_CHEEK, RIGHT_CHEEK,
  LEFT_EYE_TOP, LEFT_EYE_BOTTOM, RIGHT_EYE_TOP, RIGHT_EYE_BOTTOM,
  LEFT_IRIS_CENTER, RIGHT_IRIS_CENTER,
];

export {
  LEFT_EYE_EAR, RIGHT_EYE_EAR,
  LEFT_IRIS_CENTER, LEFT_IRIS_RING, RIGHT_IRIS_CENTER, RIGHT_IRIS_RING,
  LEFT_EYE_CONTOUR, RIGHT_EYE_CONTOUR,
  LEFT_EYE_TOP, LEFT_EYE_BOTTOM, RIGHT_EYE_TOP, RIGHT_EYE_BOTTOM,
  NOSE_TIP, FOREHEAD, CHIN, LEFT_CHEEK, RIGHT_CHEEK,
  LEFT_EYE_CENTER_LM, RIGHT_EYE_CENTER_LM,
  MOUTH_TOP, MOUTH_BOTTOM, MOUTH_LEFT, MOUTH_RIGHT,
};

export class LandmarkDetectorModule implements CVModule<Map<string, StructuredLandmarks | null>> {
  readonly name = 'landmark-detector';

  private config: CVConfig | null = null;

  setConfig(config: CVConfig): void {
    this.config = config;
  }

  process(ctx: FrameContext): Map<string, StructuredLandmarks | null> {
    const config = this.config;
    if (!config) return new Map();

    const results = new Map<string, StructuredLandmarks | null>();
    const margin = config.landmarkBoundsMargin;

    for (const student of ctx.trackedStudents) {
      if (student.faceIndex < 0 || !ctx.faceLandmarks) {
        results.set(student.trackingId, null);
        continue;
      }

      const lm = ctx.faceLandmarks[student.faceIndex];
      if (!lm || lm.length < 468) {
        results.set(student.trackingId, null);
        continue;
      }

      // Validate face completeness
      let faceComplete = true;
      for (const idx of CRITICAL_LANDMARKS) {
        const pt = lm[idx];
        if (!pt || pt.x < margin || pt.x > 1 - margin || pt.y < margin || pt.y > 1 - margin) {
          faceComplete = false;
          break;
        }
      }

      const pick = (indices: number[]): Point3D[] => indices.map(i => lm[i]);

      const structured: StructuredLandmarks = {
        raw: lm,
        faceComplete,
        leftEyeContour: pick(LEFT_EYE_CONTOUR),
        rightEyeContour: pick(RIGHT_EYE_CONTOUR),
        leftIrisCenter: lm[LEFT_IRIS_CENTER],
        leftIrisRing: pick(LEFT_IRIS_RING),
        rightIrisCenter: lm[RIGHT_IRIS_CENTER],
        rightIrisRing: pick(RIGHT_IRIS_RING),
        leftEyeEAR: pick(LEFT_EYE_EAR),
        rightEyeEAR: pick(RIGHT_EYE_EAR),
        leftEyeTop: lm[LEFT_EYE_TOP],
        leftEyeBottom: lm[LEFT_EYE_BOTTOM],
        rightEyeTop: lm[RIGHT_EYE_TOP],
        rightEyeBottom: lm[RIGHT_EYE_BOTTOM],
        noseTip: lm[NOSE_TIP],
        forehead: lm[FOREHEAD],
        chin: lm[CHIN],
        leftCheek: lm[LEFT_CHEEK],
        rightCheek: lm[RIGHT_CHEEK],
        leftEyeCenter: lm[LEFT_EYE_CENTER_LM],
        rightEyeCenter: lm[RIGHT_EYE_CENTER_LM],
        mouthTop: lm[MOUTH_TOP],
        mouthBottom: lm[MOUTH_BOTTOM],
        mouthLeft: lm[MOUTH_LEFT],
        mouthRight: lm[MOUTH_RIGHT],
      };

      results.set(student.trackingId, structured);

      // Write into studentAnalysis
      const analysis = ctx.studentAnalysis.get(student.trackingId);
      if (analysis) analysis.landmarks = structured;
    }

    return results;
  }

  reset(): void {
    // Stateless
  }
}
