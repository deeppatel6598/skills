# Sofia — AI Voice & Chat Booking Concierge

A multi-tenant **AI voice + chat concierge and booking assistant** for any
booking-type business, launching with a veterinary clinic ("Paws & Care"). The
assistant answers **everything about the brand** — location, directions, hours,
facilities, services, pricing, policies, team — and **books / reschedules /
cancels appointments** by chat or voice, in a warm, soft-spoken, human voice.

Built with Next.js 16 (App Router) · TypeScript · Prisma · PostgreSQL · the
Anthropic Claude API. See the full design in
[`/root/.claude/plans/now-i-give-all-stateless-pudding.md`](../../) and the
implementation notes below.

## Run it (zero setup)

```bash
npm install
npm run dev          # http://localhost:3000
```

Out of the box it runs with **no API keys and no database**:
- an **in-memory** seed of the Paws & Care clinic (`lib/repo/memory.ts`),
- a **keyless fallback concierge** that answers brand questions and books visits,
- **browser voice** via the Web Speech API (tap the mic, or 🔊 to hear replies).

Add capabilities by setting env vars (copy `.env.example` → `.env.local`):
- `ANTHROPIC_API_KEY` → full natural, tool-using conversation (Claude).
- `DATABASE_URL` → Postgres persistence (`npm run db:push && npm run seed`).
- `ELEVENLABS_API_KEY` → the warm, human production voice (see the plan).

**Staff dashboard:** visit `/admin` (demo password `letmein`, set via
`ADMIN_PASSWORD`) to view, reschedule, and cancel bookings.

## Verify

```bash
npm test          # domain + concierge unit tests (Vitest)
npm run lint
npm run build
```

The tests cover the highest-risk logic: conflict-free availability, **no
double-booking under concurrency**, reschedule/cancel, and the keyless
concierge (brand answers, slot offers, the no-medical-advice guardrail).

## Architecture

```
app/
  page.tsx                 Landing + embedded widget
  admin/page.tsx           Staff dashboard (sign in, view/reschedule/cancel)
  components/ChatWidget.tsx Chat + voice UI (mic STT, persona TTS, slot chips, booking form)
  api/
    chat/        POST  one concierge turn (Claude tool-loop or fallback)
    availability GET   real open slots for a service
    bookings/    POST  structured, conflict-free booking
    business/    GET   tenant meta (persona, branding, services)
    admin/       login/logout + GET bookings + PATCH/DELETE :id (cookie-guarded)
lib/
  types.ts                 Domain types + the Repo port (hexagonal)
  domain/                  availability, booking, time — pure & unit-tested
  repo/                    memory (demo) + prisma (Postgres) implementations
  ai/                      tools (agent-harness shape), prompt, concierge loop, fallback
  voice/webspeech.ts       browser STT + persona-tuned warm TTS
prisma/
  schema.prisma            multi-tenant schema
  constraints.sql          overlap-exclusion constraint (race-proof bookings)
  seed.ts                  seeds the clinic into Postgres
```

**Key guarantees**
- Availability and bookings come **only** from the domain/DB — never invented by
  the model. The model acts solely through typed tools.
- Bookings can't double-book: the in-memory repo guards overlaps, and Postgres
  enforces a `tstzrange` **exclusion constraint** (`prisma/constraints.sql`).
- The assistant **never gives medical advice** — it reassures, then books the
  soonest visit or shares the emergency line.

## Built reusing the repo's skills

Patterns came from the skills in this monorepo (`ecc/`, `superpowers/`):
`agent-harness-construction` (tool shape), `api-design`, `prisma-patterns`,
`postgres-patterns` (exclusion constraint), `security-review`,
`make-interfaces-feel-better` + `motion`/`react-patterns` (widget polish), and
`test-driven-development` for the booking core.

## Roadmap (fast-follows)

Google Calendar sync. See the plan for the full phased roadmap.

**Done:** booking domain · AI concierge (Claude + keyless fallback) · chat+voice
widget · ElevenLabs production voice (Web Speech fallback) · staff admin
dashboard · returning-client memory · multilingual (en/es/fr/de/pt/hi, voice
follows the language, safety line localized) · light/dark theming + About/Contact
pages · security hardening (CSP, headers, rate limiting, fail-closed secrets) ·
**email** — confirmation on booking, contact-form notifications, and a
reminder cron endpoint, via Resend with a keyless console-outbox fallback.
