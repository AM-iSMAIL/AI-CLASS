"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import { createPortal } from "react-dom"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import {
  Brain,
  Users,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Hand,
  MessageSquare,
  ScreenShare,
  Play,
  Pause,
  X,
  AlertCircle,
  Clock,
  LogOut,
  RotateCcw,
  Send,
  Volume2,
  VolumeX,
  Eye,
  VideoOff as CameraOff,
  Search,
  MoreHorizontal,
  Loader2,
  Lock,
  AlertTriangle,
} from "lucide-react"

import { getFile } from "@/lib/fileStorage"
import { extractPDFPages } from "@/lib/pdfParser"
import StudentCamera from "@/components/StudentCamera"
import type { FocusMetrics } from "@/lib/cv/use-cv-pipeline"
import { subscribeToStudents, subscribeToSession, syncClassroomProgress, setStudentOffline, checkIsIdKicked, checkIsKicked, isStudentRegistered, endSession, kickStudent, removeStudent } from "@/lib/session-service"
import { classroomContext } from "@/lib/classroom-context"

/* ─── MOCK DATA ─── */

const DOUBT_RESPONSES = [
  "Excellent question! In thermodynamics, we define systems as open, closed, or isolated. Energy can cross boundaries in a closed system, but matter cannot.",
  "Great question. Carnot efficiency is the theoretical maximum because it assumes zero friction and perfectly reversible processes.",
  "Entropy can be thought of as the number of microstates available to a system. Higher entropy means more disorder.",
  "Absolute zero is the theoretical lower limit of temperature. The Third Law states you cannot reach it in a finite number of steps.",
]

const parseExplanationToSlides = (text: string) => {
  const lines = text.split("\n");
  const slides: Array<{ text: string; imagePrompt?: string }> = [];
  
  let currentText = "";
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("IMAGE_PROMPT:")) {
      const prompt = trimmed.replace("IMAGE_PROMPT:", "").trim();
      if (currentText.trim()) {
        slides.push({ text: currentText.trim(), imagePrompt: prompt });
        currentText = "";
      } else if (slides.length > 0) {
        slides[slides.length - 1].imagePrompt = prompt;
      }
    } else {
      if (trimmed) {
        currentText = currentText ? currentText + " " + trimmed : trimmed;
      }
    }
  }
  if (currentText.trim()) {
    slides.push({ text: currentText.trim() });
  }
  return slides;
};


const splitIntoShortClauses = (text: string): string[] => {
  const parts = text.split(/([,;:!?.\n])/);
  const rawClauses: string[] = [];
  let currentClause = "";
  
  for (let i = 0; i < parts.length; i += 2) {
    const segment = parts[i];
    const delimiter = parts[i + 1] || "";
    const combined = (segment + delimiter).trim();
    if (!combined) continue;
    
    if (currentClause) {
      const wordCount = currentClause.split(/\s+/).length;
      if (wordCount < 5 || currentClause.length < 25) {
        currentClause += " " + combined;
        continue;
      }
      rawClauses.push(currentClause.trim());
    }
    currentClause = combined;
  }
  if (currentClause) {
    rawClauses.push(currentClause.trim());
  }

  const finalClauses: string[] = [];
  for (const clause of rawClauses) {
    const words = clause.split(/\s+/);
    if (words.length > 15) {
      for (let i = 0; i < words.length; i += 10) {
        const subWords = words.slice(i, i + 10);
        finalClauses.push(subWords.join(" "));
      }
    } else {
      finalClauses.push(clause);
    }
  }

  return finalClauses.filter(Boolean);
};


const renderTranscriptText = (
  text: string,
  aiSpeechState: string
) => {
  if (!text) return null;
  const parts = text.split(/\n/).filter(line => !line.trim().startsWith("IMAGE_PROMPT:"));
  
  return (
    <div className="space-y-2">
      {parts.map((part, index) => {
        return (
          <p
            key={index}
            style={{ fontSize: 15, lineHeight: 1.6 }}
            className={`font-medium transition-colors duration-300 ${
              aiSpeechState === "speaking" ? "text-purple-300" : "text-white/35"
            }`}
          >
            {part}
          </p>
        );
      })}
    </div>
  );
};

/* ─── COMPONENT ─── */

