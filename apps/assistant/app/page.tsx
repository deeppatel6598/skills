import ChatWidget from "./components/ChatWidget";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-[#f4f8f7] via-white to-[#fbf6ec]">
      <div className="mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-6 py-12 lg:grid-cols-2">
        <section className="order-2 lg:order-1">
          <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#2F6F6A]/10 px-3 py-1 text-xs font-medium text-[#2F6F6A]">
            🐾 AI voice &amp; chat concierge
          </p>
          <h1 className="text-balance text-4xl font-semibold tracking-tight text-neutral-900 sm:text-5xl">
            A warm, human-sounding assistant for every booking business.
          </h1>
          <p className="mt-4 max-w-md text-pretty text-neutral-600">
            Meet <strong>Sofia</strong> — she answers everything about the clinic
            (location, hours, facilities, services, pricing) and books appointments
            by chat or voice, in a soft, caring tone. Try her on the right — tap the
            mic and just talk, or type a question.
          </p>
          <ul className="mt-6 space-y-2 text-sm text-neutral-600">
            <li>✓ Full brand concierge — not a scripted FAQ bot</li>
            <li>✓ Books, reschedules, cancels — never double-books</li>
            <li>✓ Soft-spoken voice that sounds like a real person</li>
            <li>✓ Multi-tenant: configure it for any business</li>
          </ul>
          <p className="mt-6 max-w-md text-xs text-neutral-400">
            Demo runs with zero setup using an in-memory clinic. Add an
            <code className="mx-1 rounded bg-neutral-100 px-1">ANTHROPIC_API_KEY</code>
            for the full natural conversation, and a
            <code className="mx-1 rounded bg-neutral-100 px-1">DATABASE_URL</code>
            for Postgres persistence.
          </p>
        </section>

        <section className="order-1 flex justify-center lg:order-2">
          <ChatWidget />
        </section>
      </div>
    </main>
  );
}
