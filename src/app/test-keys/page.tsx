"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, RefreshCw, Key, ShieldAlert, CheckCircle, AlertTriangle, Activity } from "lucide-react"

export default function TestKeysPage() {
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<any>(null)

  const runDiagnostics = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/test-keys")
      const data = await res.json()
      setResults(data)
    } catch (e: any) {
      alert("Failed to fetch diagnostics: " + e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0D0D11] text-white p-6 md:p-12 font-sans flex flex-col items-center">
      <div className="w-full max-w-3xl space-y-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-purple-400 text-xs font-bold uppercase tracking-wider">
              <Activity className="h-4 w-4" /> API Diagnostics Tool
            </div>
            <h1 className="text-2xl font-black tracking-tight">API Key Verification</h1>
            <p className="text-xs text-white/40">Verify connection latency and keys for class lectures & doubts</p>
          </div>
          <Link
            href="/dashboard"
            className="self-start sm:self-center px-4 py-2 border border-white/10 hover:border-purple-500/30 hover:bg-purple-650/10 text-white/80 hover:text-purple-300 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Dashboard
          </Link>
        </div>

        {/* Action Button */}
        <div className="bg-[#111116] border border-white/5 p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-white">Run Integration Diagnosis</h3>
            <p className="text-xs text-white/40 leading-relaxed">
              Initiate server-side connection checks to verify DNS and NVIDIA NIM completions.
            </p>
          </div>
          <button
            onClick={runDiagnostics}
            disabled={loading}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-650/30 text-white text-xs font-black rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95 disabled:scale-100"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Diagnosing..." : "Run Diagnostics"}
          </button>
        </div>

        {/* Diagnostic Results */}
        {results && (
          <div className="space-y-6 animate-fadeIn">
            
            {/* 1. DNS Section */}
            <div className="bg-[#111116] border border-white/5 p-6 rounded-2xl space-y-4">
              <div className="flex items-center gap-2 border-b border-white/5 pb-3">
                <Activity className="h-4 w-4 text-purple-400" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-white">DNS Hostname Resolving</h3>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {/* Local DNS */}
                <div className={`p-4 rounded-xl border ${
                  results.dns.status === "success" ? "border-green-500/20 bg-green-500/5" : "border-red-500/20 bg-red-500/5"
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-white/80">Local System DNS Resolver</span>
                    {results.dns.status === "success" ? (
                      <span className="text-[10px] bg-green-500/10 border border-green-500/20 text-green-400 px-2 py-0.5 rounded font-black uppercase">Success</span>
                    ) : (
                      <span className="text-[10px] bg-red-500/10 border border-red-500/20 text-red-400 px-2 py-0.5 rounded font-black uppercase">Refused</span>
                    )}
                  </div>
                  <p className="text-[11px] font-mono break-all text-white/50 leading-relaxed">
                    {results.dns.status === "success" 
                      ? `Resolved to: ${results.dns.ips.join(", ")} (${results.dns.latencyMs}ms)`
                      : `Error: ${results.dns.error}`
                    }
                  </p>
                </div>

                {/* Google DNS */}
                <div className={`p-4 rounded-xl border ${
                  results.publicDns.status === "success" ? "border-green-500/20 bg-green-500/5" : "border-red-500/20 bg-red-500/5"
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-white/80">Google Public DNS (8.8.8.8)</span>
                    {results.publicDns.status === "success" ? (
                      <span className="text-[10px] bg-green-500/10 border border-green-500/20 text-green-400 px-2 py-0.5 rounded font-black uppercase">Success</span>
                    ) : (
                      <span className="text-[10px] bg-red-500/10 border border-red-500/20 text-red-400 px-2 py-0.5 rounded font-black uppercase">Failed</span>
                    )}
                  </div>
                  <p className="text-[11px] font-mono break-all text-white/50 leading-relaxed">
                    {results.publicDns.status === "success" 
                      ? `Resolved to: ${results.publicDns.ips.join(", ")} (${results.publicDns.latencyMs}ms)`
                      : `Error: ${results.publicDns.error}`
                    }
                  </p>
                </div>
              </div>
            </div>

            {/* 2. NVIDIA NIM Section */}
            <div className="bg-[#111116] border border-white/5 p-6 rounded-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div className="flex items-center gap-2">
                  <Key className="h-4 w-4 text-purple-400" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-white">NVIDIA NIM (Llama 3.1)</h3>
                </div>
                {results.nvidia.status === "success" ? (
                  <div className="flex items-center gap-1.5 text-green-400 font-bold text-xs">
                    <CheckCircle className="h-4 w-4" /> Working
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-red-400 font-bold text-xs">
                    <ShieldAlert className="h-4 w-4" /> Connection Issue
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex justify-between text-xs">
                  <span className="text-white/40">Status:</span>
                  <span className={results.nvidia.status === "success" ? "text-green-400 font-bold" : "text-red-400 font-bold"}>
                    {results.nvidia.status === "success" ? `Connected (${results.nvidia.latencyMs}ms)` : "Failed"}
                  </span>
                </div>
                <div className="flex flex-col gap-1.5 p-4 rounded-xl bg-black/25 border border-white/5">
                  <span className="text-[9px] uppercase tracking-widest font-black text-purple-400">Response / Error Preview</span>
                  <p className="text-xs font-mono break-words text-white/60 leading-relaxed">
                    {results.nvidia.status === "success" ? results.nvidia.response : results.nvidia.error}
                  </p>
                </div>

                {results.nvidia.status !== "success" && (
                  <div className="p-3.5 bg-yellow-500/5 border border-yellow-500/20 text-yellow-500/90 text-xs rounded-xl flex items-start gap-2.5 leading-relaxed">
                    <AlertTriangle className="h-4.5 w-4.5 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block mb-0.5">Troubleshooting Recommendation:</span>
                      {results.dns.status !== "success" ? (
                        <span>Your local system is blocking A queries to NVIDIA NIM. Modify your server router configuration or hosts files, or update DNS servers.</span>
                      ) : (
                        <span>Double-check your <code>NVIDIA_API_KEY</code> key value in <code>.env.local</code>. Make sure it contains no extra spaces or linebreaks.</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  )
}
