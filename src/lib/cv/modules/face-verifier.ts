// ─── Module 3 — Face Verification (Stub) ────────────────────────────────────
// Returns Verified for all detected faces. Interface ready for future
// face embedding comparison (FaceNet, ArcFace, etc.).

import type { CVModule, VerificationResult, FrameContext } from '../types';

export class FaceVerifierModule implements CVModule<Map<string, VerificationResult>> {
  readonly name = 'face-verifier';

  // ponytail: stub — no enrollment flow yet. Returns verified for all tracked students.
  // Upgrade path: integrate face embedding model, store enrolled embeddings per student,
  // compare cosine distance on each frame.

  process(ctx: FrameContext): Map<string, VerificationResult> {
    const results = new Map<string, VerificationResult>();

    for (const student of ctx.trackedStudents) {
      results.set(student.trackingId, {
        status: 'verified',
        confidence: 1.0,
        enrolledId: student.studentId,
      });
    }

    // Write results into studentAnalysis
    for (const [trackingId, result] of results) {
      const analysis = ctx.studentAnalysis.get(trackingId);
      if (analysis) analysis.verification = result;
    }

    return results;
  }

  reset(): void {
    // No state to reset
  }
}
