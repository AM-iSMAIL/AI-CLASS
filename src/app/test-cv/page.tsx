"use client";

import { useRef, useEffect, useState } from "react";
import { useCVPipeline } from "@/lib/cv/use-cv-pipeline";
import {
  Eye,
  EyeOff,
  Video,
  VideoOff,
  Sliders,
  Settings,
  Activity,
  AlertTriangle,
  CheckCircle,
  ShieldAlert,
  Smartphone,
  Brain
} from "lucide-react";

// ─── Options & Tuning Limits ────────────────────────────────────────────────
const CAMERA_WIDTH = 640;
const CAMERA_HEIGHT = 480;

export default function CVTestingPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // UI state
  const [cameraActive, setCameraActive] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  // Overlay configurations
  const [drawMesh, setDrawMesh] = useState(false);
  const [drawGaze, setDrawGaze] = useState(false);
  const [drawHeadPose, setDrawHeadPose] = useState(false);
  const [drawBBox, setDrawBBox] = useState(false);
  const [drawObjects, setDrawObjects] = useState(false);

  // Tuning parameter values
  const [earClosed, setEarClosed] = useState(0.20);
  const [marYawn, setMarYawn] = useState(0.55);
  const [yawThreshold, setYawThreshold] = useState(25);
  const [pitchThreshold, setPitchThreshold] = useState(20);
  const [gazeHorizontal, setGazeHorizontal] = useState(12);
  const [gazeVertical, setGazeVertical] = useState(10);
  const [deadZone, setDeadZone] = useState(10);

  // Capture metrics and pipeline
  const { metrics, rawOutput, pipeline } = useCVPipeline({
    videoRef,
    studentId: "cv_test_agent",
    enabled: cameraActive,
  });

  // ── Start/Stop Camera ──
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: CAMERA_WIDTH },
          height: { ideal: CAMERA_HEIGHT },
          facingMode: "user",
        },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraActive(true);
        setPermissionDenied(false);
      }
    } catch (err) {
      console.error("Camera start failed:", err);
      setPermissionDenied(true);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  // ── Sync UI tuning parameters with pipeline configuration ──
  useEffect(() => {
    if (pipeline) {
      const cfg = (pipeline as any).config;
      if (cfg) {
        cfg.earClosedThreshold = earClosed;
        cfg.marYawnThreshold = marYawn;
        cfg.headYawThreshold = yawThreshold;
        cfg.headPitchThreshold = pitchThreshold;
        cfg.gazeHorizontalThreshold = gazeHorizontal;
        cfg.gazeVerticalThreshold = gazeVertical;
        cfg.deviationDeadZone = deadZone;
        (pipeline as any).applyConfig();
      }
    }
  }, [pipeline, earClosed, marYawn, yawThreshold, pitchThreshold, gazeHorizontal, gazeVertical, deadZone]);

  // ── Real-time Overlay Drawing Loop ──
  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || !cameraActive) return;

    let animFrameId: number;

    const draw = () => {
      if (video.paused || video.ended) {
        animFrameId = requestAnimationFrame(draw);
        return;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Match canvas display sizes
      const displayWidth = video.clientWidth;
      const displayHeight = video.clientHeight;

      if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
        canvas.width = displayWidth;
        canvas.height = displayHeight;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Access CV Store to get active tracking records (including face landmarks)
      const records = (pipeline as any)?.store?.all() || [];

      for (const record of records) {
        const student = record.tracking;
        const analysis = record.analysis;
        const landmarks = analysis?.landmarks;

        if (!student) continue;

        // 1. Draw Face Bounding Box
        if (drawBBox && student.visibility === "visible" && student.currentPosition) {
          const { x, y, width, height } = student.currentPosition;
          const boxX = x * canvas.width;
          const boxY = y * canvas.height;
          const boxW = width * canvas.width;
          const boxH = height * canvas.height;

          // Color based on focus metrics status
          let statusColor = "rgba(52, 211, 153, 0.85)"; // Emerald
          if (metrics.status === "distracted") {
            statusColor = "rgba(251, 191, 36, 0.85)"; // Amber
          } else if (metrics.status === "away") {
            statusColor = "rgba(248, 113, 113, 0.85)"; // Rose
          }

          ctx.strokeStyle = statusColor;
          ctx.lineWidth = 2.5;
          ctx.strokeRect(boxX, boxY, boxW, boxH);

          // Top label
          ctx.fillStyle = statusColor;
          ctx.font = "bold 11px monospace";
          ctx.fillText(`Track: ${student.trackingId}`, boxX + 6, boxY + 16);
          ctx.fillText(`Focus: ${metrics.score}%`, boxX + 6, boxY + 30);
        }

        // 2. Draw Face Mesh Skeleton
        if (drawMesh && landmarks?.raw) {
          ctx.fillStyle = "rgba(124, 58, 237, 0.35)"; // Soft violet for full mesh
          for (const pt of landmarks.raw) {
            ctx.beginPath();
            ctx.arc(pt.x * canvas.width, pt.y * canvas.height, 1, 0, 2 * Math.PI);
            ctx.fill();
          }

          // Highlight eyes & mouth contours in a sharper violet
          const drawContour = (pts: any[], color: string, close = true) => {
            if (!pts || pts.length === 0) return;
            ctx.beginPath();
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.2;
            ctx.moveTo(pts[0].x * canvas.width, pts[0].y * canvas.height);
            for (let i = 1; i < pts.length; i++) {
              ctx.lineTo(pts[i].x * canvas.width, pts[i].y * canvas.height);
            }
            if (close) ctx.closePath();
            ctx.stroke();
          };

          drawContour(landmarks.leftEyeContour, "rgba(6, 182, 212, 0.8)"); // Cyan
          drawContour(landmarks.rightEyeContour, "rgba(6, 182, 212, 0.8)"); // Cyan

          // Draw lips
          ctx.beginPath();
          ctx.strokeStyle = "rgba(244, 63, 94, 0.8)"; // Rose lip contour
          ctx.lineWidth = 1.2;
          ctx.moveTo(landmarks.mouthLeft.x * canvas.width, landmarks.mouthLeft.y * canvas.height);
          ctx.lineTo(landmarks.mouthTop.x * canvas.width, landmarks.mouthTop.y * canvas.height);
          ctx.lineTo(landmarks.mouthRight.x * canvas.width, landmarks.mouthRight.y * canvas.height);
          ctx.lineTo(landmarks.mouthBottom.x * canvas.width, landmarks.mouthBottom.y * canvas.height);
          ctx.closePath();
          ctx.stroke();
        }

        // 3. Draw Iris Center & Gaze Vector Rays
        if (drawGaze && landmarks?.leftIrisCenter && landmarks?.rightIrisCenter) {
          const drawEyeGaze = (center: any, directionYaw: number, directionPitch: number) => {
            const irisX = center.x * canvas.width;
            const irisY = center.y * canvas.height;

            // Draw center dot
            ctx.fillStyle = "rgba(6, 182, 212, 1)";
            ctx.beginPath();
            ctx.arc(irisX, irisY, 3, 0, 2 * Math.PI);
            ctx.fill();

            // Project gaze line (deflect by degrees)
            const rayLen = 90;
            const dx = -Math.sin(directionYaw * Math.PI / 180) * rayLen;
            const dy = Math.sin(directionPitch * Math.PI / 180) * rayLen;

            ctx.strokeStyle = "rgba(34, 211, 238, 0.95)";
            ctx.lineWidth = 2.0;
            ctx.beginPath();
            ctx.moveTo(irisX, irisY);
            ctx.lineTo(irisX + dx, irisY + dy);
            ctx.stroke();

            // End vector circle
            ctx.fillStyle = "rgba(34, 211, 238, 0.8)";
            ctx.beginPath();
            ctx.arc(irisX + dx, irisY + dy, 4, 0, 2 * Math.PI);
            ctx.fill();
          };

          drawEyeGaze(landmarks.leftIrisCenter, metrics.gazeYaw, metrics.gazePitch);
          drawEyeGaze(landmarks.rightIrisCenter, metrics.gazeYaw, metrics.gazePitch);
        }

        // 4. Draw Head Pose Coordinates (Nose axis)
        if (drawHeadPose && landmarks?.noseTip) {
          const noseX = landmarks.noseTip.x * canvas.width;
          const noseY = landmarks.noseTip.y * canvas.height;

          const yaw = metrics.headYaw;
          const pitch = metrics.headPitch;
          const roll = metrics.headRoll;

          // Compute pose projection lines
          const axisLength = 80;

          // Z-axis (pointing straight out of nose - Blue)
          const zx = noseX - Math.sin(yaw * Math.PI / 180) * axisLength;
          const zy = noseY + Math.sin(pitch * Math.PI / 180) * axisLength;

          // X-axis (pointing left/right - Red)
          const xx = noseX + Math.cos(yaw * Math.PI / 180) * axisLength;
          const xy = noseY + Math.sin(roll * Math.PI / 180) * axisLength;

          // Y-axis (pointing up/down - Green)
          const yx = noseX - Math.sin(roll * Math.PI / 180) * axisLength;
          const yy = noseY + Math.cos(pitch * Math.PI / 180) * axisLength;

          // Draw axes
          const drawAxis = (tx: number, ty: number, color: string, label: string) => {
            ctx.strokeStyle = color;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(noseX, noseY);
            ctx.lineTo(tx, ty);
            ctx.stroke();

            ctx.fillStyle = color;
            ctx.font = "bold 10px monospace";
            ctx.fillText(label, tx + 4, ty + 4);
          };

          drawAxis(zx, zy, "rgba(59, 130, 246, 0.95)", "Z"); // Blue (Yaw/Pitch)
          drawAxis(xx, xy, "rgba(239, 68, 68, 0.95)", "X");  // Red (Pitch/Roll)
          drawAxis(yx, yy, "rgba(34, 197, 94, 0.95)", "Y");  // Green (Roll/Pitch)

          // Draw origin anchor dot
          ctx.fillStyle = "white";
          ctx.beginPath();
          ctx.arc(noseX, noseY, 3, 0, 2 * Math.PI);
          ctx.fill();
        }
      }

      // 5. Draw Object Detections (e.g. Phone, Laptop)
      const objectDetections = (pipeline as any)?.objectDetector?.lastResults || [];
      if (drawObjects && objectDetections.length > 0) {
        const objectScaleX = video.videoWidth > 0 ? canvas.width / video.videoWidth : 1;
        const objectScaleY = video.videoHeight > 0 ? canvas.height / video.videoHeight : 1;

        for (const obj of objectDetections) {
          const ox = obj.bbox.x * objectScaleX;
          const oy = obj.bbox.y * objectScaleY;
          const ow = obj.bbox.width * objectScaleX;
          const oh = obj.bbox.height * objectScaleY;

          ctx.strokeStyle = "rgba(239, 68, 68, 0.9)"; // Red alert for devices
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 3]);
          ctx.strokeRect(ox, oy, ow, oh);
          ctx.setLineDash([]); // Reset dash

          ctx.fillStyle = "rgba(239, 68, 68, 0.9)";
          ctx.font = "bold 10px sans-serif";
          const label = `${obj.class.toUpperCase()} (${Math.round(obj.confidence * 100)}%)`;
          const textWidth = ctx.measureText(label).width;

          ctx.fillRect(ox, oy - 16, textWidth + 8, 16);
          ctx.fillStyle = "white";
          ctx.fillText(label, ox + 4, oy - 4);
        }
      }

      animFrameId = requestAnimationFrame(draw);
    };

    animFrameId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animFrameId);
    };
  }, [cameraActive, pipeline, metrics, rawOutput, drawBBox, drawMesh, drawGaze, drawHeadPose, drawObjects]);

  // Clean up stream on component unmount
  useEffect(() => {
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto px-4 py-8">
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-white/10 pb-6 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-400 border border-violet-500/30">
              Developer Toolbox
            </span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              v2 Modular Pipeline
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            CV Invigilator Playground
          </h1>
          <p className="text-sm text-white/50 mt-1">
            Real-time verification, calibration, and visual profiling of the computer vision engine.
          </p>
        </div>

        {/* Global Connection Badges */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10">
            <span className={`w-2 h-2 rounded-full ${cameraActive ? "bg-emerald-400 animate-pulse" : "bg-white/20"}`} />
            <span className="text-xs text-white/60 font-mono">Webcam</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10">
            <span className={`w-2 h-2 rounded-full ${metrics.faceDetected ? "bg-emerald-400" : "bg-white/20"}`} />
            <span className="text-xs text-white/60 font-mono">FaceMesh</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10">
            <span className={`w-2 h-2 rounded-full ${(pipeline as any)?.objectDetector?.isInitialized ? "bg-emerald-400" : "bg-white/20"}`} />
            <span className="text-xs text-white/60 font-mono">COCO-SSD</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT COLUMN: Visualizer Feed & Display Controls (7 columns) */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* Webcam View Card */}
          <div className="relative overflow-hidden bg-black/60 rounded-3xl border border-white/10 shadow-2xl flex flex-col items-center justify-center min-h-[480px]">
            {permissionDenied && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-50 bg-black/85">
                <ShieldAlert className="h-16 w-16 text-rose-500 mb-4 animate-bounce" />
                <h3 className="text-lg font-bold text-rose-300 mb-2">Camera Access Blocked</h3>
                <p className="text-sm text-white/60 max-w-sm leading-relaxed mb-6">
                  Please enable camera permission in your browser settings to run the computer vision pipeline.
                </p>
                <button
                  onClick={startCamera}
                  className="px-6 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-medium shadow-lg transition-all"
                >
                  Try Access Again
                </button>
              </div>
            )}

            {!cameraActive && !permissionDenied && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-20">
                <VideoOff className="h-16 w-16 text-violet-400/50 mb-4" />
                <h3 className="text-xl font-bold text-white/90 mb-2">Initialize Sandbox Feed</h3>
                <p className="text-sm text-white/50 max-w-sm mb-6">
                  Launch your webcam to start sending video frames into the MediaPipe and TensorFlow modules.
                </p>
                <button
                  onClick={startCamera}
                  className="px-8 py-3 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold shadow-xl shadow-violet-500/20 transition-all scale-105 active:scale-95"
                >
                  Start Live Camera
                </button>
              </div>
            )}

            {/* The Video Element */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full max-h-[480px] object-cover transition-opacity duration-300 ${cameraActive ? "opacity-100" : "opacity-0"}`}
              width={CAMERA_WIDTH}
              height={CAMERA_HEIGHT}
            />

            {/* Drawing Canvas Overlay */}
            <canvas
              ref={canvasRef}
              className={`absolute top-0 left-0 w-full h-full object-cover pointer-events-none z-10 transition-opacity duration-300 ${cameraActive ? "opacity-100" : "opacity-0"}`}
            />

            {/* Tiny FPS/Resolution HUD at bottom of feed */}
            {cameraActive && (
              <div className="absolute bottom-4 left-4 z-20 px-3 py-1 rounded-lg bg-black/75 backdrop-blur-md border border-white/15 flex gap-4 text-[10px] text-white/60 font-mono">
                <span>Capture: {CAMERA_WIDTH}x{CAMERA_HEIGHT}</span>
                <span>Active Track ID: {metrics.faceDetected ? "local_mesh" : "none"}</span>
              </div>
            )}
          </div>

          {/* Rendering Layer Display Configurations */}
          <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
            <h3 className="text-sm font-bold text-white/80 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Sliders className="h-4 w-4 text-cyan-400" />
              Overlay Visualizations
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <label className="flex items-center gap-2.5 p-3 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={drawBBox}
                  onChange={(e) => setDrawBBox(e.target.checked)}
                  className="rounded border-white/20 text-violet-500 focus:ring-violet-500"
                />
                <span className="text-xs text-white/70">Bounding Box</span>
              </label>

              <label className="flex items-center gap-2.5 p-3 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={drawMesh}
                  onChange={(e) => setDrawMesh(e.target.checked)}
                  className="rounded border-white/20 text-violet-500 focus:ring-violet-500"
                />
                <span className="text-xs text-white/70">Landmark Mesh</span>
              </label>

              <label className="flex items-center gap-2.5 p-3 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={drawGaze}
                  onChange={(e) => setDrawGaze(e.target.checked)}
                  className="rounded border-white/20 text-violet-500 focus:ring-violet-500"
                />
                <span className="text-xs text-white/70">Gaze Vectors</span>
              </label>

              <label className="flex items-center gap-2.5 p-3 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={drawHeadPose}
                  onChange={(e) => setDrawHeadPose(e.target.checked)}
                  className="rounded border-white/20 text-violet-500 focus:ring-violet-500"
                />
                <span className="text-xs text-white/70">Head Pose Axes</span>
              </label>

              <label className="flex items-center gap-2.5 p-3 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={drawObjects}
                  onChange={(e) => setDrawObjects(e.target.checked)}
                  className="rounded border-white/20 text-violet-500 focus:ring-violet-500"
                />
                <span className="text-xs text-white/70">Object Detection</span>
              </label>

              {cameraActive && (
                <button
                  onClick={stopCamera}
                  className="flex items-center justify-center gap-1.5 p-3 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-400 hover:bg-rose-500/25 transition-colors font-medium text-xs cursor-pointer"
                >
                  <VideoOff className="h-3.5 w-3.5" />
                  Deactivate Camera
                </button>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Metrics Dashboard & Config Sliders (5 columns) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* Radial score / state status summary */}
          <div className="p-6 rounded-3xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 backdrop-blur-md flex items-center justify-between shadow-2xl relative overflow-hidden">
            {/* Background glow base */}
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-violet-600/20 rounded-full blur-3xl pointer-events-none" />

            <div className="flex flex-col">
              <span className="text-xs text-white/40 uppercase tracking-widest font-mono mb-1">
                Aggregated Focus
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-extrabold text-white tracking-tight">
                  {metrics.score}
                </span>
                <span className="text-sm font-semibold text-white/60">%</span>
              </div>
              <span className="text-xs text-white/50 mt-2">
                State:{" "}
                <span
                  className={`font-semibold px-2 py-0.5 rounded-full text-[10px] uppercase font-mono tracking-wider ${
                    metrics.status === "focused"
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : metrics.status === "distracted"
                      ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                      : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                  }`}
                >
                  {metrics.status}
                </span>
              </span>
            </div>

            {/* Big Status Dial */}
            <div className="relative h-24 w-24 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90">
                {/* Circle track */}
                <circle
                  cx="48"
                  cy="48"
                  r="38"
                  className="stroke-white/10"
                  strokeWidth="8"
                  fill="none"
                />
                {/* Score bar */}
                <circle
                  cx="48"
                  cy="48"
                  r="38"
                  className={`transition-all duration-300 ${
                    metrics.status === "focused"
                      ? "stroke-emerald-400"
                      : metrics.status === "distracted"
                      ? "stroke-amber-400"
                      : "stroke-rose-400"
                  }`}
                  strokeWidth="8"
                  strokeDasharray={`${2 * Math.PI * 38}`}
                  strokeDashoffset={`${2 * Math.PI * 38 * (1 - metrics.score / 100)}`}
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>
              {/* Dial label */}
              <div className="absolute inset-0 flex items-center justify-center">
                <Activity
                  className={`h-6 w-6 ${
                    metrics.status === "focused"
                      ? "text-emerald-400"
                      : metrics.status === "distracted"
                      ? "text-amber-400"
                      : "text-rose-400"
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Feature Grid / Modules Dashboard */}
          <div className="p-6 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-md flex flex-col gap-5">
            <h3 className="text-sm font-bold text-white/80 uppercase tracking-wider flex items-center gap-2">
              <Activity className="h-4 w-4 text-violet-400" />
              CV Modules Realtime Metrics
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Eye Close & Blinks */}
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col gap-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-white/50">Eyes Status</span>
                  {metrics.eyesOpen ? (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <Eye className="h-3 w-3" /> Open
                    </span>
                  ) : (
                    <span className="text-rose-400 flex items-center gap-1 font-semibold animate-pulse">
                      <EyeOff className="h-3 w-3" /> Closed
                    </span>
                  )}
                </div>
                <div className="flex justify-between items-baseline mt-1 font-mono">
                  <span className="text-[10px] text-white/40">Blink Rate</span>
                  <span className="text-sm font-bold text-white/80">{metrics.blinkRate} BPM</span>
                </div>
              </div>

              {/* Gaze Target */}
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col gap-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-white/50">Gaze Target</span>
                  <span className="font-mono text-cyan-400 font-semibold text-xs capitalize">
                    {metrics.gazeDirection}
                  </span>
                </div>
                <div className="flex justify-between items-baseline mt-1 font-mono">
                  <span className="text-[10px] text-white/40">Eye Deviation</span>
                  <span className="text-sm font-bold text-white/80">
                    {metrics.effectiveDeviation}°
                  </span>
                </div>
              </div>

              {/* Mouth & Yawning */}
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col gap-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-white/50">Yawn Monitor</span>
                  {metrics.yawning ? (
                    <span className="text-rose-400 font-semibold animate-pulse flex items-center gap-1">
                      <Brain className="h-3.5 w-3.5" /> Yawning
                    </span>
                  ) : (
                    <span className="text-white/40">Inactive</span>
                  )}
                </div>
                <div className="flex justify-between items-baseline mt-1 font-mono">
                  <span className="text-[10px] text-white/40">MAR Value</span>
                  <span className="text-sm font-bold text-white/80">
                    {rawOutput?.mouthState ? Math.round((rawOutput as any).mouthState.mar * 100) / 100 : "0.00"}
                  </span>
                </div>
              </div>

              {/* Forbidden Objects */}
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col gap-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-white/50">Devices Scans</span>
                  {metrics.phoneDetected ? (
                    <span className="text-rose-400 font-semibold animate-pulse flex items-center gap-1">
                      <Smartphone className="h-3.5 w-3.5" /> PHONE
                    </span>
                  ) : (
                    <span className="text-emerald-400/80">Clear</span>
                  )}
                </div>
                <div className="flex justify-between items-baseline mt-1 font-mono">
                  <span className="text-[10px] text-white/40">Detected Count</span>
                  <span className="text-sm font-bold text-white/80">
                    {((pipeline as any)?.objectDetector?.lastResults || []).length} obj
                  </span>
                </div>
              </div>
            </div>

            {/* Head Pose Orientation sliders */}
            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col gap-3 font-mono text-xs">
              <span className="text-white/50 font-bold tracking-wider uppercase text-[10px] mb-1">
                Head Pose Orientation
              </span>

              {/* Yaw */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-white/40">Yaw (Left / Right)</span>
                  <span className={`font-semibold ${Math.abs(metrics.headYaw) > yawThreshold ? "text-amber-400" : "text-white/60"}`}>
                    {Math.round(metrics.headYaw)}°
                  </span>
                </div>
                <div className="h-1.5 bg-white/10 rounded-full relative overflow-hidden">
                  <div
                    className="absolute h-full bg-violet-400 transition-all"
                    style={{
                      left: "50%",
                      width: `${Math.min(Math.abs(metrics.headYaw), 45) / 90 * 100}%`,
                      transform: metrics.headYaw < 0 ? "translateX(-100%)" : "translateX(0)"
                    }}
                  />
                </div>
              </div>

              {/* Pitch */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-white/40">Pitch (Up / Down)</span>
                  <span className={`font-semibold ${Math.abs(metrics.headPitch) > pitchThreshold ? "text-amber-400" : "text-white/60"}`}>
                    {Math.round(metrics.headPitch)}°
                  </span>
                </div>
                <div className="h-1.5 bg-white/10 rounded-full relative overflow-hidden">
                  <div
                    className="absolute h-full bg-violet-400 transition-all"
                    style={{
                      left: "50%",
                      width: `${Math.min(Math.abs(metrics.headPitch), 45) / 90 * 100}%`,
                      transform: metrics.headPitch < 0 ? "translateX(-100%)" : "translateX(0)"
                    }}
                  />
                </div>
              </div>

              {/* Roll */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-white/40">Roll (Tilt Angle)</span>
                  <span className="text-white/60">{Math.round(metrics.headRoll)}°</span>
                </div>
                <div className="h-1.5 bg-white/10 rounded-full relative overflow-hidden">
                  <div
                    className="absolute h-full bg-violet-400 transition-all"
                    style={{
                      left: "50%",
                      width: `${Math.min(Math.abs(metrics.headRoll), 45) / 90 * 100}%`,
                      transform: metrics.headRoll < 0 ? "translateX(-100%)" : "translateX(0)"
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Violations / Penalties Audit log */}
            <div className="flex flex-col gap-2 border-t border-white/5 pt-4">
              <span className="text-[10px] text-white/40 uppercase tracking-widest font-mono">
                Recent Violation Alarms
              </span>
              <div className="flex flex-col gap-1.5 max-h-[120px] overflow-y-auto pr-1">
                {rawOutput?.violations && rawOutput.violations.length > 0 ? (
                  rawOutput.violations.map((violation, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between text-[11px] px-2.5 py-1.5 rounded-lg border border-rose-500/20 bg-rose-500/10 text-rose-300 font-mono"
                    >
                      <span className="flex items-center gap-1.5 font-semibold">
                        <AlertTriangle className="h-3.5 w-3.5 text-rose-400 animate-pulse" />
                        {violation.type.toUpperCase()}
                      </span>
                      <span className="text-[10px] text-rose-400/80 uppercase">
                        Severity: {violation.severity}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 px-2.5 py-2 rounded-lg border border-emerald-500/10 bg-emerald-500/5 font-mono">
                    <CheckCircle className="h-3.5 w-3.5" />
                    Student compliance checks healthy. No violations.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Parameter Tuning panel */}
          <div className="p-6 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-md flex flex-col gap-4">
            <h3 className="text-sm font-bold text-white/80 uppercase tracking-wider flex items-center gap-2">
              <Settings className="h-4 w-4 text-cyan-400" />
              Threshold Calibration
            </h3>

            <div className="flex flex-col gap-4 font-mono text-xs">
              {/* Eye Closure */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between">
                  <span className="text-white/50">Closed EAR Limit</span>
                  <span className="text-cyan-400 font-semibold">{earClosed.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.10"
                  max="0.30"
                  step="0.01"
                  value={earClosed}
                  onChange={(e) => setEarClosed(parseFloat(e.target.value))}
                  className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
              </div>

              {/* Mouth Yawn */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between">
                  <span className="text-white/50">Yawning MAR Limit</span>
                  <span className="text-cyan-400 font-semibold">{marYawn.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.40"
                  max="0.85"
                  step="0.01"
                  value={marYawn}
                  onChange={(e) => setMarYawn(parseFloat(e.target.value))}
                  className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
              </div>

              {/* Gaze Deviation Horizontal */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between">
                  <span className="text-white/50">Gaze Horiz Limit</span>
                  <span className="text-cyan-400 font-semibold">{gazeHorizontal}°</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="30"
                  step="1"
                  value={gazeHorizontal}
                  onChange={(e) => setGazeHorizontal(parseInt(e.target.value))}
                  className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
              </div>

              {/* Gaze Deviation Vertical */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between">
                  <span className="text-white/50">Gaze Vert Limit</span>
                  <span className="text-cyan-400 font-semibold">{gazeVertical}°</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="30"
                  step="1"
                  value={gazeVertical}
                  onChange={(e) => setGazeVertical(parseInt(e.target.value))}
                  className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
              </div>

              {/* Head Yaw */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between">
                  <span className="text-white/50">Head Yaw Limit</span>
                  <span className="text-cyan-400 font-semibold">{yawThreshold}°</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="45"
                  step="1"
                  value={yawThreshold}
                  onChange={(e) => setYawThreshold(parseInt(e.target.value))}
                  className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
              </div>

              {/* Gaze Angle Dead Zone */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between">
                  <span className="text-white/50">Gaze Dead Zone</span>
                  <span className="text-cyan-400 font-semibold">{deadZone}°</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="25"
                  step="1"
                  value={deadZone}
                  onChange={(e) => setDeadZone(parseInt(e.target.value))}
                  className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
