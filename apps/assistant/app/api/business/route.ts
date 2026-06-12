import { NextResponse } from "next/server";
import { loadContext } from "@/lib/context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/business — public meta the widget needs to render + speak. */
export async function GET() {
  const { repo, business } = await loadContext();
  const services = await repo.listServices(business.id);
  const c = business.config;
  return NextResponse.json({
    data: {
      name: business.name,
      slug: business.slug,
      assistantName: c.assistantName,
      tagline: c.tagline,
      branding: c.branding,
      persona: c.voice,
      hoursText: c.hoursText,
      emergencyLine: c.emergencyLine,
      services: services.map((s) => ({
        name: s.name,
        durationMin: s.durationMin,
        price: s.priceCents != null ? `$${(s.priceCents / 100).toFixed(0)}` : null,
        description: s.description,
      })),
      suggestions: [
        "Where are you located?",
        "What are your hours?",
        "What services do you offer?",
        "I'd like to book a visit",
      ],
    },
  });
}
