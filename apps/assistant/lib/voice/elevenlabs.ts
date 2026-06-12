/**
 * Client-side ElevenLabs playback: POST the text to our /api/tts proxy, play the
 * returned mp3. A single Audio element is reused so we can stop it for barge-in.
 */
let current: HTMLAudioElement | null = null;
let currentUrl: string | null = null;

export function stopElevenLabs(): void {
  if (current) {
    current.pause();
    current.src = "";
    current = null;
  }
  if (currentUrl) {
    URL.revokeObjectURL(currentUrl);
    currentUrl = null;
  }
}

/** Throws if TTS is unavailable (e.g. 501 no key) so the caller can fall back. */
export async function speakElevenLabs(
  text: string,
  opts?: { onStart?: () => void; onEnd?: () => void },
): Promise<void> {
  stopElevenLabs();
  const res = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`tts unavailable: ${res.status}`);

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  current = audio;
  currentUrl = url;

  audio.onplay = () => opts?.onStart?.();
  audio.onended = () => {
    opts?.onEnd?.();
    if (current === audio) stopElevenLabs();
  };
  audio.onerror = () => opts?.onEnd?.();
  await audio.play();
}
