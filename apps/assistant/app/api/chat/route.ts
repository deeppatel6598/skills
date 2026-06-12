import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { loadContext } from "@/lib/context";
import { runConcierge } from "@/lib/ai/concierge";
import { loadClientContext } from "@/lib/domain/client-context";
import { CLIENT_COOKIE, verifyClientId } from "@/lib/client-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) }))
    .min(1)
    .max(40),
});

export async function POST(req: NextRequest) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: { code: "bad_request", message: "Invalid JSON" } }, { status: 400 });
  }

  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "validation_error", message: "Invalid request", details: parsed.error.issues } },
      { status: 422 },
    );
  }

  try {
    const { repo, business } = await loadContext();
    const clientId = verifyClientId(req.cookies.get(CLIENT_COOKIE)?.value);
    const clientContext = clientId ? await loadClientContext(repo, business, { clientId }) : null;
    const result = await runConcierge(repo, business, parsed.data.messages, clientContext);
    return NextResponse.json({
      data: {
        reply: result.reply,
        ui: result.ui ?? null,
        usedClaude: result.usedClaude,
        persona: business.config.voice,
        assistantName: business.config.assistantName,
      },
    });
  } catch (err) {
    console.error("chat error", err);
    return NextResponse.json(
      { error: { code: "internal_error", message: "Something went wrong. Please try again." } },
      { status: 500 },
    );
  }
}
