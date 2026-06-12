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
    return <main className="grid min-h-screen place-items-center text-neutral-400">Loading…</main>;
  }

  if (status === "login") {
    return (
      <main className="grid min-h-screen place-items-center bg-neutral-50 p-6">
        <form onSubmit={login} className="w-full max-w-sm rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-neutral-800">Staff sign in</h1>
          <p className="mt-1 text-sm text-neutral-500">Paws &amp; Care — booking dashboard</p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            aria-label="Password"
            className="mt-4 h-11 w-full rounded-xl border border-black/10 px-3 text-sm outline-none focus:border-[#2F6F6A]"
          />
          {loginError && <p className="mt-2 text-xs text-red-600">{loginError}</p>}
          <button type="submit" className="mt-4 h-11 w-full rounded-xl text-sm font-medium text-white transition active:scale-[0.98]" style={{ background: PRIMARY }}>
            Sign in
          </button>
          <p className="mt-3 text-center text-xs text-neutral-400">Demo password: <code>letmein</code> (set ADMIN_PASSWORD)</p>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-50">
      <header className="flex items-center justify-between border-b border-black/10 bg-white px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold text-neutral-900">Bookings</h1>
          <p className="text-xs text-neutral-500">Paws &amp; Care — staff dashboard</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => void load()} className="rounded-lg border border-black/10 px-3 py-1.5 text-sm text-neutral-600 transition active:scale-95 hover:bg-neutral-100">
            Refresh
          </button>
          <button onClick={logout} className="rounded-lg border border-black/10 px-3 py-1.5 text-sm text-neutral-600 transition active:scale-95 hover:bg-neutral-100">
            Sign out
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-3 p-6">
        {bookings.length === 0 && (
          <p className="rounded-2xl border border-dashed border-black/15 bg-white p-8 text-center text-sm text-neutral-400">
            No upcoming bookings yet. Make one from the chat widget on the home page.
          </p>
        )}

        {bookings.map((b) => (
          <div key={b.id} className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium text-neutral-900">
                  {b.clientName}
                  {b.petName ? <span className="text-neutral-500"> · {b.petName}</span> : null}
                </p>
                <p className="text-sm text-neutral-600">{b.service} — {b.when}</p>
                <p className="text-xs text-neutral-400" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {b.phone} · with {b.with}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => void openReschedule(b)}
                  disabled={busyId === b.id}
                  className="rounded-lg border px-3 py-1.5 text-xs font-medium transition active:scale-95 disabled:opacity-40"
                  style={{ borderColor: PRIMARY, color: PRIMARY }}
                >
                  Reschedule
                </button>
                <button
                  onClick={() => void cancel(b.id)}
                  disabled={busyId === b.id}
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition active:scale-95 hover:bg-red-50 disabled:opacity-40"
                >
                  Cancel
                </button>
              </div>
            </div>

            {reschedule?.id === b.id && (
              <div className="mt-3 rounded-xl bg-neutral-50 p-3">
                <p className="mb-2 text-xs font-medium text-neutral-600">Pick a new time for {b.service}:</p>
                {reschedule.slots.length === 0 ? (
                  <p className="text-xs text-neutral-400">Loading open times…</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {reschedule.slots.map((s) => (
                      <button
                        key={s.iso}
                        onClick={() => void doReschedule(b.id, s.iso)}
                        className="rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-xs transition active:scale-95 hover:border-[#2F6F6A]"
                      >
                        {s.label}
                      </button>
                    ))}
                    <button onClick={() => setReschedule(null)} className="px-2 py-1.5 text-xs text-neutral-400 hover:text-neutral-600">
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
