import type { Business, KnowledgeKind, Repo } from "@/lib/types";
import { ConflictError, NotFoundError } from "@/lib/types";
import { getAvailableSlots } from "@/lib/domain/availability";
import {
  bookAppointment,
  cancelUpcomingByPhone,
  rescheduleUpcomingByPhone,
} from "@/lib/domain/booking";
import { formatDateTime, formatSlotLabel } from "@/lib/domain/time";
import { loadClientContext } from "@/lib/domain/client-context";

/**
 * Tool layer for the concierge. Follows the agent-harness-construction skill:
 * stable explicit names, narrow schema-first inputs, and deterministic output
 * shapes ({ status, summary, data, next_actions }) so Claude can recover and the
 * UI can render the result. Availability and bookings come ONLY from these tools
 * (the domain + repo) — never invented by the model.
 */

export type ToolStatus = "success" | "warning" | "error";

export interface ToolResult {
  status: ToolStatus;
  summary: string;
  data?: unknown;
  next_actions?: string[];
}

const money = (cents?: number | null) =>
  cents == null ? null : `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;

/** Anthropic tool schemas (also documents the contract for the fallback path). */
export const TOOLS = [
  {
    name: "lookup_knowledge",
    description:
      "Answer any question about the business: location, directions, parking, opening hours, facilities, services, pricing, policies, the team, or general FAQs. Use this whenever the client asks about the brand.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "The client's question, paraphrased." },
        kind: {
          type: "string",
          enum: ["FAQ", "SERVICE", "FACILITY", "LOCATION", "POLICY", "TEAM", "HOURS", "PRICING", "GENERAL"],
          description: "Optional category hint.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "lookup_client",
    description:
      "Look up a returning client by phone number to personalize the conversation — returns their name, pets, and any upcoming appointment. Use when the client shares a phone or asks about 'my appointment'.",
    input_schema: {
      type: "object" as const,
      properties: { phone: { type: "string" } },
      required: ["phone"],
    },
  },
  {
    name: "list_services",
    description: "List the services the business offers, with durations and prices.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "check_availability",
    description:
      "Get genuinely-bookable appointment start times for a named service over the next days. Returns ISO start times — only ever offer times this returns.",
    input_schema: {
      type: "object" as const,
      properties: {
        service_name: { type: "string", description: "The service the client wants, e.g. 'wellness exam'." },
        days: { type: "number", description: "How many days ahead to search (default 7)." },
      },
      required: ["service_name"],
    },
  },
  {
    name: "create_booking",
    description:
      "Book an appointment. Only call after the client has chosen a specific start time returned by check_availability and given their name and phone.",
    input_schema: {
      type: "object" as const,
      properties: {
        client_name: { type: "string" },
        phone: { type: "string" },
        email: { type: "string" },
        pet_name: { type: "string" },
        pet_species: { type: "string" },
        service_name: { type: "string" },
        start_iso: { type: "string", description: "An ISO start time from check_availability." },
        reason: { type: "string", description: "Brief reason for the visit." },
      },
      required: ["client_name", "phone", "service_name", "start_iso"],
    },
  },
  {
    name: "reschedule_booking",
    description: "Move the client's next upcoming appointment to a new ISO start time.",
    input_schema: {
      type: "object" as const,
      properties: {
        phone: { type: "string" },
        new_start_iso: { type: "string" },
      },
      required: ["phone", "new_start_iso"],
    },
  },
  {
    name: "cancel_booking",
    description: "Cancel the client's next upcoming appointment (looked up by phone).",
    input_schema: {
      type: "object" as const,
      properties: { phone: { type: "string" } },
      required: ["phone"],
    },
  },
  {
    name: "escalate_to_human",
    description:
      "Hand off to clinic staff for emergencies, medical questions you must not answer, complaints, or anything you cannot resolve.",
    input_schema: {
      type: "object" as const,
      properties: { reason: { type: "string" } },
      required: ["reason"],
    },
  },
] as const;

export type ToolName = (typeof TOOLS)[number]["name"];

/** Execute a tool against the domain + repo. Pure data in, structured data out. */
export async function dispatchTool(
  repo: Repo,
  business: Business,
  name: string,
  input: Record<string, unknown>,
): Promise<ToolResult> {
  try {
    switch (name) {
      case "lookup_knowledge": {
        const entries = await repo.searchKnowledge(
          business.id,
          String(input.query ?? ""),
          input.kind as KnowledgeKind | undefined,
        );
        if (!entries.length) {
          return {
            status: "warning",
            summary: "No matching info found.",
            next_actions: ["Offer to connect them with the team or take a message."],
          };
        }
        return {
          status: "success",
          summary: entries[0].body,
          data: entries.map((e) => ({ title: e.title, body: e.body, kind: e.kind, metadata: e.metadata })),
        };
      }

      case "lookup_client": {
        const ctx = await loadClientContext(repo, business, { phone: String(input.phone ?? "") });
        if (!ctx) {
          return { status: "warning", summary: "No returning client found with that phone." };
        }
        return {
          status: "success",
          summary: `Returning client: ${ctx.name}.`,
          data: {
            name: ctx.name,
            pets: ctx.pets,
            upcoming: ctx.upcoming ?? null,
          },
          next_actions: ["Greet them warmly by name and ask after their pet."],
        };
      }

      case "list_services": {
        const services = await repo.listServices(business.id);
        return {
          status: "success",
          summary: `${services.length} services available.`,
          data: services.map((s) => ({
            name: s.name,
            durationMin: s.durationMin,
            price: money(s.priceCents),
            description: s.description,
          })),
        };
      }

      case "check_availability": {
        const services = await repo.listServices(business.id);
        const q = String(input.service_name ?? "").toLowerCase();
        const service =
          services.find((s) => s.name.toLowerCase() === q) ??
          services.find((s) => s.name.toLowerCase().includes(q) || q.includes(s.name.toLowerCase())) ??
          services.find((s) => q.split(/\s+/).some((w) => w.length > 2 && s.name.toLowerCase().includes(w)));
        if (!service) {
          return {
            status: "warning",
            summary: `No service matched "${input.service_name}".`,
            data: { services: services.map((s) => s.name) },
            next_actions: ["Ask which of the listed services they'd like."],
          };
        }
        const slots = await getAvailableSlots(repo, business, service, {
          days: Number(input.days) || 7,
          max: 6,
        });
        return {
          status: slots.length ? "success" : "warning",
          summary: slots.length
            ? `${slots.length} open times for ${service.name}.`
            : `No openings for ${service.name} in that window.`,
          data: {
            service: service.name,
            slots: slots.map((s) => ({ iso: s.iso, label: formatSlotLabel(s.iso), with: s.resourceName })),
          },
        };
      }

      case "create_booking": {
        const result = await bookAppointment(repo, business, {
          clientName: String(input.client_name),
          phone: String(input.phone),
          email: input.email ? String(input.email) : undefined,
          pet: input.pet_name
            ? { name: String(input.pet_name), species: input.pet_species ? String(input.pet_species) : undefined }
            : undefined,
          serviceName: String(input.service_name),
          startISO: String(input.start_iso),
          reason: input.reason ? String(input.reason) : undefined,
        });
        return {
          status: "success",
          summary: `Booked ${result.service.name} on ${formatDateTime(result.appointment.startsAt)} with ${result.resource.name}.`,
          data: {
            id: result.appointment.id,
            service: result.service.name,
            when: formatDateTime(result.appointment.startsAt),
            with: result.resource.name,
            price: money(result.service.priceCents),
          },
          next_actions: ["Confirm warmly and mention a confirmation email will follow."],
        };
      }

      case "reschedule_booking": {
        const appt = await rescheduleUpcomingByPhone(
          repo,
          business,
          String(input.phone),
          String(input.new_start_iso),
        );
        if (!appt) return { status: "warning", summary: "No upcoming appointment found for that phone." };
        return { status: "success", summary: `Moved to ${formatDateTime(appt.startsAt)}.`, data: { when: formatDateTime(appt.startsAt) } };
      }

      case "cancel_booking": {
        const appt = await cancelUpcomingByPhone(repo, business, String(input.phone));
        if (!appt) return { status: "warning", summary: "No upcoming appointment found for that phone." };
        return { status: "success", summary: "Appointment cancelled.", data: { id: appt.id } };
      }

      case "escalate_to_human": {
        // MVP: record intent; production notifies staff (dashboard + email).
        return {
          status: "success",
          summary: "Flagged for a team member to follow up.",
          data: { reason: String(input.reason ?? "") },
          next_actions: ["Reassure the client that a person will be with them shortly."],
        };
      }

      default:
        return { status: "error", summary: `Unknown tool: ${name}` };
    }
  } catch (err) {
    if (err instanceof ConflictError)
      return { status: "warning", summary: err.message, next_actions: ["Offer the next available time instead."] };
    if (err instanceof NotFoundError) return { status: "warning", summary: err.message };
    return { status: "error", summary: "Something went wrong handling that. Try again or escalate." };
  }
}
