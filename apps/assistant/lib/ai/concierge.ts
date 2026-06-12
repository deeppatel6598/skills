import Anthropic from "@anthropic-ai/sdk";
import type { Business, ChatMessage, Repo } from "@/lib/types";
import type { ClientContext } from "@/lib/domain/client-context";
import { buildSystemPrompt } from "./prompt";
import { dispatchTool, TOOLS, type ToolResult } from "./tools";
import { runFallback } from "./fallback";
import type { ConciergeResult, ConciergeUI } from "./types";

export type { ConciergeResult, ConciergeUI } from "./types";

const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-4-6";
const MAX_TOOL_TURNS = 6;

/** Map a tool's result into a UI hint the widget can render. */
function uiFromTool(name: string, result: ToolResult): ConciergeUI | undefined {
  if (result.status === "error") return undefined;
  const data = result.data as Record<string, unknown> | undefined;
  if (name === "list_services" && Array.isArray(data)) {
    return {
      kind: "services",
      services: data as { name: string; price: string | null; durationMin: number; description: string | null }[],
    };
  }
  if (name === "check_availability" && data && Array.isArray((data as { slots?: unknown[] }).slots)) {
    const d = data as { service: string; slots: { iso: string; label: string; with: string }[] };
    if (d.slots.length) return { kind: "slots", service: d.service, slots: d.slots };
  }
  if (name === "create_booking" && data) {
    const d = data as { service: string; when: string; with: string; price: string | null };
    return { kind: "booked", service: d.service, when: d.when, with: d.with, price: d.price };
  }
  return undefined;
}

/**
 * Run one concierge turn. Uses Claude with the tool-use loop when
 * ANTHROPIC_API_KEY is set; otherwise the keyless fallback. The booking domain
 * is identical for both — the model only ever acts through the tools.
 */
export async function runConcierge(
  repo: Repo,
  business: Business,
  messages: ChatMessage[],
  clientContext?: ClientContext | null,
): Promise<ConciergeResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return runFallback(repo, business, messages, clientContext);
  }

  const services = await repo.listServices(business.id);
  const system = buildSystemPrompt(business, services, clientContext);
  const client = new Anthropic();

  // History must start with a user turn for the Messages API.
  const trimmed = [...messages];
  while (trimmed.length && trimmed[0].role !== "user") trimmed.shift();
  const convo: Anthropic.MessageParam[] = trimmed.map((m) => ({ role: m.role, content: m.content }));

  let lastUI: ConciergeUI | undefined;

  for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 800,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      tools: TOOLS as unknown as Anthropic.Tool[],
      messages: convo,
    });

    if (resp.stop_reason === "tool_use") {
      convo.push({ role: "assistant", content: resp.content });
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of resp.content) {
        if (block.type === "tool_use") {
          const result = await dispatchTool(repo, business, block.name, block.input as Record<string, unknown>);
          lastUI = uiFromTool(block.name, result) ?? lastUI;
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify(result),
          });
        }
      }
      convo.push({ role: "user", content: toolResults });
      continue;
    }

    const reply = resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join(" ")
      .trim();
    return { reply: reply || "I'm here — how can I help you and your pet?", ui: lastUI, usedClaude: true };
  }

  return {
    reply: "Let me get a team member to help you with that — one moment.",
    ui: lastUI,
    usedClaude: true,
  };
}
