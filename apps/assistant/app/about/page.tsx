import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav } from "../components/SiteNav";

export const metadata: Metadata = {
  title: "About — Paws & Care AI Concierge",
  description: "How our warm, human-sounding AI assistant helps clients and clinics.",
};

const steps = [
  { n: "1", title: "Ask anything", body: "Clients ask about hours, location, facilities, services or pricing — by chat or voice, in their own language." },
  { n: "2", title: "Book in seconds", body: "Sofia offers real open times and books, reschedules, or cancels — never double-booking a vet." },
  { n: "3", title: "Feel cared for", body: "A soft-spoken voice greets returning clients by name and remembers their pet and next visit." },
];

const features = [
  { title: "Full brand concierge", body: "Answers everything about the business from a managed knowledge base — not a fixed FAQ list." },
  { title: "Conflict-free booking", body: "A database exclusion constraint guarantees two appointments can never overlap, even under load." },
  { title: "Warm, human voice", body: "Production voice via ElevenLabs, with a built-in browser fallback so it works anywhere." },
  { title: "Multilingual", body: "Detects the client's language and replies in it, with the safety guidance localized too." },
  { title: "Safety first", body: "Never gives medical advice — it reassures, then books the soonest visit or shares the emergency line." },
  { title: "Multi-tenant", body: "Configure the business profile, services, hours and brand voice for any booking business." },
];

export default function AboutPage() {
  return (
    <>
      <SiteNav />
      <main className="bg-background">
        <div className="mx-auto max-w-4xl px-6 py-14">
          <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            About
          </p>
          <h1 className="text-balance text-4xl font-semibold tracking-tight text-foreground">
            A caring front desk that never sleeps.
          </h1>
          <p className="mt-4 max-w-2xl text-pretty text-muted-foreground">
            Paws &amp; Care&apos;s assistant, Sofia, is built to feel like a real, warm
            person at the front desk — answering questions and booking appointments
            for worried pet owners, day or night, in their language.
          </p>

          <h2 className="mt-12 text-xl font-semibold text-foreground">How it works</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {steps.map((s) => (
              <div key={s.n} className="rounded-2xl border border-border bg-card p-5">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
                  {s.n}
                </div>
                <h3 className="mt-3 font-medium text-card-foreground">{s.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
              </div>
            ))}
          </div>

          <h2 className="mt-12 text-xl font-semibold text-foreground">What makes it good</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {features.map((f) => (
              <div key={f.title} className="rounded-2xl border border-border bg-card p-5">
                <h3 className="font-medium text-card-foreground">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 flex flex-wrap gap-3">
            <Link href="/" className="rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 active:scale-95">
              Try the assistant
            </Link>
            <Link href="/contact" className="rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-foreground transition hover:bg-muted active:scale-95">
              Contact us
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
