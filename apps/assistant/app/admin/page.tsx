"use client";

import { useCallback, useEffect, useState } from "react";

type Booking = {
  id: string;
  clientName: string;
  phone: string;
  petName: string | null;
  service: string;
  with: string;
  startISO: string;
  when: string;
  status: string;
};
type Slot = { iso: string; label: string; with: string };

const PRIMARY = "#2F6F6A";

export default function AdminPage() {
  const [status, setStatus] = useState<"loading" | "login" | "ready">("loading");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reschedule, setReschedule] = useState<{ id: string; service: string; slots: Slot[] } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/bookings", { cache: "no-store" });
    if (res.status === 401) {
      setStatus("login");
      return;
    }
    const json = await res.json();
    setBookings(json.data ?? []);
    setStatus("ready");
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/bookings", { cache: "no-store" })
      .then(async (res) => {
        if (!active) return;
        if (res.status === 401) {
          setStatus("login");
          return;
        }
        const json = await res.json();
        setBookings(json.data ?? []);
        setStatus("ready");
      })
      .catch(() => {
        if (active) setStatus("login");
      });
    return () => {
      active = false;
    };
  }, []);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      setPassword("");
      setStatus("loading");
      await load();
    } else {
      setLoginError("Incorrect password.");
    }
  };

  const logout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    setBookings([]);
    setStatus("login");
  };

  const cancel = async (id: string) => {
    setBusyId(id);
    await fetch(`/api/admin/bookings/${id}`, { method: "DELETE" });
    setBusyId(null);
    await load();
  };

  const openReschedule = async (b: Booking) => {
    setReschedule({ id: b.id, service: b.service, slots: [] });
    const res = await fetch(`/api/availability?service=${encodeURIComponent(b.service)}`, { cache: "no-store" });
    const json = await res.json();
    setReschedule({ id: b.id, service: b.service, slots: json.data?.slots ?? [] });
  };

  const doReschedule = async (id: string, iso: string) => {
    setBusyId(id);
    const res = await fetch(`/api/admin/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newStartISO: iso }),
    });
    setBusyId(null);
    setReschedule(null);
    if (!res.ok) alert("That time was just taken — pick another.");
    await load();
  };

  if (status === "loading") {
    return <main className="grid min-h-screen place-items-center bg-background text-muted-foreground">Loading…</main>;
  }

  if (status === "login") {
    return (
      <main className="grid min-h-screen place-items-center bg-background p-6">
        <form onSubmit={login} className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-card-foreground">Staff sign in</h1>
          <p className="mt-1 text-sm text-muted-foreground">Paws &amp; Care — booking dashboard</p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            aria-label="Password"
            className="mt-4 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/40"
          />
          {loginError && <p className="mt-2 text-xs text-danger">{loginError}</p>}
          <button type="submit" className="mt-4 h-11 w-full rounded-xl text-sm font-medium text-white transition active:scale-[0.98]" style={{ background: PRIMARY }}>
            Sign in
          </button>
          <p className="mt-3 text-center text-xs text-muted-foreground">Demo password: <code className="rounded bg-muted px-1">letmein</code> (set ADMIN_PASSWORD)</p>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b border-border bg-card px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Bookings</h1>
          <p className="text-xs text-muted-foreground">Paws &amp; Care — staff dashboard</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => void load()} className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground transition active:scale-95 hover:bg-muted hover:text-foreground">
            Refresh
          </button>
          <button onClick={logout} className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground transition active:scale-95 hover:bg-muted hover:text-foreground">
            Sign out
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-3 p-6">
        {bookings.length === 0 && (
          <p className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
            No upcoming bookings yet. Make one from the chat widget on the home page.
          </p>
        )}

        {bookings.map((b) => (
          <div key={b.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium text-card-foreground">
                  {b.clientName}
                  {b.petName ? <span className="text-muted-foreground"> · {b.petName}</span> : null}
                </p>
                <p className="text-sm text-muted-foreground">{b.service} — {b.when}</p>
                <p className="text-xs text-muted-foreground" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {b.phone} · with {b.with}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => void openReschedule(b)}
                  disabled={busyId === b.id}
                  className="rounded-lg border border-primary px-3 py-1.5 text-xs font-medium text-primary transition active:scale-95 hover:bg-primary/10 disabled:opacity-40"
                >
                  Reschedule
                </button>
                <button
                  onClick={() => void cancel(b.id)}
                  disabled={busyId === b.id}
                  className="rounded-lg border border-danger/40 px-3 py-1.5 text-xs font-medium text-danger transition active:scale-95 hover:bg-danger/10 disabled:opacity-40"
                >
                  Cancel
                </button>
              </div>
            </div>

            {reschedule?.id === b.id && (
              <div className="mt-3 rounded-xl bg-muted p-3">
                <p className="mb-2 text-xs font-medium text-muted-foreground">Pick a new time for {b.service}:</p>
                {reschedule.slots.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Loading open times…</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {reschedule.slots.map((s) => (
                      <button
                        key={s.iso}
                        onClick={() => void doReschedule(b.id, s.iso)}
                        className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs text-card-foreground transition active:scale-95 hover:border-primary"
                      >
                        {s.label}
                      </button>
                    ))}
                    <button onClick={() => setReschedule(null)} className="px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground">
                      cancel
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
