"use client";

import { useState } from "react";

type State = "idle" | "sending" | "sent" | "error";

const field =
  "h-11 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/40";

export function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState("");

  const valid = name.trim().length > 1 && /\S+@\S+\.\S+/.test(email) && message.trim().length > 4;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || state === "sending") return;
    setState("sending");
    setError("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error?.message ?? "Could not send your message.");
      }
      setState("sent");
      setName("");
      setEmail("");
      setMessage("");
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  };

  if (state === "sent") {
    return (
      <div className="rounded-2xl border border-border bg-card p-6">
        <p className="font-medium text-card-foreground">Thanks — we&apos;ve got your message. 🐾</p>
        <p className="mt-1 text-sm text-muted-foreground">A team member will get back to you shortly.</p>
        <button
          onClick={() => setState("idle")}
          className="mt-4 rounded-xl border border-border px-4 py-2 text-sm text-foreground transition hover:bg-muted active:scale-95"
        >
          Send another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-border bg-card p-6">
      <div>
        <label htmlFor="c-name" className="mb-1 block text-sm font-medium text-card-foreground">Name</label>
        <input id="c-name" value={name} onChange={(e) => setName(e.target.value)} className={field} placeholder="Your name" autoComplete="name" />
      </div>
      <div>
        <label htmlFor="c-email" className="mb-1 block text-sm font-medium text-card-foreground">Email</label>
        <input id="c-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} placeholder="you@example.com" autoComplete="email" inputMode="email" />
      </div>
      <div>
        <label htmlFor="c-message" className="mb-1 block text-sm font-medium text-card-foreground">Message</label>
        <textarea id="c-message" value={message} onChange={(e) => setMessage(e.target.value)} rows={5} className={`${field} h-auto py-2`} placeholder="How can we help you and your pet?" />
      </div>
      {state === "error" && <p className="text-sm text-danger">{error}</p>}
      <button
        type="submit"
        disabled={!valid || state === "sending"}
        className="h-11 w-full rounded-xl bg-primary text-sm font-medium text-primary-foreground transition hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {state === "sending" ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
