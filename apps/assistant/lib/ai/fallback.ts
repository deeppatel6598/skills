import type { Business, ChatMessage, Repo } from "@/lib/types";
import type { ClientContext } from "@/lib/domain/client-context";
import { loadClientContext } from "@/lib/domain/client-context";
import { dispatchTool } from "./tools";
import type { ConciergeResult, ConciergeUI } from "./types";

/**
 * Keyless fallback concierge — runs when ANTHROPIC_API_KEY is not set so the
 * demo is fully interactive anywhere. It answers any brand question via
 * lookup_knowledge and starts the booking flow by offering real open slots.
 * (With a Claude key, the natural multi-turn booking conversation takes over.)
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
  const services = await repo.listServices(business.id);

  // Returning-client recognition: from the session cookie, or a phone they type.
  let client = clientContext ?? null;
  const phoneMatch = lastUser.match(/(\+?\d[\d\s().-]{6,}\d)/);
  if (!client && phoneMatch) {
    client = await loadClientContext(repo, business, { phone: phoneMatch[1] });
  }
  const firstName = client?.name?.split(" ")[0];
  const petName = client?.pets?.[0]?.name;

  // "When is my appointment?" — answer from their record if we know them.
  if (/\b(my|our)\b.*\b(appointment|booking|visit|reservation)\b/.test(text) || /when('?s| is) my\b/.test(text)) {
    if (client?.upcoming) {
      return { reply: `You're booked for a ${client.upcoming.service} on ${client.upcoming.when}, ${firstName}. Shall I help with anything else?`, usedClaude: false };
    }
    if (!client) {
      return { reply: "I can check that for you — what's the phone number on the booking?", usedClaude: false };
    }
  }

  const serviceCards = services.map((s) => ({
    name: s.name,
    price: s.priceCents != null ? `$${(s.priceCents / 100).toFixed(0)}` : null,
    durationMin: s.durationMin,
    description: s.description ?? null,
  }));
  const servicesUI: ConciergeUI = { kind: "services", services: serviceCards };

  // Greeting / empty
  if (!text || (/^(hi|hello|hey|good (morning|afternoon|evening)|yo)\b/.test(text) && text.length < 28)) {
    const greeting = client
      ? `Welcome back, ${firstName}! ${petName ? `How's ${petName}? ` : ""}What can I help you with today?`
      : `Hi there — I'm ${c.assistantName} at ${business.name}. How can I help you and your pet today? I can answer questions or book a visit.`;
    return { reply: greeting, usedClaude: false };
  }

  // Try to detect a named service anywhere in the message
  const service =
    services.find((s) => text.includes(s.name.toLowerCase())) ??
    services.find((s) => s.name.toLowerCase().split(/\s+/).some((w) => w.length > 3 && text.includes(w)));

  const bookingIntent = /(book|appoint|schedul|reserv|availab|slot|opening|come in|bring (her|him|them|my)|see (the |a )?(vet|doctor|dr))/.test(text);

  if (bookingIntent || service) {
    if (!service) {
      return {
        reply: "Of course — I'd be glad to help you book. Which of these would you like?",
        ui: servicesUI,
        usedClaude: false,
      };
    }
    const res = await dispatchTool(repo, business, "check_availability", { service_name: service.name });
    const slots = ((res.data as { slots?: { iso: string; label: string; with: string }[] })?.slots) ?? [];
    if (!slots.length) {
      return {
        reply: `I'm so sorry — I don't see any openings for a ${service.name.toLowerCase()} just now. Would you like me to take a message for the team?`,
        usedClaude: false,
      };
    }
    return {
      reply: `Lovely — here are the next open times for a ${service.name.toLowerCase()}. Which one suits you best?`,
      ui: { kind: "slots", service: service.name, slots },
      usedClaude: false,
    };
  }

  // Knowledge / concierge question
  const res = await dispatchTool(repo, business, "lookup_knowledge", { query: lastUser });
  if (res.status === "success") {
    const meta = (res.data as { metadata?: Record<string, unknown> }[] | undefined)?.[0]?.metadata;
    const urgent = meta && (meta as { urgent?: boolean }).urgent;
    return {
      reply: String(res.summary),
      ui: urgent && c.emergencyLine ? undefined : undefined,
      usedClaude: false,
    };
  }

  // Nothing matched — warm catch-all
  return {
    reply: "I want to make sure I get this right for you — I can share our hours, location, services and pricing, or book a visit. What would help most?",
    ui: servicesUI,
    usedClaude: false,
  };
}
