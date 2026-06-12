/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Browser voice layer using the Web Speech API — zero external keys, so the
 * "talk to her" demo works anywhere. The persona settings (slower rate, gentle
 * pitch, warm female voice preference) are what make it sound human rather than
 * robotic. Production swaps `speak()` for ElevenLabs streaming behind the same
 * interface (see the plan's Voice & persona section).
 */

export interface PersonaTTS {
  provider: string;
  rate: number;
  pitch: number;
  preferVoiceNames?: string[];
}

export function speechSupported(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
}

export function ttsSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function createRecognizer(opts: {
  onResult: (text: string, isFinal: boolean) => void;
  onEnd: () => void;
  onError?: (e: unknown) => void;
  lang?: string;
}): { start: () => void; stop: () => void } | null {
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SR) return null;
  const rec = new SR();
  rec.lang = opts.lang || "en-US";
  rec.interimResults = true;
  rec.continuous = false;
  rec.maxAlternatives = 1;
  rec.onresult = (e: any) => {
    const r = e.results[e.results.length - 1];
    opts.onResult(String(r[0].transcript), Boolean(r.isFinal));
  };
  rec.onend = () => opts.onEnd();
  rec.onerror = (e: any) => opts.onError?.(e);
  return {
    start: () => {
      try {
        rec.start();
      } catch {
        /* already started */
      }
    },
    stop: () => {
      try {
        rec.stop();
      } catch {
        /* noop */
      }
    },
  };
}

let voicesCache: SpeechSynthesisVoice[] = [];

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    const synth = window.speechSynthesis;
    const existing = synth.getVoices();
    if (existing.length) {
      voicesCache = existing;
      resolve(existing);
      return;
    }
    const handler = () => {
      voicesCache = synth.getVoices();
      resolve(voicesCache);
    };
    synth.onvoiceschanged = handler;
    // Safety timeout in case the event never fires.
    setTimeout(() => resolve(synth.getVoices()), 500);
  });
}

function pickVoice(voices: SpeechSynthesisVoice[], persona: PersonaTTS): SpeechSynthesisVoice | undefined {
  const prefs = persona.preferVoiceNames ?? [];
  return (
    voices.find((v) => prefs.some((p) => v.name.toLowerCase().includes(p.toLowerCase()))) ??
    voices.find((v) => /female|samantha|aria|jenny|victoria|karen|serena|zira/i.test(v.name)) ??
    voices.find((v) => v.lang.toLowerCase().startsWith("en"))
  );
}

/** Speak text with the warm persona. `onBoundary` lets the UI show a speaking state. */
export async function speak(
  text: string,
  persona: PersonaTTS,
  hooks?: { onStart?: () => void; onEnd?: () => void },
): Promise<void> {
  if (!ttsSupported() || !text.trim()) return;
  const synth = window.speechSynthesis;
  synth.cancel(); // barge-in: stop anything already speaking
  const voices = voicesCache.length ? voicesCache : await loadVoices();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = persona.rate ?? 0.95;
  u.pitch = persona.pitch ?? 1.0;
  const voice = pickVoice(voices, persona);
  if (voice) u.voice = voice;
  u.onstart = () => hooks?.onStart?.();
  u.onend = () => hooks?.onEnd?.();
  synth.speak(u);
}

export function stopSpeaking(): void {
  if (ttsSupported()) window.speechSynthesis.cancel();
}
