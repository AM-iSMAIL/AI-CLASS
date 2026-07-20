"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { useCVPipeline, FocusMetrics } from "@/lib/cv/use-cv-pipeline";
import { updateStudentEngagement } from "@/lib/session-service";
import { Eye, EyeOff, ScanEye, Brain } from "lucide-react";

// ─── Constants ──────────────────────────────────────────────────────────────
const CAMERA_WIDTH = 640;
const CAMERA_HEIGHT = 480;

interface Props {
  sessionCode: string;
  studentId: string;
  enabled: boolean;
  isGridMode?: boolean;
  onLocalFocusUpdate?: (metrics: FocusMetrics) => void;
  onStreamReady?: (stream: MediaStream) => void;
}

export default function StudentCamera({
  sessionCode,
  studentId,
  enabled,
  isGridMode,
  onLocalFocusUpdate,
  onStreamReady,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [denied, setDenied] = useState(false);
  const [active, setActive] = useState(false);

  // ── Focus update → push to Firestore ──
  const handleFocusUpdate = useCallback(
    async (m: FocusMetrics) => {
      if (onLocalFocusUpdate) onLocalFocusUpdate(m);
      try {
        await updateStudentEngagement(sessionCode, studentId, m.score, m.status);
      } catch {
        // Silently ignore transient network failures
      }
    },
    [sessionCode, studentId, onLocalFocusUpdate],
  );

  const { metrics } = useCVPipeline({
    videoRef,
    studentId,
    onFocusUpdate: handleFocusUpdate,
    enabled: enabled && active,
  });

  // ── Camera initialisation ──
  useEffect(() => {
    if (!enabled) return;
    let currentStream: MediaStream | null = null;

    const start = async () => {
      if (!videoRef.current) {
        setTimeout(start, 500);
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: CAMERA_WIDTH },
            height: { ideal: CAMERA_HEIGHT },
            facingMode: "user",
          },
        });
        currentStream = stream;
        videoRef.current!.srcObject = stream;
        setActive(true);
        if (onStreamReady) onStreamReady(stream);
      } catch {
        setDenied(true);
      }
    };

    start();

    return () => {
      if (currentStream) currentStream.getTracks().forEach(t => t.stop());
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
    };
  }, [enabled, onStreamReady]);

  // ── Camera denied fallback ──
  if (denied) {
    return (
      <div className="absolute inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-rose-500/10 backdrop-blur-md border border-rose-500/20 rounded-xl p-4 text-xs text-rose-400 text-center max-w-xs shadow-2xl">
          <p className="font-bold text-sm mb-1 text-rose-300">Camera Blocked</p>
          <p className="text-rose-400/80 mb-2">Focus tracking is disabled.</p>
          <p className="text-rose-400/90 font-medium bg-rose-500/20 p-2 rounded-lg text-[10px] leading-relaxed">
            If you opened this link from <b>WhatsApp</b> or <b>Instagram</b>, your camera is blocked
            by the app. Please tap the menu and select <b>&quot;Open in Chrome/Safari&quot;</b>.
          </p>
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
