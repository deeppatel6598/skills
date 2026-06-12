import ChatWidget from "./components/ChatWidget";
import { SiteNav } from "./components/SiteNav";

const points = [
  "Full brand concierge — not a scripted FAQ bot",
  "Books, reschedules, cancels — never double-books",
  "Soft-spoken voice that sounds like a real person",
  "Speaks the client's language, by chat or voice",
];

export default function Home() {
  return (
    <>
      <SiteNav />
      <main className="bg-background">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-12 lg:grid-cols-2">
          <section className="order-2 lg:order-1">
            <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              🐾 AI voice &amp; chat concierge
            </p>
            <h1 className="text-balance text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              A warm, human-sounding assistant for every booking business.
            </h1>
            <p className="mt-4 max-w-md text-pretty text-muted-foreground">
              Meet <strong className="text-foreground">Sofia</strong> — she answers
              everything about the clinic (location, hours, facilities, services,
              pricing) and books appointments by chat or voice, in a soft, caring
              tone. Try her on the right — tap the mic and just talk, or type a question.
            </p>
            <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
              {points.map((p) => (
                <li key={p} className="flex gap-2">
                  <span className="text-primary" aria-hidden="true">✓</span>
                  {p}
                </li>
              ))}
            </ul>
            <p className="mt-6 max-w-md text-xs text-muted-foreground">
              Demo runs with zero setup using an in-memory clinic. Add an
              <code className="mx-1 rounded bg-muted px-1 text-foreground">ANTHROPIC_API_KEY</code>
              for the full natural conversation, and a
              <code className="mx-1 rounded bg-muted px-1 text-foreground">DATABASE_URL</code>
              for Postgres persistence.
            </p>
          </section>

          <section className="order-1 flex justify-center lg:order-2">
            <ChatWidget />
          </section>
        </div>
      </main>
    </>
  );
}
