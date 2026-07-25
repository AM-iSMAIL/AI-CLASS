"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { useCVPipeline, FocusMetrics } from "@/lib/cv/use-cv-pipeline";
import { updateStudentEngagement, updateTeacherEngagement } from "@/lib/session-service";
import { Eye, EyeOff, ScanEye, Brain } from "lucide-react";

// ─── Constants ──────────────────────────────────────────────────────────────
const CAMERA_WIDTH = 640;
const CAMERA_HEIGHT = 480;

interface Props {
  sessionCode: string;
  studentId: string;
  studentName?: string | null;
  enabled: boolean;
  isGridMode?: boolean;
  isTeacher?: boolean;
  onLocalFocusUpdate?: (metrics: FocusMetrics) => void;
  onStreamReady?: (stream: MediaStream) => void;
}

export default function StudentCamera({
  sessionCode,
  studentId,
  studentName,
  enabled,
  isGridMode,
  isTeacher = false,
  onLocalFocusUpdate,
  onStreamReady,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [denied, setDenied] = useState(false);
  const [active, setActive] = useState(false);

  // ── Focus update → push to Firestore ──
  const handleFocusUpdate = useCallback(
    async (m: FocusMetrics) => {
      // Ignore 0 score telemetry updates caused by camera shutdown or session ending
      if (m.score === 0) return;
      if (onLocalFocusUpdate) onLocalFocusUpdate(m);
      try {
        if (isTeacher) {
          await updateTeacherEngagement(sessionCode, m.score, m.status);
        } else {
          await updateStudentEngagement(sessionCode, studentId, studentName || studentId, m.score, m.status);
        }
      } catch {
        // Silently ignore transient network failures
      }
    },
    [sessionCode, studentId, studentName, onLocalFocusUpdate, isTeacher],
  );

  const { metrics } = useCVPipeline({
    videoRef,
    studentId,
    onFocusUpdate: handleFocusUpdate,
    enabled: enabled && active,
  });

  // ── Camera initialisation ──
  const startCamera = useCallback(async () => {
    if (!enabled) return;
    setDenied(false);

    try {
      let stream: MediaStream | null = null;

      if (!navigator?.mediaDevices?.getUserMedia) {
        setDenied(true);
        return;
      }

      try {
        // Attempt 1: Ideal dimensions and facing mode
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: CAMERA_WIDTH },
            height: { ideal: CAMERA_HEIGHT },
            facingMode: "user",
          },
        });
      } catch (e1) {
        console.warn("[StudentCamera] High resolution constraints failed, attempting basic video:", e1);
        // Attempt 2: Basic video constraints fallback (mobile browsers)
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      }

      if (stream) {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setActive(true);
        setDenied(false);
        if (onStreamReady) onStreamReady(stream);
      }
    } catch (err) {
      console.error("[StudentCamera] Camera permission denied or device locked:", err);
      setDenied(true);
    }
  }, [enabled, onStreamReady]);

  useEffect(() => {
    let currentVideoNode = videoRef.current;
    startCamera();

    return () => {
      if (currentVideoNode?.srcObject) {
        const stream = currentVideoNode.srcObject as MediaStream;
        stream.getTracks().forEach(t => t.stop());
      }
    };
  }, [startCamera]);

  // ── Camera denied fallback ──
  if (denied) {
    return (
      <div className="absolute inset-0 z-50 flex items-center justify-center p-3 bg-white/95 backdrop-blur-md border border-rose-200 rounded-[20px] shadow-sm">
        <div className="text-center max-w-xs space-y-2">
          <p className="font-bold text-xs text-[#DC2626]">Camera Access Needed</p>
          <p className="text-[10px] text-[#6B7280] leading-relaxed">
            If joined via <b>WhatsApp</b> or <b>Instagram</b>, tap menu and select <b>&quot;Open in Chrome / Safari&quot;</b>.
          </p>
          <button
            onClick={() => startCamera()}
            className="mt-1 px-3 py-1.5 bg-[#111827] hover:bg-[#1F2937] text-white rounded-xl text-[10px] font-bold shadow-xs transition-all duration-350 ease-[cubic-bezier(.22,1,.36,1)] cursor-pointer"
          >
            Allow / Retry Camera
          </button>
        </div>
      </div>
    );
  }

  // Status dot and detail label
  const statusDotColor =
    metrics.status === "focused" ? "bg-emerald-400" :
    metrics.status === "distracted" ? "bg-amber-400" :
    metrics.status === "away" ? "bg-rose-400" : "bg-gray-400";

  const detailLabel = (() => {
    if (!metrics.faceDetected) return "No face";
    if (metrics.yawning) return "Yawning";
    if (!metrics.eyesOpen) return "Eyes closed";
    if (metrics.gazeDirection !== "center" && metrics.gazeDirection !== "unknown") {
      const deg = Math.round(metrics.effectiveDeviation);
      return `Gaze ${metrics.gazeDirection} ${deg}°`;
    }
    return metrics.status;
  })();

  // Iris engagement label & color
  const irisColor =
    metrics.irisEngagement >= 60 ? "text-emerald-400/60" :
    metrics.irisEngagement >= 40 ? "text-amber-400/60" : "text-rose-400/60";

  return (
    <>
      {/* Webcam video element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={
          isGridMode
            ? `absolute inset-0 w-full h-full object-cover z-0 transition-all duration-300 pointer-events-none ${active && enabled ? "opacity-100" : "opacity-0"}`
            : `fixed bottom-24 right-6 w-48 h-36 object-cover rounded-2xl border-2 border-white/10 shadow-2xl z-40 transition-all duration-300 pointer-events-none ${active && enabled ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`
        }
        width={CAMERA_WIDTH}
        height={CAMERA_HEIGHT}
      />

      {/* Focus HUD overlay */}
      {active && enabled && (
        <div
          className={
            isGridMode
              ? "absolute bottom-2 left-2 z-10 flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-2 py-1 rounded-full border border-white/10"
              : "fixed bottom-26 right-[172px] z-50 flex items-center gap-2 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 animate-in fade-in slide-in-from-bottom-2"
          }
        >
          <div className={`w-2 h-2 rounded-full animate-pulse ${statusDotColor}`} />
          <span className="text-xs text-white/70 font-mono">{metrics.score}%</span>
          <span className="text-[10px] text-white/40 uppercase tracking-wider">{detailLabel}</span>
          {/* Eye state indicator */}
          {metrics.eyesOpen ? (
            <Eye className="h-3 w-3 text-white/25" />
          ) : (
            <EyeOff className="h-3 w-3 text-rose-400/60" />
          )}
          {/* Iris engagement indicator */}
          {metrics.eyesOpen && metrics.faceDetected && (
            <ScanEye className={`h-3 w-3 ${irisColor}`} />
          )}
          {/* Yawn indicator */}
          {metrics.yawning && (
            <Brain className="h-3 w-3 text-amber-400/70" />
          )}
        </div>
      )}
    </>
  );
}
