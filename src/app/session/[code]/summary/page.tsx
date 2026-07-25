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

  const [isStudentRole, setIsStudentRole] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const role = localStorage.getItem("userRole");
      const name = localStorage.getItem("studentName");
      if (role === "student" || (!!name && role !== "teacher")) {
        setTimeout(() => {
          setIsStudentRole(true);
        }, 0);
      }
    }
  }, []);

  // Determine user role (computed dynamically on each render pass)
  const isTeacher = isStudentRole
    ? false
    : session && currentUser
      ? session.teacherId === currentUser.uid
      : false;

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
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F6F7F9] flex flex-col items-center justify-center text-slate-800 font-sans">
        <div className="h-8 w-8 rounded-full border-2 border-purple-600 border-t-transparent animate-spin mb-4" />
        <p className="text-sm font-medium text-slate-500">Loading session summary...</p>
      </div>
    );
  }

  // ─── TEACHER VIEW: ATTENDANCE REPORT ───
  if (isTeacher && session) {
    const studentsOnly = studentsList.filter(s => s.id !== session.teacherId);
    const totalAttendees = studentsOnly.length + kickedList.length;
    const avgFocusScore = studentsOnly.length > 0
      ? Math.floor(studentsOnly.reduce((acc, s) => acc + (s.engagementScore || 0), 0) / studentsOnly.length)
      : 0;

    return (
      <div className="min-h-screen bg-[#F6F7F9] text-slate-800 font-sans relative pb-12 flex flex-col z-10">
        {/* Subtle background gradient glow */}
        <div className="absolute top-0 left-1/4 pointer-events-none -z-10 h-[500px] w-[500px] rounded-full bg-purple-500/5 blur-[120px]" />
        
        {/* Header Section */}
        <header className="h-16 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl px-6 md:px-8 flex items-center justify-between sticky top-0 z-20 shadow-xs">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 transition-all text-slate-700">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-sm md:text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <BarChart className="h-4 w-4 text-purple-600" />
              Attendance & Performance Report
            </h1>
          </div>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 px-4 py-2 text-xs font-bold text-white shadow-sm shadow-purple-600/20 transition-all cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
        </header>

        {/* Dashboard Content */}
        <main className="flex-1 p-6 md:p-8 space-y-8 max-w-5xl w-full mx-auto">
          {/* Session Overview Card */}
          <div className="bg-white border border-slate-200/80 p-6 rounded-3xl space-y-4 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] text-purple-600 uppercase font-black tracking-widest font-mono">Session Summary</span>
                <h2 className="text-xl font-bold text-slate-900 mt-1">{session.title}</h2>
                <p className="text-xs text-slate-500 mt-1">{session.subject} • {session.gradeLevel}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-3.5 py-1.5 rounded-lg border border-slate-200 font-mono">
                  CODE: {sessionCode}
                </span>
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-3.5 py-1.5 rounded-lg border border-emerald-200 uppercase">
                  Concluded
                </span>
              </div>
            </div>
          </div>

          {/* Stats Row */}
          <section className={`grid gap-4 grid-cols-2 ${session && (session as any).teacherEngagementScore !== undefined ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}>
            {/* Attendees */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 mb-3">
                <span className="text-[10px] font-bold uppercase tracking-wider font-mono">Total Attendees</span>
                <Users className="h-4 w-4 text-purple-600" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900">{totalAttendees}</h3>
              <span className="text-[10px] text-slate-500 font-medium">Students joined waitlist</span>
            </div>

            {/* Average Focus */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 mb-3">
                <span className="text-[10px] font-bold uppercase tracking-wider font-mono">Avg Focus Score</span>
                <Brain className="h-4 w-4 text-purple-600" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900">{avgFocusScore}%</h3>
              <span className="text-[10px] text-emerald-600 font-medium">Class focus average</span>
            </div>

            {/* Teacher Focus */}
            {session && (session as any).teacherEngagementScore !== undefined && (
              <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
                <div className="flex items-center justify-between text-slate-500 mb-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider font-mono">Teacher Focus</span>
                  <Brain className="h-4 w-4 text-purple-600" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900">{(session as any).teacherEngagementScore}%</h3>
                <span className="text-[10px] text-purple-600 font-medium">Your focus average</span>
              </div>
            )}

            {/* Present Now */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 mb-3">
                <span className="text-[10px] font-bold uppercase tracking-wider font-mono">Present at Close</span>
                <CheckCircle2 className="h-4 w-4 text-purple-600" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900">
                {studentsOnly.filter(s => s.status !== "offline").length}
              </h3>
              <span className="text-[10px] text-slate-500 font-medium">Active till the end</span>
            </div>

            {/* Kicked Blacklist */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 mb-3">
                <span className="text-[10px] font-bold uppercase tracking-wider font-mono">Kicked/Dismissed</span>
                <ShieldAlert className="h-4 w-4 text-rose-500" />
              </div>
              <h3 className="text-2xl font-bold text-rose-600">{kickedList.length}</h3>
              <span className="text-[10px] text-slate-500 font-medium">Removed for distraction</span>
            </div>
          </section>

          {/* Roster Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 font-mono">Attendance Roster</h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-[9px] font-bold uppercase tracking-wider text-slate-500 bg-slate-50 font-mono">
                    <th className="px-6 py-3.5">Student Name</th>
                    <th className="px-4 py-3.5">Final Status</th>
                    <th className="px-4 py-3.5">Join Time</th>
                    <th className="px-6 py-3.5 text-right font-mono">Avg Focus Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {/* Active & Offline Students */}
                  {studentsOnly.map((student) => {
                    const focusColor = 
                      student.engagementScore >= 80 ? "text-emerald-700 bg-emerald-50 border-emerald-200" :
                      student.engagementScore >= 65 ? "text-amber-700 bg-amber-50 border-amber-200" :
                      "text-rose-700 bg-rose-50 border-rose-200";
                    
                    return (
                      <tr key={student.id} className="text-xs hover:bg-slate-50/60 transition-colors">
                        <td className="px-6 py-4 font-semibold text-slate-900">{student.name}</td>
                        <td className="px-4 py-4">
                          {student.status === "offline" ? (
                            <span className="inline-flex items-center rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-[9px] font-bold text-slate-600 uppercase font-mono">
                              Left Class
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[9px] font-bold text-emerald-700 uppercase font-mono">
                              Present
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-slate-600 font-medium">{formatTimestamp(student.joinedAt)}</td>
                        <td className="px-6 py-4 text-right">
                          <span className={`inline-flex px-2 py-0.5 rounded border text-[10px] font-bold ${focusColor}`}>
                            {student.engagementScore}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}

                  {/* Kicked Students */}
                  {kickedList.map((kickedStud) => (
                    <tr key={kickedStud.id} className="text-xs hover:bg-rose-50/40 transition-colors bg-rose-50/20">
                      <td className="px-6 py-4 font-bold text-rose-600">{kickedStud.name}</td>
                      <td className="px-4 py-4">
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 border border-rose-200 px-2.5 py-0.5 text-[9px] font-bold text-rose-700 uppercase">
                          Kicked
                        </span>
                      </td>
                      <td className="px-4 py-4 text-slate-600 font-medium">{formatTimestamp(kickedStud.kickedAt)}</td>
                      <td className="px-6 py-4 text-right">
                        <span className="inline-flex px-2 py-0.5 rounded border border-rose-200 text-rose-600 bg-rose-50 text-[10px] font-bold">
                          --
                        </span>
                      </td>
                    </tr>
                  ))}

                  {studentsOnly.length === 0 && kickedList.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-slate-400 text-xs font-semibold">
                        No students attended this session.
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
              className="px-6 py-3 bg-slate-900 hover:bg-slate-800 rounded-xl text-xs font-bold text-white transition-all inline-flex items-center gap-2 cursor-pointer shadow-md shadow-slate-900/10"
            >
              <ArrowLeft className="h-4 w-4" />
              Return to Dashboard
            </button>
          </div>
        </main>
      </div>
    );
  }

  // ─── STUDENT VIEW ───
  return (
    <div className="min-h-screen bg-[#F6F7F9] flex flex-col items-center justify-center text-slate-800 p-6 font-sans">
      
      <div className="max-w-md w-full relative z-10 bg-white border border-slate-200/80 p-8 rounded-3xl shadow-xl text-center space-y-6">
        {kicked ? (
          <>
            <div className="w-20 h-20 bg-rose-50 border border-rose-200 rounded-full flex items-center justify-center mx-auto mb-2 animate-pulse">
              <ShieldAlert className="w-10 h-10 text-rose-600" />
            </div>
            <h1 className="text-2xl font-black text-slate-900">Removed from Session</h1>
            <p className="text-sm text-slate-600 leading-relaxed font-medium">
              {reason === "out_of_frame" ? (
                <>You were automatically removed from session <span className="font-bold text-rose-600">{sessionCode}</span> because the AI vision system detected you left the camera frame.</>
              ) : reason === "device_usage" ? (
                <>You were automatically removed from session <span className="font-bold text-rose-600">{sessionCode}</span> because the AI vision system detected prohibited phone/tablet usage.</>
              ) : (
                <>You were automatically removed from session <span className="font-bold text-rose-600">{sessionCode}</span> because the AI vision system detected you were away from your keyboard or deeply distracted for an extended period.</>
              )}
            </p>
          </>
        ) : (
          <>
            <div className="w-20 h-20 bg-purple-50 border border-purple-200 rounded-full flex items-center justify-center mx-auto mb-2">
              <BarChart className="w-10 h-10 text-purple-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Session Concluded</h1>
            <p className="text-sm text-slate-600 leading-relaxed font-medium">
              The lecture <span className="font-bold text-purple-600">{sessionCode}</span> has successfully ended. Your AI-generated performance summary and attendance metrics are being compiled.
            </p>
          </>
        )}

        <div className="pt-4 border-t border-slate-200">
          <button
            onClick={() => router.push("/student-dashboard")}
            className="w-full py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-purple-600/20"
          >
            <ArrowLeft className="w-4 h-4" />
            Return to Student Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
