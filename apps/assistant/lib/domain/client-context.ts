import type { Business, Pet, Repo } from "@/lib/types";
import { formatDateTime } from "./time";

/** What the assistant remembers about a returning client. */
export interface ClientContext {
  id: string;
  name: string;
  phone: string;
  pets: Pet[];
  upcoming?: { service: string; when: string };
}

/**
 * Load a returning client's context by id (from their session cookie) or phone
 * (mentioned in conversation). Powers the "remembers you" experience: greet by
 * name, recall pets, and reference an upcoming visit.
 */
export async function loadClientContext(
  repo: Repo,
  business: Business,
  opts: { clientId?: string; phone?: string },
): Promise<ClientContext | null> {
  const client = opts.clientId
    ? await repo.getClientById(business.id, opts.clientId)
    : opts.phone
      ? await repo.findClientByPhone(business.id, opts.phone)
      : null;
  if (!client) return null;

  const appts = await repo.getAppointmentsByPhone(business.id, client.phone);
  const nowISO = new Date().toISOString();
  const next = appts.find((a) => a.status === "CONFIRMED" && a.startsAt > nowISO);

  let upcoming: ClientContext["upcoming"];
  if (next) {
    const services = await repo.listServices(business.id);
    const svc = services.find((s) => s.id === next.serviceId);
    upcoming = { service: svc?.name ?? "your appointment", when: formatDateTime(next.startsAt) };
  }

  return {
    id: client.id,
    name: client.name,
    phone: client.phone,
    pets: (client.attributes?.pets ?? []) as Pet[],
    upcoming,
  };
}
