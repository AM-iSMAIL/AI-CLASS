// ─── Neuro Class AI — Student State Store ───────────────────────────────────
// Central per-student state container. All modules read from and write to this.

import type {
  StudentAnalysis,
  StudentMemory,
  CVOutput,
  TrackedStudent,
  PresenceStatus,
  Violation,
  EvidenceSnapshot,
} from './types';

export interface StudentRecord {
  trackingId: string;
  studentId: string | null;
  tracking: TrackedStudent | null;
  analysis: StudentAnalysis;
  memory: StudentMemory;
  violations: Violation[];
  evidence: EvidenceSnapshot[];
  lastOutput: CVOutput | null;
  lastOutputTime: number;
}

function createEmptyAnalysis(trackingId: string): StudentAnalysis {
  return {
    trackingId,
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
  };
}

function createEmptyMemory(): StudentMemory {
  return {
    focusHistory: [],
    gazeHistory: [],
    headPoseHistory: [],
    phoneHistory: [],
    absenceHistory: [],
    warningHistory: [],
    lastViolation: null,
    lastActivity: Date.now(),
  };
}

/**
 * StudentStateStore — holds all per-student state.
 * Thread-safe in the sense that JS is single-threaded;
 * all mutations happen synchronously within a single frame tick.
 */
export class StudentStateStore {
  private students = new Map<string, StudentRecord>();

  /** Get or create a record for a tracking ID */
  getOrCreate(trackingId: string): StudentRecord {
    let record = this.students.get(trackingId);
    if (!record) {
      record = {
        trackingId,
        studentId: null,
        tracking: null,
        analysis: createEmptyAnalysis(trackingId),
        memory: createEmptyMemory(),
        violations: [],
        evidence: [],
        lastOutput: null,
        lastOutputTime: 0,
      };
      this.students.set(trackingId, record);
    }
    return record;
  }

  get(trackingId: string): StudentRecord | undefined {
    return this.students.get(trackingId);
  }

  /** Link a tracking ID to an external student ID */
  linkStudentId(trackingId: string, studentId: string): void {
    const record = this.getOrCreate(trackingId);
    record.studentId = studentId;
  }

  /** Get all active student records */
  all(): StudentRecord[] {
    return Array.from(this.students.values());
  }

  /** Get all tracking IDs */
  trackingIds(): string[] {
    return Array.from(this.students.keys());
  }

  /** Remove a student record (tracking ID released) */
  remove(trackingId: string): void {
    this.students.delete(trackingId);
  }

  /** Reset analysis for a new frame (keeps memory and violations) */
  resetFrameAnalysis(trackingId: string): void {
    const record = this.students.get(trackingId);
    if (record) {
      record.analysis = createEmptyAnalysis(trackingId);
    }
  }

  /** Clear everything */
  clear(): void {
    this.students.clear();
  }

  get size(): number {
    return this.students.size;
  }
}
