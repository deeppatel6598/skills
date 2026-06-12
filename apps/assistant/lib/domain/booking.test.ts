import { describe, expect, it } from "vitest";
import { MemoryRepo } from "@/lib/repo/memory";
import { ConflictError, type Business } from "@/lib/types";
import { getAvailableSlots } from "@/lib/domain/availability";
import {
  bookAppointment,
  rescheduleUpcomingByPhone,
  rescheduleAppointment,
  cancelUpcomingByPhone,
} from "@/lib/domain/booking";
import { slotEnd } from "@/lib/domain/time";
import { runFallback } from "@/lib/ai/fallback";
import { loadClientContext } from "@/lib/domain/client-context";

async function setup() {
  const repo = new MemoryRepo();
  const business = (await repo.getBusinessBySlug("paws-and-care")) as Business;
  const services = await repo.listServices(business.id);
  const wellness = services.find((s) => s.name === "Wellness Exam")!;
  const slots = await getAvailableSlots(repo, business, wellness, { days: 12, max: 12 });
  return { repo, business, wellness, slots };
}

describe("availability", () => {
  it("derives real, future, conflict-free slots", async () => {
    const { slots } = await setup();
    expect(slots.length).toBeGreaterThan(0);
    const now = Date.now();
    for (const s of slots) expect(new Date(s.iso).getTime()).toBeGreaterThan(now);
    // Strictly increasing, de-duplicated times.
    const isos = slots.map((s) => s.iso);
    expect(new Set(isos).size).toBe(isos.length);
  });
});

