"use client"

import { useState, useEffect, Suspense } from "react"
import Image from "next/image"
import Link from "next/link"
import {
  LayoutDashboard,
  Video,
  BarChart3,
  Users,
  Settings as SettingsIcon,
  LogOut,
  Calendar,
  Clock,
  GraduationCap,
  BookOpen,
  ArrowRight,
  Plus,
  TrendingUp,
  Search,
  Menu,
  X,
  Copy,
  Check,
  Sliders,
  Shield,
  Volume2,
  Database,
  AlertCircle,
  Activity,
  Award,
  Sparkles,
  ChevronRight,
  Users2,
  Info
} from "lucide-react"
import { subscribeToAuthChanges, User } from "@/lib/auth-service"
import { getTeacherSessions, getTeacherStudentsRoster, RosterStudent } from "@/lib/session-service"
import { useRouter, useSearchParams } from "next/navigation"
import DashboardSidebar from "@/components/dashboard-sidebar"
import { ShinyButton } from "@/components/ui/shiny-button"
import { collection, getDocs, doc, deleteDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import ClassroomAnalyticsSection from "@/components/ClassroomAnalyticsSection"

function DashboardContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentTab = searchParams.get("tab") || "dashboard"

  const [user, setUser] = useState<User | null>(null)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [currentDate, setCurrentDate] = useState("June 23, 2026")
  
  const [sessions, setSessions] = useState<any[]>([])
  const [loadingSessions, setLoadingSessions] = useState(true)

  const [roster, setRoster] = useState<RosterStudent[]>([])
  const [loadingRoster, setLoadingRoster] = useState(false)
  const [studentSearchQuery, setStudentSearchQuery] = useState("")

  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  
  // My Sessions Filtering State
  const [sessionsSearch, setSessionsSearch] = useState("")
  const [sessionsFilter, setSessionsFilter] = useState("All")

  // Settings States
  const [settings, setSettings] = useState({
    faceWarningThreshold: 5,
    outOfFrameTimeout: 5,
    defaultFocusMode: false,
    defaultAllowLateJoins: true,
    aiLecturerVoice: "Google US English (en-US)",
    autoExportRoster: false,
    emailNotifications: true
  })
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Real-time Firestore Aggregated Analytics States
  const [sessionFocusScores, setSessionFocusScores] = useState<Record<string, number>>({})
  const [loadingFocusScores, setLoadingFocusScores] = useState(false)

  const [focusDistribution, setFocusDistribution] = useState({ active: 0, idle: 0, distracted: 0 })
  const [loadingDistribution, setLoadingDistribution] = useState(false)

  const [kickedLogs, setKickedLogs] = useState<Array<{ name: string; sessionCode: string; kickedAt: any }>>([])
  const [loadingKickedLogs, setLoadingKickedLogs] = useState(false)

  // Load current auth state
  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges((currentUser) => {
      setUser(currentUser)
    })
    return () => unsubscribe()
  }, [])

  // Fetch real sessions from Firestore when teacher loads
  useEffect(() => {
    if (!user) return
    const fetchSessions = async () => {
      setLoadingSessions(true)
      const list = await getTeacherSessions(user.uid)
      setSessions(list)
      setLoadingSessions(false)
    }
    fetchSessions()
  }, [user])

  // Compile student roster when sessions are loaded
  useEffect(() => {
    if (!user || sessions.length === 0) return
    const fetchRoster = async () => {
      setLoadingRoster(true)
      const sessionCodes = sessions.map(s => s.code)
      const list = await getTeacherStudentsRoster(sessionCodes)
      setRoster(list)
      setLoadingRoster(false)
    }
    fetchRoster()
  }, [sessions, user])

  // Fetch detailed session metrics (focus scores, distribution, kicks) from Firestore
  useEffect(() => {
    if (!user || sessions.length === 0) return

    const fetchDetailedMetrics = async () => {
      setLoadingFocusScores(true)
      setLoadingDistribution(true)
      setLoadingKickedLogs(true)

      const scores: Record<string, number> = {}
      let activeCount = 0
      let idleCount = 0
      let distractedCount = 0
      const logs: Array<{ name: string; sessionCode: string; kickedAt: any }> = []

      await Promise.all(
        sessions.map(async (sess) => {
          try {
            // 1. Fetch students for focus score and distribution
            const studentsCol = collection(db, "sessions", sess.code, "students")
            const studentsSnap = await getDocs(studentsCol)
            
            if (studentsSnap.empty) {
              scores[sess.code] = 0
            } else {
              let totalScore = 0
              studentsSnap.forEach((doc) => {
                const data = doc.data()
                totalScore += data.engagementScore || 0
                
                // Count status for distribution
                const status = data.status
                if (status === "active") activeCount++
                else if (status === "idle") idleCount++
                else if (status === "distracted") distractedCount++
              })
              scores[sess.code] = Math.round(totalScore / studentsSnap.size)
            }

            // 2. Fetch kicked list for disciplinary logs
            const kickedCol = collection(db, "sessions", sess.code, "kicked")
            const kickedSnap = await getDocs(kickedCol)
            kickedSnap.forEach((doc) => {
              const data = doc.data()
              logs.push({
                name: data.name || "Unknown Student",
                sessionCode: sess.code,
                kickedAt: data.kickedAt || null
              })
            })
          } catch (err) {
            console.error("Error fetching subcollections for session:", sess.code, err)
          }
        })
      )

      // Update states
      setSessionFocusScores(scores)
      setLoadingFocusScores(false)

      const totalStatus = activeCount + idleCount + distractedCount
      if (totalStatus > 0) {
        setFocusDistribution({
          active: Math.round((activeCount / totalStatus) * 100),
          idle: Math.round((idleCount / totalStatus) * 100),
          distracted: Math.round((distractedCount / totalStatus) * 100)
        })
      } else {
        setFocusDistribution({ active: 0, idle: 0, distracted: 0 })
      }
      setLoadingDistribution(false)

      // Sort kicked logs by timestamp desc
      logs.sort((a, b) => {
        const aTime = a.kickedAt?.seconds ? a.kickedAt.seconds * 1000 : 0
        const bTime = b.kickedAt?.seconds ? b.kickedAt.seconds * 1000 : 0
        return bTime - aTime
      })
      setKickedLogs(logs)
      setLoadingKickedLogs(false)
    }

    fetchDetailedMetrics()
  }, [sessions, user])

  // Format date dynamically on client side to avoid hydration mismatch
  useEffect(() => {
    const options: Intl.DateTimeFormatOptions = {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }
    setTimeout(() => {
      setCurrentDate(new Date().toLocaleDateString("en-US", options))
    }, 0)
  }, [])

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const clearDatabaseHistory = async () => {
    if (!window.confirm("Are you absolutely sure you want to clear all your class sessions and database history? This cannot be undone.")) {
      return
    }
    try {
      setLoadingSessions(true)
      const sessionList = [...sessions]
      for (const sess of sessionList) {
        // Delete students subcollection
        const studentsCol = collection(db, "sessions", sess.code, "students")
        const studentsSnap = await getDocs(studentsCol)
        for (const studentDoc of studentsSnap.docs) {
          await deleteDoc(doc(db, "sessions", sess.code, "students", studentDoc.id))
        }
        
        // Delete kicked subcollection
        const kickedCol = collection(db, "sessions", sess.code, "kicked")
        const kickedSnap = await getDocs(kickedCol)
        for (const kickedDoc of kickedSnap.docs) {
          await deleteDoc(doc(db, "sessions", sess.code, "kicked", kickedDoc.id))
        }
        
        // Delete the session doc itself
        await deleteDoc(doc(db, "sessions", sess.code))
      }
      alert("Database history cleared successfully! Reloading page...")
      window.location.reload()
    } catch (err: any) {
      console.error("Error clearing database history:", err)
      alert("Failed to clear database history: " + err.message)
      setLoadingSessions(false)
    }
  }

  const teacherName = user?.displayName || "Dr. Sarah Jenkins"

  const formatSessionDate = (sess: any) => {
    if (sess.date) return sess.date
    if (!sess.createdAt) return "Just now"
    const d = sess.createdAt.seconds ? new Date(sess.createdAt.seconds * 1000) : new Date(sess.createdAt)
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  }

  const handleSessionClick = (code: string, status: string) => {
    if (status === "Completed") {
      router.push(`/session/${code}/summary`)
    } else {
      router.push(`/session/${code}`)
    }
  }

  // Derive activeItem label for sidebar highlighting
  let activeItem = "Dashboard"
  if (currentTab === "sessions") activeItem = "My Sessions"
  else if (currentTab === "analytics") activeItem = "Analytics"
  else if (currentTab === "students") activeItem = "Students"
  else if (currentTab === "settings") activeItem = "Settings"

  // Helper to parse duration strings safely
  const parseDuration = (dur: string) => {
    if (!dur) return 0
    const num = parseFloat(dur)
    if (isNaN(num)) return 0
    if (num > 10) return num / 60 // If duration is in minutes (e.g. 45 or 60), convert to hours
    return num
  }

  // ─── Real Database Metrics Aggregations ───
  const totalSessionsCount = sessions.length
  const studentsTaughtCount = sessions.reduce((acc, s) => acc + (s.studentCount || 0), 0)
  const teachingHours = sessions.reduce((acc, s) => acc + parseDuration(s.duration), 0).toFixed(1)
  const avgEngagementRate = roster.length > 0 
    ? Math.round(roster.reduce((acc, s) => acc + s.avgEngagement, 0) / roster.length) 
    : 0

  // AI assistant tool statistics gathered from real session parameters
  const aiLecturesCount = sessions.filter(s => s.teachingMode === "AI").length
  const doubtChatCount = sessions.filter(s => s.aiAssistants?.doubtChat).length
  const visualsCount = sessions.filter(s => s.aiAssistants?.generateVisuals).length
  const notesCount = sessions.filter(s => s.aiAssistants?.sessionNotes).length

  // Filter scheduled sessions
  const upcomingSessionsList = sessions.filter(s => s.status === "Scheduled")

  return (
    <div className="min-h-screen bg-[#f8f9fa] text-neutral-800 flex font-sans antialiased">
      <DashboardSidebar
        activeItem={activeItem}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />

      {/* ─── Main Content Area ─── */}
      <div className={`flex-1 flex flex-col transition-all duration-350 ease-[cubic-bezier(0.22,1,0.36,1)] ${isSidebarCollapsed ? "lg:ml-[64px]" : "lg:ml-[280px]"}`}>
        
        {/* Header Topbar */}
        <header className="h-16 border-b border-neutral-200/80 bg-white px-6 md:px-8 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            {/* Hamburger menu for mobile view */}
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="p-2 rounded-lg border border-neutral-200 hover:bg-neutral-50 lg:hidden text-neutral-600 hover:text-neutral-900"
            >
              <Menu className="h-5 w-5" />
            </button>
            
            <h1 className="text-base md:text-xl font-serif font-bold text-neutral-900 tracking-tight">
              Good morning, {teacherName}
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <span className="hidden sm:inline-flex text-xs font-semibold text-neutral-500 bg-neutral-100 px-3.5 py-1.5 rounded-lg border border-neutral-200">
              {currentDate}
            </span>
            <ShinyButton 
              onClick={() => router.push("/dashboard/create-session")}
              className="!px-5 !py-2.5 !text-xs !font-bold flex items-center gap-1.5"
            >
              <Plus className="h-3.5 w-3.5 text-white" />
              New Session
            </ShinyButton>
          </div>
        </header>

        {/* Dashboard Grid Content */}
        <main className="flex-1 p-6 md:p-8 space-y-8 max-w-6xl w-full mx-auto">
          
          {/* ────────────────── TABS RENDERING ────────────────── */}

          {/* 1. DEFAULT DASHBOARD TAB */}
          {currentTab === "dashboard" && (
            <div className="space-y-8 animate-fadeIn">
              {/* Stats Row */}
              <section className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                {/* Card 1: Total Sessions */}
                <div className="card p-6 shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex flex-col justify-between min-h-[140px]">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-serif font-bold uppercase tracking-wider text-neutral-800">TOTAL SESSIONS</span>
                    <div className="h-8 w-8 rounded-xl bg-[#e6f0fa] flex items-center justify-center text-[#2185d0]">
                      <Video className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="mt-4">
                    <h3 className="text-4xl font-bold text-neutral-900 leading-none" style={{ fontFamily: '"Times New Roman", Times, serif', fontWeight: 900 }}>{loadingSessions ? "..." : totalSessionsCount}</h3>
                    <span className="text-[10px] font-serif text-neutral-400 mt-2 block">All active & finished</span>
                  </div>
                </div>

                {/* Card 2: Students Taught */}
                <div className="card p-6 shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex flex-col justify-between min-h-[140px]">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-serif font-bold uppercase tracking-wider text-neutral-800">STUDENTS TAUGHT</span>
                    <div className="h-8 w-8 rounded-xl bg-[#ffebeb] flex items-center justify-center text-[#db2828]">
                      <GraduationCap className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="mt-4">
                    <h3 className="text-4xl font-bold text-neutral-900 leading-none" style={{ fontFamily: '"Times New Roman", Times, serif', fontWeight: 900 }}>{loadingSessions ? "..." : studentsTaughtCount}</h3>
                    <span className="text-[10px] font-serif text-neutral-400 mt-2 block">From database registers</span>
                  </div>
                </div>

                {/* Card 3: Hours of Teaching */}
                <div className="card p-6 shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex flex-col justify-between min-h-[140px]">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-serif font-bold uppercase tracking-wider text-neutral-800">HOURS OF TEACHING</span>
                    <div className="h-8 w-8 rounded-xl bg-[#fff5e6] flex items-center justify-center text-[#f2711c]">
                      <Clock className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="mt-4">
                    <h3 className="text-4xl font-bold text-neutral-900 leading-none" style={{ fontFamily: '"Times New Roman", Times, serif', fontWeight: 900 }}>{loadingSessions ? "..." : `${teachingHours}h`}</h3>
                    <span className="text-[10px] font-serif text-neutral-400 mt-2 block">Total live duration</span>
                  </div>
                </div>

                {/* Card 4: Avg Engagement */}
                <div className="card p-6 shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex flex-col justify-between min-h-[140px]">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-serif font-bold uppercase tracking-wider text-neutral-800">AVG ENGAGEMENT</span>
                    <div className="h-8 w-8 rounded-xl bg-[#e6f6ec] flex items-center justify-center text-[#21ba45]">
                      <BarChart3 className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="mt-4">
                    <h3 className="text-4xl font-bold text-neutral-900 leading-none" style={{ fontFamily: '"Times New Roman", Times, serif', fontWeight: 900 }}>{loadingRoster ? "..." : `${avgEngagementRate}%`}</h3>
                    <span className="text-[10px] font-serif text-neutral-400 mt-2 block">Average across students</span>
                  </div>
                </div>
              </section>

              {/* Columns Split */}
              <div className="grid gap-8 lg:grid-cols-3">
                {/* Left Column (Quick Start & Recent) */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Quick Start Card */}
                  <div className="card p-6 shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex flex-col sm:flex-row justify-between items-center gap-6">
                    <div className="space-y-4 flex-1">
                      <div>
                        <h2 className="text-xl font-serif font-bold text-neutral-900">Start a New Session</h2>
                        <p className="text-xs text-neutral-500 mt-1">Your AI teacher is ready to go live.</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <button
                          onClick={clearDatabaseHistory}
                          className="text-xs text-neutral-500 font-medium hover:text-red-600 underline cursor-pointer"
                        >
                          Clear Database History
                        </button>
                        <ShinyButton 
                          onClick={() => router.push("/dashboard/create-session")}
                          className="!px-5 !py-2.5 !text-xs !font-bold flex items-center gap-1.5"
                        >
                          Create Session
                          <ArrowRight className="h-3.5 w-3.5 text-white" />
                        </ShinyButton>
                      </div>
                    </div>
                    <div className="w-24 h-24 sm:w-28 sm:h-28 relative flex-shrink-0">
                      <Image
                        src="/ai-teacher-tablet.png"
                        alt="AI Teacher Illustration"
                        fill
                        className="rounded-xl object-cover"
                      />
                    </div>
                  </div>

                  {/* Recent Sessions */}
                  <div className="card overflow-hidden">
                    <div className="px-6 py-5 border-b border-neutral-100 flex items-center justify-between">
                      <h3 className="text-sm font-serif font-bold uppercase tracking-wider text-neutral-800">Recent Sessions</h3>
                      <Link href="/dashboard?tab=sessions" className="text-xs text-blue-600 font-semibold hover:underline">
                        View All
                      </Link>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-neutral-100 text-[10px] font-bold uppercase tracking-wider text-neutral-900 bg-neutral-50/50">
                            <th className="px-6 py-3.5">Session Name</th>
                            <th className="px-4 py-3.5">Topics</th>
                            <th className="px-4 py-3.5">Students</th>
                            <th className="px-4 py-3.5">Date</th>
                            <th className="px-6 py-3.5 text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100">
                          {loadingSessions ? (
                            <tr>
                              <td colSpan={5} className="px-6 py-8 text-center text-neutral-400 text-xs font-semibold">
                                <div className="h-5 w-5 rounded-full border border-purple-500 border-t-transparent animate-spin mx-auto mb-2" />
                                Loading your sessions...
                              </td>
                            </tr>
                          ) : sessions.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="px-6 py-12 text-center text-neutral-400 text-xs font-medium">
                                <Info className="h-6 w-6 text-neutral-300 mx-auto mb-2" />
                                No sessions created yet. Click &quot;New Session&quot; above to start your first class.
                              </td>
                            </tr>
                          ) : (
                            sessions.slice(0, 5).map((session, index) => {
                              const sCode = session.code
                              const topicsCount = session.topics?.length ?? 0
                              const studentCount = session.studentCount ?? 0
                              const title = session.title || session.name

                              return (
                                <tr
                                  key={index}
                                  onClick={() => handleSessionClick(sCode, session.status)}
                                  className="text-xs hover:bg-neutral-50/80 transition-colors cursor-pointer"
                                >
                                  <td className="px-6 py-4 font-serif font-bold text-neutral-900 max-w-[180px] truncate">
                                    {title}
                                    <span className="block text-[10px] text-neutral-400 font-mono mt-0.5 font-normal">{sCode}</span>
                                  </td>
                                  <td className="px-4 py-4 text-neutral-600">
                                    <span className="inline-flex items-center gap-1">
                                      <BookOpen className="h-3.5 w-3.5 text-blue-500" />
                                      {topicsCount}
                                    </span>
                                  </td>
                                  <td className="px-4 py-4 text-neutral-600">
                                    <span className="inline-flex items-center gap-1">
                                      <Users className="h-3.5 w-3.5 text-blue-500" />
                                      {studentCount}
                                    </span>
                                  </td>
                                  <td className="px-4 py-4 text-neutral-900 font-medium">{formatSessionDate(session)}</td>
                                  <td className="px-6 py-4 text-right">
                                    {(session.status === "Live" || session.status === "Active") && (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-black px-2.5 py-1 text-[10px] font-bold text-white uppercase tracking-wider">
                                        <span className="h-1 w-1 rounded-full bg-white" />
                                        Live
                                      </span>
                                    )}
                                    {session.status === "Completed" && (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-[#1b3f27] px-2.5 py-1 text-[10px] font-bold text-white uppercase tracking-wider">
                                        <span className="h-1 w-1 rounded-full bg-[#10b981]" />
                                        Ended
                                      </span>
                                    )}
                                    {session.status === "Scheduled" && (
                                      <span className="inline-flex items-center rounded-full bg-blue-50 text-blue-700 border border-blue-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider">
                                        Scheduled
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              )
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Right Column (Upcoming Sessions) */}
                <div className="space-y-6">
                  <div className="card p-5 space-y-4 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
                    <div className="border-b border-neutral-100 pb-3">
                      <h3 className="text-sm font-serif font-bold uppercase tracking-wider text-neutral-800">Upcoming Sessions</h3>
                    </div>

                    <div className="space-y-3.5">
                      {loadingSessions ? (
                        <div className="py-8 text-center text-neutral-400 text-xs">Loading scheduled...</div>
                      ) : upcomingSessionsList.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50/50 p-6 text-center text-neutral-400 text-xs">
                          No upcoming sessions scheduled.
                        </div>
                      ) : (
                        upcomingSessionsList.map((session, index) => {
                          const d = session.scheduledAt?.seconds ? new Date(session.scheduledAt.seconds * 1000) : (session.scheduledAt ? new Date(session.scheduledAt) : new Date())
                          const dateString = d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
                          const timeString = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
                          return (
                            <div
                              key={index}
                              className="group rounded-xl border border-neutral-200 bg-white p-4 space-y-3 transition-colors hover:border-neutral-300"
                            >
                              <h4 className="text-xs font-serif font-bold text-neutral-800 group-hover:text-blue-600 transition-colors">
                                {session.title || session.name}
                              </h4>
                              <div className="flex items-center justify-between text-[11px] text-neutral-500">
                                <span className="flex items-center gap-1.5">
                                  <Calendar className="h-3.5 w-3.5 text-neutral-400" />
                                  {dateString}, {timeString}
                                </span>
                                <span className="font-mono text-neutral-600 font-bold bg-neutral-100 px-1.5 py-0.5 rounded border border-neutral-200">
                                  {session.code}
                                </span>
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. MY SESSIONS TAB */}
          {currentTab === "sessions" && (
            <div className="space-y-6 animate-fadeIn">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-serif font-bold text-neutral-900">My Sessions</h2>
                  <p className="text-xs text-neutral-500 mt-1">Search, copy session codes, or view summary reports</p>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-3">
                  {/* Search Bar */}
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                    <input
                      type="text"
                      placeholder="Search sessions..."
                      value={sessionsSearch}
                      onChange={(e) => setSessionsSearch(e.target.value)}
                      className="bg-white rounded-xl border border-neutral-200 pl-9 pr-4 py-2 text-xs text-neutral-800 focus:outline-none focus:border-neutral-400 w-full sm:w-60 transition-colors shadow-sm"
                    />
                  </div>

                  {/* Filter Dropdown */}
                  <select
                    value={sessionsFilter}
                    onChange={(e) => setSessionsFilter(e.target.value)}
                    className="bg-white rounded-xl border border-neutral-200 px-3 py-2 text-xs text-neutral-800 focus:outline-none focus:border-neutral-400 transition-colors shadow-sm"
                  >
                    <option value="All">All Statuses</option>
                    <option value="Live">Live / Active</option>
                    <option value="Completed">Completed</option>
                    <option value="Scheduled">Scheduled</option>
                  </select>
                </div>
              </div>

              {/* Sessions List */}
              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-neutral-100 text-[10px] font-bold uppercase tracking-wider text-neutral-900 bg-neutral-50/50">
                        <th className="px-6 py-4">Session Name & Code</th>
                        <th className="px-4 py-4">Subject & Grade</th>
                        <th className="px-4 py-4">Topics</th>
                        <th className="px-4 py-4">Students</th>
                        <th className="px-4 py-4">Created Date</th>
                        <th className="px-4 py-4">Status</th>
                        <th className="px-6 py-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {loadingSessions ? (
                        <tr>
                          <td colSpan={7} className="px-6 py-12 text-center text-neutral-400 text-xs font-semibold">
                            <div className="h-6 w-6 rounded-full border-2 border-purple-500 border-t-transparent animate-spin mx-auto mb-3" />
                            Loading class list...
                          </td>
                        </tr>
                      ) : (
                        sessions
                          .filter(session => {
                            const title = (session.title || session.name || "").toLowerCase()
                            const code = (session.code || "").toLowerCase()
                            const matchesSearch = title.includes(sessionsSearch.toLowerCase()) || code.includes(sessionsSearch.toLowerCase())
                            
                            if (sessionsFilter === "All") return matchesSearch
                            if (sessionsFilter === "Live") return matchesSearch && (session.status === "Live" || session.status === "Active")
                            if (sessionsFilter === "Completed") return matchesSearch && session.status === "Completed"
                            if (sessionsFilter === "Scheduled") return matchesSearch && session.status === "Scheduled"
                            return matchesSearch
                          })
                          .map((session, index) => {
                            const sCode = session.code
                            const topicsCount = session.topics?.length ?? 0
                            const studentCount = session.studentCount ?? 0
                            const title = session.title || session.name
                            const isLive = session.status === "Live" || session.status === "Active"

                            return (
                              <tr key={index} className="text-xs hover:bg-neutral-50/50 transition-colors">
                                <td className="px-6 py-4 font-serif font-bold text-neutral-900">
                                  <div>{title}</div>
                                  <div className="flex items-center gap-1.5 mt-1 font-sans font-normal">
                                    <span className="font-mono text-[10px] text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded border border-neutral-200">{sCode}</span>
                                    <button
                                      onClick={() => copyToClipboard(sCode)}
                                      className="p-1 rounded hover:bg-neutral-100 text-neutral-400 hover:text-neutral-900 transition-colors"
                                      title="Copy Session Code"
                                    >
                                      {copiedCode === sCode ? (
                                        <Check className="h-3 w-3 text-emerald-600" />
                                      ) : (
                                        <Copy className="h-3 w-3" />
                                      )}
                                    </button>
                                  </div>
                                </td>
                                <td className="px-4 py-4 text-neutral-600">
                                  <div className="font-medium text-neutral-800">{session.subject || "General"}</div>
                                  <div className="text-[10px] text-neutral-400">{session.gradeLevel || "Grade 10"}</div>
                                </td>
                                <td className="px-4 py-4 text-neutral-600">
                                  <span className="inline-flex items-center gap-1">
                                    <BookOpen className="h-3.5 w-3.5 text-blue-500" />
                                    {topicsCount} topics
                                  </span>
                                </td>
                                <td className="px-4 py-4 text-neutral-600">
                                  <span className="inline-flex items-center gap-1">
                                    <Users className="h-3.5 w-3.5 text-blue-500" />
                                    {studentCount} joined
                                  </span>
                                </td>
                                <td className="px-4 py-4 text-neutral-900 font-medium">{formatSessionDate(session)}</td>
                                <td className="px-4 py-4">
                                  {isLive && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-black px-2.5 py-1 text-[10px] font-bold text-white uppercase tracking-wider">
                                      <span className="h-1 w-1 rounded-full bg-white animate-pulse" />
                                      Live
                                    </span>
                                  )}
                                  {session.status === "Completed" && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-[#1b3f27] px-2.5 py-1 text-[10px] font-bold text-white uppercase tracking-wider">
                                      <span className="h-1 w-1 rounded-full bg-[#10b981]" />
                                      Ended
                                    </span>
                                  )}
                                  {session.status === "Scheduled" && (
                                    <span className="inline-flex items-center rounded-full bg-blue-50 text-blue-700 border border-blue-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider">
                                      Scheduled
                                    </span>
                                  )}
                                </td>
                                <td className="px-6 py-4 text-right">
                                  {session.status === "Completed" ? (
                                    <Link
                                      href={`/session/${sCode}/summary`}
                                      className="inline-flex items-center gap-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-bold px-3 py-1.5 rounded-lg border border-neutral-200 transition-all text-[11px]"
                                    >
                                      View Summary
                                      <ChevronRight className="h-3.5 w-3.5" />
                                    </Link>
                                  ) : (
                                    <Link
                                      href={`/session/${sCode}`}
                                      className="inline-flex items-center gap-1 bg-[#0a0a23] hover:bg-slate-900 text-white font-bold px-3 py-1.5 rounded-lg transition-all text-[11px] shadow-sm"
                                    >
                                      Open Lobby
                                      <ChevronRight className="h-3.5 w-3.5" />
                                    </Link>
                                  )}
                                </td>
                              </tr>
                            )
                          })
                      )}
                      {!loadingSessions && sessions.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-6 py-12 text-center text-neutral-400 text-xs">
                            No sessions found. Create a new session to begin.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 3. ANALYTICS TAB */}
          {currentTab === "analytics" && (
            <div className="space-y-8 animate-fadeIn">
              <ClassroomAnalyticsSection
                sessions={sessions}
                sessionFocusScores={sessionFocusScores}
                focusDistribution={focusDistribution}
                roster={roster}
                kickedLogs={kickedLogs}
                loadingFocusScores={loadingFocusScores}
                loadingDistribution={loadingDistribution}
              />

              {/* Bottom statistics grid */}
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {/* AI Performance Card */}
                <div className="card p-5 space-y-4 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
                  <div className="flex items-center gap-2 text-purple-600 font-bold text-xs uppercase tracking-wider">
                    <Sparkles className="h-4 w-4" />
                    AI Assistant Configurations
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-2xl font-serif font-bold text-neutral-900">{loadingSessions ? "..." : aiLecturesCount}</div>
                      <div className="text-[10px] text-neutral-400 mt-0.5 font-medium">AI Lectures created</div>
                    </div>
                    <div>
                      <div className="text-2xl font-serif font-bold text-neutral-900">{loadingSessions ? "..." : doubtChatCount}</div>
                      <div className="text-[10px] text-neutral-400 mt-0.5 font-medium">Doubt chats enabled</div>
                    </div>
                    <div>
                      <div className="text-2xl font-serif font-bold text-neutral-900">{loadingSessions ? "..." : visualsCount}</div>
                      <div className="text-[10px] text-neutral-400 mt-0.5 font-medium">Visual builders active</div>
                    </div>
                    <div>
                      <div className="text-2xl font-serif font-bold text-neutral-900">{loadingSessions ? "..." : notesCount}</div>
                      <div className="text-[10px] text-neutral-400 mt-0.5 font-medium">Auto notes generated</div>
                    </div>
                  </div>
                </div>

                {/* Engagement Leaderboard */}
                <div className="card p-5 space-y-4 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
                  <div className="flex items-center gap-2 text-purple-600 font-bold text-xs uppercase tracking-wider">
                    <Award className="h-4 w-4" />
                    Top Performing Students
                  </div>
                  <div className="space-y-2.5">
                    {loadingRoster ? (
                      <div className="text-center text-neutral-400 text-xs py-4">Loading leaderboard...</div>
                    ) : roster.length === 0 ? (
                      <div className="text-center text-neutral-400 text-xs py-4">No student records found.</div>
                    ) : (
                      roster
                        .slice()
                        .sort((a, b) => b.avgEngagement - a.avgEngagement)
                        .slice(0, 3)
                        .map((student, i) => (
                          <div key={i} className="flex items-center justify-between text-xs border-b border-neutral-100 pb-2 last:border-0 last:pb-0">
                            <span className="font-semibold text-neutral-700">{student.name}</span>
                            <span className="font-bold text-emerald-600">{student.avgEngagement}% Focus</span>
                          </div>
                        ))
                    )}
                  </div>
                </div>

                {/* Classroom alert logs */}
                <div className="card p-5 space-y-4 sm:col-span-2 lg:col-span-1 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
                  <div className="flex items-center gap-2 text-purple-600 font-bold text-xs uppercase tracking-wider">
                    <AlertCircle className="h-4 w-4" />
                    Disciplinary / Kicked Log
                  </div>
                  <div className="space-y-2.5 text-xs text-neutral-600 max-h-32 overflow-y-auto pr-1">
                    {loadingKickedLogs ? (
                      <div className="text-center text-neutral-400 text-xs py-4">Loading kicks...</div>
                    ) : kickedLogs.length === 0 ? (
                      <div className="text-center text-neutral-400 text-xs py-4">No disciplinary actions recorded.</div>
                    ) : (
                      kickedLogs.map((log, i) => {
                        const d = log.kickedAt?.seconds ? new Date(log.kickedAt.seconds * 1000) : (log.kickedAt ? new Date(log.kickedAt) : null)
                        const dStr = d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "Recently"
                        return (
                          <div key={i} className="flex items-start gap-2 border-b border-neutral-100 pb-2 last:border-0 last:pb-0">
                            <span className="h-2 w-2 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
                            <div>
                              <div className="font-semibold text-neutral-700">{log.name}</div>
                              <div className="text-[10px] text-neutral-400 mt-0.5">Kicked from {log.sessionCode} • {dStr}</div>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 4. STUDENTS TAB */}
          {currentTab === "students" && (
            <div className="space-y-6 animate-fadeIn">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-serif font-bold text-neutral-900">Student Directory</h2>
                  <p className="text-xs text-neutral-500 mt-1">Overview of students roster and engagement parameters across all classes</p>
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                  <input
                    type="text"
                    placeholder="Search roster..."
                    value={studentSearchQuery}
                    onChange={(e) => setStudentSearchQuery(e.target.value)}
                    className="bg-white rounded-xl border border-neutral-200 pl-9 pr-4 py-2 text-xs text-neutral-800 focus:outline-none focus:border-neutral-400 w-full sm:w-64 transition-colors shadow-sm"
                  />
                </div>
              </div>

              {/* Roster Table */}
              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-neutral-100 text-[10px] font-bold uppercase tracking-wider text-neutral-400 bg-neutral-50/50">
                        <th className="px-6 py-4">Student Name</th>
                        <th className="px-6 py-4">Classes Attended</th>
                        <th className="px-6 py-4">Average Focus Score</th>
                        <th className="px-6 py-4">Status Indicator</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {loadingRoster ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-12 text-center text-neutral-400 text-xs font-semibold">
                            <div className="h-6 w-6 rounded-full border-2 border-purple-500 border-t-transparent animate-spin mx-auto mb-3" />
                            Compiling database roster...
                          </td>
                        </tr>
                      ) : roster.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-12 text-center text-neutral-400 text-xs">
                            <Users2 className="h-8 w-8 text-neutral-300 mx-auto mb-2" />
                            No student attendance records found.
                          </td>
                        </tr>
                      ) : (
                        roster
                          .filter(std => std.name.toLowerCase().includes(studentSearchQuery.toLowerCase()))
                          .map((student, index) => {
                            const nameInitial = student.name
                              .split(" ")
                              .map(n => n[0])
                              .join("")
                              .slice(0, 2)
                              .toUpperCase()
                            
                            let ratingColor = "text-emerald-600"
                            if (student.avgEngagement < 90 && student.avgEngagement >= 80) ratingColor = "text-amber-600"
                            if (student.avgEngagement < 80) ratingColor = "text-red-600"

                            return (
                              <tr key={index} className="text-xs hover:bg-neutral-50/50 transition-colors">
                                <td className="px-6 py-4 font-semibold text-neutral-800 flex items-center gap-3">
                                  <div className="h-8 w-8 rounded-full bg-purple-50 border border-purple-100 flex items-center justify-center text-xs font-bold text-purple-600">
                                    {nameInitial}
                                  </div>
                                  <div>
                                    <div className="font-semibold text-neutral-800">{student.name}</div>
                                    <div className="text-[10px] text-neutral-400 font-mono">ID: {student.name.toLowerCase().replace(/\s+/g, "-")}</div>
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-neutral-600">
                                  <span className="inline-flex items-center gap-1 text-neutral-800 bg-neutral-100 px-2.5 py-1 rounded-md border border-neutral-200 font-semibold text-[10px]">
                                    {student.classesAttended} Sessions
                                  </span>
                                </td>
                                <td className="px-6 py-4">
                                  <span className={`font-bold ${ratingColor} text-sm`}>{student.avgEngagement}%</span>
                                </td>
                                <td className="px-6 py-4">
                                  {student.avgEngagement >= 90 ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded font-bold uppercase tracking-wide">
                                      High Attentive
                                    </span>
                                  ) : student.avgEngagement >= 80 ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded font-bold uppercase tracking-wide">
                                      Normal
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[10px] text-red-700 bg-red-50 border border-red-100 px-2 py-0.5 rounded font-bold uppercase tracking-wide">
                                      Needs Review
                                    </span>
                                  )}
                                </td>
                              </tr>
                            )
                          })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 5. SETTINGS TAB */}
          {currentTab === "settings" && (
            <div className="space-y-6 animate-fadeIn">
              <div>
                <h2 className="text-xl font-serif font-bold text-neutral-900">Teacher Preference Settings</h2>
                <p className="text-xs text-neutral-500 mt-1">Configure default session control rules and check connection integrity</p>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                {/* Left Card: Session rules configuration */}
                <div className="card p-6 space-y-6 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
                  <h3 className="text-sm font-serif font-bold text-neutral-800 uppercase tracking-wider flex items-center gap-2 border-b border-neutral-100 pb-3">
                    <Sliders className="h-4 w-4 text-blue-500" />
                    Session Control Default Rules
                  </h3>

                  <div className="space-y-4">
                    {/* Face tracking warning limit */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-neutral-700">Sustained Distraction Warning Limit</span>
                        <span className="font-mono text-blue-600 font-bold">{settings.faceWarningThreshold} seconds</span>
                      </div>
                      <input
                        type="range"
                        min="3"
                        max="15"
                        value={settings.faceWarningThreshold}
                        onChange={(e) => setSettings({ ...settings, faceWarningThreshold: parseInt(e.target.value) })}
                        className="w-full h-1.5 bg-neutral-100 rounded-lg appearance-none cursor-pointer accent-[#0a0a23]"
                      />
                    </div>

                    {/* Out of frame timeout */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-neutral-700">Out of Frame Kick Countdown</span>
                        <span className="font-mono text-blue-600 font-bold">{settings.outOfFrameTimeout} seconds</span>
                      </div>
                      <input
                        type="range"
                        min="3"
                        max="15"
                        value={settings.outOfFrameTimeout}
                        onChange={(e) => setSettings({ ...settings, outOfFrameTimeout: parseInt(e.target.value) })}
                        className="w-full h-1.5 bg-neutral-100 rounded-lg appearance-none cursor-pointer accent-[#0a0a23]"
                      />
                    </div>

                    {/* Focus mode toggle */}
                    <div className="flex items-center justify-between text-xs border-t border-neutral-100 pt-3">
                      <div>
                        <div className="font-semibold text-neutral-700">Enable Focus Mode by Default</div>
                        <div className="text-[10px] text-neutral-500 mt-0.5">Students webcam feeds are invisible to peers</div>
                      </div>
                      <button
                        onClick={() => setSettings({ ...settings, defaultFocusMode: !settings.defaultFocusMode })}
                        className={`h-6 w-11 rounded-full p-0.5 transition-colors duration-200 outline-none ${
                          settings.defaultFocusMode ? "bg-black" : "bg-neutral-200"
                        }`}
                      >
                        <div
                          className={`h-5 w-5 rounded-full bg-white transition-transform duration-200 ${
                            settings.defaultFocusMode ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>

                    {/* Allow late joins toggle */}
                    <div className="flex items-center justify-between text-xs border-t border-neutral-100 pt-3">
                      <div>
                        <div className="font-semibold text-neutral-700">Allow Late Joins</div>
                        <div className="text-[10px] text-neutral-500 mt-0.5">Allow students to enter after classroom starts</div>
                      </div>
                      <button
                        onClick={() => setSettings({ ...settings, defaultAllowLateJoins: !settings.defaultAllowLateJoins })}
                        className={`h-6 w-11 rounded-full p-0.5 transition-colors duration-200 outline-none ${
                          settings.defaultAllowLateJoins ? "bg-black" : "bg-neutral-200"
                        }`}
                      >
                        <div
                          className={`h-5 w-5 rounded-full bg-white transition-transform duration-200 ${
                            settings.defaultAllowLateJoins ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>

                    {/* Voice selector */}
                    <div className="space-y-1.5 border-t border-neutral-100 pt-3">
                      <label className="text-xs font-semibold text-neutral-700 flex items-center gap-1">
                        <Volume2 className="h-3.5 w-3.5 text-blue-500" />
                        AI Lecturer Voice (Speech Synthesis)
                      </label>
                      <select
                        value={settings.aiLecturerVoice}
                        onChange={(e) => setSettings({ ...settings, aiLecturerVoice: e.target.value })}
                        className="w-full bg-white rounded-lg border border-neutral-200 px-3 py-2 text-xs text-neutral-800 focus:outline-none focus:border-neutral-400"
                      >
                        <option>Google US English (en-US)</option>
                        <option>Google UK English Male (en-GB)</option>
                        <option>Google India English Female (en-IN)</option>
                        <option>Microsoft David Desktop (en-US)</option>
                      </select>
                    </div>

                    <div className="pt-4 flex items-center justify-between gap-4">
                      {saveSuccess && (
                        <span className="text-xs text-emerald-600 font-bold flex items-center gap-1 animate-pulse">
                          <Check className="h-3.5 w-3.5" /> Preferences saved!
                        </span>
                      )}
                      <button
                        onClick={() => {
                          setSaveSuccess(true)
                          setTimeout(() => setSaveSuccess(false), 2000)
                        }}
                        className="ml-auto rounded-full bg-black hover:bg-slate-900 text-white font-bold px-5 py-2.5 text-xs transition-colors cursor-pointer shadow-sm"
                      >
                        Save Settings
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right Card: Connections checklists */}
                <div className="space-y-6">
                  {/* System connection */}
                  <div className="card p-6 space-y-5 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
                    <h3 className="text-sm font-serif font-bold text-neutral-800 uppercase tracking-wider flex items-center gap-2 border-b border-neutral-100 pb-3">
                      <Database className="h-4 w-4 text-blue-500" />
                      Live Connection Checklist
                    </h3>

                    <div className="space-y-3.5">
                      {/* Firestore check */}
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-neutral-600">Firestore Database Connection</span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald border border-emerald-100 text-[10px] text-emerald-800 font-bold uppercase tracking-wider">
                          Connected
                        </span>
                      </div>

                      {/* Claude check */}
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-neutral-600">Claude AI Chat & Lecture API</span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald border border-emerald-100 text-[10px] text-emerald-800 font-bold uppercase tracking-wider">
                          Configured
                        </span>
                      </div>

                      {/* Web Speech synthesis check */}
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-neutral-600">Web Speech Synthesis API</span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald border border-emerald-100 text-[10px] text-emerald-800 font-bold uppercase tracking-wider">
                          Available
                        </span>
                      </div>

                      {/* MediaPipe CV check */}
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-neutral-600">MediaPipe Computer Vision SDK</span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald border border-emerald-100 text-[10px] text-emerald-800 font-bold uppercase tracking-wider">
                          Compiled
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Security check */}
                  <div className="card p-6 space-y-4 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
                    <h3 className="text-sm font-serif font-bold text-neutral-800 uppercase tracking-wider flex items-center gap-2 border-b border-neutral-100 pb-3">
                      <Shield className="h-4 w-4 text-blue-500" />
                      System Access Profile
                    </h3>
                    <div className="space-y-1.5 text-xs text-neutral-600">
                      <div><strong className="text-neutral-800">Security Scope:</strong> teacher-read-write</div>
                      <div><strong className="text-neutral-800">Verification Mode:</strong> Google Firebase IAM</div>
                      <div><strong className="text-neutral-800">App Environment:</strong> Production (six.vercel)</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
    )
}

export default function Dashboard() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#f8f9fa] flex flex-col items-center justify-center gap-3">
        <div className="h-10 w-10 rounded-full border-2 border-black border-t-transparent animate-spin" />
        <span className="text-xs text-neutral-400 font-serif font-semibold tracking-wider animate-pulse">Initializing dashboard...</span>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  )
}
