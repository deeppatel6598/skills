/**
 * Seeds the first tenant ("Paws & Care Veterinary Clinic") into Postgres.
 * Mirrors the in-memory demo seed (lib/repo/memory.ts) so both modes behave the
 * same. Idempotent: run with `npm run seed` after `npm run db:push`/`db:migrate`.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const H = (h: number) => h * 60;

async function main() {
  const slug = "paws-and-care";

  const config = {
    timezone: "America/New_York",
    assistantName: "Sofia",
    tagline: "Compassionate care for your furry family.",
    branding: { primary: "#2F6F6A", accent: "#E8B04B", bubbleEmoji: "🐾" },
    voice: {
      displayName: "Sofia",
      gender: "female",
      description:
        "soft-spoken, warm, gentle and unhurried — like a caring receptionist who loves animals",
      provider: "webspeech",
      elevenLabsVoiceId: "",
      rate: 0.92,
      pitch: 1.02,
      preferVoiceNames: [
        "Samantha",
        "Google UK English Female",
        "Microsoft Aria Online (Natural)",
        "Microsoft Jenny Online (Natural)",
        "Victoria",
        "Karen",
        "Serena",
        "female",
      ],
    },
    tone: ["warm", "reassuring", "patient", "gentle"],
    hoursText: "Mon–Fri 8am–6pm, Sat 9am–2pm, closed Sunday",
    policies: [
      "Please arrive 10 minutes early for your first visit.",
      "We ask for 24 hours' notice for cancellations.",
      "Bring previous medical records and current medications for first visits.",
    ],
    emergencyLine: "(555) 911-PETS",
  };

  const business = await prisma.business.upsert({
    where: { slug },
    update: { name: "Paws & Care Veterinary Clinic", vertical: "veterinary", config },
    create: { slug, name: "Paws & Care Veterinary Clinic", vertical: "veterinary", config },
  });

  // Reset child rows for a clean, repeatable seed.
  await prisma.appointment.deleteMany({ where: { businessId: business.id } });
  await prisma.knowledgeEntry.deleteMany({ where: { businessId: business.id } });
  await prisma.service.deleteMany({ where: { businessId: business.id } });
  await prisma.resource.deleteMany({ where: { businessId: business.id } });

  await prisma.service.createMany({
    data: [
      { businessId: business.id, name: "Wellness Exam", durationMin: 30, priceCents: 6500, description: "Routine head-to-tail check-up to keep your pet healthy." },
      { businessId: business.id, name: "Vaccination", durationMin: 20, priceCents: 4000, description: "Core and booster vaccines." },
      { businessId: business.id, name: "Dental Cleaning", durationMin: 60, priceCents: 18000, description: "Full dental scaling and polish." },
      { businessId: business.id, name: "Sick Visit", durationMin: 30, priceCents: 9000, description: "Same-week visit when your pet isn't feeling well." },
      { businessId: business.id, name: "Grooming", durationMin: 45, priceCents: 5500, description: "Bath, nails, and a tidy trim." },
    ],
  });

  const reyes = await prisma.resource.create({ data: { businessId: business.id, name: "Dr. Amelia Reyes", role: "Veterinarian" } });
  const patel = await prisma.resource.create({ data: { businessId: business.id, name: "Dr. Liam Patel", role: "Veterinarian" } });

  for (const r of [reyes, patel]) {
    for (const weekday of [1, 2, 3, 4, 5]) {
      await prisma.availabilityRule.create({ data: { resourceId: r.id, weekday, startMin: H(8), endMin: H(18) } });
    }
    await prisma.availabilityRule.create({ data: { resourceId: r.id, weekday: 6, startMin: H(9), endMin: H(14) } });
  }

  await prisma.knowledgeEntry.createMany({
    data: [
      { businessId: business.id, kind: "LOCATION", title: "Where are you located? Directions & parking", body: "We're at 248 Maple Street, Springfield — just off Route 9. There's free parking behind the building and the entrance is step-free.", metadata: { mapUrl: "https://maps.google.com/?q=248+Maple+Street+Springfield", phone: "(555) 248-7297" } },
      { businessId: business.id, kind: "HOURS", title: "What are your opening hours?", body: "We're open Monday to Friday 8am–6pm, Saturday 9am–2pm, and we're closed on Sundays." },
      { businessId: business.id, kind: "FACILITY", title: "What facilities and equipment do you have?", body: "Our clinic has a full in-house lab, digital X-ray and ultrasound, a dedicated surgical suite, an isolation ward, and a calm, separate cat waiting area so anxious kitties feel at ease." },
      { businessId: business.id, kind: "SERVICE", title: "What services do you offer?", body: "We offer wellness exams, vaccinations, dental cleanings, sick visits, grooming, microchipping, and minor surgery." },
      { businessId: business.id, kind: "PRICING", title: "How much does a visit cost?", body: "A wellness exam is $65 and vaccinations start at $40. We'll always talk you through any costs before treatment so there are no surprises." },
      { businessId: business.id, kind: "POLICY", title: "What is your cancellation policy?", body: "We completely understand life happens — we just ask for 24 hours' notice so we can offer the slot to another family." },
      { businessId: business.id, kind: "TEAM", title: "Who are your veterinarians?", body: "Dr. Amelia Reyes and Dr. Liam Patel lead our team, supported by four wonderful veterinary nurses." },
      { businessId: business.id, kind: "FAQ", title: "Do you treat exotic pets?", body: "Yes — alongside cats and dogs, Dr. Patel also sees rabbits, guinea pigs, and birds." },
      { businessId: business.id, kind: "FAQ", title: "What should I bring to my first visit?", body: "Please bring any previous medical records and a list of current medications — and of course, your pet!" },
      { businessId: business.id, kind: "FAQ", title: "My pet ate something they shouldn't have — what do I do?", body: "Oh no, I'm so sorry — that's really worrying. I'm not able to give medical advice, but please call our emergency line right away at (555) 911-PETS, or I can help you book the very next available visit.", metadata: { urgent: true } },
      { businessId: business.id, kind: "GENERAL", title: "Do you have parking and step-free access?", body: "Yes — free parking behind the building and a step-free entrance." },
    ],
  });

  console.log(`Seeded "${business.name}" (${slug}).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
