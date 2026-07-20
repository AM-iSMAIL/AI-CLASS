"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import {
  Play,
  History,
  LogOut,
  Loader2,
  AlertCircle,
  Tv,
  Calendar,
  Clock,
  Sparkles,
  BookOpen,
  ArrowRight,
  Menu,
  X,
  Cloud,
  FileText,
  Download,
  ArrowLeft
} from "lucide-react"
import { joinSession } from "@/lib/session-service"

export default function StudentDashboardPage() {
  const [studentName, setStudentName] = useState("")
  const [sessionCode, setSessionCode] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<"dashboard" | "documents" | "history">("dashboard")

  useEffect(() => {
    if (typeof window !== "undefined") {
      const name = localStorage.getItem("studentName")
      if (!name) {
        window.location.href = "/auth"
      } else {
        setStudentName(name)
      }
    }
  }, [])

  const handleJoinClass = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!sessionCode.trim()) return

    setIsSubmitting(true)
    setError(null)
    setSuccess(null)

    try {
      const formattedCode = sessionCode.trim().toUpperCase()
      setSuccess("Validating session code...")
      
      const studentId = await joinSession(studentName, formattedCode)
      localStorage.setItem("studentId", studentId)
      
      setSuccess("Session verified! Joining classroom...")
      setTimeout(() => {
        window.location.href = `/session/${formattedCode}`
      }, 1200)
    } catch (err: any) {
      console.error(err)
      setError(err.message || "Session not found. Please verify the code.")
      setIsSubmitting(false)
    }
  }

  const handleSignOut = () => {
    localStorage.removeItem("studentName")
    localStorage.removeItem("studentId")
    window.location.href = "/auth"
  }

  if (!studentName) {
    return (
      <div className="flex h-screen bg-[#070708] items-center justify-center">
        <div className="h-8 w-8 rounded-full border border-purple-500 border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#070708] font-sans antialiased text-white flex flex-col relative overflow-hidden">
      {/* Premium background mesh gradients */}
      <div className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full bg-purple-600/5 blur-[160px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-15%] w-[600px] h-[600px] rounded-full bg-indigo-650/5 blur-[160px] pointer-events-none" />

      {/* ─── Header ─── */}
      <header className="w-full border-b border-white/5 bg-[#0A0A0C]/70 backdrop-blur-md sticky top-0 z-20 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Hamburger Trigger */}
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 rounded-lg bg-white/5 border border-white/5 hover:bg-purple-500/10 hover:border-purple-500/20 text-white/80 hover:text-white transition-all cursor-pointer active:scale-95"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2.5 border-l-2 border-purple-500/40 pl-3 drop-shadow-[0_0_8px_rgba(147,51,234,0.25)] hover:border-purple-500/85 transition-all"
          >
            <Image src="/logo.png" alt="Class AI" width={30} height={30} />
            <span className="text-md font-bold tracking-tight text-white">
              Class<span className="text-purple-400">AI</span>{" "}
              <span className="text-[9px] font-black px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-purple-400 ml-1.5 uppercase tracking-wider">
                Student
              </span>
            </span>
          </Link>
        </div>

        {/* Profile Info */}
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2 text-xs font-semibold text-white/80">
            <span className="text-white/40 font-normal">Welcome,</span>
            <span className="text-purple-400 hover:text-purple-300 transition-colors">{studentName}</span>
          </div>

          <button
            onClick={handleSignOut}
            className="flex items-center justify-center gap-2 px-3 py-1.5 rounded-xl border border-white/5 bg-white/[0.02] text-xs font-semibold text-white/70 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition-all cursor-pointer active:scale-95"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign Out
          </button>
        </div>
      </header>

      {/* ─── SLIDING DRAWER MENU (Hamburger) ─── */}
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity duration-300 ${
          isSidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setIsSidebarOpen(false)}
      >
        <div
          className={`fixed top-0 left-0 bottom-0 w-[300px] bg-[#0E0E0E] border-r border-white/5 p-6 space-y-6 transform transition-transform duration-300 ease-out z-55 flex flex-col justify-between ${
            isSidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <span className="text-sm font-bold uppercase tracking-wider text-purple-400">Navigation</span>
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="p-1 rounded bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => {
                  setActiveTab("dashboard")
                  setIsSidebarOpen(false)
                }}
                className={`w-full text-left px-4 py-3 rounded-xl border transition-all flex items-center gap-3 font-semibold text-xs cursor-pointer ${
                  activeTab === "dashboard"
                    ? "border-purple-500/30 bg-purple-500/10 text-purple-300 shadow-md"
                    : "border-white/5 bg-white/[0.01] text-white/60 hover:bg-white/[0.03] hover:text-white"
                }`}
              >
                <Tv className="h-4.5 w-4.5" />
                Student Dashboard
              </button>

              <button
                onClick={() => {
                  setActiveTab("documents")
                  setIsSidebarOpen(false)
                }}
                className={`w-full text-left px-4 py-3 rounded-xl border transition-all flex items-center gap-3 font-semibold text-xs cursor-pointer ${
                  activeTab === "documents"
                    ? "border-purple-500/30 bg-purple-500/10 text-purple-300 shadow-md"
                    : "border-white/5 bg-white/[0.01] text-white/60 hover:bg-white/[0.03] hover:text-white"
                }`}
              >
                <Cloud className="h-4.5 w-4.5" />
                Course Documents
              </button>

              <button
                onClick={() => {
                  setActiveTab("history")
                  setIsSidebarOpen(false)
                }}
                className={`w-full text-left px-4 py-3 rounded-xl border transition-all flex items-center gap-3 font-semibold text-xs cursor-pointer ${
                  activeTab === "history"
                    ? "border-purple-500/30 bg-purple-500/10 text-purple-300 shadow-md"
                    : "border-white/5 bg-white/[0.01] text-white/60 hover:bg-white/[0.03] hover:text-white"
                }`}
              >
                <History className="h-4.5 w-4.5" />
                Session History
              </button>
            </div>
          </div>

          <div className="border-t border-white/5 pt-4">
            <button
              onClick={handleSignOut}
              className="w-full py-2.5 rounded-xl border border-red-500/10 bg-red-500/5 hover:bg-red-500/10 text-red-400 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* ─── Main Workspace ─── */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-6 md:p-8 z-10 flex flex-col gap-8">
        
        {activeTab === "dashboard" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-fadeIn">
            
            {/* ─── LEFT COLUMN: JOIN CLASS (lg:col-span-5) ─── */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-[#0D0D11] border border-white/5 rounded-2xl p-6 md:p-8 shadow-xl space-y-6 relative overflow-hidden">
                {/* Subtle accent border top */}
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-purple-500/0 via-purple-500/40 to-indigo-500/0" />
                
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-purple-500/10 border border-purple-500/15 flex items-center justify-center text-purple-400">
                    <Tv className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white tracking-wide">Join a Live Class</h2>
                    <p className="text-[11px] text-white/40 mt-0.5">Enter the session code from your teacher</p>
                  </div>
                </div>

                <form onSubmit={handleJoinClass} className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest block">Session Code</label>
                    <input
                      type="text"
                      required
                      maxLength={10}
                      disabled={isSubmitting}
                      placeholder="CLASS-XXXX"
                      value={sessionCode}
                      onChange={(e) => setSessionCode(e.target.value)}
                      className="w-full px-4 py-3.5 text-center font-mono text-xl font-bold tracking-widest uppercase bg-black/40 border border-white/5 rounded-xl text-white placeholder-white/10 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 transition-all disabled:opacity-50"
                    />
                  </div>

                  {error && (
                    <div className="flex items-center gap-2.5 text-red-400 bg-red-500/5 border border-red-500/10 px-4 py-3 rounded-xl text-xs animate-fadeIn">
                      <AlertCircle className="h-4 w-4 flex-shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  {success && (
                    <div className="flex items-center gap-2.5 text-emerald-400 bg-emerald-500/5 border border-emerald-500/10 px-4 py-3 rounded-xl text-xs animate-fadeIn">
                      <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
                      <span>{success}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmitting || !sessionCode.trim()}
                    className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-indigo-650 hover:from-purple-700 hover:to-indigo-700 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-purple-500/15 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-xs uppercase tracking-wider active:scale-[0.98]"
                  >
                    {isSubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="h-3.5 w-3.5 fill-current" />
                    )}
                    {isSubmitting ? "Connecting..." : "Join Class"}
                  </button>
                </form>
              </div>
              
              {/* Live Indicator Mock Widget */}
              <div className="p-4 bg-gradient-to-r from-purple-550/5 via-indigo-950/5 to-black/40 border border-white/5 rounded-xl flex items-center justify-between text-xs">
                <span className="text-white/40 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-purple-500 animate-pulse" />
                  Real-time syncing enabled
                </span>
                <span className="text-purple-400 font-bold uppercase text-[9px] tracking-wide flex items-center gap-1">
                  <Sparkles className="h-3 w-3 animate-pulse" /> DB Active
                </span>
              </div>
            </div>

            {/* ─── RIGHT COLUMN: PREVIOUS LECTURES HISTORY (lg:col-span-7) ─── */}
            <div className="lg:col-span-7 space-y-5">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div className="flex items-center gap-2">
                  <History className="h-4.5 w-4.5 text-purple-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white">Previous Lectures History</h3>
                </div>
                <span className="text-[10px] text-white/30 font-semibold">2 Sessions logged</span>
              </div>

              <div className="space-y-4">
                {[
                  {
                    title: "Introduction to Generative AI & LLMs",
                    date: "July 17, 2026",
                    duration: "45 mins",
                    summary: "This session detailed the transition of Class AI into a fully autonomous lecture assistant. Discussed how HLS.js connects player layers with Ngrok tunnel streaming, while Firebase handles real-time synchronization between teacher settings and student dashboards."
                  },
                  {
                    title: "Neural Network Architectures & Deep Learning",
                    date: "July 14, 2026",
                    duration: "52 mins",
                    summary: "Covered the foundational models of deep learning, backpropagation algorithms, and the integration of NVIDIA NIM speech synthesis API pathways for the virtual assistant avatar."
                  }
                ].map((lecture, index) => (
                  <div
                    key={index}
                    className="bg-[#0D0D11] border border-white/5 rounded-2xl p-5 md:p-6 space-y-4 hover:border-purple-500/15 hover:bg-[#111116] transition-all duration-300 shadow-md group relative"
                  >
                    {/* Subtle hover gradient light */}
                    <div className="absolute inset-0 bg-radial-gradient from-purple-550/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-2xl" />

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-3 relative z-10">
                      <div className="space-y-1">
                        <span className="text-[8px] bg-purple-500/10 border border-purple-500/20 text-purple-400 font-black px-2 py-0.5 rounded uppercase tracking-wider">
                          Lecture {index + 1}
                        </span>
                        <h4 className="text-xs font-extrabold text-white leading-snug group-hover:text-purple-300 transition-colors">
                          {lecture.title}
                        </h4>
                      </div>
                      
                      <div className="flex items-center gap-3 text-[10px] text-white/40 font-bold bg-black/25 px-2.5 py-1 rounded-lg border border-white/5 flex-shrink-0 self-start sm:self-center">
                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {lecture.date}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {lecture.duration}</span>
                      </div>
                    </div>

                    <div className="space-y-1.5 relative z-10">
                      <span className="text-[9px] uppercase font-black text-purple-400/90 tracking-widest block">AI Catch-Up Summary</span>
                      <p className="text-[11px] text-white/50 leading-relaxed font-sans font-medium">
                        {lecture.summary}
                      </p>
                    </div>

                    <div className="flex gap-3 pt-1.5 relative z-10">
                      <button
                        onClick={() => alert(`Launching recorded video playback stream...`)}
                        className="px-4 py-2 bg-purple-650/10 hover:bg-purple-650/20 border border-purple-500/20 text-purple-300 hover:text-purple-200 text-[10px] font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
                      >
                        <Play className="h-3.5 w-3.5 fill-current" />
                        Watch Recording
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* ─── TAB 2: COURSE DOCUMENTS ─── */}
        {activeTab === "documents" && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div className="flex items-center gap-2.5">
                <Cloud className="h-5 w-5 text-purple-400" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-white">Course Documents</h3>
              </div>
              <button
                onClick={() => setActiveTab("dashboard")}
                className="inline-flex items-center gap-1 text-xs text-purple-400 font-bold hover:text-purple-300 cursor-pointer transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Dashboard
              </button>
            </div>

            <div className="bg-[#0D0D11] border border-white/5 rounded-2xl overflow-hidden shadow-xl">
              <div className="p-5 border-b border-white/5 bg-black/10 flex items-center justify-between">
                <span className="text-xs font-bold text-white/60">Class Resources</span>
                <span className="text-[10px] bg-purple-500/10 border border-purple-500/20 px-2.5 py-0.5 rounded text-purple-400 font-bold uppercase tracking-wider animate-pulse">
                  Syncing Real-time
                </span>
              </div>
              
              <div className="divide-y divide-white/5">
                {[
                  { name: "ai-lecture-01-introduction.pdf", size: "2.4 MB", uploadedBy: "Prof. Sarah Jenkins", date: "July 18, 2026" },
                  { name: "deep-learning-syllabus.pdf", size: "1.1 MB", uploadedBy: "Dr. Marcus Vance", date: "July 15, 2026" },
                  { name: "neural-networks-basics.pptx", size: "5.8 MB", uploadedBy: "Prof. Sarah Jenkins", date: "July 11, 2026" },
                ].map((docItem, index) => (
                  <div key={index} className="p-4 md:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-white/[0.01] transition-all duration-300">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-purple-500/10 rounded-xl text-purple-400 border border-purple-500/15">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white hover:text-purple-300 cursor-pointer transition-colors">
                          {docItem.name}
                        </h4>
                        <p className="text-[10px] text-white/40 mt-1 flex flex-wrap gap-2 items-center">
                          <span>{docItem.size}</span>
                          <span>•</span>
                          <span>Shared by {docItem.uploadedBy}</span>
                          <span>•</span>
                          <span>{docItem.date}</span>
                        </p>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => alert(`Downloading ${docItem.name} from Firebase Storage...`)}
                      className="px-4 py-2 border border-white/10 hover:border-purple-500/30 hover:bg-purple-650/10 text-white/80 hover:text-purple-300 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 self-start sm:self-center"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "history" && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div className="flex items-center gap-2.5">
                <History className="h-5 w-5 text-purple-400" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-white">Session History</h3>
              </div>
              <button
                onClick={() => setActiveTab("dashboard")}
                className="inline-flex items-center gap-1 text-xs text-purple-400 font-bold hover:text-purple-300 cursor-pointer transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Dashboard
              </button>
            </div>

            <div className="space-y-4">
              {[
                {
                  title: "Introduction to Generative AI & LLMs",
                  date: "July 17, 2026",
                  duration: "45 mins",
                  summary: "This session detailed the transition of Class AI into a fully autonomous lecture assistant. Discussed how HLS.js connects player layers with Ngrok tunnel streaming, while Firebase handles real-time synchronization between teacher settings and student dashboards."
                },
                {
                  title: "Neural Network Architectures & Deep Learning",
                  date: "July 14, 2026",
                  duration: "52 mins",
                  summary: "Covered the foundational models of deep learning, backpropagation algorithms, and the integration of NVIDIA NIM speech synthesis API pathways for the virtual assistant avatar."
                }
              ].map((lecture, index) => (
                <div
                  key={index}
                  className="bg-[#0D0D11] border border-white/5 rounded-2xl p-5 md:p-6 space-y-4 hover:border-purple-500/15 hover:bg-[#111116] transition-all duration-300 shadow-md group relative"
                >
                  <div className="absolute inset-0 bg-radial-gradient from-purple-550/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-2xl" />

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-3 relative z-10">
                    <div className="space-y-1">
                      <span className="text-[8px] bg-purple-500/10 border border-purple-500/20 text-purple-400 font-black px-2 py-0.5 rounded uppercase tracking-wider">
                        Lecture {index + 1}
                      </span>
                      <h4 className="text-xs font-extrabold text-white leading-snug group-hover:text-purple-300 transition-colors">
                        {lecture.title}
                      </h4>
                    </div>
                    
                    <div className="flex items-center gap-3 text-[10px] text-white/40 font-bold bg-black/25 px-2.5 py-1 rounded-lg border border-white/5 flex-shrink-0 self-start sm:self-center">
                      <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {lecture.date}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {lecture.duration}</span>
                    </div>
                  </div>

                  <div className="space-y-1.5 relative z-10">
                    <span className="text-[9px] uppercase font-black text-purple-400/90 tracking-widest block">AI Catch-Up Summary</span>
                    <p className="text-[11px] text-white/50 leading-relaxed font-sans font-medium">
                      {lecture.summary}
                    </p>
                  </div>

                  <div className="flex gap-3 pt-1.5 relative z-10">
                    <button
                      onClick={() => alert(`Launching recorded video playback stream...`)}
                      className="px-4 py-2 bg-purple-650/10 hover:bg-purple-650/20 border border-purple-500/20 text-purple-300 hover:text-purple-200 text-[10px] font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
                    >
                      <Play className="h-3.5 w-3.5 fill-current" />
                      Watch Recording
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
