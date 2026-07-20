"use client";

import { useState } from "react";

export default function TestImagePage() {
  const [prompt, setPrompt] = useState("A labeled diagram of the water cycle showing evaporation, condensation, and precipitation");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latency, setLatency] = useState<number | null>(null);

  const generate = async () => {
    setLoading(true);
    setError(null);
    setImageUrl(null);
    setLatency(null);
    const start = performance.now();

    try {
      const res = await fetch("/api/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      const ms = Math.round(performance.now() - start);
      setLatency(ms);

      if (data.image) {
        setImageUrl(data.image);
      } else {
        setError(data.error || "No image returned");
      }
    } catch (e: any) {
      setError(e.message || "Network error");
      setLatency(Math.round(performance.now() - start));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#e0e0e0", padding: 40, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>FLUX.2-klein-4b Test</h1>
      <p style={{ fontSize: 13, opacity: 0.5, marginBottom: 24 }}>Temporary page — tests /api/image route</p>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={3}
        style={{ width: "100%", maxWidth: 600, background: "#1a1a1a", border: "1px solid #333", borderRadius: 8, padding: 12, color: "#fff", fontSize: 14, resize: "vertical" }}
      />

      <div style={{ marginTop: 12 }}>
        <button
          onClick={generate}
          disabled={loading || !prompt.trim()}
          style={{ padding: "10px 24px", borderRadius: 8, background: loading ? "#333" : "#7c3aed", color: "#fff", border: "none", cursor: loading ? "wait" : "pointer", fontSize: 14, fontWeight: 600 }}
        >
          {loading ? "Generating..." : "Generate Image"}
        </button>
      </div>

      {latency !== null && (
        <p style={{ marginTop: 16, fontSize: 13, fontFamily: "monospace", color: "#a78bfa" }}>
          Latency: {latency}ms
        </p>
      )}

      {error && (
        <div style={{ marginTop: 16, padding: 12, background: "#2b1515", border: "1px solid #ef444440", borderRadius: 8, color: "#f87171", fontSize: 13 }}>
          {error}
        </div>
      )}

      {imageUrl && (
        <div style={{ marginTop: 20 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt="Generated"
            style={{ maxWidth: 512, borderRadius: 12, border: "1px solid #333" }}
          />
        </div>
      )}
    </div>
  );
}