export default function LiveClassroomPage() {
  const params = useParams()
  const router = useRouter()
  const sessionCode = ((params.code as string) || "UNKNOWN").toUpperCase()

  const [sessionTitle, setSessionTitle] = useState("")
  const [sessionSubject, setSessionSubject] = useState("")
  const [topics, setTopics] = useState<string[]>([])
  const [teachingMode, setTeachingMode] = useState<"AI" | "Human">("AI")
  const [isTeacher, setIsTeacher] = useState(true)
  const isStudent = !isTeacher;
  const [studentId, setStudentId] = useState("unknown-student")
  const [studentName, setStudentName] = useState<string | null>(null)
  const [hasEntered, setHasEntered] = useState(false)
  const [startupGraceActive, setStartupGraceActive] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [pdfPages, setPdfPages] = useState<string[]>([])
  const [isPdfMode, setIsPdfMode] = useState(false)
  const [isParsingPdf, setIsParsingPdf] = useState(true)

  const [activeTopicIdx, setActiveTopicIdx] = useState(0)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [micOn, setMicOn] = useState(true)
  const [videoOn, setVideoOn] = useState(true)
  const [handRaised, setHandRaised] = useState(false)
  const [chatOpen, setChatOpen] = useState(true)
  const [isRecording, setIsRecording] = useState(false)
  const [screenSharing, setScreenSharing] = useState(false)

  const [aiSpeechState, setAiSpeechState] = useState<"speaking" | "paused" | "idle">("idle")
  const [liveSubtitles, setLiveSubtitles] = useState("")
  const [speechEnabled, setSpeechEnabled] = useState(true)
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null)
  const activeAudioRef = useRef<HTMLAudioElement | null>(null)
  const ttsQueueRef = useRef<Array<{ text: string; onEnd?: () => void; audio?: HTMLAudioElement | null; promise?: Promise<any> | null; error?: boolean; imagePrompt?: string; imageUrl?: string | null; imagePromise?: Promise<any> | null; runId: number; slideIndex: number }>>([])
  const isTtsPlayingRef = useRef<boolean>(false)
  const ttsRunIdRef = useRef(0)
  const currentSlideIdxRef = useRef(0)
  const streamCompletedRef = useRef(false)
  const hasStartedRef = useRef(false)
  
  // Lecture pause/resume state machine
  const [lecturePlayState, setLecturePlayState] = useState<"PLAYING" | "PAUSED_FOR_DOUBT" | "RESUMING">("PLAYING")
  const lectureAbortRef = useRef<AbortController | null>(null)
  const savedLectureStateRef = useRef<{ topicIdx: number; fullTranscript: string; sentenceBuffer: string; } | null>(null)
  const resumePendingRef = useRef<boolean>(false)

  const prefetchedLectures = useRef<Record<string, { promise: Promise<Response | void>, time: number, consumed: boolean, fullText?: string, firstImageUrl?: string | null, firstAudioBase64?: string }>>({})

  const [transcript, setTranscript] = useState("")
  const [pastTranscripts, setPastTranscripts] = useState<string[]>([])
  const [topicImageUrl, setTopicImageUrl] = useState<string | null>(null)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageFading, setImageFading] = useState(false)
  const [lectureHistory, setLectureHistory] = useState<Array<{ role: string, content: string }>>([])
  const [isGeneratingImage, setIsGeneratingImage] = useState(false)
  const [imageError, setImageError] = useState<string | null>(null)

  const [students, setStudents] = useState<any[]>([])
  const [classFocus, setClassFocus] = useState(0)
  const [localMetrics, setLocalMetrics] = useState<FocusMetrics>({score: 0, status: "offline", gazeDirection: "unknown", faceDetected: false, eyesOpen: false, headYaw: 0, headPitch: 0, headRoll: 0, yawning: false, blinkRate: 0, gazeYaw: 0, gazePitch: 0, irisEngagement: 50, effectiveDeviation: 0, phoneDetected: false})
  
  const [warningLevel, setWarningLevel] = useState(0)
  const [strikeCount, setStrikeCount] = useState(0) // Persistent strike counter across clicks
  const [outOfFrameSecondsLeft, setOutOfFrameSecondsLeft] = useState<number | null>(null)
  const [phoneWarningCount, setPhoneWarningCount] = useState(0)
  const [showPhoneWarning, setShowPhoneWarning] = useState(false)
  const [phoneSecondsLeft, setPhoneSecondsLeft] = useState<number | null>(null)
  const [endCountdown, setEndCountdown] = useState<number | null>(null)
  const [sessionStatus, setSessionStatus] = useState<string>("Active")

  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const outOfFrameTimerRef = useRef<NodeJS.Timeout | null>(null)
  const outOfFrameIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const phoneTimerRef = useRef<NodeJS.Timeout | null>(null)
  const phoneIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const phoneClearTimerRef = useRef<NodeJS.Timeout | null>(null)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({})
  const peerRef = useRef<any>(null)
  const callsRef = useRef<Record<string, any>>({})

  const [chatInput, setChatInput] = useState("")
  const [isAnswering, setIsAnswering] = useState(false)
  const isAnsweringRef = useRef(false)
  const transcriptRef = useRef<string[]>([])
  const [messages, setMessages] = useState(classroomContext.getState().conversationHistory)

  useEffect(() => {
    // Initial welcome message if empty
    if (classroomContext.getState().conversationHistory.length === 0) {
      classroomContext.addMessage({ id: "welcome", sender: "Professor AI", text: "Welcome to today's session. Type any doubts here and I'll pause to answer.", time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), isAI: true, role: "assistant" })
    }
    const unsubscribe = classroomContext.subscribe((state) => {
      setMessages(state.conversationHistory)
    })
    return unsubscribe
  }, [])

  // ── Warning escalation engine ──
  useEffect(() => {
    if (!hasEntered || !videoOn || endCountdown !== null || sessionStatus === "Completed") return;

    const clearPending = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    // Trigger strike escalation when face is in frame and student focus score is 30 or less, or if phone is detected
    const isUnfocused =
      localMetrics.faceDetected && (
        localMetrics.score <= 30 ||
        localMetrics.phoneDetected
      );

    const STRIKE_STEP_DELAY = 2500; // 2.5s between strikes
    const AUTO_KICK_DELAY = 4000;    // 4s after Strike 3 to kick

    if (isUnfocused) {
      if (timerRef.current) return; // Keep existing timeout running without resetting it

      // Calculate what the NEXT strike should be based on current persistent strike count
      const nextStrike = Math.min(3, strikeCount + 1);

      // Display warning modal overlay if not currently shown
      if (warningLevel === 0) {
        setTimeout(() => {
          setWarningLevel(nextStrike);
        }, 0);
      }

      // Automatically advance to the next strike if they remain distracted
      timerRef.current = setTimeout(async () => {
        timerRef.current = null;
        if (nextStrike === 1) {
          setStrikeCount(1);
          setWarningLevel(2); // Escalate to show Strike 2 next
        } else if (nextStrike === 2) {
          setStrikeCount(2);
          setWarningLevel(3); // Escalate to show Strike 3 next
        } else if (nextStrike === 3) {
          setStrikeCount(3);
          // Fired 3 strikes, kick student after AUTO_KICK_DELAY
          setTimeout(async () => {
            const storedName = studentName || "Unknown";
            if (!isTeacher) await kickStudent(sessionCode, studentId, storedName);
            window.location.href = `/session/${sessionCode}/summary?kicked=true`;
          }, AUTO_KICK_DELAY);
        }
      }, STRIKE_STEP_DELAY);
    } else {
      // If user refocuses, clear running warning timers. Keep warningLevel = 0 so modal closes.
      clearPending();
      if (warningLevel > 0) {
        setTimeout(() => {
          setWarningLevel(0);
        }, 0);
      }
    }

    return () => {
      // Clean up on unmount or dependency updates (without clearing progress on stable unfocused status)
    };
  }, [localMetrics.status, localMetrics.score, localMetrics.faceDetected, localMetrics.phoneDetected, localMetrics.effectiveDeviation, localMetrics.gazeDirection, warningLevel, strikeCount, hasEntered, videoOn, isTeacher, sessionCode, studentId, studentName, endCountdown, sessionStatus]);

  // Startup grace period timer to delay detection at the start of class
  useEffect(() => {
    if (hasEntered) {
      const timer = setTimeout(() => {
        setStartupGraceActive(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [hasEntered]);

  // ── Out of frame auto-kick engine ──
  useEffect(() => {
    if (!hasEntered || !videoOn || endCountdown !== null || sessionStatus === "Completed" || startupGraceActive) return;

    const clearOutOfFrameTimers = () => {
      if (outOfFrameTimerRef.current) {
        clearTimeout(outOfFrameTimerRef.current);
        outOfFrameTimerRef.current = null;
      }
      if (outOfFrameIntervalRef.current) {
        clearInterval(outOfFrameIntervalRef.current);
        outOfFrameIntervalRef.current = null;
      }
      setTimeout(() => {
        setOutOfFrameSecondsLeft(null);
      }, 0);
    };

    if (localMetrics.faceDetected) {
      clearOutOfFrameTimers();
      return;
    }

    setTimeout(() => {
      setOutOfFrameSecondsLeft(5);
    }, 0);

    outOfFrameIntervalRef.current = setInterval(() => {
      setOutOfFrameSecondsLeft((prev) => {
        if (prev === null) return null;
        return prev > 1 ? prev - 1 : 0;
      });
    }, 1000);

    outOfFrameTimerRef.current = setTimeout(async () => {
      const storedName = studentName || "Unknown";
      if (!isTeacher) await kickStudent(sessionCode, studentId, storedName);
      window.location.href = `/session/${sessionCode}/summary?kicked=true&reason=out_of_frame`;
    }, 5000);

    return () => {
      clearOutOfFrameTimers();
    };
  }, [localMetrics.faceDetected, hasEntered, videoOn, isTeacher, sessionCode, studentId, studentName, endCountdown, sessionStatus, startupGraceActive]);

  // ── Phone usage warning engine ──
  useEffect(() => {
    if (!hasEntered || !videoOn || endCountdown !== null || sessionStatus === "Completed") return;

    const clearPhoneTimers = () => {
      if (phoneTimerRef.current) {
        clearTimeout(phoneTimerRef.current);
        phoneTimerRef.current = null;
      }
      if (phoneIntervalRef.current) {
        clearInterval(phoneIntervalRef.current);
        phoneIntervalRef.current = null;
      }
      setTimeout(() => {
        setPhoneSecondsLeft(null);
        setShowPhoneWarning(false);
      }, 0);
    };

    if (!localMetrics.phoneDetected) {
      // Start a debounce timeout before clearing
      if (!phoneClearTimerRef.current) {
        phoneClearTimerRef.current = setTimeout(() => {
          clearPhoneTimers();
          phoneClearTimerRef.current = null;
        }, 3000); // 3 seconds of no-phone before clearing
      }
      return;
    } else {
      // Phone detected - cancel any pending clear timeout
      if (phoneClearTimerRef.current) {
        clearTimeout(phoneClearTimerRef.current);
        phoneClearTimerRef.current = null;
      }
    }

    // Phone detected - start warning flow (only if warning modal isn't already active)
    if (!showPhoneWarning) {
      setTimeout(() => {
        setShowPhoneWarning(true);
        setPhoneSecondsLeft(5);
      }, 0);

      phoneIntervalRef.current = setInterval(() => {
        setPhoneSecondsLeft((prev) => {
          if (prev === null) return null;
          return prev > 1 ? prev - 1 : 0;
        });
      }, 1000);

      phoneTimerRef.current = setTimeout(async () => {
        // 5 seconds completed - escalate warning count
        setPhoneWarningCount((prevCount) => {
          const nextCount = prevCount + 1;
          if (nextCount >= 3) {
            // Kicked out on 3rd warning
            const kickAsync = async () => {
              const storedName = studentName || "Unknown";
              if (!isTeacher) await kickStudent(sessionCode, studentId, storedName);
              window.location.href = `/session/${sessionCode}/summary?kicked=true&reason=device_usage`;
            };
            kickAsync();
          }
          return nextCount;
        });
        // Clear the current active countdown
        if (phoneIntervalRef.current) {
          clearInterval(phoneIntervalRef.current);
          phoneIntervalRef.current = null;
        }
        setPhoneSecondsLeft(null);
      }, 5000);
    }

    return () => {
      // Do NOT clear timers immediately on render transitions to prevent resetting on momentary drops
    };
  }, [localMetrics.phoneDetected, hasEntered, videoOn, isTeacher, sessionCode, studentId, studentName, endCountdown, sessionStatus, showPhoneWarning]);
  const chatEndRef = useRef<HTMLDivElement>(null)
  const transcriptEndRef = useRef<HTMLDivElement>(null)

  const [toasts, setToasts] = useState<Array<{ id: string; text: string }>>([])
  const [showEndModal, setShowEndModal] = useState(false)

  // --- Immersive Meeting Design States & Refs ---
  const [showToolbar, setShowToolbar] = useState(true)
  const [isParticipantsOpen, setIsParticipantsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [showOnlyActive, setShowOnlyActive] = useState(false)
  const [speakingStudentIds, setSpeakingStudentIds] = useState<Set<string>>(new Set())
  const [showMoreMenu, setShowMoreMenu] = useState(false)

  // Drawer Drag & Hint states
  const [startX, setStartX] = useState(0)
  const [currentX, setCurrentX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState(0)
  const [showHint, setShowHint] = useState(false)

  const isHoveringToolbarRef = useRef(false)
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const participantsPanelRef = useRef<HTMLDivElement>(null)
  const participantsTabRef = useRef<HTMLButtonElement>(null)
  const moreMenuRef = useRef<HTMLDivElement>(null)
  const drawerRef = useRef<HTMLDivElement>(null)

  // Hydrate hint display from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const interacted = localStorage.getItem("hasInteractedParticipants")
      if (!interacted) {
        setTimeout(() => {
          setShowHint(true)
        }, 0)
      }
    }
  }, [])

  // Interaction helper to clear hint
  const handleParticipantsInteraction = useCallback(() => {
    setShowHint(false)
    try {
      localStorage.setItem("hasInteractedParticipants", "true")
    } catch { /* ignore */ }
  }, [])

  // Mouse Drag listeners on window
  useEffect(() => {
    if (!isDragging) return
    const handleMouseMove = (e: MouseEvent) => {
      setCurrentX(e.clientX)
      setDragOffset(e.clientX - startX)
    }
    const handleMouseUp = (e: MouseEvent) => {
      setIsDragging(false)
      const dx = e.clientX - startX
      if (isParticipantsOpen) {
        if (dx > 80) {
          setIsParticipantsOpen(false)
          localStorage.setItem("participantsOpen", "false")
        }
      } else {
        if (dx < -80) {
          setIsParticipantsOpen(true)
          handleParticipantsInteraction()
          localStorage.setItem("participantsOpen", "true")
        }
      }
      setDragOffset(0)
    }
    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", handleMouseUp)
    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
    }
  }, [isDragging, startX, isParticipantsOpen, handleParticipantsInteraction])

  // Touch Swipe / Drag listeners on window
  useEffect(() => {
    if (!isDragging) return
    const handleTouchMove = (e: TouchEvent) => {
      setCurrentX(e.touches[0].clientX)
      setDragOffset(e.touches[0].clientX - startX)
    }
    const handleTouchEnd = () => {
      setIsDragging(false)
      const dx = currentX - startX
      if (isParticipantsOpen) {
        if (dx > 80) {
          setIsParticipantsOpen(false)
          localStorage.setItem("participantsOpen", "false")
        }
      } else {
        if (dx < -80) {
          setIsParticipantsOpen(true)
          handleParticipantsInteraction()
          localStorage.setItem("participantsOpen", "true")
        }
      }
      setDragOffset(0)
    }
    window.addEventListener("touchmove", handleTouchMove, { passive: true })
    window.addEventListener("touchend", handleTouchEnd)
    return () => {
      window.removeEventListener("touchmove", handleTouchMove)
      window.removeEventListener("touchend", handleTouchEnd)
    }
  }, [isDragging, startX, currentX, isParticipantsOpen, handleParticipantsInteraction])

  // Deterministic student mock features helper
  const getStudentSimulatedProps = useCallback((id: string) => {
    let hash = 0
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash)
    }
    hash = Math.abs(hash)
    const isMuted = (hash % 3) === 0
    const hasHandRaised = (hash % 11) === 0
    const connectionQual = (hash % 10) > 7 ? "Fair" : (hash % 10) > 4 ? "Good" : "Excellent"
    return { isMuted, hasHandRaised, connectionQual }
  }, [])

  const getStudentProps = useCallback((s: any) => {
    const isSelf = s.id === studentId
    if (isSelf) {
      return {
        isMuted: !micOn,
        hasHandRaised: handRaised,
        connectionQual: "Excellent",
      }
    }
    return getStudentSimulatedProps(s.id)
  }, [studentId, micOn, handRaised, getStudentSimulatedProps])

  const getDrawerWidth = useCallback(() => {
    if (typeof window !== "undefined") {
      if (window.innerWidth < 768) return window.innerWidth * 0.85
      if (window.innerWidth < 1024) return 320
    }
    return 360
  }, [])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setIsDragging(true)
    setStartX(e.touches[0].clientX)
    setCurrentX(e.touches[0].clientX)
    setDragOffset(0)
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true)
    setStartX(e.clientX)
    setCurrentX(e.clientX)
    setDragOffset(0)
  }, [])

  /* ─── INIT & VALIDATION ─── */
  useEffect(() => {
    let title = "Physics Lab Session"
    let subject = "Physics"
    let storedTopics: string | null = null
    let mode = "AI"
    let role = "teacher"
    let storedStudentId = "unknown-student"
    let storedStudentName = "Guest Student"

    try {
      title = localStorage.getItem("sessionTitle") || title
      subject = localStorage.getItem("sessionSubject") || subject
      storedTopics = localStorage.getItem("sessionTopics")
      mode = localStorage.getItem("teachingMode") || mode
      role = localStorage.getItem("userRole") || role
      storedStudentId = localStorage.getItem("studentId") || storedStudentId
      storedStudentName = localStorage.getItem("studentName") || storedStudentName
      const storedParticipantsOpen = localStorage.getItem("participantsOpen")
      setTimeout(() => {
        setIsParticipantsOpen(storedParticipantsOpen === "true")
        setSessionTitle(title)
        setSessionSubject(subject)
        if (storedTopics) {
          try { 
            const parsed = JSON.parse(storedTopics)
            if (Array.isArray(parsed) && parsed.length > 0) {
              setTopics(parsed)
            }
          } catch { /* keep default topics */ }
        }
        if (mode === "Human") setTeachingMode("Human")
        setIsTeacher(role === "teacher")
        setStudentId(storedStudentId)
        setStudentName(storedStudentName)
      }, 0)
    } catch { /* keep defaults */ }

    // Fetch live session directly from Firebase to ensure topics and subject are loaded
    const unsubscribeSessionInit = subscribeToSession(sessionCode, (updated) => {
      if (updated) {
        if (updated.title) setSessionTitle(updated.title)
        if (updated.subject) setSessionSubject(updated.subject)
        if (updated.topics && updated.topics.length > 0) setTopics(updated.topics)
        if (updated.teachingMode) setTeachingMode(updated.teachingMode as "AI" | "Human")
      }
    })

    // PDF Loading
    const loadPdf = async () => {
      try {
        const file = await getFile("session-pdf")
        if (file) {
          const pages = await extractPDFPages(file)
          if (pages.length > 0) {
            setPdfPages(pages)
            setIsPdfMode(true)
          }
        }
      } catch (err) {
        console.error("PDF load error:", err)
      } finally {
        setIsParsingPdf(false)
      }
    }
    loadPdf()

    // Access Check
    const checkAccess = async () => {
      if (role === "teacher") {
        setHasEntered(true)
        setLoading(false)
        return
      }

      try {
        // Check if kicked and registered in parallel to minimize database latency
        const [isKickedById, isKickedByName, registered] = await Promise.all([
          checkIsIdKicked(sessionCode, storedStudentId),
          checkIsKicked(sessionCode, storedStudentName),
          isStudentRegistered(sessionCode, storedStudentId)
        ]);

        if (isKickedById || isKickedByName) {
          setError("You have been kicked from this session and cannot rejoin.")
          setLoading(false)
          return
        }

        if (!registered) {
          setError("Access Denied. You did not join during the waiting time or are not registered in this session.")
          setLoading(false)
          return
        }
      } catch (err) {
        console.error("Error verifying student access:", err)
      }
      setHasEntered(true)
      setLoading(false)
    }

    checkAccess()

    return () => {
      unsubscribeSessionInit()
    }
  }, [sessionCode])

  // Context Synchronization
  useEffect(() => {
    classroomContext.updateState({
      sessionId: sessionCode,
      subject: sessionSubject,
      topic: topics[activeTopicIdx] || "",
    })
  }, [sessionCode, sessionSubject, topics, activeTopicIdx])

  const addToast = useCallback((text: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    setToasts((prev) => [...prev, { id, text }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000)
  }, [])



  /* ─── WEB SPEECH ─── */
  const stopSpeaking = useCallback(() => {
    try { window.speechSynthesis.cancel() } catch {}
    if (activeAudioRef.current) {
      try { activeAudioRef.current.pause() } catch {}
      activeAudioRef.current = null
    }
    ttsQueueRef.current = []
    isTtsPlayingRef.current = false
    ttsRunIdRef.current++
    setAiSpeechState("idle")
  }, [])

  // Immediate Session Termination Handler (Zero delay)
  const handleEndSession = useCallback(async () => {
    stopSpeaking()
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop())
    }
    try {
      await endSession(sessionCode)
    } catch (err) {
      console.error("Error ending session:", err)
    }
    window.location.href = `/session/${sessionCode}/summary`
  }, [sessionCode, localStream, stopSpeaking])

  // Immediate Leave Session Handler (Zero delay)
  const handleLeaveSession = useCallback(async () => {
    stopSpeaking()
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop())
    }
    if (!isTeacher && studentId) {
      try {
        await removeStudent(sessionCode, studentId)
      } catch (err) {
        console.error("Error removing student on leave:", err)
      }
    }
    if (isTeacher) {
      window.location.href = "/dashboard"
    } else {
      window.location.href = "/student-dashboard"
    }
  }, [sessionCode, isTeacher, studentId, localStream, stopSpeaking])

  // Real-time listener for session state (instantly redirects when teacher ends session)
  useEffect(() => {
    if (!sessionCode) return
    const unsubscribe = subscribeToSession(sessionCode, (updatedSession) => {
      if (updatedSession) {
        setSessionStatus(updatedSession.status || "Active")
      }
      if (updatedSession?.status === "Completed") {
        stopSpeaking()
        if (localStream) {
          localStream.getTracks().forEach((track) => track.stop())
        }
        window.location.href = `/session/${sessionCode}/summary`
      }
    })
    return () => unsubscribe()
  }, [sessionCode, localStream, stopSpeaking])

  const pauseSpeaking = useCallback(() => {
    try { window.speechSynthesis.pause() } catch {}
    if (activeAudioRef.current) {
      try { activeAudioRef.current.pause() } catch {}
    }
    setAiSpeechState("paused")
  }, [])

  const resumeSpeaking = useCallback(() => {
    try { window.speechSynthesis.resume() } catch {}
    if (activeAudioRef.current) {
      try { activeAudioRef.current.play() } catch {}
    }
    setAiSpeechState("speaking")
  }, [])


  const shouldFlushSpeechBuffer = (buffer: string) => {
    const trimmed = buffer.trim();
    if (!trimmed) return false;
    
    // 1. Hard punctuation (end of sentence/paragraph) or soft pauses (commas, semicolons, colons)
    if (/[.!?,;:](|$)/.test(trimmed)) return true;
    
    // 2. Newline: Only flush if it's a meaningful phrase (at least 3 words or 15 chars)
    if (buffer.includes("\n")) {
      const words = trimmed.split(/\s+/);
      if (words.length >= 3 || trimmed.length >= 15) return true;
    }
    
    // 3. Fallback: Only flush as a safety if the sentence is long (15+ words)
    const words = trimmed.split(/\s+/);
    if (words.length >= 15 && buffer.endsWith(" ")) return true;
    
    return false;
  }

  const processTtsQueue = useCallback(() => {
    function runQueue() {
      if (isTtsPlayingRef.current) return

      const nextChunk = ttsQueueRef.current[0]
      if (!nextChunk) {
        isTtsPlayingRef.current = false
        setAiSpeechState("idle")
        return
      }

      isTtsPlayingRef.current = true
      setAiSpeechState("speaking")
      setLiveSubtitles(nextChunk.text)
      currentSlideIdxRef.current = nextChunk.slideIndex

      // Trigger image display/loader for this chunk's prompt (concurrency-safe)
      if (nextChunk.imagePrompt) {
        // Start generating the image asynchronously if not already triggered
        if (!nextChunk.imagePromise) {
          nextChunk.imagePromise = fetch("/api/image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: nextChunk.imagePrompt, width: 768, height: 512 })
          })
            .then(res => res.json())
            .then(data => {
              if (data.image) {
                nextChunk.imageUrl = data.image;
              }
            })
            .catch(() => {});
        }

        setIsGeneratingImage(true);
        setImageError(null);
        
        const showImage = () => {
          // Double-check if the run is still active
          if (nextChunk.runId !== ttsRunIdRef.current) return;
          setIsGeneratingImage(false);
          if (nextChunk.imageUrl) {
            setTopicImageUrl(nextChunk.imageUrl);
            setImageLoaded(true);
          }
        };

        if (nextChunk.imageUrl) {
          showImage();
        } else {
          // Non-blocking loader: pop up image asynchronously when ready without pausing speech
          nextChunk.imagePromise.then(showImage).catch(() => {
            if (nextChunk.runId === ttsRunIdRef.current) {
              setIsGeneratingImage(false);
            }
          });
        }
      } else {
        setIsGeneratingImage(false);
        setImageError(null);
      }

      const playItem = () => {
        // If the runId has changed since this item was queued, it's stale! Discard it!
        if (nextChunk.runId !== ttsRunIdRef.current) return;

        // Remove from queue since we're starting play
        ttsQueueRef.current.shift();

        const clean = nextChunk.text.split("\n").filter(l => !l.trim().startsWith("IMAGE_PROMPT:")).join("\n").trim();
        if (!clean) {
          isTtsPlayingRef.current = false;
          if (nextChunk.onEnd) nextChunk.onEnd();
          runQueue();
          return;
        }

        setLiveSubtitles(clean);

        // 1. Primary Engine: Play Camb AI Audio (Realistic Human Voice)
        if (nextChunk.audio) {
          const audio = nextChunk.audio;
          audio.volume = 1.0;
          activeAudioRef.current = audio;

          audio.onplay = () => {
            if (nextChunk.runId !== ttsRunIdRef.current) return;
            setAiSpeechState("speaking");
          };
          audio.onended = () => {
            if (nextChunk.runId !== ttsRunIdRef.current) return;
            isTtsPlayingRef.current = false;
            if (nextChunk.onEnd) nextChunk.onEnd();
            runQueue();
          };
          audio.onerror = (e) => {
            console.warn("[Camb AI Audio]: Playback error, advancing:", e);
            if (nextChunk.runId !== ttsRunIdRef.current) return;
            isTtsPlayingRef.current = false;
            if (nextChunk.onEnd) nextChunk.onEnd();
            runQueue();
          };

          audio.play().catch(err => {
            console.warn("[Camb AI Audio]: Playback exception, advancing:", err);
            if (nextChunk.runId !== ttsRunIdRef.current) return;
            isTtsPlayingRef.current = false;
            if (nextChunk.onEnd) nextChunk.onEnd();
            runQueue();
          });
          return;
        }

        // If audio wasn't pre-fetched yet, fetch from Camb AI directly
        if (speechEnabled && !nextChunk.error) {
          console.log(`[Camb AI] On-demand fetching voice for: "${clean.substring(0, 25)}..."`);
          fetch("/api/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: clean })
          })
            .then(r => r.json())
            .then(data => {
              if (data.audioContent && nextChunk.runId === ttsRunIdRef.current) {
                const audio = new Audio("data:audio/mpeg;base64," + data.audioContent);
                audio.volume = 1.0;
                activeAudioRef.current = audio;
                audio.onplay = () => setAiSpeechState("speaking");
                audio.onended = () => {
                  isTtsPlayingRef.current = false;
                  if (nextChunk.onEnd) nextChunk.onEnd();
                  runQueue();
                };
                audio.onerror = () => {
                  isTtsPlayingRef.current = false;
                  if (nextChunk.onEnd) nextChunk.onEnd();
                  runQueue();
                };
                audio.play().catch(() => {
                  isTtsPlayingRef.current = false;
                  if (nextChunk.onEnd) nextChunk.onEnd();
                  runQueue();
                });
                return;
              }
              fallbackDurationProgress();
            })
            .catch(() => fallbackDurationProgress());
          return;
        }

        function fallbackDurationProgress() {
          isTtsPlayingRef.current = true;
          setAiSpeechState("speaking");
          const duration = Math.max(1000, clean.split(/\s+/).length * 200);
          setTimeout(() => {
            if (nextChunk.runId !== ttsRunIdRef.current) return;
            isTtsPlayingRef.current = false;
            setAiSpeechState("idle");
            if (nextChunk.onEnd) nextChunk.onEnd();
            runQueue();
          }, duration);
        }

        fallbackDurationProgress();
      }

      const triggerPlay = () => {
        if (nextChunk.promise) {
          nextChunk.promise.then(playItem).catch(playItem)
        } else {
          playItem()
        }
      }

      // NON-BLOCKING EXECUTION: Start voice playback immediately without waiting for image generation!
      triggerPlay();
    }

    runQueue();
  }, [speechEnabled])

  const speakTextChunk = useCallback((text: string, onEnd?: () => void, startFromIndex = 0, firstImageUrl?: string | null) => {
    if (!text) {
      if (onEnd) onEnd()
      return
    }

    if (!speechEnabled) {
      setAiSpeechState("speaking")
      const clean = text.split("\n").filter(l => !l.trim().startsWith("IMAGE_PROMPT:")).join("\n").trim();
      setLiveSubtitles(clean)
      const duration = Math.max(1000, clean.split(/\s+/).length * 250)
      setTimeout(() => { setAiSpeechState("idle"); if (onEnd) onEnd() }, duration)
      return
    }

    const slides = parseExplanationToSlides(text);
    const remainingSlides = slides.slice(startFromIndex);
    if (remainingSlides.length === 0) {
      if (onEnd) onEnd()
      return
    }

    // Queue all slides sequentially, and start prefetching audios in parallel immediately
    remainingSlides.forEach((slide, index) => {
      const isLast = index === remainingSlides.length - 1;
      const isFirst = index === 0;
      
      const clauses = splitIntoShortClauses(slide.text);
      clauses.forEach((clause, clauseIdx) => {
        const cleanClause = clause.split("\n").filter(l => !l.trim().startsWith("IMAGE_PROMPT:")).join("\n").trim();

        const item = {
          text: clause,
          runId: ttsRunIdRef.current,
          slideIndex: startFromIndex + index,
          onEnd: (isLast && clauseIdx === clauses.length - 1) ? onEnd : undefined,
          audio: null as HTMLAudioElement | null,
          promise: null as Promise<any> | null,
          error: false,
          imagePrompt: clauseIdx === 0 ? slide.imagePrompt : undefined,
          imageUrl: (isFirst && clauseIdx === 0 && firstImageUrl) ? firstImageUrl : null as string | null,
          imagePromise: (isFirst && clauseIdx === 0 && firstImageUrl) ? Promise.resolve() : null as Promise<any> | null
        };
        
        if (speechEnabled && cleanClause) {
          item.promise = fetch("/api/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: cleanClause })
          })
            .then(r => r.json())
            .then(data => {
              if (data.audioContent) {
                const audio = new Audio("data:audio/mpeg;base64," + data.audioContent);
                audio.preload = "auto";
                audio.load();
                item.audio = audio;
              }
            })
            .catch(() => {
              item.error = true;
            });
        } else {
          item.promise = Promise.resolve();
        }

        ttsQueueRef.current.push(item);
      });
    });

    processTtsQueue()
  }, [speechEnabled, processTtsQueue])

  /* ─── PREFETCH LECTURE ─── */
  useEffect(() => {
    if (!loading && !isParsingPdf && topics.length > 0 && sessionSubject !== "" && teachingMode === "AI") {
      const currentTopic = topics[activeTopicIdx] || "";
      const currentItem = isPdfMode && pdfPages.length > 0 ? pdfPages[activeTopicIdx] : currentTopic;
      
      const currentContext = classroomContext.getState();
      const prevTopics = topics.slice(0, activeTopicIdx);
      if (
        currentContext.subject !== sessionSubject || 
        currentContext.topic !== currentTopic ||
        JSON.stringify(currentContext.previousTopics) !== JSON.stringify(prevTopics)
      ) {
         classroomContext.updateState({
           sessionId: sessionCode,
           subject: sessionSubject,
           topic: currentTopic,
           previousTopics: prevTopics,
         });
      }

      const cacheKey = `${sessionCode}_${sessionSubject}_${currentTopic}`;
      if (!prefetchedLectures.current[cacheKey]) {
        console.log(`[Latency] Pre-fetching lecture stream at ${performance.now().toFixed(0)}ms for ${cacheKey}`);
        
        const prompt = isPdfMode 
          ? `Please explain this page of the document: ${currentItem}` 
          : `Please give a detailed lecture explanation for the current topic to the class: ${currentItem}`;
          
        const requestTime = performance.now();
        const { conversationHistory: _ih, ...initialState } = classroomContext.getState();
        const promise = fetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: prompt,
            target: "teacher",
            state: initialState
          })
        }).then(res => {
          if (!res.ok) throw new Error("Fetch failed");
          
          // Asynchronously consume a clone for caching without delaying stream start!
          const cloned = res.clone();
          const bodyStream = cloned.body;
          if (bodyStream) {
            (async () => {
              const reader = bodyStream.getReader();
              const decoder = new TextDecoder();
              let fullText = "";
              let sentenceBuffer = "";
              let firstTtsTriggered = false;
              let firstImgTriggered = false;

              try {
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;
                  const chunk = decoder.decode(value, { stream: true });
                  const lines = chunk.split("\n");
                  for (const line of lines) {
                    if (line.startsWith("data: ") && !line.includes("[DONE]")) {
                      try {
                        const data = JSON.parse(line.slice(6));
                        const delta = data.choices?.[0]?.delta?.content || "";
                        fullText += delta;
                        sentenceBuffer += delta;

                        // 1. Trigger first TTS prefetch on-the-fly
                        if (!firstTtsTriggered && shouldFlushSpeechBuffer(sentenceBuffer) && !sentenceBuffer.includes("IMAGE_PROMPT:")) {
                          firstTtsTriggered = true;
                          const ttsText = sentenceBuffer.trim();
                          if (ttsText) {
                            fetch("/api/tts", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ text: ttsText })
                            })
                              .then(r => r.json())
                              .then(data => {
                                if (data.audioContent && prefetchedLectures.current[cacheKey]) {
                                  prefetchedLectures.current[cacheKey].firstAudioBase64 = data.audioContent;
                                }
                              })
                              .catch(() => {});
                          }
                        }

                        // 2. Trigger first image prefetch on-the-fly
                        if (!firstImgTriggered && sentenceBuffer.includes("IMAGE_PROMPT:")) {
                          const imgIdx = sentenceBuffer.indexOf("IMAGE_PROMPT:");
                          const afterPrompt = sentenceBuffer.substring(imgIdx + 13);
                          const newlineIdx = afterPrompt.indexOf("\n");
                          if (newlineIdx !== -1) {
                            firstImgTriggered = true;
                            const imgPrompt = afterPrompt.substring(0, newlineIdx).trim();
                            if (imgPrompt) {
                              fetch("/api/image", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ prompt: imgPrompt, width: 768, height: 512 })
                              })
                                .then(r => r.json())
                                .then(data => {
                                  if (data.image && prefetchedLectures.current[cacheKey]) {
                                    prefetchedLectures.current[cacheKey].firstImageUrl = data.image;
                                  }
                                })
                                .catch(() => {});
                            }
                          }
                        }
                      } catch {}
                    }
                  }
                }
                
                const entry = prefetchedLectures.current[cacheKey];
                if (entry) {
                  entry.fullText = fullText;
                }
              } catch {}
            })();
          }
          return res;
        }).catch(err => {
          console.error("Prefetch failed", err);
        });
        
        prefetchedLectures.current[cacheKey] = { promise, time: requestTime, consumed: false };
      }
    }
  }, [loading, isParsingPdf, topics, pdfPages, isPdfMode, teachingMode, sessionSubject, sessionCode, activeTopicIdx]);



  /* ─── AI TEACHING SEQUENCE ─── */
  const runTopicSpeech = useCallback(async (idx: number, resumeFrom?: string) => {
    async function executeTopicSpeech(targetIdx: number, targetResumeFrom?: string) {
      stopSpeaking()
      
      // Create a new AbortController for this lecture stream
      lectureAbortRef.current?.abort()
      const abortController = new AbortController()
      lectureAbortRef.current = abortController
      
      setLecturePlayState("PLAYING")
      streamCompletedRef.current = false
      
      const items = isPdfMode ? pdfPages : topics
      if (targetIdx >= items.length) {
        speakTextChunk("That concludes our topics for today. Feel free to review the materials and ask any remaining questions.\nIMAGE_PROMPT: A beautiful, elegant, stylized 'The End' title card on a dark premium background, representing the completion of a lecture, high resolution, photorealistic, with clear readable text 'The End'")
        return
      }
      const currentItem = items[targetIdx]
      
      // Only clear visual states if NOT resuming
      if (!targetResumeFrom) {
        setIsGeneratingImage(false)
        setImageError(null)
        setTopicImageUrl(null)
        setImageLoaded(false)
        setImageFading(false)
        setTranscript("")
      }

      setAiSpeechState("speaking")
      
      let explanation = targetResumeFrom || ""
      let sentenceBuffer = ""
      let firstTokenTime = 0
      let lastTokenTime = 0
      const triggeredPrompts = new Set<string>()

      const reqStartTime = performance.now()
      let cachedTime = reqStartTime;

      const onPlaybackEnd = () => {
        const next = targetIdx + 1
        if (next < items.length) {
          addToast(isPdfMode ? `Moving to Page ${next + 1}` : `Moving to Topic ${next + 1}`)
          setActiveTopicIdx(next)
          if (isTeacher) {
            syncClassroomProgress(sessionCode, next)
          }
          executeTopicSpeech(next)
        } else {
          speakTextChunk("That concludes our topics for today. Feel free to review the materials and ask any remaining questions.\nIMAGE_PROMPT: A beautiful, elegant, stylized 'The End' title card on a dark premium background, representing the completion of a lecture, high resolution, photorealistic, with clear readable text 'The End'")
        }
      }

      let retries = 0;
      const MAX_RETRIES = 2;
      let streamCompleted = false;

      while (retries <= MAX_RETRIES && !streamCompleted) {
        try {
          const currentContext = classroomContext.getState();
          const currentTopic = topics[targetIdx] || "";
          const prevTopics = topics.slice(0, targetIdx);
          if (
            currentContext.subject !== sessionSubject || 
            currentContext.topic !== currentTopic ||
            JSON.stringify(currentContext.previousTopics) !== JSON.stringify(prevTopics)
          ) {
             classroomContext.updateState({
               sessionId: sessionCode,
               subject: sessionSubject,
               topic: currentTopic,
               previousTopics: prevTopics,
             });
          }

          const cacheKey = `${sessionCode}_${sessionSubject}_${currentTopic}`;
          const cached = prefetchedLectures.current[cacheKey];

          let res: Response | void | undefined;

          if (!targetResumeFrom && cached && cached.fullText && retries === 0) {
            console.log(`[Latency] Using fully cached text for ${cacheKey}`);
            explanation = cached.fullText;
            setTimeout(() => setTranscript(explanation), 0);
            speakTextChunk(explanation, onPlaybackEnd, 0, cached.firstImageUrl);
            
            // Inject pre-fetched first audio into the first queue item for instant playback
            if (cached.firstAudioBase64 && ttsQueueRef.current.length > 0) {
              const firstItem = ttsQueueRef.current[0];
              const audio = new Audio("data:audio/mpeg;base64," + cached.firstAudioBase64);
              audio.volume = 1.0;
              firstItem.audio = audio;
              firstItem.promise = Promise.resolve(); // Already resolved — play immediately
              console.log(`[Latency] Injected pre-fetched audio into first slide`);
              processTtsQueue(); // Kick the queue in case it was waiting
            }
            
            streamCompleted = true;
            break;
          } else if (!targetResumeFrom && cached && !cached.consumed && retries === 0) {
            console.log(`[Latency] Using pre-fetched promise for stream ${cacheKey}`);
            cachedTime = cached.time;
            cached.consumed = true; // Mark as consumed so it isn't read twice
            res = await cached.promise;
          } else {
            let prompt = isPdfMode 
              ? `Please explain this page of the document: ${currentItem}` 
              : `Please give a detailed lecture explanation for the current topic to the class: ${currentItem}`;

            // When resuming after a doubt, tell the AI to CONTINUE, not restart
            if (targetResumeFrom && targetResumeFrom.length > 50) {
               prompt = `CONTINUATION REQUIRED: You were in the middle of explaining "${currentItem}" and got interrupted by a student question. Your lecture so far is provided in the transcript below. Pick up EXACTLY where you left off and continue teaching. Do NOT repeat anything, do NOT re-introduce the topic, do NOT greet the students again. Just seamlessly continue the explanation from the next logical point.`;
            }

            const { conversationHistory: _lh, ...lectureState } = classroomContext.getState();
            res = await fetch("/api/ai", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              signal: abortController.signal,
              body: JSON.stringify({
                question: prompt,
                target: "teacher",
                state: lectureState,
                transcript: targetResumeFrom || undefined
              })
            })
          }

          if (res && res.ok && res.body) {
            const reader = res.body.getReader();
            const decoder = new TextDecoder();

            // ponytail: Streaming TTS — flush each slide to the TTS queue as it completes
            // during streaming, so voice starts within ~0.1s of first token instead of
            // waiting for the entire 20-30s response to finish.
            let slideIdx = 0;


            // Helper: queue a single slide for TTS+image immediately
            const flushSlide = (cleanText: string, imgPrompt?: string, isLast = false) => {
              const clauses = splitIntoShortClauses(cleanText);
              const currentSlideIdx = slideIdx++;
              
              clauses.forEach((clause, clauseIdx) => {
                const cleanClause = clause.split("\n").filter(l => !l.trim().startsWith("IMAGE_PROMPT:")).join("\n").trim();
                
                const item = {
                  text: clause,
                  runId: ttsRunIdRef.current,
                  slideIndex: currentSlideIdx,
                  onEnd: (isLast && clauseIdx === clauses.length - 1) ? onPlaybackEnd : undefined,
                  audio: null as HTMLAudioElement | null,
                  promise: null as Promise<any> | null,
                  error: false,
                  imagePrompt: clauseIdx === 0 ? (imgPrompt || undefined) : undefined,
                  imageUrl: null as string | null,
                  imagePromise: null as Promise<any> | null,
                };

                if (speechEnabled && cleanClause) {
                  item.promise = fetch("/api/tts", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ text: cleanClause })
                  })
                    .then(r => r.json())
                    .then(data => {
                      if (data.audioContent) {
                        const audio = new Audio("data:audio/mpeg;base64," + data.audioContent);
                        audio.preload = "auto";
                        audio.load();
                        item.audio = audio;
                      }
                    })
                    .catch(() => {
                      item.error = true;
                    });
                } else {
                  item.promise = Promise.resolve();
                }

                ttsQueueRef.current.push(item);
              });
              processTtsQueue();
            };

            while (true) {
              if (abortController.signal.aborted) break;
              const { done, value } = await reader.read();
              if (done) break;
              
              const chunk = decoder.decode(value, { stream: true });
              const lines = chunk.split("\n");
              
              for (const line of lines) {
                 if (line.startsWith("data: ") && !line.includes("[DONE]")) {
                    try {
                       const data = JSON.parse(line.slice(6));
                       const delta = data.choices?.[0]?.delta?.content || "";
                       if (delta) {
                          if (firstTokenTime === 0) firstTokenTime = performance.now();
                          explanation += delta;
                          sentenceBuffer += delta;
                          setTimeout(() => setTranscript(explanation), 0);

                          // Flush slides incrementally: check if buffer has a complete IMAGE_PROMPT line
                          const hasImagePrompt = sentenceBuffer.includes("IMAGE_PROMPT:");
                          if (hasImagePrompt) {
                            const imgIdx = sentenceBuffer.indexOf("IMAGE_PROMPT:");
                            const afterPrompt = sentenceBuffer.substring(imgIdx + 13);
                            const newlineIdx = afterPrompt.indexOf("\n");
                            if (newlineIdx !== -1) {
                              // Complete IMAGE_PROMPT line — flush the slide
                              const textBefore = sentenceBuffer.substring(0, imgIdx).trim();
                              const imgPrompt = afterPrompt.substring(0, newlineIdx).trim();
                              const rest = afterPrompt.substring(newlineIdx + 1);
                              if (textBefore) {
                                // Normal case: text + image prompt together
                                flushSlide(textBefore, imgPrompt, false);
                              } else if (imgPrompt) {
                                // Text was already flushed by sentence-boundary detection.
                                // 1. Attach image prompt to last item in queue if available
                                const q = ttsQueueRef.current;
                                const lastItem = q.length > 0 ? q[q.length - 1] : null;
                                if (lastItem) {
                                  // eslint-disable-next-line react-hooks/immutability
                                  lastItem.imagePrompt = imgPrompt;
                                  if (!lastItem.imagePromise) {
                                    lastItem.imagePromise = fetch("/api/image", {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ prompt: imgPrompt, width: 768, height: 512 })
                                    })
                                      .then(res => res.json())
                                      .then(data => {
                                        if (data.image) {
                                          lastItem.imageUrl = data.image;
                                        }
                                      })
                                      .catch(() => {});
                                  }
                                } else {
                                  // 2. Queue is already empty/playing — trigger image generation in background directly!
                                  setIsGeneratingImage(true);
                                  setImageError(null);
                                  fetch("/api/image", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ prompt: imgPrompt, width: 768, height: 512 })
                                  })
                                    .then(res => res.json())
                                    .then(data => {
                                      if (data.image && ttsRunIdRef.current) {
                                        setTopicImageUrl(data.image);
                                        setImageLoaded(true);
                                      }
                                      setIsGeneratingImage(false);
                                    })
                                    .catch(() => {
                                      setIsGeneratingImage(false);
                                    });
                                }
                              }
                              sentenceBuffer = rest;
                            }
                            } else {
                              // Flush on sentence boundary for fast first voice response
                              const trimmed = sentenceBuffer.trim();
                              const cleanUpper = trimmed.toUpperCase();
                              const lastIdx = cleanUpper.lastIndexOf("I");
                              const isPartiallyReceivingImagePrompt = lastIdx !== -1 && 
                                (lastIdx === 0 || cleanUpper[lastIdx - 1] === " " || cleanUpper[lastIdx - 1] === "\n") &&
                                "IMAGE_PROMPT:".startsWith(cleanUpper.substring(lastIdx));

                              if (!isPartiallyReceivingImagePrompt && shouldFlushSpeechBuffer(sentenceBuffer)) {
                                flushSlide(sentenceBuffer, "", false);
                                sentenceBuffer = "";
                              }
                            }
                       }
                    } catch (e) {}
                 }
              }
            }

            // Flush any remaining buffered text as the final slide
            if (sentenceBuffer.trim() && !abortController.signal.aborted) {
              // Handle case where final buffer has an incomplete IMAGE_PROMPT
              const imgIdx = sentenceBuffer.indexOf("IMAGE_PROMPT:");
              if (imgIdx !== -1) {
                const textBefore = sentenceBuffer.substring(0, imgIdx).trim();
                const imgPrompt = sentenceBuffer.substring(imgIdx + 13).trim();
                if (textBefore) {
                  flushSlide(textBefore, imgPrompt, true);
                } else if (imgPrompt) {
                  fetch("/api/image", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ prompt: imgPrompt, width: 768, height: 512 })
                  })
                    .then(res => res.json())
                    .then(data => {
                      if (data.image) {
                        setTopicImageUrl(data.image);
                        setImageLoaded(true);
                      }
                    })
                    .catch(() => {});
                }
              } else {
                flushSlide(sentenceBuffer, "", true);
              }
            } else if (!abortController.signal.aborted) {
              // Mark the last queued item with onPlaybackEnd
              const q = ttsQueueRef.current;
              if (q.length > 0) {
                q[q.length - 1].onEnd = onPlaybackEnd;
              }
            }
            
            lastTokenTime = performance.now();
            streamCompleted = true;
            streamCompletedRef.current = true;

            // BACKGROUND PREFETCH NEXT TOPIC
            const nextIdx = idx + 1;
            if (nextIdx < items.length) {
              const nextItem = items[nextIdx];
              const nextCacheKey = `${sessionCode}_${sessionSubject}_${nextItem}`;
              if (!prefetchedLectures.current[nextCacheKey]) {
                console.log(`[Latency] Pre-fetching NEXT topic stream at ${performance.now().toFixed(0)}ms for ${nextCacheKey}`);
                const nextPrompt = isPdfMode 
                  ? `Please explain this page of the document: ${nextItem}` 
                  : `Please give a detailed lecture explanation for the current topic to the class: ${nextItem}`;
                
                const { conversationHistory: _ph, ...prefetchState } = classroomContext.getState();
                const nextPromise = fetch("/api/ai", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    question: nextPrompt,
                    target: "teacher",
                    state: { ...prefetchState, topic: nextItem }
                  })
                }).then(async r => {
                  if (!r.ok) throw new Error("Prefetch failed");
                  
                  // Read the stream to fully populate the text cache in background
                  const cloned = r.clone();
                  if (cloned.body) {
                    const reader = cloned.body.getReader();
                    const decoder = new TextDecoder();
                    let fullText = "";
                    let sentenceBuffer = "";
                    let firstTtsTriggered = false;
                    let firstImgTriggered = false;
                    try {
                      while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        const chunk = decoder.decode(value, { stream: true });
                        const lines = chunk.split("\n");

                        for (const line of lines) {
                          if (line.startsWith("data: ") && !line.includes("[DONE]")) {
                            try {
                              const data = JSON.parse(line.slice(6));
                              const delta = data.choices?.[0]?.delta?.content || "";
                              fullText += delta;
                              sentenceBuffer += delta;

                              // 1. Trigger first TTS prefetch on-the-fly
                              if (!firstTtsTriggered && shouldFlushSpeechBuffer(sentenceBuffer) && !sentenceBuffer.includes("IMAGE_PROMPT:")) {
                                firstTtsTriggered = true;
                                const ttsText = sentenceBuffer.trim();
                                if (ttsText) {
                                  console.log(`[Latency] Prefetching next topic first TTS audio on the fly: "${ttsText}"`);
                                  fetch("/api/tts", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ text: ttsText })
                                  })
                                    .then(r => r.json())
                                    .then(data => {
                                      if (data.audioContent && prefetchedLectures.current[nextCacheKey]) {
                                        prefetchedLectures.current[nextCacheKey].firstAudioBase64 = data.audioContent;
                                      }
                                    })
                                    .catch(() => {});
                                }
                              }

                              // 2. Trigger first image prefetch on-the-fly
                              if (!firstImgTriggered && sentenceBuffer.includes("IMAGE_PROMPT:")) {
                                const imgIdx = sentenceBuffer.indexOf("IMAGE_PROMPT:");
                                const afterPrompt = sentenceBuffer.substring(imgIdx + 13);
                                const newlineIdx = afterPrompt.indexOf("\n");
                                if (newlineIdx !== -1) {
                                  firstImgTriggered = true;
                                  const imgPrompt = afterPrompt.substring(0, newlineIdx).trim();
                                  if (imgPrompt) {
                                    console.log(`[Latency] Prefetching next topic first image on the fly: "${imgPrompt}"`);
                                    fetch("/api/image", {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ prompt: imgPrompt, width: 768, height: 512 })
                                    })
                                      .then(r => r.json())
                                      .then(data => {
                                        if (data.image && prefetchedLectures.current[nextCacheKey]) {
                                          prefetchedLectures.current[nextCacheKey].firstImageUrl = data.image;
                                        }
                                      })
                                      .catch(() => {});
                                  }
                                }
                              }
                            } catch {}
                          }
                        }
                      }
                      
                      if (prefetchedLectures.current[nextCacheKey]) {
                        prefetchedLectures.current[nextCacheKey].fullText = fullText;
                        console.log(`[Latency] Pre-fetched fully cached text for ${nextCacheKey}`);
                        
                        // Fallbacks in case stream finished too quickly to trigger on-the-fly hooks
                        if (!firstImgTriggered) {
                          const sentences = fullText.split("\n");
                          let firstPrompt = "";
                          for (const s of sentences) {
                            const cleanLine = s.trim();
                            if (cleanLine.startsWith("IMAGE_PROMPT:")) {
                              firstPrompt = cleanLine.substring(13).trim();
                              break;
                            }
                          }
                          if (firstPrompt) {
                            fetch("/api/image", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ prompt: firstPrompt, width: 768, height: 512 })
                            })
                              .then(res => res.json())
                              .then(data => {
                                if (data.image && prefetchedLectures.current[nextCacheKey]) {
                                  prefetchedLectures.current[nextCacheKey].firstImageUrl = data.image;
                                }
                              })
                              .catch(() => {});
                          }
                        }
                        
                        if (!firstTtsTriggered) {
                          const nextSlides = parseExplanationToSlides(fullText);
                          if (nextSlides.length > 0 && nextSlides[0].text) {
                            fetch("/api/tts", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ text: nextSlides[0].text })
                            })
                              .then(r => r.json())
                              .then(data => {
                                if (data.audioContent && prefetchedLectures.current[nextCacheKey]) {
                                  prefetchedLectures.current[nextCacheKey].firstAudioBase64 = data.audioContent;
                                }
                              })
                              .catch(() => {});
                          }
                        }
                      }
                    } catch {}
                  }
                  return r;
                }).catch(err => {
                  console.error("Prefetch next topic failed", err);
                });
                
                prefetchedLectures.current[nextCacheKey] = { promise: nextPromise, time: performance.now(), consumed: false };
              }
            }

            if (abortController.signal.aborted) {
              savedLectureStateRef.current = {
                topicIdx: idx,
                fullTranscript: explanation,
                sentenceBuffer: "",
              };
              return;
            }

            // Cache the fully resolved string for immediate playback if user returns to this topic
            if (cached) {
               cached.fullText = explanation;
            }

          } else {
            throw new Error("Bad response from AI Server")
          }
        } catch (e: any) {
          // Intentional abort from doubt pause — exit silently
          if (e?.name === "AbortError" || abortController.signal.aborted) {
            console.log("[Lecture] Stream aborted for doubt pause");
            // Save the current state for resumption
            savedLectureStateRef.current = {
              topicIdx: idx,
              fullTranscript: explanation,
              sentenceBuffer: sentenceBuffer,
            };
            return; // Exit cleanly, no retry
          }
          console.error("AI Lecture fetch failed or interrupted:", e)
          retries++;
          if (retries > MAX_RETRIES) {
             console.warn("[Lecture]: Falling back to local offline lecture for topic:", currentItem);
             addToast("Slow connection. Loading local offline lesson material.");
             explanation = `Let's begin our discussion on ${currentItem}. This is an essential area of study that forms the foundation of modern technology.
IMAGE_PROMPT: A beautiful workspace with a clean laptop displaying code on the screen, purple neon accents, cinematic lighting.
By exploring ${currentItem}, we learn how to design, analyze, and build efficient solutions to complex problems.
IMAGE_PROMPT: Glowing abstract connection traces showing data network flow, purple and indigo colors.
Understanding these concepts allows us to create innovative tools that drive progress across all industries.
IMAGE_PROMPT: Hand typing on a backlit mechanical keyboard in a dark room, close up macro shot.
As we progress through the course, we will examine the core principles and real-world applications of this subject.
IMAGE_PROMPT: A high-tech digital classroom with glowing violet displays and educational visuals.`;
             setTranscript(explanation);
             speakTextChunk(explanation, onPlaybackEnd);
             streamCompleted = true;
             break;
          }
          // wait before retry
          await new Promise(r => setTimeout(r, 1000));
        }
      }

    const totalTimeToFirstToken = firstTokenTime > 0 ? (firstTokenTime - cachedTime) : (lastTokenTime - cachedTime);
    const totalStreamingTime = lastTokenTime - firstTokenTime;
    
    console.log(`[Latency] Time to First Token: ${totalTimeToFirstToken.toFixed(0)}ms | Streaming Duration: ${totalStreamingTime.toFixed(0)}ms`);
    if (targetIdx === 0) {
       addToast(`Latency | TTFT: ${totalTimeToFirstToken.toFixed(0)}ms | Streaming: ${totalStreamingTime.toFixed(0)}ms`);
    }

    transcriptRef.current.push(explanation)
    setPastTranscripts((old) => [...old, explanation])
  }

  await executeTopicSpeech(idx, resumeFrom);
}, [topics, pdfPages, isPdfMode, speakTextChunk, stopSpeaking, addToast, sessionCode, sessionSubject])

  /* ─── ENTER CLASSROOM ─── */
  const handleEnterClassroom = useCallback(() => {
    stopSpeaking()
    setHasEntered(true)
    setLectureHistory([])
    if (teachingMode === "AI" && !hasStartedRef.current) {
      hasStartedRef.current = true
      runTopicSpeech(0)
    }
  }, [teachingMode, runTopicSpeech])

  /* ─── AUTO-START AI TEACHING ─── */
  useEffect(() => {
    if (hasEntered && !loading && !isParsingPdf && teachingMode === "AI" && !hasStartedRef.current) {
      const items = isPdfMode ? pdfPages : topics;
      if (items.length > 0) {
        hasStartedRef.current = true;
        console.log("[Live Classroom] Auto-triggering runTopicSpeech(0)");
        runTopicSpeech(0);
      }
    }
  }, [hasEntered, loading, isParsingPdf, teachingMode, isPdfMode, pdfPages, topics, runTopicSpeech]);

  /* ─── CLEANUP: kill speech on unmount (navigation away) ─── */
  useEffect(() => {
    // Add beforeunload to explicitly set student offline in Firebase
    const handleBeforeUnload = () => {
      if (!isTeacher && studentId && sessionCode) {
        setStudentOffline(sessionCode, studentId).catch(() => {});
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    
    return () => {
      stopSpeaking()
      lectureAbortRef.current?.abort()
      window.removeEventListener("beforeunload", handleBeforeUnload);
      
      if (!isTeacher && studentId && sessionCode) {
        setStudentOffline(sessionCode, studentId).catch(() => {});
      }
    }
  }, [isTeacher, studentId, sessionCode])

  /* ─── TIMER ─── */
  useEffect(() => {
    if (!hasEntered || lecturePlayState === "PAUSED_FOR_DOUBT") return
    const i = setInterval(() => {
      setElapsedSeconds((s) => s + 1)
    }, 1000)
    return () => clearInterval(i)
  }, [hasEntered, lecturePlayState])

  /* ─── CLASSROOM SYNC ─── */
  useEffect(() => {
    if (!sessionCode) return
    const unsubscribe = subscribeToSession(
      sessionCode,
      (updated) => {
        if (!updated) return;

        // Redirect student to summary page if session completed in database
        if (!isTeacher && updated.status === "Completed") {
          router.push(`/session/${sessionCode}/summary`)
          return
        }

        // Sync topic for students
        if (!isTeacher && updated.currentTopicIndex !== undefined && updated.currentTopicIndex !== activeTopicIdx) {
          setActiveTopicIdx(updated.currentTopicIndex)
        }
      },
      (err) => console.error("Session sync error:", err)
    )
    return () => unsubscribe()
  }, [sessionCode, isTeacher, activeTopicIdx, router])

  /* ─── STUDENTS SIM ─── */
  useEffect(() => {
    if (!hasEntered || !sessionCode) return
    const unsubscribe = subscribeToStudents(
      sessionCode,
      (updated) => {
        // Auto-remove "ghost" students who closed their tab and stopped sending engagement data
        const now = Date.now();
        const activeStudents = updated.filter(s => {
          if (!s.lastActive) return true;
          const lastActiveMs = s.lastActive.toMillis ? s.lastActive.toMillis() : (s.lastActive.seconds * 1000);
          return (now - lastActiveMs) < 15000; // 15 seconds threshold
        });
        
        setStudents(activeStudents)
        if (activeStudents.length > 0) {
          setClassFocus(Math.floor(updated.reduce((a, s) => a + (s.engagementScore || 0), 0) / updated.length))
        }
      },
      (err) => {
        console.error("Failed to sync students in live page:", err)
      }
    )
    return () => unsubscribe()
  }, [hasEntered, sessionCode])

  // Use a ref to access the latest localStream inside LiveKit callbacks
  const localStreamRef = useRef<MediaStream | null>(null);
  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  const [livekitToken, setLivekitToken] = useState<string | null>(null);

  // Fetch LiveKit Token
  useEffect(() => {
    if (!hasEntered || !sessionCode || !studentId) return;
    fetch('/api/livekit/token', {
      method: 'POST',
      body: JSON.stringify({ sessionCode, studentId, isTeacher }),
      headers: { 'Content-Type': 'application/json' }
    })
    .then(r => r.json())
    .then(data => {
      if (data.token) setLivekitToken(data.token);
    })
    .catch(console.error);
  }, [hasEntered, sessionCode, studentId, isTeacher]);

  /* ─── LIVEKIT SFU INIT ─── */
  const roomRef = useRef<any>(null);

  useEffect(() => {
    if (!hasEntered || !studentId || !livekitToken) return;

    let room: any;
    const initLiveKit = async () => {
      const { Room, RoomEvent } = await import('livekit-client');
      room = new Room();
      roomRef.current = room;

      room.on(RoomEvent.TrackSubscribed, (track: any, publication: any, participant: any) => {
        if (track.kind === 'video') {
           const stream = new MediaStream([track.mediaStreamTrack]);
           setRemoteStreams(prev => ({ ...prev, [participant.identity]: stream }));
        }
      });

      room.on(RoomEvent.TrackUnsubscribed, (track: any, publication: any, participant: any) => {
        if (track.kind === 'video') {
           setRemoteStreams(prev => {
             const copy = { ...prev };
             delete copy[participant.identity];
             return copy;
           });
        }
      });

      room.on(RoomEvent.ActiveSpeakersChanged, (speakers: any[]) => {
        const identities = speakers.map(s => s.identity);
        setSpeakingStudentIds(new Set(identities));
      });

      try {
        const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
        if (!livekitUrl) {
          console.error("NEXT_PUBLIC_LIVEKIT_URL is missing!");
          return;
        }
        await room.connect(livekitUrl, livekitToken);
        console.log("Joined LiveKit room successfully!");

        if (localStreamRef.current) {
          const videoTrack = localStreamRef.current.getVideoTracks()[0];
          if (videoTrack) {
            const { LocalVideoTrack } = await import('livekit-client');
            const localTk = new LocalVideoTrack(videoTrack);
            await room.localParticipant.publishTrack(localTk);
          }
        }
      } catch (err) {
        console.error("LiveKit connection error:", err);
      }
    };
    initLiveKit();

    return () => {
      if (room) room.disconnect();
    };
  }, [hasEntered, studentId, livekitToken]);

  // Update LiveKit's video track when localStream changes AFTER initialization
  useEffect(() => {
    if (roomRef.current && localStream && roomRef.current.state === 'connected') {
      const publishTrackAsync = async () => {
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
          const { LocalVideoTrack } = await import('livekit-client');
          const localTk = new LocalVideoTrack(videoTrack);
          
          const existingPublications = roomRef.current.localParticipant.videoTrackPublications;
          for (const pub of existingPublications.values()) {
            if (pub.track) {
              await roomRef.current.localParticipant.unpublishTrack(pub.track);
            }
          }
          
          await roomRef.current.localParticipant.publishTrack(localTk);
        }
      };
      publishTrackAsync();
    }
  }, [localStream]);

  const handleStreamReady = useCallback((stream: MediaStream) => {
    setLocalStream(stream);
  }, []);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }) }, [messages])
  useEffect(() => { transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" }) }, [transcript, pastTranscripts])

  /* ─── DOUBT ─── */
  const handleSendDoubt = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isAnsweringRef.current || !chatInput.trim()) return
    isAnsweringRef.current = true
    setIsAnswering(true)
    
    // Stop any active narration immediately (lecture or previous doubt voice)
    stopSpeaking()
    resumePendingRef.current = false // Reset resume pending since we got a new question
    
    const question = chatInput.trim()
    const userMsgId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    const userMsg = { id: userMsgId, sender: "You", text: question, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), isAI: false, role: "user" as const }
    classroomContext.addMessage(userMsg)
    setChatInput("")
    
    // === PAUSE LECTURE ===
    if (lecturePlayState === "PLAYING") {
      // Abort active lecture stream (if still streaming)
      lectureAbortRef.current?.abort()
      setLecturePlayState("PAUSED_FOR_DOUBT")
      
      // If the stream already completed (abort had no effect), savedLectureStateRef
      // won't be set by the abort handler. Capture it now from the current transcript
      // so the resume path can continue instead of restarting the topic.
      // Use a short delay to let the abort catch block run first if the stream was
      // still active — if it was, it will set savedLectureStateRef itself.
      setTimeout(() => {
        if (!savedLectureStateRef.current && transcript) {
          savedLectureStateRef.current = {
            topicIdx: activeTopicIdx,
            fullTranscript: transcript,
            sentenceBuffer: "",
          };
        }
      }, 0);
    }
    
    try {
      const currentContext = classroomContext.getState();

      const { conversationHistory: _dh, ...doubtState } = currentContext;
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          question: question,
          target: "doubt-chat",
          sessionId: sessionCode,
          studentId: studentId,
          state: doubtState
        })
      })

      if (res.ok && res.body) {
        const msgId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
        classroomContext.addMessage({ id: msgId, sender: "Professor AI", text: "", time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), isAI: true, role: "assistant" as const })
        
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let answerText = ""
        
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          
          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split("\n")
          
          for (const line of lines) {
             if (line.startsWith("data: ") && !line.includes("[DONE]")) {
                try {
                   const data = JSON.parse(line.slice(6))
                   const delta = data.choices?.[0]?.delta?.content || ""
                   if (delta) {
                      answerText += delta
                      
                      const cleanText = answerText
                        .split("\n")
                        .filter(l => !l.trim().startsWith("IMAGE_PROMPT:"))
                        .join("\n")
                        .trim();
                      
                      classroomContext.updateMessage(msgId, { text: cleanText })
                   }
                } catch (e) {}
             }
          }
        }

        // Ensure lecture speech is fully stopped before playing doubt answer
        stopSpeaking();

        // Play the doubt answer audio, then resume lecture
        speakTextChunk(answerText, () => {
          // Resume class automatically when doubt explanation ends
          resumePendingRef.current = false;
          const saved = savedLectureStateRef.current;
          if (saved) {
            savedLectureStateRef.current = null;
            setLecturePlayState("RESUMING");
            runTopicSpeech(saved.topicIdx, saved.fullTranscript);
          } else {
            setLecturePlayState("PLAYING");
            runTopicSpeech(activeTopicIdx);
          }
        });

      } else {
        const errData = await res.text()
        console.error("Doubt Chat API Error:", errData)
        addToast("Sorry, I encountered an error answering that.")
      }
    } catch (e) {
      console.error("Doubt Chat fetch failed:", e)
      addToast("Network error. Please try again.")
    }

    isAnsweringRef.current = false
    setIsAnswering(false)
    // NOTE: Lecture remains PAUSED. Student must click "Resume Lecture".
  }

  /* ─── RESUME LECTURE ─── */
  const handleResumeLecture = useCallback(() => {
    // If the professor is still speaking the doubt response, wait until it finishes
    if (isTtsPlayingRef.current || aiSpeechState === "speaking") {
      resumePendingRef.current = true;
      setLecturePlayState("RESUMING");
      return;
    }
    
    const saved = savedLectureStateRef.current;
    if (!saved) {
      // No saved state — just restart current topic
      setLecturePlayState("PLAYING")
      runTopicSpeech(activeTopicIdx)
      return
    }
    
    savedLectureStateRef.current = null;
    
    if (streamCompletedRef.current) {
      // Stream was fully complete. Just resume playing from where we left off.
      setLecturePlayState("PLAYING")
      const items = isPdfMode ? pdfPages : topics
      const nextTopicIdx = activeTopicIdx + 1
      
      const onResumePlaybackEnd = () => {
        if (nextTopicIdx < items.length) {
          addToast(isPdfMode ? `Moving to Page ${nextTopicIdx + 1}` : `Moving to Topic ${nextTopicIdx + 1}`)
          setActiveTopicIdx(nextTopicIdx)
          syncClassroomProgress(sessionCode, nextTopicIdx)
          runTopicSpeech(nextTopicIdx)
        } else {
          speakTextChunk("That concludes our topics for today. Feel free to review the materials and ask any remaining questions.\nIMAGE_PROMPT: A beautiful, elegant, stylized 'The End' title card on a dark premium background, representing the completion of a lecture, high resolution, photorealistic, with clear readable text 'The End'")
        }
      }

      speakTextChunk(saved.fullTranscript, onResumePlaybackEnd, currentSlideIdxRef.current + 1)
    } else {
      // Stream was incomplete. Get continuation from LLM.
      setLecturePlayState("RESUMING")
      runTopicSpeech(saved.topicIdx, saved.fullTranscript)
    }
  }, [activeTopicIdx, runTopicSpeech, speakTextChunk, topics, pdfPages, isPdfMode, sessionCode])


  const handleConfirmEnd = async () => {
    setShowEndModal(false)
    setEndCountdown(5)
    stopSpeaking()

    // Immediately clear all warning states to prevent overlays from lingering during countdown
    setWarningLevel(0)
    setOutOfFrameSecondsLeft(null)
    setPhoneSecondsLeft(null)
    setShowPhoneWarning(false)

    try {
      await endSession(sessionCode)
    } catch (e) {
      console.warn("Failed to end session in database:", e)
    }
  }

  useEffect(() => {
    if (endCountdown === null) return
    if (endCountdown === 0) { 
      // Explicitly disconnect from LiveKit and stop all tracks to ensure camera light turns off
      if (roomRef.current) {
        roomRef.current.disconnect();
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
      }
      if (isTeacher) {
        router.push(`/session/${sessionCode}/summary`)
      } else {
        router.push("/dashboard")
      }
      return 
    }
    const t = setTimeout(() => setEndCountdown((c) => (c !== null ? c - 1 : null)), 1000)
    return () => clearTimeout(t)
  }, [endCountdown, router, isTeacher, sessionCode])

  useEffect(() => {
    if (!hasEntered) return
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      switch (e.key.toLowerCase()) {
        case "m": setMicOn((v) => !v); break
        case "v": setVideoOn((v) => !v); break
        case "h": setHandRaised((v) => !v); break
        case "c": setChatOpen((v) => !v); break
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [hasEntered])

  // --- Auto-Hide Toolbar Effect ---
  useEffect(() => {
    if (!hasEntered) return

    const triggerShow = () => {
      setShowToolbar(true)
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current)
        hideTimeoutRef.current = null
      }
    }

    const triggerHideWithDelay = () => {
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current)
      hideTimeoutRef.current = setTimeout(() => {
        if (!isHoveringToolbarRef.current) {
          setShowToolbar(false)
        }
      }, 2000)
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (e.clientY >= window.innerHeight - 60) {
        triggerShow()
      } else {
        if (!isHoveringToolbarRef.current) {
          triggerHideWithDelay()
        }
      }
    }

    const handleTouchStart = () => {
      triggerShow()
      triggerHideWithDelay()
    }

    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("touchstart", handleTouchStart)
    
    triggerHideWithDelay()

    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("touchstart", handleTouchStart)
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current)
    }
  }, [hasEntered])

  // --- Collapsible Panel Outside Click & Escape Hook ---
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        isParticipantsOpen &&
        participantsPanelRef.current &&
        !participantsPanelRef.current.contains(e.target as Node) &&
        participantsTabRef.current &&
        !participantsTabRef.current.contains(e.target as Node)
      ) {
        setIsParticipantsOpen(false)
        localStorage.setItem("participantsOpen", "false")
      }

      if (
        showMoreMenu &&
        moreMenuRef.current &&
        !moreMenuRef.current.contains(e.target as Node)
      ) {
        setShowMoreMenu(false)
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isParticipantsOpen) {
          setIsParticipantsOpen(false)
          localStorage.setItem("participantsOpen", "false")
        }
        if (showMoreMenu) {
          setShowMoreMenu(false)
        }
      }
    }

    document.addEventListener("mousedown", handleOutsideClick)
    window.addEventListener("keydown", handleKeyDown)

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick)
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [isParticipantsOpen, showMoreMenu])

  // --- Active Speaker Simulation Sequence ---
  useEffect(() => {
    if (!hasEntered) return
    const interval = setInterval(() => {
      if (students.length === 0) return
      const speakCount = Math.floor(Math.random() * 2) + 1
      const newSpeaking = new Set<string>()
      for (let i = 0; i < speakCount; i++) {
        const randomStudent = students[Math.floor(Math.random() * students.length)]
        if (randomStudent && randomStudent.id) {
          newSpeaking.add(randomStudent.id)
        }
      }
      setSpeakingStudentIds(newSpeaking)
    }, 7000)

    return () => clearInterval(interval)
  }, [hasEntered, students])

  const fmt = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`
  const totalItems = isPdfMode ? pdfPages.length : topics.length
  const progressPct = totalItems > 0 ? Math.floor(((activeTopicIdx + 1) / totalItems) * 100) : 50
  const activeLabel = isPdfMode ? `Page ${activeTopicIdx + 1} of ${totalItems}` : (topics[activeTopicIdx] || "Course Topic")
  
  const focusDot = classFocus >= 80 ? "bg-emerald-500" : classFocus >= 65 ? "bg-amber-500" : "bg-rose-500"
  const focusText = classFocus >= 80 ? "text-emerald-400" : classFocus >= 65 ? "text-amber-400" : "text-rose-400"

  // ─── LOADING SCREEN ───
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center text-white font-sans">
        <div className="h-8 w-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin mb-4" />
        <p className="text-sm text-white/60">Verifying session access...</p>
      </div>
    )
  }

  // ─── ERROR SCREEN ───
  if (error) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center text-white font-sans p-6 text-center">
        <AlertCircle className="h-10 w-10 text-red-500 mb-4" />
        <h2 className="text-lg font-bold mb-2">Access Denied</h2>
        <p className="text-sm text-white/50 mb-6 max-w-sm">{error}</p>
        <Link
          href="/dashboard"
          className="px-5 py-2.5 bg-[#1a1a1a] rounded-xl text-xs font-semibold hover:bg-[#242424] border border-white/5 transition-all"
        >
          Return to Dashboard
        </Link>
      </div>
    )
  }



  const drawerWidth = getDrawerWidth()
  let transformStr = "translate3d(100%, 0, 0)"
  let openRatio = 0
  if (isParticipantsOpen) {
    if (isDragging && dragOffset > 0) {
      openRatio = Math.max(0, 1 - dragOffset / drawerWidth)
      transformStr = `translate3d(${Math.min(drawerWidth, dragOffset)}px, 0, 0)`
    } else {
      openRatio = 1
      transformStr = "translate3d(0, 0, 0)"
    }
  } else {
    if (isDragging && dragOffset < 0) {
      openRatio = Math.min(1, -dragOffset / drawerWidth)
      transformStr = `translate3d(${Math.max(0, drawerWidth + dragOffset)}px, 0, 0)`
    } else {
      openRatio = 0
      transformStr = "translate3d(100%, 0, 0)"
    }
  }

  const overlayStyle = {
    opacity: openRatio * 0.25,
    backdropFilter: `blur(${openRatio * 10}px)`,
    WebkitBackdropFilter: `blur(${openRatio * 10}px)`,
    transition: isDragging ? "none" : "opacity 300ms cubic-bezier(0.16, 1, 0.3, 1), backdrop-filter 300ms cubic-bezier(0.16, 1, 0.3, 1)",
    pointerEvents: openRatio > 0.01 ? ("auto" as const) : ("none" as const),
  }

  const filteredStudents = students.filter((s) => {
    const matchesSearch = s.name?.toLowerCase().includes(searchQuery.toLowerCase())
    const isSpeaking = speakingStudentIds.has(s.id)
    const matchesSpeaker = !showOnlyActive || isSpeaking
    return matchesSearch && matchesSpeaker
  })

  return (
    <div className="fixed inset-0 bg-[#F6F7F9] text-slate-800 flex flex-col font-sans antialiased overflow-hidden select-none z-50">
      <style>{`
        @keyframes orbPulse {
          0% { box-shadow: 0 0 0 0 rgba(37,99,235,0.4); }
          70% { box-shadow: 0 0 0 20px rgba(37,99,235,0); }
          100% { box-shadow: 0 0 0 0 rgba(37,99,235,0); }
        }
        @keyframes orbInner {
          0%,100% { box-shadow: inset 0 0 20px rgba(37,99,235,0.12), 0 0 15px rgba(37,99,235,0.15); }
          50% { box-shadow: inset 0 0 30px rgba(37,99,235,0.25), 0 0 30px rgba(37,99,235,0.3); }
        }
        .orb-active {
          animation: orbPulse 2s ease-out infinite, orbInner 2.5s ease-in-out infinite;
        }
        .orb-idle {
          box-shadow: inset 0 0 8px rgba(37,99,235,0.03);
        }

        @keyframes wv { 0%,100%{transform:scaleY(.12)} 50%{transform:scaleY(1)} }
        .wv{animation:wv .6s ease-in-out infinite}
        .wv-1{animation-delay:.08s} .wv-2{animation-delay:.2s} .wv-3{animation-delay:.03s}
        .wv-4{animation-delay:.26s} .wv-5{animation-delay:.13s}

        @keyframes tileGlow {
          0%,100%{border-color:rgba(37,99,235,.3);box-shadow:0 0 20px rgba(37,99,235,.08),0 0 40px rgba(37,99,235,.03)}
          50%{border-color:rgba(37,99,235,.5);box-shadow:0 0 25px rgba(37,99,235,.15),0 0 50px rgba(37,99,235,.05)}
        }
        .tile-glow{animation:tileGlow 2.5s ease-in-out infinite}

        @keyframes imgIn { 0%{opacity:0} 100%{opacity:1} }
        .img-in{animation:imgIn .6s ease-out forwards}
        .img-out{opacity:0;transition:opacity .3s}

        @keyframes slideUp { 0%{transform:translateY(6px);opacity:0} 100%{transform:translateY(0);opacity:1} }
        .slide-up{animation:slideUp .25s ease-out}

        .cscroll::-webkit-scrollbar{width:3px}
        .cscroll::-webkit-scrollbar-track{background:#F3F4F6}
        .cscroll::-webkit-scrollbar-thumb{background:#CBD5E1;border-radius:10px}
        .cscroll::-webkit-scrollbar-thumb:hover{background:#94A3B8}

        @keyframes audioRing {
          0% { transform: scale(1); opacity: 1; border-color: rgba(37, 99, 235, 0.7); box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.3); }
          50% { transform: scale(1.08); opacity: 0.5; border-color: rgba(37, 99, 235, 0.3); box-shadow: 0 0 8px 2px rgba(37, 99, 235, 0.15); }
          100% { transform: scale(1.15); opacity: 0; border-color: rgba(37, 99, 235, 0); box-shadow: 0 0 12px 4px rgba(37, 99, 235, 0); }
        }
        .audio-ring {
          position: absolute;
          inset: -2px;
          border: 2px solid rgba(37, 99, 235, 0.55);
          border-radius: 12px;
          animation: audioRing 1.6s cubic-bezier(0.1, 0.8, 0.3, 1) infinite;
          pointer-events: none;
          z-index: 5;
        }

        /* Drawer Overlay */
        .drawer-overlay {
          position: fixed;
          inset: 0;
          z-index: 100;
          background-color: rgba(0, 0, 0, 0.2);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          will-change: opacity, backdrop-filter;
        }

        /* Drawer container */
        .drawer-container {
          position: fixed;
          top: 0;
          right: 0;
          bottom: 0;
          z-index: 110;
          background-color: #FFFFFF;
          border-left: 1px solid rgba(15, 23, 42, 0.08);
          box-shadow: 0 1px 2px rgba(15,23,42,.03), 0 12px 32px rgba(15,23,42,.05);
          will-change: transform;
          width: 85vw;
        }
        @media (min-width: 768px) {
          .drawer-container {
            width: 320px;
          }
        }
        @media (min-width: 1024px) {
          .drawer-container {
            width: 360px;
          }
        }

        /* Drawer handle tab */
        .drawer-handle {
          position: fixed;
          right: 0;
          top: 50%;
          transform: translateY(-50%);
          z-index: 90;
          background-color: #FFFFFF;
          border-top: 1px solid rgba(15, 23, 42, 0.08);
          border-left: 1px solid rgba(15, 23, 42, 0.08);
          border-bottom: 1px solid rgba(15, 23, 42, 0.08);
          border-radius: 12px 0 0 12px;
          width: 24px;
          height: 120px;
          cursor: pointer;
          transition: width 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          box-shadow: -2px 0 15px rgba(15, 23, 42, 0.05);
        }
        .drawer-handle:hover {
          width: 32px;
          background-color: #F8FAFC;
          box-shadow: -4px 0 20px rgba(15, 23, 42, 0.08);
          border-color: rgba(37, 99, 235, 0.3);
        }

        /* Instagram-style Hint Indicator */
        .hint-indicator {
          position: fixed;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          z-index: 85;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          pointer-events: none;
        }

        @keyframes hintArrow {
          0%, 100% { transform: translateX(0); opacity: 0.1; }
          50% { transform: translateX(-4px); opacity: 0.7; }
        }
        .hint-arrow {
          animation: hintArrow 2s ease-in-out infinite;
        }
      `}</style>

      {/* ═══ TOP BAR ═══ */}
      <header className="h-[72px] bg-white border-b border-[rgba(15,23,42,.08)] px-6 flex items-center justify-between flex-shrink-0 z-30 antialiased">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-[#EFF6FF] flex items-center justify-center border border-[#BFDBFE] shadow-xs">
            <Brain className="h-4.5 w-4.5 text-[#2563EB]" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-[#111827] leading-none">Class<span className="text-[#2563EB]">AI</span></span>
            <span className="text-[11px] text-[#6B7280] font-medium tracking-wide uppercase truncate max-w-[160px] mt-1">{sessionTitle}</span>
          </div>
        </div>
        <div className="flex flex-col items-center gap-1.5 w-72">
          <div className="flex items-center gap-2 text-xs text-[#374151] font-semibold">
            <span className="text-[#2563EB] font-bold uppercase text-[9px] tracking-wider font-mono">{isPdfMode ? "PDF Page " : "Topic "} {activeTopicIdx + 1}/{totalItems}:</span>
            <span className="truncate max-w-[160px] font-bold text-[#111827]">{activeLabel}</span>
          </div>
          <div className="h-[4px] w-full bg-[#E5E7EB] rounded-full overflow-hidden">
            <div className="h-full bg-[#2563EB] rounded-full transition-all duration-500 ease-[cubic-bezier(.22,1,.36,1)]" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
        <div className="flex items-center gap-2.5 text-xs font-semibold">
          {/* Student Focus Avg Badge */}
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-[#E5E7EB] shadow-xs hover:-translate-y-0.5 transition-all duration-350 ease-[cubic-bezier(.22,1,.36,1)] cursor-pointer">
            <span className={`h-2 w-2 rounded-full ${focusDot} animate-pulse`} />
            <span className="text-[#6B7280] font-medium">Student Avg:</span>
            <span className={`${focusText} font-bold`}>{classFocus}%</span>
          </div>

          {/* Teacher Focus Badge */}
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-[#E5E7EB] shadow-xs hover:-translate-y-0.5 transition-all duration-350 ease-[cubic-bezier(.22,1,.36,1)] cursor-pointer">
            <span className={`h-2 w-2 rounded-full ${localMetrics.status === "focused" ? "bg-[#16A34A]" : "bg-[#DC2626]"} animate-pulse`} />
            <span className="text-[#6B7280] font-medium">Your Focus:</span>
            <span className="font-bold text-[#111827]">{localMetrics.score}%</span>
          </div>

          <div className="flex items-center gap-2.5 bg-white border border-[#E5E7EB] px-3.5 py-1.5 rounded-full font-mono text-[#111827] font-bold shadow-xs hover:-translate-y-0.5 transition-all duration-350 ease-[cubic-bezier(.22,1,.36,1)] cursor-pointer">
            <Clock className="h-3.5 w-3.5 text-[#9CA3AF]" />
            <span>{fmt(elapsedSeconds)}</span>
            <span className="border-l border-[#E5E7EB] pl-2.5 flex items-center gap-1">
              <Users className="h-3.5 w-3.5 text-[#2563EB]" />{students.length}
            </span>
          </div>
          {isTeacher && (
            <div className="flex items-center gap-2">
              <button id="end-session-btn" onClick={handleEndSession} className="px-4 py-2 bg-[#DC2626] hover:bg-[#B91C1C] hover:-translate-y-0.5 text-white rounded-[16px] transition-all duration-350 ease-[cubic-bezier(.22,1,.36,1)] cursor-pointer text-xs font-bold shadow-[0_12px_24px_rgba(220,38,38,.18)] active:scale-95">End Session</button>
            </div>
          )}
        </div>
      </header>

      {/* ═══ MAIN AREA ═══ */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0 relative bg-[#F6F7F9]">

        {/* ─── LEFT COLUMN — Main Stage ─── */}
        <div className="flex-1 flex flex-col p-4 gap-4 min-h-[50vh] lg:min-h-0 pb-4 lg:pb-[84px] overflow-hidden">

          {/* ── CONTENT / IMAGE AREA (HERO — presentation panel widescreen fill) ── */}
          <div className="flex-1 bg-white border border-[rgba(15,23,42,.08)] rounded-[24px] shadow-[0_8px_24px_rgba(15,23,42,.05)] hover:-translate-y-0.5 hover:shadow-[0_18px_34px_rgba(15,23,42,.08)] transition-all duration-350 ease-[cubic-bezier(.22,1,.36,1)] overflow-hidden flex flex-col relative min-h-0">
            {/* Image / Fallback — fills entire area */}
            <div className="flex-1 relative overflow-hidden min-h-0 bg-white">
              {topicImageUrl && imageLoaded ? (
                <div className={`absolute inset-0 ${imageFading ? "img-out" : "img-in"}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={topicImageUrl}
                    alt={activeLabel}
                    className="rounded-[20px]"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    onError={() => { setImageLoaded(false); setTopicImageUrl(null) }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-white/10 via-transparent to-white/5" />
                </div>
              ) : (
                /* Beautiful initial fallback image instead of a blank gradient */
                <div className="absolute inset-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1024&auto=format&fit=crop"
                    alt="Classroom Visual Aid"
                    className="rounded-[20px]"
                    style={{ width: "100%", height: "100%", objectFit: "cover", filter: "brightness(0.95)" }}
                  />
                  <div className="absolute inset-0 bg-[#F6F7F9]/50 backdrop-blur-[2px]" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center space-y-3 px-8">
                      <h2 className="text-[34px] font-bold text-[#111827] tracking-tight">{activeLabel}</h2>
                      <p className="text-[15px] text-[#6B7280] font-medium">{isPdfMode ? "Page" : "Topic"} {activeTopicIdx + 1} of {totalItems}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Overlaid visual aid loading state */}
              {isGeneratingImage && (
                <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-md border border-[#E5E7EB] rounded-full px-3.5 py-1.5 flex items-center gap-2 z-20 shadow-md animate-pulse">
                  <Loader2 className="animate-spin text-[#2563EB] h-3.5 w-3.5" />
                  <span className="text-[10px] text-[#374151] font-bold tracking-wider uppercase font-mono">Generating AI Visual Aid...</span>
                </div>
              )}

              {imageError && (
                <div className="absolute inset-0 bg-rose-50/95 backdrop-blur-md flex flex-col items-center justify-center gap-3 border border-red-200 px-8 text-center z-20">
                  <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                    <span className="text-red-600 text-lg">⚠️</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-[#111827]">Visual Aid Failed to Generate</h4>
                    <p className="text-xs text-[#6B7280] mt-1">{imageError}</p>
                  </div>
                  <button 
                    onClick={() => {
                      setImageError(null);
                    }}
                    className="mt-1 px-3 py-1 bg-white hover:bg-slate-50 border border-[#E5E7EB] rounded-lg text-[10px] text-[#111827] font-bold tracking-wide transition-all duration-350 ease-[cubic-bezier(.22,1,.36,1)] cursor-pointer"
                  >
                    Clear Error
                  </button>
                </div>
              )}
            </div>
            {/* Caption bar */}
            <div className="h-10 border-t border-[#E5E7EB] bg-white flex items-center justify-between px-4 flex-shrink-0 relative z-10">
              <span className="text-xs font-bold text-[#111827] truncate max-w-[80%]">{activeLabel}</span>
              <span className="px-2.5 py-0.5 rounded-full bg-[#EFF6FF] border border-[#BFDBFE] text-[9px] font-bold text-[#2563EB] uppercase tracking-wider font-mono">IMAGE</span>
            </div>
          </div>

          {/* ── PROFESSOR AI — Response Panel ── */}
          <div
            className={`rounded-[22px] border border-[rgba(15,23,42,.08)] p-[28px] flex gap-4 flex-shrink-0 transition-all duration-350 ease-[cubic-bezier(.22,1,.36,1)] relative bg-white shadow-[0_8px_24px_rgba(15,23,42,.05)] hover:-translate-y-0.5 hover:shadow-[0_18px_34px_rgba(15,23,42,.08)] ${
              lecturePlayState === "PAUSED_FOR_DOUBT" ? "border-amber-400/50"
              : aiSpeechState === "speaking" ? "tile-glow"
              : aiSpeechState === "paused" ? "border-amber-400/30"
              : "border-[rgba(15,23,42,.08)]"
            }`}
          >
            {/* LIVE / PAUSED badge */}
            {lecturePlayState === "PAUSED_FOR_DOUBT" ? (
              <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-[#FEF3C7] border border-[#FDE68A] px-3 py-1 rounded-full z-10">
                <span className="h-1.5 w-1.5 rounded-full bg-[#D97706]" />
                <span className="text-[10px] font-bold text-[#D97706] uppercase tracking-wider font-mono">Paused</span>
              </div>
            ) : (
              <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-[#FEF2F2] border border-[#FECACA] px-3 py-1 rounded-full z-10">
                <span className="h-1.5 w-1.5 rounded-full bg-[#DC2626] animate-pulse" />
                <span className="text-[10px] font-bold text-[#DC2626] uppercase tracking-wider font-mono">Live</span>
              </div>
            )}

            {/* Orb + waveform ── */}
            <div className="flex flex-col items-center gap-2 flex-shrink-0 justify-center">
              <div
                className={`rounded-full flex items-center justify-center border-[3px] border-white transition-all duration-500 shadow-[0_10px_20px_rgba(37,99,235,.18)] ${
                  aiSpeechState === "speaking"
                    ? "bg-[#2563EB] text-white orb-active"
                    : aiSpeechState === "paused"
                    ? "bg-[#2563EB]/80 text-white orb-idle"
                    : "bg-[#2563EB] text-white orb-idle"
                }`}
                style={{ width: 48, height: 48 }}
              >
                <Brain className="h-5 w-5 text-white" />
              </div>
              <div className="flex items-end justify-center gap-[2px] h-3.5 w-8">
                {aiSpeechState === "speaking" && lecturePlayState !== "PAUSED_FOR_DOUBT"
                  ? [1,2,3,4,5].map((i) => <div key={i} className={`w-[2.5px] rounded-full bg-[#2563EB] wv wv-${i}`} style={{height:"100%"}} />)
                  : [1,2,3,4,5].map((i) => <div key={i} className="w-[2.5px] h-[2.5px] rounded-full bg-[#E5E7EB]" />)
                }
              </div>
            </div>

            {/* Name, topic, transcript */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden gap-1 max-w-[92%]">
              <div className="flex items-center gap-2">
                <h3 className="text-[18px] font-bold text-[#111827] leading-tight">Professor AI</h3>
                <span className="text-xs text-[#9CA3AF]">·</span>
                <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full truncate transition-colors duration-300 ${
                  lecturePlayState === "PAUSED_FOR_DOUBT" ? "bg-[#FEF3C7] text-[#D97706]"
                  : aiSpeechState === "speaking" ? "bg-[#EFF6FF] text-[#2563EB]" : aiSpeechState === "paused" ? "bg-[#FEF3C7] text-[#D97706]" : "bg-[#F3F4F6] text-[#6B7280]"
                }`}>
                  {lecturePlayState === "PAUSED_FOR_DOUBT" ? "Answering doubt..." 
                  : aiSpeechState === "speaking" ? activeLabel : aiSpeechState === "paused" ? "Paused" : "Waiting..."}
                </span>
              </div>

              {/* Transcript — styled with 1.8 line height */}
              <div className="flex-1 relative min-h-[3.5rem] max-h-28 overflow-hidden">
                <div className="absolute inset-0 overflow-y-auto cscroll pr-2">
                  {pastTranscripts.map((pt, i) => (
                    <p key={i} className="text-[13px] text-[#6B7280] mb-1.5 leading-[1.8] font-medium">{pt}</p>
                  ))}
                  {transcript && (
                    <p className="text-[15px] text-[#374151] font-medium leading-[1.8]">
                      {transcript}
                    </p>
                  )}
                  {lecturePlayState === "PAUSED_FOR_DOUBT" && (
                    <p className="text-xs text-[#D97706] italic mt-1 font-medium leading-[1.8]">Lecture paused — will resume automatically.</p>
                  )}
                  {!transcript && !pastTranscripts.length && (
                    <p className="text-xs text-[#9CA3AF] italic leading-[1.8]">Transcript appears when lecture starts...</p>
                  )}
                  <div ref={transcriptEndRef} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ─── RIGHT SIDEBAR — Participants + Doubt Chat (16px vertical spacing) ─── */}
        <aside className="w-full lg:w-[30%] border-t lg:border-t-0 lg:border-l border-[rgba(15,23,42,.08)] bg-white flex flex-col min-h-0 pb-[84px] lg:pb-0 overflow-hidden antialiased">
          
          {/* ── STUDENT TILES (16px spacing) ── */}
          <div className="flex-none p-4 pb-0 space-y-4">
            <h4 className="text-[#374151] font-bold text-xs tracking-[0.02em] uppercase font-mono pb-2.5 border-b border-[#E5E7EB] flex items-center justify-between flex-shrink-0">
              <span className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-[#2563EB]" />
                In Class ({students.length})
              </span>
              <span className="text-[#16A34A] flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-[#16A34A] animate-pulse" />
                <span className="text-[9px] font-bold uppercase font-mono">Active</span>
              </span>
            </h4>
            <div className="grid grid-cols-2 gap-2.5 max-h-[220px] overflow-y-auto cscroll pb-1">
              {/* Local User Tile */}
              <div className={`relative aspect-video rounded-[22px] border border-[#E5E7EB] bg-white overflow-hidden hover:-translate-y-0.5 transition-all duration-350 ease-[cubic-bezier(.22,1,.36,1)] shadow-xs p-4`}>
                <div className="absolute inset-0 z-0">
                  <StudentCamera
                    sessionCode={sessionCode}
                    studentId={studentId}
                    studentName={studentName}
                    enabled={videoOn}
                    isGridMode={true}
                    isTeacher={isTeacher}
                    onLocalFocusUpdate={setLocalMetrics}
                    onStreamReady={handleStreamReady}
                  />
                </div>
                {/* Focus badge — solid white non-transparent badge */}
                <div className="absolute top-1.5 right-1.5 px-2.5 py-1 rounded-full bg-white border border-[#E5E7EB] flex items-center text-[9px] font-mono text-[#111827] font-bold z-10 gap-1.5 shadow-sm">
                  <div className={`w-1.5 h-1.5 rounded-full ${localMetrics.status === "focused" ? "bg-[#16A34A]" : "bg-[#DC2626]"}`} />
                  <span>{localMetrics.score}%</span>
                </div>
                <div className="absolute bottom-1.5 right-1.5 px-2 py-0.5 rounded-full bg-white border border-[#E5E7EB] text-[9px] font-semibold text-[#111827] z-10 shadow-xs">
                  {isTeacher ? "You" : "You"}
                </div>
              </div>

              {/* Other Students */}
              {students.filter(s => s.id !== studentId).map((student: any) => {
                const score = student.engagementScore ?? student.score ?? 0;
                const status = student.status ?? student.state ?? "offline";
                const isFocused = status === "focused";
                
                return (
                  <div key={student.id} className="relative aspect-video rounded-[22px] border border-[#E5E7EB] bg-white flex items-center justify-center hover:-translate-y-0.5 transition-all duration-350 ease-[cubic-bezier(.22,1,.36,1)] overflow-hidden shadow-xs p-4">
                    {remoteStreams[student.id] ? (
                      <video 
                        autoPlay 
                        playsInline 
                        muted
                        className="absolute inset-0 w-full h-full object-cover z-0"
                        ref={node => {
                          if (node && node.srcObject !== remoteStreams[student.id]) {
                            node.srcObject = remoteStreams[student.id];
                          }
                        }}
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-[#EFF6FF] border border-[#BFDBFE] flex items-center justify-center text-[10px] font-bold text-[#2563EB] relative z-10 shadow-xs">
                        {student.name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() || "?"}
                      </div>
                    )}
                    <span className="absolute bottom-1.5 left-1.5 px-2 py-0.5 rounded-full bg-white border border-[#E5E7EB] text-[9px] font-semibold text-[#111827] z-10 truncate max-w-[80%] shadow-xs">
                      {student.name || "Student"}
                    </span>
                    <div className="absolute top-1.5 right-1.5 px-2.5 py-1 rounded-full bg-white border border-[#E5E7EB] flex items-center text-[9px] font-mono text-[#111827] font-bold z-10 gap-1.5 shadow-sm">
                      <div className={`w-1.5 h-1.5 rounded-full ${isFocused ? "bg-[#16A34A]" : "bg-[#DC2626]"}`} />
                      <span>{score}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── DOUBT CHAT (16px spacing) ── */}
          <div className="flex-1 p-4 pt-4 flex flex-col overflow-hidden min-h-0 space-y-4">
            <h4 className="text-[#374151] font-bold text-xs tracking-[0.02em] uppercase font-mono pb-2.5 border-t border-b border-[#E5E7EB] pt-2 flex items-center justify-between flex-shrink-0">
              <span className="flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5 text-[#2563EB]" />
                Doubt Chat
              </span>
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-[#16A34A] animate-pulse" />
                <span className="text-[#16A34A] text-[9px] font-bold uppercase font-mono">Live</span>
              </span>
            </h4>
            <div className="flex-1 overflow-y-auto cscroll space-y-3 pr-1 pt-[20px] flex flex-col min-h-0">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex flex-col gap-1 max-w-[90%] slide-up ${msg.isAI ? "self-start" : "self-end items-end"}`}>
                  <span className="text-[9px] text-[#6B7280] font-semibold">{msg.sender} • {msg.time}</span>
                  <div className={`text-[11px] px-3.5 py-2.5 rounded-[18px] leading-relaxed transition-all duration-350 ease-[cubic-bezier(.22,1,.36,1)] ${
                    msg.isAI
                      ? "bg-white text-[#374151] border border-[#E5E7EB] rounded-tl-none flex gap-2 items-start shadow-xs"
                      : "bg-[#EFF6FF] text-[#1E40AF] border border-[#BFDBFE] rounded-tr-none shadow-xs font-medium"
                  }`}>
                    {msg.isAI && <Brain className="h-3.5 w-3.5 text-[#2563EB] flex-shrink-0 mt-0.5" />}
                    <span>{msg.text}</span>
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            {/* Input (52px height) */}
            <div className="flex flex-col gap-2 pt-3 border-t border-[#E5E7EB] flex-shrink-0">
              <form onSubmit={handleSendDoubt} className="flex gap-2 w-full">
                <input
                  id="doubt-chat-input" type="text" required value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)} placeholder={isAnswering ? "Professor is answering..." : "Ask a doubt..."}
                  disabled={isAnswering}
                  className="flex-1 h-[52px] px-4 bg-white border border-[#E5E7EB] rounded-[18px] text-xs focus:outline-none focus:border-[#2563EB] focus:ring-0 focus:shadow-[0_0_0_3px_rgba(37,99,235,.08)] text-[#111827] placeholder:text-[#9CA3AF] transition-all duration-350 ease-[cubic-bezier(.22,1,.36,1)] disabled:opacity-50"
                />
                <button type="submit" disabled={isAnswering} className="h-[52px] px-4 bg-[#111827] hover:bg-[#1F2937] hover:-translate-y-0.5 rounded-[16px] text-white shadow-[0_12px_24px_rgba(17,24,39,.12)] transition-all duration-350 ease-[cubic-bezier(.22,1,.36,1)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group flex items-center justify-center">
                  <Send className="h-4 w-4 group-hover:translate-x-0.5 transition-transform duration-300" />
                </button>
              </form>
            </div>
          </div>
        </aside>
      </div>

      {/* ═══ FLOATING TOOLBAR ═══ */}
      <div
        onMouseEnter={() => {
          isHoveringToolbarRef.current = true
          setShowToolbar(true)
          if (hideTimeoutRef.current) {
            clearTimeout(hideTimeoutRef.current)
            hideTimeoutRef.current = null
          }
        }}
        onMouseLeave={() => {
          isHoveringToolbarRef.current = false
          if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current)
          hideTimeoutRef.current = setTimeout(() => {
            if (!isHoveringToolbarRef.current) {
              setShowToolbar(false)
            }
          }, 2000)
        }}
        className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[45] flex items-center gap-3 transition-all duration-350 ease-[cubic-bezier(.22,1,.36,1)] ${
          showToolbar ? "translate-y-0 opacity-100" : "translate-y-28 opacity-0 pointer-events-none"
        }`}
      >
        <div
          className="flex items-center px-3 rounded-[24px] shadow-[0_20px_40px_rgba(15,23,42,.08)] border border-[rgba(15,23,42,.08)] bg-white/95 backdrop-blur-md relative gap-1"
          style={{ height: 64 }}
        >
          {/* Mic */}
          <button id="mic-toggle" onClick={() => { setMicOn(v => !v); addToast(micOn ? "Mic off" : "Mic on") }}
            className={`group flex flex-col items-center justify-center gap-0.5 px-3.5 h-full rounded-[16px] transition-all duration-350 ease-[cubic-bezier(.22,1,.36,1)] cursor-pointer hover:-translate-y-0.5 ${micOn ? "text-[#374151] hover:bg-[#F3F4F6]" : "text-[#DC2626] bg-[#FEF2F2]"}`}>
            {micOn ? <Mic className="h-[18px] w-[18px] group-hover:scale-[1.08] transition-transform duration-300" /> : <MicOff className="h-[18px] w-[18px] group-hover:scale-[1.08] transition-transform duration-300" />}
            <span className="text-[11px] font-medium">Mic</span>
          </button>

          {/* Camera */}
          <button id="camera-toggle" onClick={() => { setVideoOn(v => !v); addToast(videoOn ? "Camera off" : "Camera on") }}
            className={`group flex flex-col items-center justify-center gap-0.5 px-3.5 h-full rounded-[16px] transition-all duration-350 ease-[cubic-bezier(.22,1,.36,1)] cursor-pointer hover:-translate-y-0.5 ${videoOn ? "text-[#374151] hover:bg-[#F3F4F6]" : "text-[#DC2626] bg-[#FEF2F2]"}`}>
            {videoOn ? <Video className="h-[18px] w-[18px] group-hover:scale-[1.08] transition-transform duration-300" /> : <VideoOff className="h-[18px] w-[18px] group-hover:scale-[1.08] transition-transform duration-300" />}
            <span className="text-[11px] font-medium">Camera</span>
          </button>

          {/* People */}
          <button onClick={() => {
            const next = !isParticipantsOpen
            setIsParticipantsOpen(next)
            if (next) {
              handleParticipantsInteraction()
            }
            localStorage.setItem("participantsOpen", next ? "true" : "false")
          }}
            className={`group flex flex-col items-center justify-center gap-0.5 px-3.5 h-full rounded-[16px] transition-all duration-350 ease-[cubic-bezier(.22,1,.36,1)] cursor-pointer hover:-translate-y-0.5 ${isParticipantsOpen ? "text-[#2563EB] bg-[#EFF6FF]" : "text-[#374151] hover:bg-[#F3F4F6]"}`}>
            <Users className="h-[18px] w-[18px] group-hover:scale-[1.08] transition-transform duration-300" />
            <span className="text-[11px] font-medium">People</span>
          </button>

          {/* More Popover Button */}
          <div className="relative h-full flex items-center">
            <button
              onClick={() => setShowMoreMenu(v => !v)}
              className={`group flex flex-col items-center justify-center gap-0.5 px-3.5 h-full rounded-[16px] transition-all duration-350 ease-[cubic-bezier(.22,1,.36,1)] cursor-pointer hover:-translate-y-0.5 ${showMoreMenu ? "text-[#2563EB] bg-[#EFF6FF]" : "text-[#374151] hover:bg-[#F3F4F6]"}`}
            >
              <MoreHorizontal className="h-[18px] w-[18px] group-hover:scale-[1.08] transition-transform duration-300" />
              <span className="text-[11px] font-medium">More</span>
            </button>

            {/* Popover Menu */}
            {showMoreMenu && (
              <div
                ref={moreMenuRef}
                className="absolute bottom-20 right-0 bg-white border border-[#E5E7EB] rounded-[18px] p-2 w-48 shadow-[0_18px_34px_rgba(15,23,42,.08)] flex flex-col gap-1 z-50 backdrop-blur-md"
              >
                {/* Voice speech synthesizer toggle */}
                <button
                  onClick={() => {
                    setSpeechEnabled(v => {
                      const next = !v
                      if (!next) { stopSpeaking() }
                      addToast(next ? "Voice on" : "Voice muted")
                      return next
                    })
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-slate-50 rounded-lg text-xs font-semibold flex items-center justify-between text-slate-700"
                >
                  <span className="flex items-center gap-2">
                    {speechEnabled ? <Volume2 className="h-3.5 w-3.5 text-blue-600" /> : <VolumeX className="h-3.5 w-3.5 text-red-600" />}
                    AI Voice
                  </span>
                  <span className="text-[10px] text-slate-400">{speechEnabled ? "On" : "Off"}</span>
                </button>

                {/* Record session */}
                <button
                  onClick={() => { const v = !isRecording; setIsRecording(v); addToast(v ? "Recording session started" : "Recording saved") }}
                  className="w-full px-3 py-2 text-left hover:bg-slate-50 rounded-lg text-xs font-semibold flex items-center justify-between text-slate-700"
                >
                  <span className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${isRecording ? "bg-red-500 animate-pulse" : "bg-slate-350"}`} />
                    Record Class
                  </span>
                  <span className="text-[10px] text-slate-400">{isRecording ? "Recording" : "Start"}</span>
                </button>

                {/* Divider if teacher */}
                {isTeacher && teachingMode === "AI" && <div className="h-px bg-slate-100 my-1" />}

                {/* Teacher-only: Pause/Resume AI */}
                {isTeacher && teachingMode === "AI" && (
                  <button
                    onClick={() => {
                      if (aiSpeechState === "speaking") {
                        pauseSpeaking()
                        addToast("AI paused")
                      } else {
                        resumeSpeaking()
                        addToast("AI resumed")
                      }
                      setShowMoreMenu(false)
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-slate-50 rounded-lg text-xs font-semibold flex items-center gap-2 text-slate-700"
                  >
                    {aiSpeechState === "speaking" ? <Pause className="h-3.5 w-3.5 text-amber-500" /> : <Play className="h-3.5 w-3.5 text-emerald-500" />}
                    {aiSpeechState === "speaking" ? "Pause Lecture" : "Resume Lecture"}
                  </button>
                )}

                {/* Teacher-only: Take Over */}
                {isTeacher && teachingMode === "AI" && (
                  <button
                    onClick={() => { setTeachingMode("Human"); stopSpeaking(); addToast("You took over classroom"); setShowMoreMenu(false) }}
                    className="w-full px-3 py-2 text-left hover:bg-slate-50 rounded-lg text-xs font-semibold flex items-center gap-2 text-blue-600"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Take Over Class
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ TOASTS ═══ */}
      <div className="fixed bottom-24 left-6 z-[60] flex flex-col gap-2 max-w-xs pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className="flex items-center gap-2 bg-white border border-slate-200 p-3 rounded-xl shadow-2xl slide-up text-xs text-slate-700 pointer-events-auto">
            <span>{t.text}</span>
          </div>
        ))}
      </div>

      {/* ═══ END MODAL ═══ */}
      {showEndModal && (
        <div className="fixed inset-0 z-[99] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl">
            <div className="p-6 text-center space-y-4">
              <AlertCircle className="h-10 w-10 text-red-500 mx-auto" />
              <h3 className="font-bold text-slate-900 text-base">End this session?</h3>
              <p className="text-xs text-slate-500">This will end the lecture for all participants.</p>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex gap-3">
              <button onClick={() => setShowEndModal(false)} className="flex-1 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800 transition-all cursor-pointer">Cancel</button>
              <button onClick={handleConfirmEnd} className="flex-1 py-2.5 bg-[#DC2626] hover:bg-[#B91C1C] rounded-xl text-xs font-bold text-white transition-all cursor-pointer">End Session</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ END COUNTDOWN ═══ */}
      {endCountdown !== null && (
        <div className="fixed inset-0 bg-[#F6F7F9] z-[999] flex flex-col items-center justify-center text-center p-6">
          <Brain className="h-14 w-14 text-blue-600 mx-auto animate-pulse mb-5" />
          <h2 className="text-xl font-black text-slate-900">Session Ended</h2>
          <p className="text-xs text-blue-600 font-semibold italic mt-3">&ldquo;Great work today, everyone!&rdquo;</p>
          <p className="text-[10px] text-slate-450 mt-4">Returning to dashboard in {endCountdown}s</p>
        </div>
      )}

      {/* ─── OVERLAY ─── */}
      <div 
        className="drawer-overlay"
        style={overlayStyle}
        onClick={() => {
          setIsParticipantsOpen(false)
          localStorage.setItem("participantsOpen", "false")
        }}
      />

      {/* ─── EDGE SWIPE ZONE (MOBILE) ─── */}
      {!isParticipantsOpen && (
        <div 
          className="fixed right-0 top-0 bottom-0 w-6 z-[80] bg-transparent touch-none"
          onTouchStart={handleTouchStart}
        />
      )}

      {/* ─── DRAWER HANDLE ─── */}
      {!isParticipantsOpen && (
        <button
          ref={participantsTabRef}
          type="button"
          onMouseEnter={() => {
            setIsParticipantsOpen(true)
            handleParticipantsInteraction()
            localStorage.setItem("participantsOpen", "true")
          }}
          onClick={() => {
            setIsParticipantsOpen(true)
            handleParticipantsInteraction()
            localStorage.setItem("participantsOpen", "true")
          }}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          className="drawer-handle shadow-lg border-none outline-none focus:outline-none"
        >
          <div className="flex flex-col items-center gap-2">
            <span className="text-[10px] text-blue-600 font-bold animate-pulse">◀</span>
            <Users className="h-3.5 w-3.5 text-slate-700" />
            <span 
              style={{ writingMode: "vertical-rl" }} 
              className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 select-none my-1"
            >
              People
            </span>
          </div>
        </button>
      )}

      {/* ─── INSTAGRAM HINT ─── */}
      {!isParticipantsOpen && showHint && (
        <div className="hint-indicator">
          {/* page indicator dot */}
          <div className="h-1.5 w-1.5 rounded-full bg-blue-500 shadow-lg shadow-blue-500/50 animate-pulse" />
          <div className="h-1 w-1 rounded-full bg-slate-300" />
          {/* animated arrow */}
          <div className="hint-arrow mt-2 bg-blue-600 text-white rounded-full p-1 border border-blue-400/20 shadow-md">
            <span className="text-[9px] font-black leading-none block">←</span>
          </div>
        </div>
      )}

      {/* ─── DRAWER CONTAINER ─── */}
      <div
        ref={drawerRef}
        className="drawer-container flex flex-col"
        style={{
          transform: transformStr,
          transition: isDragging ? "none" : "transform 300ms cubic-bezier(0.16, 1, 0.3, 1)",
        }}
        onTouchStart={(e) => {
          // Allow swipe dismissal from within the drawer container if started on the edge
          const touchX = e.touches[0].clientX
          const rect = drawerRef.current?.getBoundingClientRect()
          if (rect && touchX < rect.left + 30) {
            setIsDragging(true)
            setStartX(touchX)
            setCurrentX(touchX)
            setDragOffset(0)
          }
        }}
      >
        {/* Drawer Header */}
        <div className="h-14 border-b border-slate-100 px-5 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <Users className="h-4 w-4 text-blue-600" />
            <h3 className="font-bold text-sm text-[#111827]">Participants</h3>
            <span className="px-2 py-0.5 rounded-full bg-blue-50 border border-blue-100 text-[10px] font-bold text-blue-600">
              {students.length}
            </span>
          </div>
          <button
            onClick={() => {
              setIsParticipantsOpen(false)
              localStorage.setItem("participantsOpen", "false")
            }}
            className="h-8 w-8 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-all cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Drawer Controls (Search & Filters) */}
        <div className="p-4 border-b border-slate-100 space-y-3 flex-shrink-0">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search people..."
              className="w-full pl-9 pr-4 py-2 bg-[#F8FAFC] border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500/40 text-slate-800 placeholder:text-slate-400 transition-all"
            />
          </div>

          {/* Filters */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Filters</span>
            <button
              onClick={() => setShowOnlyActive(prev => !prev)}
              className={`px-2.5 py-1 rounded-lg border text-[10px] font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                showOnlyActive
                  ? "bg-blue-50 border-blue-200 text-blue-600"
                  : "bg-slate-50 border-slate-200 text-slate-650 hover:bg-slate-100"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${showOnlyActive ? "bg-blue-500 animate-pulse" : "bg-slate-300"}`} />
              Active Speakers
            </button>
          </div>
        </div>

        {/* Participant List */}
        <div className="flex-1 overflow-y-auto cscroll p-3 space-y-1">
          {filteredStudents.length > 0 ? (
            filteredStudents.map((s) => {
              const isSpeaking = speakingStudentIds.has(s.id);
              const { isMuted, hasHandRaised, connectionQual } = getStudentProps(s);
              
              // connection icon
              let connColor = "text-emerald-600";
              if (connectionQual === "Good") connColor = "text-amber-500";
              if (connectionQual === "Fair") connColor = "text-rose-500";

              return (
                <div
                  key={s.id}
                  className={`flex items-center justify-between p-2.5 rounded-xl transition-all border border-transparent ${
                    isSpeaking 
                      ? "bg-blue-50/50 border-blue-200" 
                      : "hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Avatar with speaking animation */}
                    <div className="relative">
                      {isSpeaking && (
                        <div className="absolute -inset-1 rounded-full border border-blue-500/80 animate-ping opacity-70" />
                      )}
                      <div
                        className={`h-9 w-9 rounded-full bg-slate-50 border flex items-center justify-center text-xs font-bold shadow-sm relative z-10 transition-all ${
                          isSpeaking ? "border-blue-500 ring-2 ring-blue-500/20 text-blue-600" : "border-slate-200 text-slate-700"
                        }`}
                      >
                        {s.name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() || "?"}
                      </div>
                      {/* focus dot status */}
                      <span className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border border-white z-20 ${
                        s.status === "active" ? "bg-emerald-500" : s.status === "idle" ? "bg-amber-500" : s.status === "distracted" ? "bg-rose-500" : "bg-gray-400"
                      }`} />
                    </div>

                    {/* Name & status */}
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-slate-800 truncate flex items-center gap-1.5">
                        {s.name}
                        {s.id === studentId && (
                          <span className="text-[8px] bg-blue-50 px-1 py-0.2 rounded font-black text-blue-600 border border-blue-100">YOU</span>
                        )}
                      </span>
                      <span className="text-[10px] text-slate-400 truncate uppercase tracking-wider font-semibold">
                        {s.status} • {s.engagementScore}%
                      </span>
                    </div>
                  </div>

                  {/* Indicators */}
                  <div className="flex items-center gap-2">
                    {/* hand raise */}
                    {hasHandRaised && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-1.5 text-amber-600 animate-bounce">
                        <Hand className="h-3 w-3" />
                      </div>
                    )}

                    {/* mic status */}
                    <div className={`p-1.5 rounded-lg border ${
                      isMuted 
                        ? "bg-red-50 border-red-100 text-red-500" 
                        : "bg-slate-50 border-slate-200 text-slate-400"
                    }`}>
                      {isMuted ? <MicOff className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
                    </div>

                    {/* connection */}
                    <div className={`p-1.5 rounded-lg bg-slate-50 border border-slate-200 ${connColor}`} title={`Connection: ${connectionQual}`}>
                      <svg className="h-3 w-3 fill-current" viewBox="0 0 24 24">
                        <rect x="3" y="16" width="3" height="5" rx="0.5" opacity={connectionQual === "Fair" ? 0.3 : 1} />
                        <rect x="9" y="11" width="3" height="10" rx="0.5" opacity={connectionQual === "Fair" || connectionQual === "Good" ? 0.3 : 1} />
                        <rect x="15" y="6" width="3" height="15" rx="0.5" />
                      </svg>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-10 space-y-2">
              <Users className="h-8 w-8 text-slate-300 mx-auto" />
              <p className="text-xs text-slate-400">No participants found</p>
            </div>
          )}
        </div>
      </div>
      {typeof document !== "undefined" && (
        <>
          {/* Warning modal overlay */}
          {warningLevel > 0 &&
            createPortal(
              <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/40 backdrop-blur-xl animate-in fade-in duration-300 p-4 font-sans text-slate-800">
                <div className="max-w-md w-full rounded-3xl border border-slate-200 bg-white p-7 text-center animate-in zoom-in-95 duration-300 shadow-[0_0_60px_rgba(15,23,42,0.15)] relative overflow-hidden">
                  {/* Subtle background glow */}
                  <div className="absolute -top-20 -left-20 w-40 h-40 rounded-full bg-blue-100/40 blur-3xl pointer-events-none" />
                  <div className="absolute -bottom-20 -right-20 w-40 h-40 rounded-full bg-indigo-100/40 blur-3xl pointer-events-none" />

                  {/* Strike counter badge */}
                  <div className="relative z-10 h-20 w-28 rounded-2xl bg-rose-50 border-2 border-rose-500/50 flex flex-col items-center justify-center mx-auto mb-4 shadow-[0_0_35px_rgba(244,63,94,0.15)]">
                    <span className="text-2xl font-black text-rose-600 font-mono tracking-wider">
                      {warningLevel}/3
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-rose-500">
                      STRIKE {warningLevel}
                    </span>
                  </div>

                  {/* Title & Subtitle */}
                  <div className="relative z-10 space-y-2 mb-5">
                    <h3 className="text-xl font-black text-slate-950 tracking-tight">
                      {warningLevel === 1 && "Warning: Strike 1 of 3"}
                      {warningLevel === 2 && "Warning: Strike 2 of 3"}
                      {warningLevel === 3 && "FINAL STRIKE 3/3 — Lesson Paused"}
                    </h3>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      {warningLevel === 1 && "Focus score dropped below 30%. Facing away again will trigger Strike 2."}
                      {warningLevel === 2 && "Sustained distraction detected! One more strike will result in automatic kick."}
                      {warningLevel === 3 && "You have reached 3 strikes! Click below to resume or you will be kicked from class."}
                    </p>
                    <div className="pt-1">
                      <span className="text-xs font-black text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-1.5 inline-block shadow-sm">
                        🚨 STRIKE {warningLevel}/3 — Reaching 3/3 results in auto-kick!
                      </span>
                    </div>
                  </div>

                  {/* Focus metrics pill */}
                  <div className="relative z-10 inline-flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-full px-4 py-1.5 mb-5 shadow-inner">
                    <span className={`h-2 w-2 rounded-full ${localMetrics.status === "focused" ? "bg-emerald-500" : localMetrics.status === "distracted" ? "bg-amber-500" : "bg-rose-500"} animate-ping`} />
                    <span className="text-xs text-slate-500 font-medium">Focus Score:</span>
                    <span className="text-xs font-mono font-bold text-blue-605 text-blue-600">{localMetrics.score}%</span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">({localMetrics.status})</span>
                  </div>

                  {/* Gaze Telemetry Box */}
                  <div className="relative z-10 text-xs text-slate-600 bg-[#FCFCFD] p-3.5 rounded-2xl border border-slate-200 mb-6 flex items-center justify-center gap-2">
                    <Eye className="h-4 w-4 text-blue-600 flex-shrink-0" />
                    <span>
                      {localMetrics.gazeDirection !== 'unknown' && localMetrics.gazeDirection !== 'center' 
                        ? `Detected Gaze: ${localMetrics.gazeDirection.toUpperCase()} (${Math.round(localMetrics.effectiveDeviation)}° angle)` 
                        : "Please face forward and align your gaze with the screen."}
                    </span>
                  </div>

                  {/* CTA Button */}
                  <button
                    onClick={() => {
                      setStrikeCount(prev => Math.min(3, prev + 1));
                      setWarningLevel(0);
                    }}
                    className="relative z-10 w-full py-4 rounded-2xl bg-[#111827] hover:bg-[#1F2937] transition-all duration-300 text-xs font-black uppercase tracking-widest text-white shadow-lg active:scale-[0.98] cursor-pointer"
                  >
                    I&apos;m Focused — Resume Learning
                  </button>
                </div>
              </div>,
              document.body
            )
          }

          {/* Out of frame overlay */}
          {outOfFrameSecondsLeft !== null &&
            createPortal(
              <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/40 backdrop-blur-xl animate-in fade-in duration-300 p-4 font-sans text-slate-800">
                <div className="max-w-md w-full rounded-3xl border border-rose-200 bg-white p-7 text-center animate-in zoom-in-95 duration-300 shadow-[0_0_60px_rgba(244,63,94,0.15)] relative overflow-hidden">
                  <div className="absolute -top-20 -left-20 w-40 h-40 rounded-full bg-rose-100/40 blur-3xl pointer-events-none" />

                  {/* Icon */}
                  <div className="relative z-10 h-16 w-16 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center mx-auto mb-5">
                    <Lock className="h-8 w-8 text-rose-500 animate-bounce" />
                  </div>

                  <h3 className="relative z-10 text-xl font-black text-slate-950 tracking-tight mb-2">Face Not Detected</h3>
                  <p className="relative z-10 text-xs text-slate-500 leading-relaxed mb-6">
                    Please align your face within the camera frame to remain active in the session.
                  </p>

                  <div className="relative z-10 inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-rose-50 border border-rose-200 mb-6">
                    <span className="text-3xl font-mono font-black text-rose-500">{outOfFrameSecondsLeft}s</span>
                  </div>

                  <p className="relative z-10 text-[11px] text-rose-600/70 leading-relaxed">
                    You will be automatically removed from the session in {outOfFrameSecondsLeft} seconds if undetected.
                  </p>
                </div>
              </div>,
              document.body
            )
          }

          {/* Phone / Tablet Warning overlay */}
          {showPhoneWarning && phoneWarningCount < 3 &&
            createPortal(
              <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-slate-900/40 backdrop-blur-xl animate-in fade-in duration-300 p-4 font-sans text-slate-800">
                <div className="max-w-md w-full rounded-3xl border border-amber-200 bg-white p-7 text-center animate-in zoom-in-95 duration-300 shadow-[0_0_60px_rgba(245,158,11,0.15)] relative overflow-hidden">
                  <div className="absolute -top-20 -left-20 w-40 h-40 rounded-full bg-amber-100/40 blur-3xl pointer-events-none" />

                  <div className="relative z-10 h-16 w-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto mb-5">
                    <AlertTriangle className="h-8 w-8 text-amber-550 text-amber-500 animate-pulse" />
                  </div>

                  <h3 className="relative z-10 text-xl font-black text-slate-950 tracking-tight mb-2">Device Usage Detected</h3>
                  <p className="relative z-10 text-xs text-slate-500 leading-relaxed mb-6">
                    Using phones, tablets, or secondary screens is strictly prohibited during live sessions.
                  </p>

                  {phoneSecondsLeft !== null ? (
                    <div className="relative z-10 inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-amber-50 border border-amber-200 mb-6">
                      <span className="text-3xl font-mono font-black text-amber-500">{phoneSecondsLeft}s</span>
                    </div>
                  ) : (
                    <div className="relative z-10 inline-flex items-center justify-center px-4 py-2 rounded-xl bg-amber-50 border border-amber-200 mb-6">
                      <span className="text-xs font-mono font-bold text-amber-600">Warning {phoneWarningCount} of 3</span>
                    </div>
                  )}

                  <p className="relative z-10 text-[11px] text-amber-600/70 leading-relaxed">
                    {phoneSecondsLeft !== null
                      ? `Please put away the device. Warning strike in ${phoneSecondsLeft} seconds.`
                      : "Put the device completely away to resume learning."}
                  </p>
                </div>
              </div>,
              document.body
            )
          }
          {/* Entry Overlay */}
          {!hasEntered && (
            <div className="fixed inset-0 bg-[#F6F7F9] z-[99] flex flex-col items-center justify-center text-center p-6 font-sans antialiased col-span-full">
              <style>{`
                @keyframes ep{0%,100%{box-shadow:0 0 20px rgba(37,99,235,.1)}50%{box-shadow:0 0 40px rgba(37,99,235,.2)}}
                @keyframes fu{0%{opacity:0;transform:translateY(20px)}100%{opacity:1;transform:translateY(0)}}
                .ef{animation:fu .6s cubic-bezier(.16,1,.3,1) forwards}
                .efd{animation:fu .6s cubic-bezier(.16,1,.3,1) .15s forwards;opacity:0}
                .efd2{animation:fu .6s cubic-bezier(.16,1,.3,1) .3s forwards;opacity:0}
              `}</style>
              <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(15,23,42,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.03)_1px,transparent_1px)] bg-[size:48px_48px] pointer-events-none" />
              <div className="relative z-10 max-w-sm w-full space-y-8">
                <div className="ef flex flex-col items-center gap-5">
                  <div className="h-20 w-20 rounded-3xl bg-blue-50 flex items-center justify-center border border-blue-100" style={{ animation: "ep 3s ease-in-out infinite" }}>
                    <Brain className="h-10 w-10 text-blue-600" />
                  </div>
                  <div className="space-y-2">
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">Ready to begin?</h1>
                    <p className="text-xs text-slate-400 leading-relaxed">{isParsingPdf ? "Loading PDF..." : "Your AI-powered classroom is prepared"}</p>
                  </div>
                </div>
                <div className="efd bg-white border border-slate-200 rounded-2xl p-5 space-y-3 shadow-md">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black uppercase tracking-[.15em] text-blue-600">Session</span>
                    <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-50 px-2 py-0.5 rounded">{sessionCode}</span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">{sessionTitle}</h3>
                  <p className="text-[11px] text-slate-500">{sessionSubject} • {isPdfMode ? `${pdfPages.length} Pages` : `${topics.length} topics`} • {teachingMode} Mode</p>
                  <div className="flex items-center gap-2 pt-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] text-emerald-600 font-semibold">6 students connected</span>
                  </div>
                </div>
                <button id="enter-classroom-btn" disabled={isParsingPdf} onClick={handleEnterClassroom} className="efd2 w-full py-4 bg-[#111827] hover:bg-[#1F2937] rounded-2xl text-sm font-black uppercase text-white tracking-widest transition-all shadow-lg shadow-slate-900/10 active:scale-[.98] cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                  <Play className="h-4 w-4 fill-current" /> {isParsingPdf ? "Loading..." : "Enter Classroom"}
                </button>
                <p className="text-[10px] text-slate-455 text-slate-400">Click to enable audio • M=mic V=video H=hand C=chat</p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
