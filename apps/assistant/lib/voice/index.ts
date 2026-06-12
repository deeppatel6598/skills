/**
 * Unified voice layer for the widget. Speaking prefers ElevenLabs (warm, human,
 * production voice) when the server has a key, and automatically falls back to
 * the browser Web Speech voice otherwise (or if a synth call fails).
 */
import { speak, stopSpeaking, type PersonaTTS } from "./webspeech";
import { speakElevenLabs, stopElevenLabs } from "./elevenlabs";

export {
  createRecognizer,
  speechSupported,
  ttsSupported,
  type PersonaTTS,
} from "./webspeech";

export type VoiceProvider = "elevenlabs" | "webspeech";

export interface SpeakOpts {
  persona: PersonaTTS;
  lang: string;
  provider: VoiceProvider;
  onStart?: () => void;
  onEnd?: () => void;
}

/** Speak an assistant reply with the best available voice for this deployment. */
export async function speakReply(text: string, opts: SpeakOpts): Promise<void> {
  if (!text.trim()) return;
  stopAllSpeech(); // barge-in
  if (opts.provider === "elevenlabs") {
    try {
      await speakElevenLabs(text, { onStart: opts.onStart, onEnd: opts.onEnd });
      return;
    } catch {
      // fall through to Web Speech
    }
  }
  await speak(text, opts.persona, { lang: opts.lang, onStart: opts.onStart, onEnd: opts.onEnd });
}

/** Stop any speech from any provider. */
export function stopAllSpeech(): void {
  stopSpeaking();
  stopElevenLabs();
}
