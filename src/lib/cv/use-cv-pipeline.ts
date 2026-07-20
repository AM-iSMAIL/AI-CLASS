// ─── Neuro Class AI — CV Pipeline React Hook ───────────────────────────────
// Wraps CVPipeline and FrameSource inside a clean, standard React Hook.
// Provides backward-compatible FocusMetrics outputs as well as raw CVOutputs.

import { useEffect, useRef, useState, useCallback } from 'react';
import type { CVOutput } from './types';
import { CVPipeline } from './pipeline';
import { FrameSource } from './frame-source';

export interface FocusMetrics {
  score: number;
  status: 'focused' | 'distracted' | 'away' | 'offline';
  gazeDirection: 'center' | 'left' | 'right' | 'up' | 'down' | 'unknown';
  faceDetected: boolean;
  eyesOpen: boolean;
  headYaw: number;
  headPitch: number;
  headRoll: number;
  yawning: boolean;
  blinkRate: number;
  gazeYaw: number;
  gazePitch: number;
  irisEngagement: number;
  effectiveDeviation: number;
  phoneDetected: boolean;
}

interface UseCVPipelineOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  studentId?: string | null;
  onFocusUpdate?: (metrics: FocusMetrics, rawOutput: CVOutput) => void;
  enabled?: boolean;
}

export function useCVPipeline({
  videoRef,
  studentId = null,
  onFocusUpdate,
  enabled = true,
}: UseCVPipelineOptions) {
  const [metrics, setMetrics] = useState<FocusMetrics>({
    score: 100,
    status: 'focused',
    gazeDirection: 'unknown',
    faceDetected: false,
    eyesOpen: true,
    headYaw: 0,
    headPitch: 0,
    headRoll: 0,
    yawning: false,
    blinkRate: 0,
    gazeYaw: 0,
    gazePitch: 0,
    irisEngagement: 50,
    effectiveDeviation: 0,
    phoneDetected: false,
  });

  const [rawOutput, setRawOutput] = useState<CVOutput | null>(null);
  const [pipelineState, setPipelineState] = useState<CVPipeline | null>(null);

  const pipelineRef = useRef<CVPipeline | null>(null);
  const frameSourceRef = useRef<FrameSource | null>(null);
  const lastPushRef = useRef<number>(0);

  // Helper mapping function to retain full backward compatibility
  const mapToFocusMetrics = useCallback((output: CVOutput): FocusMetrics => {
    let status: FocusMetrics['status'] = 'focused';
    const s = output.currentState;
    if (s === 'absent' || s === 'camera_blocked' || output.presence === 'partial_face') {
      status = 'away';
    } else if (s === 'distracted' || s === 'looking_away') {
      status = 'distracted';
    }

    const faceDetected = output.presence !== 'absent' && output.presence !== 'no_face' && output.presence !== 'partial_face';

    // Estimate effective deviation angle (degrees)
    const yaw = output.headPose?.yaw ?? 0;
    const pitch = output.headPose?.pitch ?? 0;
    const gazeYaw = output.blinkState?.eyesOpen ? (yaw + (output.gazeDirection === 'left' ? -15 : output.gazeDirection === 'right' ? 15 : 0)) : yaw;
    const gazePitch = output.blinkState?.eyesOpen ? (pitch + (output.gazeDirection === 'up' ? -10 : output.gazeDirection === 'down' ? 10 : 0)) : pitch;
    const effectiveDeviation = Math.round(Math.sqrt(gazeYaw ** 2 + gazePitch ** 2) * 10) / 10;

    return {
      score: output.focusScore,
      status,
      gazeDirection: output.gazeDirection,
      faceDetected,
      eyesOpen: faceDetected ? (output.blinkState?.eyesOpen ?? true) : false,
      headYaw: yaw,
      headPitch: pitch,
      headRoll: output.headPose?.roll ?? 0,
      yawning: output.mouthState?.isYawning ?? false,
      blinkRate: output.blinkState?.blinkRate ?? 0,
      gazeYaw,
      gazePitch,
      irisEngagement: 50, // Standard baseline
      effectiveDeviation,
      phoneDetected: output.phoneDetected,
    };
  }, []);

  useEffect(() => {
    if (!enabled || !videoRef.current) return;

    const video = videoRef.current;
    const pipeline = new CVPipeline();
    pipelineRef.current = pipeline;
    setPipelineState(pipeline);

    const frameSource = new FrameSource(video, (pipeline as any).config);
    frameSourceRef.current = frameSource;

    const runFrame = async () => {
      try {
        const outputs = await pipeline.processFrame(video);
        const now = Date.now();
        const throttleLimit = (pipeline as any).config.outputThrottleMs;

        if (outputs.length > 0) {
          const primaryOutput = outputs[0];

          // Link studentId if available
          if (studentId) {
            pipeline.linkStudent(primaryOutput.trackingId, studentId);
            primaryOutput.studentId = studentId;
          }

          const fm = mapToFocusMetrics(primaryOutput);
          setMetrics(fm);
          setRawOutput(primaryOutput);

          if (onFocusUpdate && now - lastPushRef.current >= throttleLimit) {
            onFocusUpdate(fm, primaryOutput);
            lastPushRef.current = now;
          }
        } else {
          // No faces detected or tracked - report absent / away immediately
          const absentOutput: CVOutput = {
            studentId: studentId || '',
            trackingId: 'local_untracked',
            verified: false,
            focusScore: 0,
            currentState: 'absent',
            behavior: 'left_seat',
            gazeDirection: 'unknown',
            headPose: null,
            blinkState: null,
            mouthState: null,
            presence: 'absent',
            phoneDetected: false,
            violations: [],
            evidence: [],
            attentionHistory: [],
            timestamp: now,
          };

          const fm: FocusMetrics = {
            score: 0,
            status: 'away',
            gazeDirection: 'unknown',
            faceDetected: false,
            eyesOpen: false,
            headYaw: 0,
            headPitch: 0,
            headRoll: 0,
            yawning: false,
            blinkRate: 0,
            gazeYaw: 0,
            gazePitch: 0,
            irisEngagement: 0,
            effectiveDeviation: 90,
            phoneDetected: false,
          };

          setMetrics(fm);
          setRawOutput(absentOutput);

          if (onFocusUpdate && now - lastPushRef.current >= throttleLimit) {
            onFocusUpdate(fm, absentOutput);
            lastPushRef.current = now;
          }
        }
      } catch (err) {
        console.warn('[useCVPipeline] Frame execution skipped:', err);
      }
    };

    const initAndStart = async () => {
      try {
        await pipeline.init();
        await frameSource.start(runFrame);
      } catch (err) {
        console.error('[useCVPipeline] Init/Start failed:', err);
      }
    };

    initAndStart();

    return () => {
      frameSource.stop();
      pipeline.destroy();
      pipelineRef.current = null;
      setPipelineState(null);
      frameSourceRef.current = null;
    };
  }, [enabled, videoRef, studentId, onFocusUpdate, mapToFocusMetrics]);

  return {
    metrics,
    rawOutput,
    pipeline: pipelineState,
  };
}
