/**
 * Server-side ElevenLabs TTS request builder. Synthesis happens on the server so
 * the API key is never exposed. Voice settings are tuned for the persona: a warm,
 * soft, unhurried delivery — not a peppy "AI" read. `eleven_turbo_v2_5` is
 * low-latency and multilingual, so it follows the conversation language.
 */

// ElevenLabs "Sarah" — a soft, warm female voice. Override with ELEVENLABS_VOICE_ID.
export const DEFAULT_VOICE_ID = "EXAVITQu4vr4xnSDxMaL";

export function elevenLabsConfigured(): boolean {
  return Boolean(process.env.ELEVENLABS_API_KEY);
}

export interface ElevenRequest {
  url: string;
  headers: Record<string, string>;
  body: string;
}

export function buildElevenLabsRequest(opts: { text: string; voiceId?: string }): ElevenRequest {
  const voiceId = opts.voiceId || process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;
  const model = process.env.ELEVENLABS_MODEL || "eleven_turbo_v2_5";
  return {
    url: `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?output_format=mp3_44100_128`,
    headers: {
      "xi-api-key": process.env.ELEVENLABS_API_KEY ?? "",
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text: opts.text,
      model_id: model,
      // Warm + soft + steady: higher stability, low style, slightly slower speed.
      voice_settings: {
        stability: 0.55,
        similarity_boost: 0.75,
        style: 0.15,
        use_speaker_boost: true,
        speed: 0.95,
      },
    }),
  };
}
