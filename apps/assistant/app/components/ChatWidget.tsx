"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createRecognizer,
  speakReply,
  stopAllSpeech,
  speechSupported,
  ttsSupported,
  type PersonaTTS,
  type VoiceProvider,
} from "@/lib/voice";
import { detectLanguage, t, toBCP47 } from "@/lib/lang";

type ServiceCard = { name: string; price: string | null; durationMin: number; description: string | null };
type Slot = { iso: string; label: string; with: string };
type UI =
  | { kind: "services"; services: ServiceCard[] }
  | { kind: "slots"; service: string; slots: Slot[] }
  | { kind: "booked"; service: string; when: string; with: string; price: string | null }
  | { kind: "collect"; service?: string; startISO?: string };

type Msg = { role: "user" | "assistant"; content: string; ui?: UI | null };

interface BizMeta {
  name: string;
  assistantName: string;
  tagline?: string;
  branding: { primary: string; accent: string; bubbleEmoji?: string };
  persona: PersonaTTS & { displayName: string };
  voiceProvider: VoiceProvider;
  services: ServiceCard[];
  suggestions: string[];
  emergencyLine?: string;
}

export default function ChatWidget() {
  const [biz, setBiz] = useState<BizMeta | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceOn, setVoiceOn] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [booking, setBooking] = useState<{ service: string; startISO: string; label: string } | null>(null);
  const [returning, setReturning] = useState<{ name: string; phone: string } | null>(null);

  const recognizerRef = useRef<{ start: () => void; stop: () => void } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const voiceOnRef = useRef(voiceOn);
  useEffect(() => {
    voiceOnRef.current = voiceOn;
  }, [voiceOn]);
  const langRef = useRef("en"); // current conversation language (from the user's input)

  const primary = biz?.branding.primary ?? "#2F6F6A";
  const accent = biz?.branding.accent ?? "#E8B04B";

  useEffect(() => {
    fetch("/api/business")
      .then((r) => r.json())
      .then(({ data }: { data: BizMeta }) => {
        setBiz(data);
        const fresh = `Hi there — I'm ${data.assistantName} at ${data.name}. ${data.tagline ?? ""} How can I help you and your pet today?`;
        // Returning-client recognition (signed cookie set on a prior booking).
        fetch("/api/client/me", { cache: "no-store" })
          .then((r) => r.json())
          .then(({ data: me }) => {
            if (me?.returning) {
              const pet = me.pets?.[0]?.name as string | undefined;
              setReturning({ name: me.name, phone: me.phone });
              setMessages([
                {
                  role: "assistant",
                  content: `Welcome back, ${me.firstName}! ${pet ? `How's ${pet}? ` : ""}${me.upcoming ? `You're booked for a ${me.upcoming.service} on ${me.upcoming.when}. ` : ""}What can I help you with today?`,
                },
              ]);
            } else {
              setMessages([{ role: "assistant", content: fresh }]);
            }
          })
          .catch(() => setMessages([{ role: "assistant", content: fresh }]));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  const say = useCallback(
    (text: string) => {
      if (!voiceOnRef.current || !biz) return;
      void speakReply(text, {
        persona: biz.persona,
        lang: detectLanguage(text),
        provider: biz.voiceProvider,
        onStart: () => setSpeaking(true),
        onEnd: () => setSpeaking(false),
      });
    },
    [biz],
  );

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || sending) return;
      langRef.current = detectLanguage(trimmed); // so the mic listens in their language too
      const next: Msg[] = [...messages, { role: "user", content: trimmed }];
      setMessages(next);
      setInput("");
      setSending(true);
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: next.map((m) => ({ role: m.role, content: m.content })) }),
        });
        const json = await res.json();
        const reply: string = json?.data?.reply ?? "I'm sorry, I didn't catch that.";
        const ui: UI | null = json?.data?.ui ?? null;
        setMessages((m) => [...m, { role: "assistant", content: reply, ui }]);
        say(reply);
      } catch {
        setMessages((m) => [...m, { role: "assistant", content: "I'm having a little trouble connecting. Could you try again?" }]);
      } finally {
        setSending(false);
      }
    },
    [messages, sending, say],
  );

  const toggleMic = useCallback(() => {
    if (listening) {
      recognizerRef.current?.stop();
      setListening(false);
      return;
    }
    stopAllSpeech(); // barge-in
    const rec = createRecognizer({
      onResult: (text, isFinal) => {
        setInput(text);
        if (isFinal) {
          setListening(false);
          void send(text);
        }
      },
      onEnd: () => setListening(false),
      onError: () => setListening(false),
      lang: toBCP47(langRef.current),
    });
    if (!rec) return;
    recognizerRef.current = rec;
    setListening(true);
    rec.start();
  }, [listening, send]);

  const submitBooking = useCallback(
    async (form: { clientName: string; phone: string; email?: string; petName?: string; serviceName: string; startISO: string }) => {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (res.ok) {
        const d = json.data;
        const confirm = t(langRef.current, "booked", {
          first: form.clientName.split(" ")[0],
          service: d.service,
          when: d.when,
          withName: d.with,
        });
        setMessages((m) => [
          ...m,
          { role: "assistant", content: confirm, ui: { kind: "booked", service: d.service, when: d.when, with: d.with, price: d.price } },
        ]);
        say(confirm);
        setBooking(null);
      } else {
        const msg = json?.error?.message ?? "That time was just taken.";
        setMessages((m) => [...m, { role: "assistant", content: `Oh — ${msg} Shall we pick another time?` }]);
        setBooking(null);
      }
    },
    [say],
  );

  if (!biz) {
    return <div className="text-sm text-muted-foreground">Loading assistant…</div>;
  }

  return (
    <div
      className="relative flex h-[640px] w-full max-w-[420px] flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-[0_20px_60px_-15px_rgba(0,0,0,0.35)]"
      style={{ ["--brand" as string]: primary, ["--accent" as string]: accent }}
    >
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 text-white" style={{ background: primary }}>
        <div className="grid h-10 w-10 place-items-center rounded-full bg-white/20 text-lg">
          {biz.branding.bubbleEmoji ?? "💬"}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{biz.assistantName} · {biz.name}</p>
          <p className="truncate text-xs text-white/80">{speaking ? "speaking…" : listening ? "listening…" : "online · here to help"}</p>
        </div>
        {(ttsSupported() || biz.voiceProvider === "elevenlabs") && (
          <button
            onClick={() => {
              if (voiceOn) stopAllSpeech();
              setVoiceOn((v) => !v);
            }}
            aria-pressed={voiceOn}
            aria-label={voiceOn ? "Turn voice off" : "Turn voice on"}
            title={voiceOn ? "Voice on" : "Voice off"}
            className="grid h-9 w-9 place-items-center rounded-full bg-white/15 transition active:scale-95 hover:bg-white/25"
          >
            {voiceOn ? "🔊" : "🔇"}
          </button>
        )}
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-muted px-4 py-4">
        {messages.map((m, i) => (
          <MessageRow key={i} msg={m} primary={primary} accent={accent} onSlot={(service, slot) => setBooking({ service, startISO: slot.iso, label: slot.label })} onService={(name) => void send(`I'd like to book a ${name}`)} />
        ))}
        {sending && <Typing />}
      </div>

      {/* Suggestions (only before the user has spoken) */}
      {messages.length <= 1 && (
        <div className="flex flex-wrap gap-2 border-t border-border bg-card px-4 py-2">
          {biz.suggestions.map((s) => (
            <button
              key={s}
              onClick={() => void send(s)}
              className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition active:scale-95 hover:border-[var(--brand)] hover:text-[var(--brand)]"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
        className="flex items-center gap-2 border-t border-border bg-card px-3 py-3"
      >
        {speechSupported() && (
          <button
            type="button"
            onClick={toggleMic}
            aria-pressed={listening}
            aria-label={listening ? "Stop listening" : "Speak"}
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-lg transition active:scale-95 ${
              listening ? "animate-pulse text-white" : "text-muted-foreground hover:bg-muted"
            }`}
            style={listening ? { background: primary } : undefined}
          >
            🎙️
          </button>
        )}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={listening ? "Listening…" : "Type or tap the mic…"}
          aria-label="Message"
          className="h-11 flex-1 rounded-full border border-input bg-background px-4 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-[var(--brand)] focus:bg-card"
        />
        <button
          type="submit"
          disabled={!input.trim() || sending}
          aria-label="Send"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-white transition active:scale-95 disabled:opacity-40"
          style={{ background: primary }}
        >
          ➤
        </button>
      </form>

      {booking && (
        <BookingForm
          primary={primary}
          service={booking.service}
          startISO={booking.startISO}
          label={booking.label}
          defaultName={returning?.name ?? ""}
          defaultPhone={returning?.phone ?? ""}
          onCancel={() => setBooking(null)}
          onSubmit={submitBooking}
        />
      )}
    </div>
  );
}

function MessageRow({
  msg,
  primary,
  accent,
  onSlot,
  onService,
}: {
  msg: Msg;
  primary: string;
  accent: string;
  onSlot: (service: string, slot: Slot) => void;
  onService: (name: string) => void;
}) {
  const isUser = msg.role === "user";
  return (
    <div className={isUser ? "flex justify-end" : "flex justify-start"}>
      <div className="max-w-[85%] space-y-2">
        <div
          className={`text-pretty rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
            isUser ? "rounded-br-md text-white" : "rounded-bl-md border border-border bg-card text-card-foreground"
          }`}
          style={isUser ? { background: primary } : undefined}
        >
          {msg.content}
        </div>
        {msg.ui?.kind === "services" && (
          <div className="flex flex-wrap gap-1.5">
            {msg.ui.services.map((s) => (
              <button
                key={s.name}
                onClick={() => onService(s.name)}
                className="rounded-xl border border-border bg-card px-2.5 py-1.5 text-left text-xs transition active:scale-95 hover:border-[color:var(--brand)]"
                title={s.description ?? undefined}
              >
                <span className="font-medium text-card-foreground">{s.name}</span>
                {s.price && <span className="ml-1 text-muted-foreground">· {s.price}</span>}
              </button>
            ))}
          </div>
        )}
        {msg.ui?.kind === "slots" && (
          <div className="flex flex-wrap gap-1.5">
            {msg.ui.slots.map((slot) => (
              <button
                key={slot.iso}
                onClick={() => onSlot(msg.ui!.kind === "slots" ? msg.ui!.service : "", slot)}
                className="rounded-xl border px-2.5 py-1.5 text-xs font-medium text-primary transition active:scale-95"
                style={{ borderColor: accent }}
              >
                {slot.label}
              </button>
            ))}
          </div>
        )}
        {msg.ui?.kind === "booked" && (
          <div className="rounded-2xl border border-border bg-card p-3 text-xs shadow-sm">
            <p className="mb-1 font-semibold text-primary">✓ Appointment confirmed</p>
            <p className="text-card-foreground">{msg.ui.service} · {msg.ui.when}</p>
            <p className="text-muted-foreground">with {msg.ui.with}{msg.ui.price ? ` · ${msg.ui.price}` : ""}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Typing() {
  return (
    <div className="flex justify-start">
      <div className="flex gap-1 rounded-2xl rounded-bl-md border border-border bg-card px-3 py-2.5">
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: `${i * 120}ms` }} />
        ))}
      </div>
    </div>
  );
}

function BookingForm({
  primary,
  service,
  startISO,
  label,
  defaultName,
  defaultPhone,
  onCancel,
  onSubmit,
}: {
  primary: string;
  service: string;
  startISO: string;
  label: string;
  defaultName: string;
  defaultPhone: string;
  onCancel: () => void;
  onSubmit: (form: { clientName: string; phone: string; email?: string; petName?: string; serviceName: string; startISO: string }) => Promise<void>;
}) {
  const [clientName, setClientName] = useState(defaultName);
  const [phone, setPhone] = useState(defaultPhone);
  const [email, setEmail] = useState("");
  const [petName, setPetName] = useState("");
  const [busy, setBusy] = useState(false);
  const valid = clientName.trim().length > 1 && phone.replace(/\D/g, "").length >= 7;

  return (
    <div className="absolute inset-0 z-10 flex items-end bg-black/30 p-3" onClick={onCancel}>
      <div className="w-full rounded-2xl border border-border bg-card p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm font-semibold text-card-foreground">Confirm your visit</p>
        <p className="mb-3 text-xs text-muted-foreground">{service} · {label}</p>
        <div className="space-y-2">
          <input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Your name" aria-label="Your name" className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-[var(--brand)]" />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number" inputMode="tel" aria-label="Phone number" className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-[var(--brand)]" />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (optional — for confirmation)" type="email" inputMode="email" aria-label="Email" className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-[var(--brand)]" />
          <input value={petName} onChange={(e) => setPetName(e.target.value)} placeholder="Pet's name (optional)" aria-label="Pet's name" className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-[var(--brand)]" />
        </div>
        <div className="mt-3 flex gap-2">
          <button onClick={onCancel} className="h-10 flex-1 rounded-xl border border-border text-sm text-foreground transition active:scale-95">
            Back
          </button>
          <button
            disabled={!valid || busy}
            onClick={async () => {
              setBusy(true);
              await onSubmit({ clientName, phone, email: email || undefined, petName: petName || undefined, serviceName: service, startISO });
              setBusy(false);
            }}
            className="h-10 flex-1 rounded-xl text-sm font-medium text-white transition active:scale-95 disabled:opacity-40"
            style={{ background: primary }}
          >
            {busy ? "Booking…" : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
