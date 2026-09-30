import "@/lib/dns-fix";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const ttsCache = new Map<string, string>();
const inFlightMap = new Map<string, Promise<string>>();
const MAX_CACHE_SIZE = 200;

// Strict concurrency mutex: Camb AI accounts permit max 1 running job at a time.
// All requests wait sequentially so Camb AI never returns 429 concurrency_exceeded.
let cambMutex: Promise<any> = Promise.resolve();

function enqueueCambJob<T>(job: () => Promise<T>): Promise<T> {
  const run = () => job();
  const nextPromise = cambMutex.then(run, run);
  // Add a small 80ms cooling delay after completion so Camb AI server registers the previous job as ended
  cambMutex = nextPromise.then(
    () => new Promise(r => setTimeout(r, 80)),
    () => new Promise(r => setTimeout(r, 80))
  );
  return nextPromise;
}

async function fetchCambAiAudio(
  processedText: string,
  voiceId: number,
  language: string,
  speechModel: string,
  apiKey: string
): Promise<Buffer> {
  let response: Response | null = null;
  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    attempts++;
    try {
      console.log(`[Camb AI TTS] Attempt ${attempts} for: "${processedText.substring(0, 30)}..."`);
      response = await fetch("https://client.camb.ai/apis/tts-stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey
        },
        body: JSON.stringify({
          text: processedText,
          voice_id: voiceId,
          language,
          speech_model: speechModel
        })
      });

      if (response.ok) break;
      if (response.status !== 429 && response.status < 500) break; // Don't retry client 4xx errors
    } catch (e) {
      console.warn(`[Camb AI TTS] Fetch attempt ${attempts} failed:`, e);
    }
    if (attempts < maxAttempts) {
      await new Promise(r => setTimeout(r, 400 * attempts));
    }
  }

  if (!response || !response.ok) {
    const errText = response ? await response.text() : "Network error";
    console.error("[Camb AI API Error]:", errText);
    throw new Error(errText || "Camb AI TTS synthesis failed.");
  }

  const audioBuffer = await response.arrayBuffer();
  if (!audioBuffer || audioBuffer.byteLength === 0) {
    console.warn("[Camb AI API]: Received empty audio buffer (0 bytes)");
    throw new Error("Empty audio stream returned from Camb AI");
  }

  return Buffer.from(audioBuffer);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { text } = body;
    const voiceId = body.voiceId ?? body.voice_id ?? 147320;
    const language = body.language ?? body.lang ?? "en-us";
    const speechModel = body.speechModel ?? body.speech_model ?? "mars-8.1-flash-beta";

    if (!text || !text.trim()) {
      return NextResponse.json({ error: "Missing 'text' parameter" }, { status: 400 });
    }

    // Pad short text to prevent Camb AI 422 Unprocessable Entity errors
    let processedText = text.trim();
    if (processedText.length < 6) {
      processedText = processedText + " . . .";
    }

    const cacheKey = `${voiceId}:${language}:${speechModel}:${processedText}`;
    if (ttsCache.has(cacheKey)) {
      return NextResponse.json({ audioContent: ttsCache.get(cacheKey) });
    }

    // Reuse in-flight promise if the same text is already being processed
    if (inFlightMap.has(cacheKey)) {
      try {
        const base64Audio = await inFlightMap.get(cacheKey)!;
        return NextResponse.json({ audioContent: base64Audio });
      } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
      }
    }

    const apiKey = (process.env.CAMB_API_KEY || "").trim();
    if (!apiKey) {
      return NextResponse.json({ error: "Camb AI API Key is not set in environment." }, { status: 500 });
    }

    const numericVoiceId = typeof voiceId === "number" ? voiceId : parseInt(voiceId, 10);

    const jobPromise = enqueueCambJob(async () => {
      // Check cache again in case an earlier queued job just cached it
      if (ttsCache.has(cacheKey)) {
        return ttsCache.get(cacheKey)!;
      }

      const buffer = await fetchCambAiAudio(processedText, numericVoiceId, language, speechModel, apiKey);
      const base64Audio = buffer.toString("base64");

      // Store in LRU cache
      if (ttsCache.size >= MAX_CACHE_SIZE) {
        const firstKey = ttsCache.keys().next().value;
        if (firstKey) ttsCache.delete(firstKey);
      }
      ttsCache.set(cacheKey, base64Audio);

      return base64Audio;
    });

    inFlightMap.set(cacheKey, jobPromise);
    try {
      const base64Audio = await jobPromise;
      return NextResponse.json({ audioContent: base64Audio });
    } catch (err: any) {
      return NextResponse.json({ error: err.message || "Camb AI synthesis failed" }, { status: 500 });
    } finally {
      inFlightMap.delete(cacheKey);
    }
  } catch (err: any) {
    console.error("[TTS API Router Catch]:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const text = searchParams.get("text");
    const voiceId = searchParams.get("voiceId") || searchParams.get("voice_id") || "147320";
    const language = searchParams.get("language") || searchParams.get("lang") || "en-us";
    const speechModel = searchParams.get("speechModel") || searchParams.get("speech_model") || "mars-8.1-flash-beta";

    if (!text || !text.trim()) {
      return new Response("Missing 'text' parameter", { status: 400 });
    }

    // Pad short text to prevent Camb AI 422 Unprocessable Entity errors
    let processedText = text.trim();
    if (processedText.length < 6) {
      processedText = processedText + " . . .";
    }

    const apiKey = (process.env.CAMB_API_KEY || "").trim();
    if (!apiKey) {
      return new Response("Camb AI API Key is not set in environment.", { status: 500 });
    }

    const cacheKey = `${voiceId}:${language}:${speechModel}:${processedText}`;
    let base64Audio: string;

    if (ttsCache.has(cacheKey)) {
      base64Audio = ttsCache.get(cacheKey)!;
    } else if (inFlightMap.has(cacheKey)) {
      base64Audio = await inFlightMap.get(cacheKey)!;
    } else {
      const numericVoiceId = parseInt(voiceId, 10);
      const jobPromise = enqueueCambJob(async () => {
        if (ttsCache.has(cacheKey)) {
          return ttsCache.get(cacheKey)!;
        }
        const buffer = await fetchCambAiAudio(processedText, numericVoiceId, language, speechModel, apiKey);
        const base64 = buffer.toString("base64");

        if (ttsCache.size >= MAX_CACHE_SIZE) {
          const firstKey = ttsCache.keys().next().value;
          if (firstKey) ttsCache.delete(firstKey);
        }
        ttsCache.set(cacheKey, base64);
        return base64;
      });

      inFlightMap.set(cacheKey, jobPromise);
      try {
        base64Audio = await jobPromise;
      } finally {
        inFlightMap.delete(cacheKey);
      }
    }

    const audioBuffer = Buffer.from(base64Audio, "base64");
    return new Response(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": audioBuffer.length.toString(),
        "Cache-Control": "public, max-age=86400, immutable"
      }
    });
  } catch (err: any) {
    console.error("[TTS API GET Stream Catch]:", err);
    return new Response(err.message, { status: 500 });
  }
}
