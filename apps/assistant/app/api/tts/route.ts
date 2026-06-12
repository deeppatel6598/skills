import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { buildElevenLabsRequest, elevenLabsConfigured } from "@/lib/voice/elevenlabs-server";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ text: z.string().min(1).max(2000) });

/**
 * POST /api/tts — synthesize speech via ElevenLabs and stream mp3 back.
 * Returns 501 when no key is configured so the browser falls back to Web Speech.
 */
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { name: "tts", limit: 40, windowMs: 60_000 });
  if (limited) return limited;

  if (!elevenLabsConfigured()) {
    return NextResponse.json({ error: { code: "tts_unavailable", message: "ElevenLabs not configured" } }, { status: 501 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: { code: "bad_request", message: "Invalid JSON" } }, { status: 400 });
  }
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "validation_error", message: "text required" } }, { status: 422 });
  }

  try {
    const { url, headers, body } = buildElevenLabsRequest({ text: parsed.data.text });
    const upstream = await fetch(url, { method: "POST", headers, body });
    if (!upstream.ok || !upstream.body) {
      console.error("elevenlabs error", upstream.status, await upstream.text().catch(() => ""));
      return NextResponse.json({ error: { code: "tts_failed", message: "Voice synthesis failed" } }, { status: 502 });
    }
    // Proxy the audio stream straight through to the client.
    return new Response(upstream.body, {
      status: 200,
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("tts route error", err);
    return NextResponse.json({ error: { code: "internal_error", message: "Voice synthesis failed" } }, { status: 500 });
  }
}
