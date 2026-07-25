import "@/lib/dns-fix";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

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

    const apiKey = (process.env.CAMB_API_KEY || "").trim();

    if (!apiKey) {
      return NextResponse.json({ error: "Camb AI API Key is not set in environment." }, { status: 500 });
    }

    console.log(`[TTS API] Calling Camb AI TTS stream for text: "${processedText.substring(0, 30)}..."`);
    const response = await fetch("https://client.camb.ai/apis/tts-stream", {
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

    if (!response.ok) {
      const errText = await response.text();
      console.error("[Camb AI API Error]:", errText);
      return NextResponse.json({ 
        error: errText || "Camb AI TTS synthesis failed."
      }, { status: response.status });
    }

    // Convert raw binary audio stream to base64
    const audioBuffer = await response.arrayBuffer();
    if (!audioBuffer || audioBuffer.byteLength === 0) {
      console.warn("[Camb AI API]: Received empty audio buffer (0 bytes)");
      return NextResponse.json({ error: "Empty audio stream returned from Camb AI" }, { status: 422 });
    }

    const base64Audio = Buffer.from(audioBuffer).toString("base64");
    return NextResponse.json({ audioContent: base64Audio });
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

    console.log(`[TTS API GET Stream] Calling Camb AI TTS for text: "${processedText.substring(0, 30)}..."`);
    const response = await fetch("https://client.camb.ai/apis/tts-stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey
      },
      body: JSON.stringify({
        text: processedText,
        voice_id: parseInt(voiceId, 10),
        language,
        speech_model: speechModel
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[Camb AI API Stream Error]:", errText);
      return new Response(errText || "Camb AI TTS synthesis failed.", { status: response.status });
    }

    // Stream the audio response directly to the browser
    return new Response(response.body, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Transfer-Encoding": "chunked",
        "Cache-Control": "no-cache"
      }
    });
  } catch (err: any) {
    console.error("[TTS API GET Stream Catch]:", err);
    return new Response(err.message, { status: 500 });
  }
}
