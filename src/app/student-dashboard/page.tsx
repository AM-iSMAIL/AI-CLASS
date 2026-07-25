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
import { joinSession, getStudentHistorySessions, Session } from "@/lib/session-service"

export default function StudentDashboardPage() {
  const [studentName, setStudentName] = useState("")
  const [sessionCode, setSessionCode] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<"dashboard" | "documents" | "history">("dashboard")
  const [historySessions, setHistorySessions] = useState<Session[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)

  useEffect(() => {
    if (typeof window !== "undefined") {
      const name = localStorage.getItem("studentName")
      const stId = localStorage.getItem("studentId") || undefined
      if (!name) {
        window.location.href = "/auth"
      } else {
        setTimeout(() => {
          setStudentName(name)
        }, 0)

        getStudentHistorySessions(stId, name)
          .then((sessions) => {
            setHistorySessions(sessions)
          })
          .catch((err) => console.error("Error fetching history:", err))
          .finally(() => setLoadingHistory(false))
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
      <div className="flex h-screen bg-[#F6F7F9] items-center justify-center text-[#111827]">
        <div className="h-8 w-8 rounded-full border-2 border-[#2563EB] border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F6F7F9] font-sans antialiased text-[#111827] flex flex-col relative overflow-hidden">

      {/* ─── Header ─── */}
      <header className="w-full border-b border-[rgba(15,23,42,.08)] bg-white sticky top-0 z-20 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Hamburger Trigger */}
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 rounded-xl bg-white border border-[#E5E7EB] hover:bg-[#F9FAFB] hover:-translate-y-0.5 text-[#374151] transition-all duration-350 ease-[cubic-bezier(.22,1,.36,1)] cursor-pointer active:scale-95 shadow-xs"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2.5 transition-all"
          >
            <div className="h-8 w-8 rounded-xl bg-[#EFF6FF] border border-[#BFDBFE] flex items-center justify-center shadow-xs">
              <Tv className="h-4 w-4 text-[#2563EB]" />
            </div>
            <span className="text-md font-bold tracking-tight text-[#111827]">
              Class<span className="text-[#2563EB]">AI</span>{" "}
              <span className="text-[9px] font-bold px-2.5 py-0.5 rounded-full bg-[#EFF6FF] border border-[#BFDBFE] text-[#2563EB] ml-1.5 uppercase tracking-wider font-mono">
                Student
              </span>
            </span>
          </Link>
        </div>

        {/* Profile Info */}
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#374151]">
            <span className="text-[#6B7280] font-normal">Welcome,</span>
            <span className="text-[#2563EB] font-bold">{studentName}</span>
          </div>

          <button
            onClick={handleSignOut}
            className="flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-xl border border-[#E5E7EB] bg-white text-xs font-semibold text-[#374151] hover:bg-[#FEF2F2] hover:text-[#DC2626] hover:border-[#FECACA] transition-all duration-350 ease-[cubic-bezier(.22,1,.36,1)] cursor-pointer active:scale-95 shadow-xs"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign Out
          </button>
        </div>
      </header>

      {/* ─── SLIDING DRAWER MENU (Hamburger) ─── */}
      <div
        className={`fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 transition-opacity duration-300 ${
          isSidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setIsSidebarOpen(false)}
      >
        <div
          className={`fixed top-0 left-0 bottom-0 w-[300px] bg-white border-r border-[rgba(15,23,42,.08)] p-6 space-y-6 transform transition-transform duration-300 ease-out z-55 flex flex-col justify-between shadow-xl ${
            isSidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-[#2563EB] font-mono">Navigation</span>
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="p-1.5 rounded-lg bg-[#F3F4F6] text-[#374151] hover:bg-[#E5E7EB] transition-colors cursor-pointer"
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
                className={`w-full text-left px-4 py-3 rounded-[16px] border transition-all duration-350 ease-[cubic-bezier(.22,1,.36,1)] flex items-center gap-3 font-semibold text-xs cursor-pointer ${
                  activeTab === "dashboard"
                    ? "border-[#BFDBFE] bg-[#EFF6FF] text-[#2563EB] font-bold shadow-xs"
                    : "border-[#E5E7EB] bg-white text-[#374151] hover:bg-[#F9FAFB]"
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
                className={`w-full text-left px-4 py-3 rounded-[16px] border transition-all duration-350 ease-[cubic-bezier(.22,1,.36,1)] flex items-center gap-3 font-semibold text-xs cursor-pointer ${
                  activeTab === "documents"
                    ? "border-[#BFDBFE] bg-[#EFF6FF] text-[#2563EB] font-bold shadow-xs"
                    : "border-[#E5E7EB] bg-white text-[#374151] hover:bg-[#F9FAFB]"
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
                className={`w-full text-left px-4 py-3 rounded-[16px] border transition-all duration-350 ease-[cubic-bezier(.22,1,.36,1)] flex items-center gap-3 font-semibold text-xs cursor-pointer ${
                  activeTab === "history"
                    ? "border-[#BFDBFE] bg-[#EFF6FF] text-[#2563EB] font-bold shadow-xs"
                    : "border-[#E5E7EB] bg-white text-[#374151] hover:bg-[#F9FAFB]"
                }`}
              >
                <History className="h-4.5 w-4.5" />
                Session History
              </button>
            </div>
          </div>

          <div className="border-t border-[#E5E7EB] pt-4">
            <button
              onClick={handleSignOut}
              className="w-full py-3 rounded-[16px] border border-[#FECACA] bg-[#FEF2F2] hover:bg-rose-100 text-[#DC2626] text-xs font-bold transition-all duration-350 ease-[cubic-bezier(.22,1,.36,1)] flex items-center justify-center gap-2 cursor-pointer"
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
              <div className="bg-white border border-[rgba(15,23,42,.08)] rounded-[24px] p-6 md:p-8 shadow-[0_1px_2px_rgba(15,23,42,.03),0_12px_32px_rgba(15,23,42,.05)] hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(15,23,42,.08)] transition-all duration-350 ease-[cubic-bezier(.22,1,.36,1)] space-y-6 relative overflow-hidden">
                
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-[#EFF6FF] border border-[#BFDBFE] flex items-center justify-center text-[#2563EB]">
                    <Tv className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-[#111827]">Join a Live Class</h2>
                    <p className="text-xs text-[#6B7280] mt-0.5">Enter the session code from your teacher</p>
                  </div>
                </div>

                <form onSubmit={handleJoinClass} className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-[#374151] uppercase tracking-widest block font-mono">Session Code</label>
                    <input
                      type="text"
                      required
                      maxLength={10}
                      disabled={isSubmitting}
                      placeholder="CLASS-XXXX"
                      value={sessionCode}
                      onChange={(e) => setSessionCode(e.target.value)}
                      className="w-full px-4 py-3.5 text-center font-mono text-xl font-bold tracking-widest uppercase bg-white border border-[#E5E7EB] rounded-[18px] text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:border-[#2563EB] focus:ring-0 focus:shadow-[0_0_0_3px_rgba(37,99,235,.08)] transition-all duration-350 ease-[cubic-bezier(.22,1,.36,1)] disabled:opacity-50"
                    />
                  </div>

                  {error && (
                    <div className="flex items-center gap-2.5 text-[#DC2626] bg-[#FEF2F2] border border-[#FECACA] px-4 py-3 rounded-[16px] text-xs animate-fadeIn font-medium">
                      <AlertCircle className="h-4 w-4 flex-shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  {success && (
                    <div className="flex items-center gap-2.5 text-[#16A34A] bg-[#ECFDF5] border border-[#A7F3D0] px-4 py-3 rounded-[16px] text-xs animate-fadeIn font-medium">
                      <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
                      <span>{success}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmitting || !sessionCode.trim()}
                    className="w-full py-3.5 bg-[#111827] hover:bg-[#1F2937] hover:-translate-y-0.5 text-white font-bold rounded-[16px] shadow-[0_12px_24px_rgba(17,24,39,.12)] transition-all duration-350 ease-[cubic-bezier(.22,1,.36,1)] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-xs uppercase tracking-wider group active:scale-[0.98]"
                  >
                    {isSubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="h-3.5 w-3.5 fill-current group-hover:translate-x-0.5 transition-transform duration-300" />
                    )}
                    {isSubmitting ? "Connecting..." : "Join Class"}
                  </button>
                </form>
              </div>
              
              {/* Live Indicator Widget */}
              <div className="p-4 bg-white border border-[rgba(15,23,42,.08)] rounded-[20px] shadow-[0_6px_20px_rgba(15,23,42,.05)] hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(15,23,42,.08)] transition-all duration-350 ease-[cubic-bezier(.22,1,.36,1)] flex items-center justify-between text-xs">
                <span className="text-[#6B7280] flex items-center gap-2 font-medium">
                  <span className="h-2 w-2 rounded-full bg-[#16A34A] animate-pulse" />
                  Real-time sync active
                </span>
                <span className="text-[#2563EB] font-bold uppercase text-[9px] tracking-wide font-mono flex items-center gap-1">
                  <Sparkles className="h-3 w-3 animate-pulse" /> Live DB
                </span>
              </div>
            </div>

            {/* ─── RIGHT COLUMN: PREVIOUS LECTURES HISTORY (lg:col-span-7) ─── */}
            <div className="lg:col-span-7 space-y-5">
              <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
                <div className="flex items-center gap-2">
                  <History className="h-4.5 w-4.5 text-[#2563EB]" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#374151] font-mono">Previous Lectures History</h3>
                </div>
                <span className="text-[10px] text-[#6B7280] font-semibold">{historySessions.length} Sessions logged</span>
              </div>

              <div className="space-y-4">
                {loadingHistory ? (
                  <div className="py-12 text-center text-xs text-[#6B7280] font-mono">
                    Loading session history...
                  </div>
                ) : historySessions.length === 0 ? (
                  <div className="bg-white border border-dashed border-[#E5E7EB] rounded-[24px] p-8 text-center space-y-2">
                    <History className="h-8 w-8 text-[#CBD5E1] mx-auto mb-2" />
                    <h4 className="text-xs font-bold text-[#111827]">No session history found</h4>
                    <p className="text-[11px] text-[#6B7280] max-w-sm mx-auto">
                      Enter a session code from your teacher above to join a live class and log your completed lectures!
                    </p>
                  </div>
                ) : (
                  historySessions.map((sess, index) => {
                    const formattedDate = sess.createdAt?.seconds 
                      ? new Date(sess.createdAt.seconds * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                      : "Recent Class"
                    const topicSummary = sess.topics && sess.topics.length > 0 
                      ? `Covered key topics including ${sess.topics.join(", ")}.`
                      : "Automated AI lecture session with live focus telemetry and interactive doubt resolution."

                    return (
                      <div
                        key={sess.code || index}
                        className="bg-white border border-[rgba(15,23,42,.08)] rounded-[24px] p-5 md:p-6 space-y-4 hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(15,23,42,.08)] transition-all duration-350 ease-[cubic-bezier(.22,1,.36,1)] shadow-[0_1px_2px_rgba(15,23,42,.03),0_12px_32px_rgba(15,23,42,.05)] group relative"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E5E7EB] pb-3 relative z-10">
                          <div className="space-y-1">
                            <span className="text-[9px] bg-[#EFF6FF] border border-[#BFDBFE] text-[#2563EB] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider font-mono">
                              {sess.code} • {sess.subject || "General"}
                            </span>
                            <h4 className="text-sm font-bold text-[#111827] leading-snug group-hover:text-[#2563EB] transition-colors">
                              {sess.title || (sess as any).name || `Session ${sess.code}`}
                            </h4>
                          </div>
                          
                          <div className="flex items-center gap-3 text-[10px] text-[#6B7280] font-bold bg-[#F9FAFB] px-3 py-1.5 rounded-xl border border-[#E5E7EB] flex-shrink-0 self-start sm:self-center font-mono">
                            <span className="flex items-center gap-1"><Calendar className="h-3 w-3 text-[#2563EB]" /> {formattedDate}</span>
                            <span>•</span>
                            <span className="flex items-center gap-1"><Clock className="h-3 w-3 text-[#2563EB]" /> {sess.duration || "60 mins"}</span>
                          </div>
                        </div>

                        <div className="space-y-1.5 relative z-10">
                          <span className="text-[9px] uppercase font-bold text-[#2563EB] tracking-wider font-mono block">AI Catch-Up Summary</span>
                          <p className="text-[11px] text-[#6B7280] leading-relaxed font-medium">
                            {topicSummary}
                          </p>
                        </div>

                        <div className="flex gap-3 pt-1.5 relative z-10">
                          <Link
                            href={`/session/${sess.code}/summary`}
                            className="px-4 py-2 bg-[#111827] hover:bg-[#1F2937] hover:-translate-y-0.5 text-white text-[10px] font-bold rounded-[16px] shadow-[0_12px_24px_rgba(17,24,39,.12)] transition-all duration-350 ease-[cubic-bezier(.22,1,.36,1)] cursor-pointer flex items-center gap-1.5 group active:scale-95"
                          >
                            <Play className="h-3.5 w-3.5 fill-current group-hover:translate-x-0.5 transition-transform duration-300" />
                            View Session Summary
                          </Link>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

          </div>
        )}

        {/* ─── TAB 2: COURSE DOCUMENTS ─── */}
        {activeTab === "documents" && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-4">
              <div className="flex items-center gap-2.5">
                <Cloud className="h-5 w-5 text-[#2563EB]" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-[#374151] font-mono">Course Documents</h3>
              </div>
              <button
                onClick={() => setActiveTab("dashboard")}
                className="inline-flex items-center gap-1 text-xs text-[#2563EB] font-bold hover:underline cursor-pointer transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Dashboard
              </button>
            </div>

            <div className="bg-white border border-[rgba(15,23,42,.08)] rounded-[24px] overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,.03),0_12px_32px_rgba(15,23,42,.05)]">
              <div className="p-5 border-b border-[#E5E7EB] bg-[#F9FAFB] flex items-center justify-between">
                <span className="text-xs font-bold text-[#374151]">Class Resources</span>
                <span className="text-[10px] bg-[#EFF6FF] border border-[#BFDBFE] px-2.5 py-0.5 rounded-full text-[#2563EB] font-bold uppercase tracking-wider font-mono animate-pulse">
                  Real-time Sync
                </span>
              </div>
              
              <div className="divide-y divide-[#E5E7EB]">
                {[
                  { name: "ai-lecture-01-introduction.pdf", size: "2.4 MB", uploadedBy: "Prof. Sarah Jenkins", date: "July 18, 2026" },
                  { name: "deep-learning-syllabus.pdf", size: "1.1 MB", uploadedBy: "Dr. Marcus Vance", date: "July 15, 2026" },
                  { name: "neural-networks-basics.pptx", size: "5.8 MB", uploadedBy: "Prof. Sarah Jenkins", date: "July 11, 2026" },
                ].map((docItem, index) => (
                  <div key={index} className="p-4 md:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#F8FAFC] transition-all duration-350 ease-[cubic-bezier(.22,1,.36,1)]">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-[#EFF6FF] rounded-2xl text-[#2563EB] border border-[#BFDBFE]">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-[#111827] hover:text-[#2563EB] cursor-pointer transition-colors">
                          {docItem.name}
                        </h4>
                        <p className="text-[10px] text-[#6B7280] mt-1 flex flex-wrap gap-2 items-center font-medium">
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
                      className="px-4 py-2 bg-[#111827] hover:bg-[#1F2937] hover:-translate-y-0.5 text-white text-xs font-bold rounded-[16px] shadow-[0_12px_24px_rgba(17,24,39,.12)] transition-all duration-350 ease-[cubic-bezier(.22,1,.36,1)] cursor-pointer flex items-center gap-1.5 self-start sm:self-center"
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
            <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-4">
              <div className="flex items-center gap-2.5">
                <History className="h-5 w-5 text-[#2563EB]" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-[#374151] font-mono">Session History</h3>
              </div>
              <button
                onClick={() => setActiveTab("dashboard")}
                className="inline-flex items-center gap-1 text-xs text-[#2563EB] font-bold hover:underline cursor-pointer transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Dashboard
              </button>
            </div>

            <div className="space-y-4">
              {loadingHistory ? (
                <div className="py-12 text-center text-xs text-[#6B7280] font-mono">
                  Loading session history...
                </div>
              ) : historySessions.length === 0 ? (
                <div className="bg-white border border-dashed border-[#E5E7EB] rounded-[24px] p-8 text-center space-y-2">
                  <History className="h-8 w-8 text-[#CBD5E1] mx-auto mb-2" />
                  <h4 className="text-xs font-bold text-[#111827]">No session history found</h4>
                  <p className="text-[11px] text-[#6B7280] max-w-sm mx-auto">
                    Enter a session code from your teacher on the dashboard tab to join a live class and log your completed lectures!
                  </p>
                </div>
              ) : (
                historySessions.map((sess, index) => {
                  const formattedDate = sess.createdAt?.seconds 
                    ? new Date(sess.createdAt.seconds * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                    : "Recent Class"
                  const topicSummary = sess.topics && sess.topics.length > 0 
                    ? `Covered key topics including ${sess.topics.join(", ")}.`
                    : "Automated AI lecture session with live focus telemetry and interactive doubt resolution."

                  return (
                    <div
                      key={sess.code || index}
                      className="bg-white border border-[rgba(15,23,42,.08)] rounded-[24px] p-5 md:p-6 space-y-4 hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(15,23,42,.08)] transition-all duration-350 ease-[cubic-bezier(.22,1,.36,1)] shadow-[0_1px_2px_rgba(15,23,42,.03),0_12px_32px_rgba(15,23,42,.05)] group relative"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E5E7EB] pb-3 relative z-10">
                        <div className="space-y-1">
                          <span className="text-[9px] bg-[#EFF6FF] border border-[#BFDBFE] text-[#2563EB] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider font-mono">
                            {sess.code} • {sess.subject || "General"}
                          </span>
                          <h4 className="text-sm font-bold text-[#111827] leading-snug group-hover:text-[#2563EB] transition-colors">
                            {sess.title || (sess as any).name || `Session ${sess.code}`}
                          </h4>
                        </div>
                        
                        <div className="flex items-center gap-3 text-[10px] text-[#6B7280] font-bold bg-[#F9FAFB] px-3 py-1.5 rounded-xl border border-[#E5E7EB] flex-shrink-0 self-start sm:self-center font-mono">
                          <span className="flex items-center gap-1"><Calendar className="h-3 w-3 text-[#2563EB]" /> {formattedDate}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3 text-[#2563EB]" /> {sess.duration || "60 mins"}</span>
                        </div>
                      </div>

                      <div className="space-y-1.5 relative z-10">
                        <span className="text-[9px] uppercase font-bold text-[#2563EB] tracking-wider font-mono block">AI Catch-Up Summary</span>
                        <p className="text-[11px] text-[#6B7280] leading-relaxed font-medium">
                          {topicSummary}
                        </p>
                      </div>

                      <div className="flex gap-3 pt-1.5 relative z-10">
                        <Link
                          href={`/session/${sess.code}/summary`}
                          className="px-4 py-2 bg-[#111827] hover:bg-[#1F2937] hover:-translate-y-0.5 text-white text-[10px] font-bold rounded-[16px] shadow-[0_12px_24px_rgba(17,24,39,.12)] transition-all duration-350 ease-[cubic-bezier(.22,1,.36,1)] cursor-pointer flex items-center gap-1.5 group active:scale-95"
                        >
                          <Play className="h-3.5 w-3.5 fill-current group-hover:translate-x-0.5 transition-transform duration-300" />
                          View Session Summary
                        </Link>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
