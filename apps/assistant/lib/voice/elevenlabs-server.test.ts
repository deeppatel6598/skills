import { describe, expect, it } from "vitest";
import { buildElevenLabsRequest, DEFAULT_VOICE_ID } from "@/lib/voice/elevenlabs-server";

describe("ElevenLabs request builder", () => {
  it("targets the streaming endpoint with the default (or given) voice", () => {
    const req = buildElevenLabsRequest({ text: "Hello there" });
    expect(req.url).toContain(`/text-to-speech/${DEFAULT_VOICE_ID}/stream`);
    expect(req.url).toContain("output_format=mp3");

    const custom = buildElevenLabsRequest({ text: "hi", voiceId: "abc123" });
    expect(custom.url).toContain("/text-to-speech/abc123/stream");
  });

  it("sends warm, soft, unhurried voice settings", () => {
    const body = JSON.parse(buildElevenLabsRequest({ text: "How's Bella?" }).body);
    expect(body.text).toBe("How's Bella?");
    expect(body.model_id).toBeTruthy();
    expect(body.voice_settings.stability).toBeGreaterThanOrEqual(0.5); // steady
    expect(body.voice_settings.speed).toBeLessThanOrEqual(1); // not rushed
    expect(body.voice_settings.style).toBeLessThanOrEqual(0.3); // gentle, not performative
  });

  it("includes the api key header", () => {
    const req = buildElevenLabsRequest({ text: "hi" });
    expect(req.headers).toHaveProperty("xi-api-key");
    expect(req.headers["Content-Type"]).toBe("application/json");
  });
});
