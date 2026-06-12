import type { Business, ChatMessage, Repo } from "@/lib/types";
import type { ClientContext } from "@/lib/domain/client-context";
import { loadClientContext } from "@/lib/domain/client-context";
import { dispatchTool } from "./tools";
import type { ConciergeResult, ConciergeUI } from "./types";
import { detectLanguage, t } from "@/lib/lang";

/**
 * Keyless fallback concierge — runs when ANTHROPIC_API_KEY is not set so the
 * demo is fully interactive anywhere. It answers brand questions, books visits,
 * recognizes returning clients, and localizes its own phrases (en/es/fr/de/pt/hi)
 * with voice following the language. Knowledge-base answers stay in their source
 * language here; with a Claude key, replies are fully translated (prompt.ts).
 */
export async function runFallback(
  repo: Repo,
  business: Business,
  messages: ChatMessage[],
  clientContext?: ClientContext | null,
): Promise<ConciergeResult> {
  const c = business.config;
  const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const text = lastUser.toLowerCase().trim();
  const lang = detectLanguage(lastUser);
  const services = await repo.listServices(business.id);

  // Returning-client recognition: from the session cookie, or a phone they type.
  let client = clientContext ?? null;
  const phoneMatch = lastUser.match(/(\+?\d[\d\s().-]{6,}\d)/);
  if (!client && phoneMatch) {
    client = await loadClientContext(repo, business, { phone: phoneMatch[1] });
  }
  const firstName = client?.name?.split(" ")[0];
  const petName = client?.pets?.[0]?.name;

  // Safety first, across languages: if a pet may have ingested something or shows
  // alarming symptoms, never advise — reassure + emergency line (localized).
  const DANGER =
    /(\bate\b|eaten|swallow|ingest|poison|toxic|vomit|seizure|bleeding|\bblood\b|collaps|emergency|chok|comi[oó]|trag[oó]|veneno|t[oó]xic|v[oó]mito|sangr|convuls|emergencia|mang[eé]|aval[eé]|\bvomi\b|urgence|gefressen|verschluckt|vergiftet|giftig|erbroch|erbrich|\bblut\b|notfall|krampf|खा लिया|खाया|निगल|ज़हर|उल्टी|खून|दौरा|आपातकाल)/i;
  if (DANGER.test(lastUser)) {
    return { reply: t(lang, "noAdvice", { emergency: c.emergencyLine ?? "" }), usedClaude: false };
  }

  const serviceCards = services.map((s) => ({
    name: s.name,
    price: s.priceCents != null ? `$${(s.priceCents / 100).toFixed(0)}` : null,
    durationMin: s.durationMin,
    description: s.description ?? null,
  }));
  const servicesUI: ConciergeUI = { kind: "services", services: serviceCards };

  // "When is my appointment?" — answer from their record if we know them.
  if (
    /\b(my|our)\b.*\b(appointment|booking|visit|reservation)\b/.test(text) ||
    /when('?s| is) my\b/.test(text) ||
    /(mi (cita|reserva)|mon rendez|mein termin|minha (consulta|reserva)|meu agendamento|मेरी अपॉइंटमेंट)/.test(text)
  ) {
    if (client?.upcoming) {
      return { reply: t(lang, "upcoming", { service: client.upcoming.service, when: client.upcoming.when, first: firstName }), usedClaude: false };
    }
    if (!client) {
      return { reply: t(lang, "askPhone"), usedClaude: false };
    }
  }

  // Greeting / empty (startsWith — works for non-Latin scripts where \b fails)
  const GREETINGS = ["hi", "hello", "hey", "good morning", "good afternoon", "good evening", "yo", "hola", "bonjour", "hallo", "guten tag", "ola", "olá", "namaste", "नमस्ते", "ciao"];
  if (!text || (text.length < 30 && GREETINGS.some((g) => text.startsWith(g)))) {
    const reply = client
      ? t(lang, "greetingReturning", { first: firstName, petQ: petName ? t(lang, "petQ", { pet: petName }) : "" })
      : t(lang, "greetingNew", { assistant: c.assistantName, business: business.name });
    return { reply, usedClaude: false };
  }

  // Booking intent or a named service
  const service =
    services.find((s) => text.includes(s.name.toLowerCase())) ??
    services.find((s) => s.name.toLowerCase().split(/\s+/).some((w) => w.length > 3 && text.includes(w)));
  const bookingIntent =
    /(book|appoint|schedul|reserv|availab|slot|opening|come in|see (the |a )?(vet|doctor|dr)|cita|reservar|agendar|marcar|rendez|termin|buchen|बुक|अपॉइंटमेंट)/.test(text);

  if (bookingIntent || service) {
    if (!service) {
      return { reply: t(lang, "askWhichService"), ui: servicesUI, usedClaude: false };
    }
    const res = await dispatchTool(repo, business, "check_availability", { service_name: service.name });
    const slots = ((res.data as { slots?: { iso: string; label: string; with: string }[] })?.slots) ?? [];
    if (!slots.length) {
      return { reply: t(lang, "noOpenings", { service: service.name }), usedClaude: false };
    }
    return {
      reply: t(lang, "slotsLead", { service: service.name }),
      ui: { kind: "slots", service: service.name, slots },
      usedClaude: false,
    };
  }

  // Brand / concierge question (knowledge base)
  const res = await dispatchTool(repo, business, "lookup_knowledge", { query: lastUser });
  if (res.status === "success") {
    const meta = (res.data as { metadata?: Record<string, unknown> }[] | undefined)?.[0]?.metadata;
    if (meta && (meta as { urgent?: boolean }).urgent) {
      return { reply: t(lang, "noAdvice", { emergency: c.emergencyLine ?? "" }), usedClaude: false };
    }
    return { reply: String(res.summary), usedClaude: false };
  }

  // Warm catch-all
  return { reply: t(lang, "catchAll"), ui: servicesUI, usedClaude: false };
}