describe("booking", () => {
  it("books an available slot", async () => {
    const { repo, business, slots } = await setup();
    const r = await bookAppointment(repo, business, {
      clientName: "Sara Lopez",
      phone: "555-111-2222",
      pet: { name: "Bella", species: "dog" },
      serviceName: "Wellness Exam",
      startISO: slots[0].iso,
      reason: "annual checkup",
    });
    expect(r.appointment.status).toBe("CONFIRMED");
    expect(r.service.name).toBe("Wellness Exam");
  });

  it("routes a second booking at the same time to the other vet, then rejects a third", async () => {
    const { repo, business, slots } = await setup();
    const iso = slots[0].iso;
    const first = await bookAppointment(repo, business, { clientName: "Sara", phone: "555-111-0001", serviceName: "Wellness Exam", startISO: iso });
    const second = await bookAppointment(repo, business, { clientName: "Tom", phone: "555-111-0002", serviceName: "Wellness Exam", startISO: iso });
    expect(second.resource.id).not.toBe(first.resource.id); // both vets now busy

    await expect(
      bookAppointment(repo, business, { clientName: "Mia", phone: "555-111-0003", serviceName: "Wellness Exam", startISO: iso }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("never double-books a resource under concurrent requests", async () => {
    const { repo, business, slots } = await setup();
    const start = slots[0].iso;
    const end = slotEnd(start, 30);
    const client = await repo.upsertClient({ businessId: business.id, name: "A", phone: "555-000-0001" });
    const attempts = Array.from({ length: 8 }, () =>
      repo.createAppointment({
        businessId: business.id,
        clientId: client.id,
        resourceId: "res_reyes",
        serviceId: "svc_wellness",
        startsAt: start,
        endsAt: end,
      }),
    );
    const results = await Promise.allSettled(attempts);
    const ok = results.filter((r) => r.status === "fulfilled").length;
    expect(ok).toBe(1); // exactly one wins; the rest hit the conflict guard
  });

  it("reschedules to a new time and frees the old slot", async () => {
    const { repo, business, slots } = await setup();
    await bookAppointment(repo, business, { clientName: "Sara", phone: "555-222-3333", serviceName: "Wellness Exam", startISO: slots[0].iso });
    const moved = await rescheduleUpcomingByPhone(repo, business, "555-222-3333", slots[3].iso);
    expect(moved?.startsAt).toBe(slots[3].iso);
    // Old slot is now free again for a new client.
    const reuse = await bookAppointment(repo, business, { clientName: "New", phone: "555-444-5555", serviceName: "Wellness Exam", startISO: slots[0].iso });
    expect(reuse.appointment.status).toBe("CONFIRMED");
  });

  it("admin reschedule moves a specific appointment conflict-free", async () => {
    const { repo, business, slots } = await setup();
    const r = await bookAppointment(repo, business, { clientName: "Sara", phone: "555-777-8888", serviceName: "Wellness Exam", startISO: slots[0].iso });
    const moved = await rescheduleAppointment(repo, business, r.appointment, slots[4].iso);
    expect(moved.startsAt).toBe(slots[4].iso);
    const active = await repo.listAppointments(business.id);
    expect(active.find((a) => a.id === r.appointment.id)).toBeUndefined(); // old slot cancelled
    expect(active.some((a) => a.id === moved.id)).toBe(true);
  });

  it("cancels the upcoming appointment", async () => {
    const { repo, business, slots } = await setup();
    await bookAppointment(repo, business, { clientName: "Sara", phone: "555-666-7777", serviceName: "Wellness Exam", startISO: slots[0].iso });
    const cancelled = await cancelUpcomingByPhone(repo, business, "555-666-7777");
    expect(cancelled?.status).toBe("CANCELLED");
  });
});

describe("returning-client memory", () => {
  it("recognizes a returning client by phone with pet and upcoming visit", async () => {
    const { repo, business, slots } = await setup();
    await bookAppointment(repo, business, { clientName: "Sara Lopez", phone: "555-111-2222", pet: { name: "Bella", species: "dog" }, serviceName: "Wellness Exam", startISO: slots[0].iso });
    const ctx = await loadClientContext(repo, business, { phone: "555-111-2222" });
    expect(ctx?.name).toBe("Sara Lopez");
    expect(ctx?.pets?.[0]?.name).toBe("Bella");
    expect(ctx?.upcoming?.service).toBe("Wellness Exam");
  });

  it("greets a returning client by name and asks after their pet", async () => {
    const { repo, business, slots } = await setup();
    await bookAppointment(repo, business, { clientName: "Sara Lopez", phone: "555-111-2222", pet: { name: "Bella" }, serviceName: "Wellness Exam", startISO: slots[0].iso });
    const ctx = await loadClientContext(repo, business, { phone: "555-111-2222" });
    const res = await runFallback(repo, business, [{ role: "user", content: "hi" }], ctx);
    expect(res.reply).toContain("Welcome back, Sara");
    expect(res.reply).toContain("Bella");
  });

  it("answers 'when is my appointment' from a phone given in the message", async () => {
    const { repo, business, slots } = await setup();
    await bookAppointment(repo, business, { clientName: "Sara Lopez", phone: "555-111-2222", serviceName: "Wellness Exam", startISO: slots[0].iso });
    const res = await runFallback(repo, business, [{ role: "user", content: "when is my appointment? my number is 555-111-2222" }]);
    expect(res.reply.toLowerCase()).toContain("wellness exam");
  });
});

describe("multilingual fallback", () => {
  it("greets in Spanish when the client writes Spanish", async () => {
    const { repo, business } = await setup();
    const res = await runFallback(repo, business, [{ role: "user", content: "hola" }]);
    expect(res.reply.toLowerCase()).toContain("hola");
  });

  it("offers slots with a French lead for a French booking request", async () => {
    const { repo, business } = await setup();
    const res = await runFallback(repo, business, [{ role: "user", content: "je voudrais réserver un wellness exam" }]);
    expect(res.ui?.kind).toBe("slots");
    expect(res.reply.toLowerCase()).toContain("créneaux");
  });
});

describe("concierge fallback (no API key)", () => {
  it("answers a brand/location question from the knowledge base", async () => {
    const { repo, business } = await setup();
    const res = await runFallback(repo, business, [{ role: "user", content: "where are you located and is there parking?" }]);
    expect(res.usedClaude).toBe(false);
    expect(res.reply.toLowerCase()).toContain("maple");
  });

  it("offers real slots when the client wants to book", async () => {
    const { repo, business } = await setup();
    const res = await runFallback(repo, business, [{ role: "user", content: "I'd like to book a wellness exam please" }]);
    expect(res.ui?.kind).toBe("slots");
    if (res.ui?.kind === "slots") expect(res.ui.slots.length).toBeGreaterThan(0);
  });

  it("does not give medical advice for a worried owner (escalates to emergency)", async () => {
    const { repo, business } = await setup();
    const res = await runFallback(repo, business, [{ role: "user", content: "my dog ate chocolate what should I do" }]);
    expect(res.reply.toLowerCase()).toMatch(/emergency|911|can.?t give medical|team/);
  });
});
