import {
  Appointment,
  Business,
  Client,
  ConflictError,
  NotFoundError,
  Pet,
  Repo,
  Resource,
  Service,
} from "@/lib/types";
import { addMinutes } from "date-fns";
import { findFreeResource } from "./availability";

export async function resolveService(
  repo: Repo,
  businessId: string,
  name: string,
): Promise<Service | null> {
  const services = await repo.listServices(businessId);
  const q = name.toLowerCase().trim();
  return (
    services.find((s) => s.name.toLowerCase() === q) ??
    services.find((s) => s.name.toLowerCase().includes(q) || q.includes(s.name.toLowerCase())) ??
    services.find((s) => q.split(/\s+/).some((w) => w.length > 2 && s.name.toLowerCase().includes(w))) ??
    null
  );
}

export interface BookingResult {
  appointment: Appointment;
  service: Service;
  resource: Resource;
  client: Client;
}

/** Book an appointment for the chosen service at the chosen time, conflict-free. */
export async function bookAppointment(
  repo: Repo,
  business: Business,
  input: {
    clientName: string;
    phone: string;
    email?: string;
    pet?: Pet;
    serviceName: string;
    startISO: string;
    reason?: string;
  },
): Promise<BookingResult> {
  const service = await resolveService(repo, business.id, input.serviceName);
  if (!service) throw new NotFoundError(`I couldn't find a service called "${input.serviceName}".`);

  const resource = await findFreeResource(repo, business, service, input.startISO);
  if (!resource) throw new ConflictError("I'm sorry, that time isn't available anymore.");

  const endISO = addMinutes(new Date(input.startISO), service.durationMin).toISOString();
  const client = await repo.upsertClient({
    businessId: business.id,
    name: input.clientName,
    phone: input.phone,
    email: input.email,
    pet: input.pet,
  });

  const appointment = await repo.createAppointment({
    businessId: business.id,
    clientId: client.id,
    resourceId: resource.id,
    serviceId: service.id,
    startsAt: input.startISO,
    endsAt: endISO,
    notes: input.reason,
    attributes: input.pet ? { petName: input.pet.name, reason: input.reason } : { reason: input.reason },
  });

  return { appointment, service, resource, client };
}

/** Move a specific appointment to a new time, conflict-free (staff/admin use). */
export async function rescheduleAppointment(
  repo: Repo,
  business: Business,
  appt: Appointment,
  newStartISO: string,
): Promise<Appointment> {
  const services = await repo.listServices(business.id);
  const service = services.find((s) => s.id === appt.serviceId);
  if (!service) throw new NotFoundError("Service not found for this appointment.");

  const free = await findFreeResource(repo, business, service, newStartISO);
  if (!free) throw new ConflictError("That new time isn't available.");

  const newEnd = addMinutes(new Date(newStartISO), service.durationMin).toISOString();
  await repo.updateAppointment(appt.id, { status: "CANCELLED" });
  return repo.createAppointment({
    businessId: business.id,
    clientId: appt.clientId,
    resourceId: free.id,
    serviceId: service.id,
    startsAt: newStartISO,
    endsAt: newEnd,
    notes: appt.notes ?? undefined,
    attributes: appt.attributes ?? undefined,
  });
}

export async function cancelUpcomingByPhone(
  repo: Repo,
  business: Business,
  phone: string,
): Promise<Appointment | null> {
  const nowISO = new Date().toISOString();
  const appts = await repo.getAppointmentsByPhone(business.id, phone);
  const next = appts.find((a) => a.status === "CONFIRMED" && a.startsAt > nowISO);
  if (!next) return null;
  return repo.updateAppointment(next.id, { status: "CANCELLED" });
}

export async function rescheduleUpcomingByPhone(
  repo: Repo,
  business: Business,
  phone: string,
  newStartISO: string,
): Promise<Appointment | null> {
  const nowISO = new Date().toISOString();
  const appts = await repo.getAppointmentsByPhone(business.id, phone);
  const next = appts.find((a) => a.status === "CONFIRMED" && a.startsAt > nowISO);
  if (!next) return null;

  const services = await repo.listServices(business.id);
  const service = services.find((s) => s.id === next.serviceId)!;
  const free = await findFreeResource(repo, business, service, newStartISO);
  if (!free) throw new ConflictError("That new time isn't available.");

  const newEnd = addMinutes(new Date(newStartISO), service.durationMin).toISOString();
  await repo.updateAppointment(next.id, { status: "CANCELLED" });
  return repo.createAppointment({
    businessId: business.id,
    clientId: next.clientId,
    resourceId: free.id,
    serviceId: service.id,
    startsAt: newStartISO,
    endsAt: newEnd,
    notes: next.notes ?? undefined,
  });
}
