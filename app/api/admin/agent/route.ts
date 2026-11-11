import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createOdooClient, odooConfigFromEnv, type OdooClient } from "@/lib/odoo";
import { chatTurn, LlmConfigError, llmConfig, type ChatMessage, type ToolCall } from "@/lib/rappi-agent/llm";
import { systemPrompt } from "@/lib/rappi-agent/prompt";
import { AGENT_TOOLS, describeCall, needsApproval, runTool } from "@/lib/rappi-agent/tools";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_MODEL_TURNS = 20;
const MAX_BODY_CHARS = 600_000;

type Event =
  | { t: "text"; v: string }
  | { t: "tool"; label: string; ok: boolean; error?: string }
  | { t: "approval"; label: string; name: string; args: Record<string, unknown> }
  | { t: "done"; messages: ChatMessage[] }
  | { t: "error"; message: string };

function parseArgs(raw: string): Record<string, unknown> {
  try {
    const v = JSON.parse(raw || "{}");
    return v && typeof v === "object" && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}

function validMessages(value: unknown): ChatMessage[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 400) return null;
  for (const m of value) {
    if (!m || typeof m !== "object") return null;
    const { role, content } = m as { role?: unknown; content?: unknown };
    if (role === "user" && typeof content === "string") continue;
    if (role === "assistant" && (typeof content === "string" || content === null)) continue;
    if (role === "tool" && typeof content === "string" && typeof (m as { tool_call_id?: unknown }).tool_call_id === "string") continue;
    return null;
  }
  return value as ChatMessage[];
}

/** Tool calls of the last assistant message that have no result yet, in order. */
function pendingCalls(messages: ChatMessage[]): ToolCall[] {
  let i = messages.length - 1;
  const answered = new Set<string>();
  while (i >= 0 && messages[i].role === "tool") {
    answered.add((messages[i] as { tool_call_id: string }).tool_call_id);
    i--;
  }
  const last = messages[i];
  if (!last || last.role !== "assistant" || !last.tool_calls?.length) return [];
  return last.tool_calls.filter((c) => !answered.has(c.id));
}

export async function POST(req: Request) {
  const session = await createClient();
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { data: isAdmin } = await session.rpc("is_admin");
  if (!isAdmin) return NextResponse.json({ error: "Not authorized." }, { status: 403 });

  try {
    llmConfig();
  } catch (error) {
    const message = error instanceof LlmConfigError ? error.message : "Agent is not configured.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const raw = await req.text();
  if (raw.length > MAX_BODY_CHARS) {
    return NextResponse.json({ error: "Conversation too long. Start a new chat." }, { status: 413 });
  }
  let body: { messages?: unknown; decision?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const messages = validMessages(body.messages);
  if (!messages) return NextResponse.json({ error: "Invalid messages." }, { status: 400 });
  let decision = body.decision === "approve" || body.decision === "reject" ? body.decision : null;

  const supabase = createAdminClient() as unknown as SupabaseClient;
  let odoo: OdooClient | null = null;
  const deps = {
    supabase,
    odoo: () => (odoo ??= createOdooClient(odooConfigFromEnv(), { timeoutMs: 30_000, retries: 1 })),
  };

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: Event) => controller.enqueue(encoder.encode(`${JSON.stringify(e)}\n`));

      /** Runs outstanding tool calls in order. Returns false when one waits for approval. */
      const runPending = async () => {
        const pending = pendingCalls(messages);
        const calls = pending.map((tc) => ({ name: tc.function.name, args: parseArgs(tc.function.arguments) }));
        // Lookups only: run them side by side, then record results in call order.
        if (pending.length > 1 && !calls.some(needsApproval)) {
          const results = await Promise.allSettled(calls.map((call) => runTool(call, deps)));
          results.forEach((r, i) => {
            const label = describeCall(calls[i]);
            if (r.status === "fulfilled") {
              messages.push({ role: "tool", tool_call_id: pending[i].id, content: r.value });
              send({ t: "tool", label, ok: true });
            } else {
              const message = r.reason instanceof Error ? r.reason.message : String(r.reason);
              messages.push({ role: "tool", tool_call_id: pending[i].id, content: `Error: ${message}` });
              send({ t: "tool", label, ok: false, error: message.slice(0, 300) });
            }
          });
          return true;
        }
        for (const tc of pending) {
          const call = { name: tc.function.name, args: parseArgs(tc.function.arguments) };
          const label = describeCall(call);
          const reply = (content: string) => messages.push({ role: "tool", tool_call_id: tc.id, content });
          if (needsApproval(call)) {
            if (!decision) {
              send({ t: "approval", label, name: call.name, args: call.args });
              return false;
            }
            const approved = decision === "approve";
            decision = null;
            if (!approved) {
              reply("The admin declined this action. Do not retry it unless asked.");
              send({ t: "tool", label: `Declined: ${label}`, ok: false });
              continue;
            }
            console.info("rappi-agent write", JSON.stringify({ admin: user.id, label }));
          }
          try {
            reply(await runTool(call, deps));
            send({ t: "tool", label, ok: true });
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            reply(`Error: ${message}`);
            send({ t: "tool", label, ok: false, error: message.slice(0, 300) });
          }
        }
        return true;
      };

      try {
        for (let turn = 0; turn < MAX_MODEL_TURNS; turn++) {
          if (!(await runPending())) break;
          const reply = await chatTurn({
            messages: [{ role: "system", content: systemPrompt() }, ...messages],
            tools: AGENT_TOOLS,
            onText: (v) => send({ t: "text", v }),
            signal: req.signal,
          });
          messages.push(reply);
          if (!reply.tool_calls?.length) break;
        }
        send({ t: "done", messages });
      } catch (error) {
        send({ t: "error", message: error instanceof Error ? error.message.slice(0, 500) : "Agent failed." });
        send({ t: "done", messages });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
