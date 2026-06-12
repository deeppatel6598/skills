import { NextRequest, NextResponse } from "next/server";
import { loadContext } from "@/lib/context";
import { loadClientContext } from "@/lib/domain/client-context";
import { CLIENT_COOKIE, verifyClientId } from "@/lib/client-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/client/me — resolve the returning-client cookie to a friendly profile. */
export async function GET(req: NextRequest) {
  const clientId = verifyClientId(req.cookies.get(CLIENT_COOKIE)?.value);
  if (!clientId) return NextResponse.json({ data: { returning: false } });

  const { repo, business } = await loadContext();
  const ctx = await loadClientContext(repo, business, { clientId });
  if (!ctx) return NextResponse.json({ data: { returning: false } });

  return NextResponse.json({
    data: {
      returning: true,
      name: ctx.name,
      firstName: ctx.name.split(" ")[0],
      phone: ctx.phone,
      pets: ctx.pets,
      upcoming: ctx.upcoming ?? null,
    },
  });
}
