// ─── NVIDIA FLUX.2-klein-4b Image Generation API Route ──────────────────────
// Accepts a text prompt, returns a base64 PNG via NVIDIA NIM.

import "@/lib/dns-fix";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

const NVIDIA_IMAGE_URL =
  "https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.2-klein-4b";

export async function POST(req: NextRequest) {
  const apiKey = (process.env.NVIDIA_API_KEY || process.env.NVIDIA_IMAGE_API_KEY || "").trim();

  if (!apiKey) {
    return NextResponse.json(
      { error: "NVIDIA_API_KEY or NVIDIA_IMAGE_API_KEY not configured" },
      { status: 500 }
    );
  }

  try {
    const body = await req.json();
    const prompt = body.prompt;
    let width = body.width ?? 1024;
    let height = body.height ?? 1024;
    
    // NVIDIA FLUX.2-klein-4b requires dimensions >= 512 and <= 1568
    if (width < 512) width = 512;
    if (height < 512) height = 512;

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'prompt' field" },
        { status: 400 }
      );
    }

    // Prefix for educational context — helps the model generate cleaner, textless visualizations
    const hasTextRequest = prompt.toLowerCase().includes("the end") || prompt.toLowerCase().includes("text");
    const suffix = hasTextRequest
      ? ". Sharp focus, beautiful lighting, high resolution."
      : ". Sharp focus, beautiful lighting, high resolution, absolutely no text, no labels, no words, no letters, no captions, no writing.";
    const fullPrompt = `Highly detailed, photorealistic, 4K quality, vibrant colors, professional educational visualization: ${prompt}${suffix}`;

    const res = await fetch(NVIDIA_IMAGE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        prompt: fullPrompt,
        height,
        width,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "Unknown error");
      console.error("[/api/image] NVIDIA error:", res.status, errText);
      return NextResponse.json(
        { error: `NVIDIA API returned ${res.status}: ${errText}` },
        { status: res.status }
      );
    }

    const data = await res.json();

    // FLUX returns { artifacts: [{ base64: "...", seed: ... }] }
    const base64 = data?.artifacts?.[0]?.base64;

    if (!base64) {
      console.error("[/api/image] No image in response:", JSON.stringify(data).slice(0, 200));
      return NextResponse.json(
        { error: "No image returned from model" },
        { status: 502 }
      );
    }

    return NextResponse.json({ image: `data:image/png;base64,${base64}` });
  } catch (err: any) {
    console.error("[/api/image] Unexpected error:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
