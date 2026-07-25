"use client";

import { useSearchParams, useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { ArrowLeft, Brain, ShieldAlert, BarChart, Users, CheckCircle2, Download } from "lucide-react";
import Link from "next/link";
import {
  subscribeToSession,
  subscribeToStudents,
  subscribeToKicked,
  Session,
  Student,
  KickedStudent
} from "@/lib/session-service";
import { subscribeToAuthChanges } from "@/lib/auth-service";

export default function SummaryPage() {
  const searchParams = useSearchParams();
  const params = useParams();
  const router = useRouter();
  
  const kicked = searchParams.get("kicked") === "true";
  const reason = searchParams.get("reason");
  const sessionCode = (params.code as string)?.toUpperCase() || "UNKNOWN";

  // Auth & Database states
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [studentsList, setStudentsList] = useState<Student[]>([]);
  const [kickedList, setKickedList] = useState<KickedStudent[]>([]);
  const [loading, setLoading] = useState(true);

  // Load auth state
  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges((user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  // Load session & attendance lists
  useEffect(() => {
    if (!sessionCode) return;

    let unsubscribeSession = () => {};
    let unsubscribeStudents = () => {};
    let unsubscribeKicked = () => {};

    try {
      unsubscribeSession = subscribeToSession(
        sessionCode,
        (updatedSession) => {
          if (updatedSession) {
            setSession(updatedSession);
            setLoading(false);
          } else {
            setLoading(false);
          }
        },
        () => setLoading(false)
      );

      unsubscribeStudents = subscribeToStudents(
        sessionCode,
        (list) => {
          setStudentsList(list);
        }
      );

      unsubscribeKicked = subscribeToKicked(
        sessionCode,
        (list) => {
          setKickedList(list);
        }
      );
    } catch (e) {
      console.error(e);
      setTimeout(() => setLoading(false), 0);
    }

    return () => {
      unsubscribeSession();
      unsubscribeStudents();
      unsubscribeKicked();
    };
  }, [sessionCode]);

  const [userRole, setUserRole] = useState<string>("teacher");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const role = localStorage.getItem("userRole");
      if (role) {
        setTimeout(() => {
          setUserRole(role);
        }, 0);
      }
    }
  }, []);

  // Determine user role (computed dynamically on each render pass)
  const isTeacher = userRole === "teacher" || (session && currentUser ? session.teacherId === currentUser.uid : false);

  // Export Attendance CSV function
  const handleExportCSV = () => {
    try {
      const headers = ["Student Name", "Status", "Join Time", "Average Focus Score"];
      const rows = [
        ...studentsList.filter(s => s.id !== session?.teacherId).map(s => {
          const joinedTime = s.joinedAt?.seconds 
            ? new Date(s.joinedAt.seconds * 1000).toLocaleTimeString() 
            : "Unknown";
          return [s.name, s.status === "offline" ? "Left Class" : "Present", joinedTime, `${s.engagementScore}%`];
        }),
        ...kickedList.map(k => {
          const kickedTime = k.kickedAt?.seconds 
            ? new Date(k.kickedAt.seconds * 1000).toLocaleTimeString() 
            : "Unknown";
          return [k.name, "Kicked/Removed", kickedTime, "0%"];
        })
      ];

      const csvContent = "data:text/csv;charset=utf-8," 
        + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
      
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `attendance_report_${sessionCode}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("CSV export failed:", err);
    }
  };

  const formatTimestamp = (ts: any) => {
    if (!ts) {
      return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    const date = ts.toDate 
      ? ts.toDate() 
      : ts.seconds 
        ? new Date(ts.seconds * 1000) 
        : new Date(ts);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // ─── LOADING SCREEN ───
  if (loading && !session) {
    return (
      <div className="min-h-screen bg-[#F6F7F9] flex flex-col items-center justify-center text-[#111827] font-sans">
        <div className="h-8 w-8 rounded-full border-2 border-[#2563EB] border-t-transparent animate-spin mb-4" />
        <p className="text-sm font-medium text-[#6B7280]">Loading session summary...</p>
      </div>
    );
  }

  // ─── TEACHER VIEW: ATTENDANCE REPORT ───
  if (isTeacher) {
    const sessionData = session || {
      title: typeof window !== "undefined" ? localStorage.getItem("sessionTitle") || "Live AI Classroom Session" : "Live AI Classroom Session",
      subject: typeof window !== "undefined" ? localStorage.getItem("sessionSubject") || "General" : "General",
      gradeLevel: "High School",
      teacherId: "teacher",
    };

    const totalAttendees = studentsList.length + kickedList.length;

    // 1. Compute Class Average Focus Score (including Teacher + Students)
    const allScores = studentsList
      .map(s => s.engagementScore ?? (s as any).score)
      .filter(sc => typeof sc === "number" && !isNaN(sc) && sc >= 0);

    let avgFocusScore = 100;
    if (allScores.length > 0) {
      avgFocusScore = Math.round(allScores.reduce((acc, val) => acc + val, 0) / allScores.length);
    } else if (typeof window !== "undefined") {
      const cachedClassFocus = localStorage.getItem(`student_focus_${sessionCode}`) || localStorage.getItem("classFocus");
      if (cachedClassFocus && !isNaN(Number(cachedClassFocus))) {
        avgFocusScore = Math.round(Number(cachedClassFocus));
      }
    }

    // 2. Compute Teacher Focus Score
    let teacherFocusScore: number | null = null;
    const rawTeacherScore = (sessionData as any).teacherEngagementScore;
    if (typeof rawTeacherScore === "number" && !isNaN(rawTeacherScore)) {
      teacherFocusScore = Math.round(rawTeacherScore);
    } else if (typeof window !== "undefined") {
      const cachedTeacherFocus = localStorage.getItem(`teacher_focus_${sessionCode}`) || localStorage.getItem("teacherFocus");
      if (cachedTeacherFocus && !isNaN(Number(cachedTeacherFocus))) {
        teacherFocusScore = Math.round(Number(cachedTeacherFocus));
      }
    }

    if (teacherFocusScore === null) {
      teacherFocusScore = avgFocusScore;
    }

    return (
      <div className="min-h-screen bg-[#F6F7F9] text-[#111827] font-sans relative pb-12 flex flex-col z-10 antialiased">
        {/* Top Navbar */}
        <header className="h-16 border-b border-[rgba(15,23,42,.08)] bg-white px-6 md:px-8 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <Link 
              href="/dashboard" 
              className="p-2 rounded-xl bg-white border border-[#E5E7EB] hover:bg-[#F9FAFB] hover:-translate-y-0.5 text-[#374151] transition-all duration-350 ease-[cubic-bezier(.22,1,.36,1)] shadow-xs"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-sm md:text-base font-bold text-[#111827] tracking-tight flex items-center gap-2">
              <BarChart className="h-4 w-4 text-[#2563EB]" />
              Attendance & Performance Report
            </h1>
          </div>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 rounded-2xl bg-[#111827] hover:bg-[#1F2937] hover:-translate-y-0.5 px-4 py-2 text-xs font-bold text-white shadow-[0_12px_24px_rgba(17,24,39,.12)] transition-all duration-350 ease-[cubic-bezier(.22,1,.36,1)] cursor-pointer group"
          >
            <Download className="h-3.5 w-3.5 group-hover:translate-y-0.5 transition-transform duration-300" />
            Export CSV
          </button>
        </header>

        {/* Dashboard Content */}
        <main className="flex-1 p-6 md:p-8 space-y-8 max-w-5xl w-full mx-auto">
          {/* Session Overview Card */}
          <div className="bg-white border border-[rgba(15,23,42,.08)] p-6 rounded-[24px] space-y-4 shadow-[0_1px_2px_rgba(15,23,42,.03),0_12px_32px_rgba(15,23,42,.05)] hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(15,23,42,.08)] transition-all duration-350 ease-[cubic-bezier(.22,1,.36,1)]">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] text-[#2563EB] uppercase font-black tracking-widest font-mono">Session Summary</span>
                <h2 className="text-xl font-bold text-[#111827] mt-1">{sessionData.title}</h2>
                <p className="text-xs text-[#6B7280] mt-1">{sessionData.subject} • {sessionData.gradeLevel}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-[#374151] bg-[#F3F4F6] px-3.5 py-1.5 rounded-lg border border-[rgba(15,23,42,.08)] font-mono">
                  CODE: {sessionCode}
                </span>
                <span className="text-xs font-semibold text-[#16A34A] bg-[#ECFDF5] px-3.5 py-1.5 rounded-lg border border-[#A7F3D0] uppercase">
                  Concluded
                </span>
              </div>
            </div>
          </div>

          {/* Stats Row */}
          <section className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            {/* Total Attendees */}
            <div className="bg-white rounded-[20px] border-2 border-[#111827] p-5 shadow-[0_6px_20px_rgba(15,23,42,.05)] hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(15,23,42,.08)] transition-all duration-350 ease-[cubic-bezier(.22,1,.36,1)]">
              <div className="flex items-center justify-between text-[#111827] mb-3">
                <span className="text-[10px] font-black uppercase tracking-wider font-mono">Total Attendees</span>
                <Users className="h-4 w-4 text-[#2563EB]" />
              </div>
              <h3 className="text-2xl font-black text-[#000000]">{totalAttendees}</h3>
              <span className="text-[10px] text-[#111827] font-bold">Students joined waitlist</span>
            </div>

            {/* Student Average Focus Score */}
            <div className="bg-white rounded-[20px] border-2 border-[#111827] p-5 shadow-[0_6px_20px_rgba(15,23,42,.05)] hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(15,23,42,.08)] transition-all duration-350 ease-[cubic-bezier(.22,1,.36,1)]">
              <div className="flex items-center justify-between text-[#111827] mb-3">
                <span className="text-[10px] font-black uppercase tracking-wider font-mono">Student Avg Focus</span>
                <Brain className="h-4 w-4 text-[#16A34A]" />
              </div>
              <h3 className="text-2xl font-black text-[#000000]">{avgFocusScore}%</h3>
              <span className="text-[10px] text-[#16A34A] font-bold">Student class focus average</span>
            </div>

            {/* Present at Close */}
            <div className="bg-white rounded-[20px] border-2 border-[#111827] p-5 shadow-[0_6px_20px_rgba(15,23,42,.05)] hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(15,23,42,.08)] transition-all duration-350 ease-[cubic-bezier(.22,1,.36,1)]">
              <div className="flex items-center justify-between text-[#111827] mb-3">
                <span className="text-[10px] font-black uppercase tracking-wider font-mono">Present at Close</span>
                <CheckCircle2 className="h-4 w-4 text-[#16A34A]" />
              </div>
              <h3 className="text-2xl font-black text-[#000000]">
                {studentsList.filter(s => s.status !== "offline").length}
              </h3>
              <span className="text-[10px] text-[#111827] font-bold">Active till the end</span>
            </div>

            {/* Kicked / Dismissed */}
            <div className="bg-white rounded-[20px] border-2 border-[#111827] p-5 shadow-[0_6px_20px_rgba(15,23,42,.05)] hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(15,23,42,.08)] transition-all duration-350 ease-[cubic-bezier(.22,1,.36,1)]">
              <div className="flex items-center justify-between text-[#111827] mb-3">
                <span className="text-[10px] font-black uppercase tracking-wider font-mono">Kicked/Dismissed</span>
                <ShieldAlert className="h-4 w-4 text-[#DC2626]" />
              </div>
              <h3 className="text-2xl font-black text-[#DC2626]">{kickedList.length}</h3>
              <span className="text-[10px] text-[#111827] font-bold">Removed for distraction</span>
            </div>
          </section>

          {/* Roster Table */}
          <div className="bg-white rounded-[24px] border-2 border-[#111827] overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,.03),0_12px_32px_rgba(15,23,42,.05)]">
            <div className="px-6 py-5 border-b-2 border-[#111827] flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-[#000000] font-mono">Attendance Roster</h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-[#111827] text-[10px] font-black uppercase tracking-wider text-[#000000] bg-[#F9FAFB] font-mono">
                    <th className="px-6 py-3.5">Student Name</th>
                    <th className="px-4 py-3.5">Final Status</th>
                    <th className="px-4 py-3.5">Join Time</th>
                    <th className="px-6 py-3.5 text-right font-mono">Avg Focus Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E7EB]">
                  {/* Active & Offline Attendees (Teacher + Students) */}
                  {studentsList.map((student) => {
                    const focusScore = student.engagementScore ?? (student as any).score ?? 100;
                    const focusBadge = 
                      focusScore >= 80 ? "bg-[#ECFDF5] text-[#16A34A] border-[#A7F3D0]" :
                      focusScore >= 65 ? "bg-[#FEF3C7] text-[#D97706] border-[#FDE68A]" :
                      "bg-[#FEF2F2] text-[#DC2626] border-[#FECACA]";
                    
                    const isHost = student.id === sessionData.teacherId || (student as any).isTeacher || (student as any).role === "teacher";
                    
                    return (
                      <tr key={student.id} className="border-b border-[#E5E7EB] hover:bg-[#F8FAFC] transition-all duration-350 ease-[cubic-bezier(.22,1,.36,1)] text-xs">
                        <td className="px-6 py-4 font-bold text-[#000000]">
                          {student.name} {isHost && <span className="ml-1.5 px-2 py-0.5 rounded-full bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE] text-[9px] font-mono font-bold uppercase">Host / Teacher</span>}
                        </td>
                        <td className="px-4 py-4">
                          {student.status === "offline" ? (
                            <span className="inline-flex items-center rounded-full bg-[#F3F4F6] border border-[#111827] px-2.5 py-0.5 text-[9px] font-extrabold text-[#111827] uppercase font-mono">
                              Left Class
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-[#ECFDF5] border border-[#A7F3D0] px-2.5 py-0.5 text-[9px] font-extrabold text-[#16A34A] uppercase font-mono">
                              Present
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-[#111827] font-bold">{formatTimestamp(student.joinedAt)}</td>
                        <td className="px-6 py-4 text-right">
                          <span className={`inline-flex px-2 py-0.5 rounded-md border text-[10px] font-bold ${focusBadge}`}>
                            {focusScore}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}

                  {/* Kicked Students */}
                  {kickedList.map((kickedStud) => (
                    <tr key={kickedStud.id} className="border-b border-[#E5E7EB] hover:bg-[#F8FAFC] transition-all duration-350 ease-[cubic-bezier(.22,1,.36,1)] text-xs bg-[#FEF2F2]/30">
                      <td className="px-6 py-4 font-bold text-[#DC2626]">{kickedStud.name}</td>
                      <td className="px-4 py-4">
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#FEF2F2] border border-[#FECACA] px-2.5 py-0.5 text-[9px] font-bold text-[#DC2626] uppercase">
                          Kicked
                        </span>
                      </td>
                      <td className="px-4 py-4 text-[#6B7280] font-medium">{formatTimestamp(kickedStud.kickedAt)}</td>
                      <td className="px-6 py-4 text-right">
                        <span className="inline-flex px-2 py-0.5 rounded-md border border-[#FECACA] text-[#DC2626] bg-[#FEF2F2] text-[10px] font-bold">
                          --
                        </span>
                      </td>
                    </tr>
                  ))}

                  {studentsList.length === 0 && kickedList.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-xs font-medium">
                        <Users className="h-10 w-10 text-[#CBD5E1] mb-2.5 mx-auto" />
                        <p className="text-[#6B7280]">No students attended this session.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Navigation Button */}
          <div className="text-center pt-2">
            <button
              onClick={() => router.push("/dashboard")}
              className="px-6 py-3 bg-[#111827] hover:bg-[#1F2937] hover:-translate-y-0.5 rounded-[16px] text-xs font-bold text-white shadow-[0_12px_24px_rgba(17,24,39,.12)] transition-all duration-350 ease-[cubic-bezier(.22,1,.36,1)] inline-flex items-center gap-2 cursor-pointer group"
            >
              <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform duration-300" />
              Return to Dashboard
            </button>
          </div>
        </main>
      </div>
    );
  }

  // ─── STUDENT VIEW ───
  return (
    <div className="min-h-screen bg-[#F6F7F9] flex flex-col items-center justify-center text-[#111827] p-6 font-sans antialiased">
      
      <div className="max-w-md w-full relative z-10 bg-white border border-[rgba(15,23,42,.08)] p-8 rounded-[24px] shadow-[0_12px_32px_rgba(15,23,42,.05)] text-center space-y-6">
        {kicked ? (
          <>
            <div className="w-20 h-20 bg-[#FEF2F2] border border-[#FECACA] rounded-full flex items-center justify-center mx-auto mb-2 animate-pulse">
              <ShieldAlert className="w-10 h-10 text-[#DC2626]" />
            </div>
            <h1 className="text-2xl font-black text-[#111827]">Removed from Session</h1>
            <p className="text-sm text-[#6B7280] leading-relaxed font-medium">
              {reason === "out_of_frame" ? (
                <>You were automatically removed from session <span className="font-bold text-[#DC2626]">{sessionCode}</span> because the AI vision system detected you left the camera frame.</>
              ) : reason === "device_usage" ? (
                <>You were automatically removed from session <span className="font-bold text-[#DC2626]">{sessionCode}</span> because the AI vision system detected prohibited phone/tablet usage.</>
              ) : (
                <>You were automatically removed from session <span className="font-bold text-[#DC2626]">{sessionCode}</span> because the AI vision system detected you were away from your keyboard or deeply distracted for an extended period.</>
              )}
            </p>
          </>
        ) : (
          <>
            <div className="w-20 h-20 bg-[#EFF6FF] border border-[#BFDBFE] rounded-full flex items-center justify-center mx-auto mb-2">
              <BarChart className="w-10 h-10 text-[#2563EB]" />
            </div>
            <h1 className="text-2xl font-bold text-[#111827]">Session Concluded</h1>
            <p className="text-sm text-[#6B7280] leading-relaxed font-medium">
              The lecture <span className="font-bold text-[#2563EB]">{sessionCode}</span> has successfully ended. Your AI-generated performance summary and attendance metrics are being compiled.
            </p>
          </>
        )}

        <div className="pt-4 border-t border-[#E5E7EB]">
          <button
            onClick={() => router.push("/student-dashboard")}
            className="w-full py-4 bg-[#111827] hover:bg-[#1F2937] hover:-translate-y-0.5 text-white rounded-[16px] text-sm font-bold shadow-[0_12px_24px_rgba(17,24,39,.12)] transition-all duration-350 ease-[cubic-bezier(.22,1,.36,1)] flex items-center justify-center gap-2 cursor-pointer group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform duration-300" />
            Return to Student Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
