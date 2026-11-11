import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createOdooClient, odooConfigFromEnv, type OdooClient } from "@/lib/odoo";
import { chatTurn, LlmConfigError, llmConfig, type ChatMessage, type ToolCall } from "@/lib/rappi-agent/llm";
import { systemPrompt } from "@/lib/rappi-agent/prompt";
import { AGENT_TOOLS, describeCall, needsApproval, runTool, type ToolCallInput } from "@/lib/rappi-agent/tools";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_MODEL_TURNS = 20;
const MAX_BODY_CHARS = 600_000;
const PREVIEW_CHARS = 4_000;

/** Streamed to the admin panel as NDJSON, one event per line. */
type Event =
  | { t: "model"; name: string }
  | { t: "thinking"; v: string }
  | { t: "text"; v: string }
  | { t: "step_start"; id: string; label: string; name: string; args: Record<string, unknown> }
  | { t: "step_end"; id: string; ok: boolean; ms: number; preview?: string; error?: string }
  | { t: "approval"; id: string; label: string; name: string; args: Record<string, unknown> }
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
      let open = true;
      const send = (e: Event) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(e)}\n`));
        } catch {
          open = false; // Admin closed the panel or pressed stop.
        }
      };

      /** Runs one tool call, streaming its start and end. Returns the tool message content. */
      const execute = async (id: string, call: ToolCallInput) => {
        send({ t: "step_start", id, label: describeCall(call), name: call.name, args: call.args });
        const started = Date.now();
        try {
          const result = await runTool(call, deps);
          send({ t: "step_end", id, ok: true, ms: Date.now() - started, preview: result.slice(0, PREVIEW_CHARS) });
          return result;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          send({ t: "step_end", id, ok: false, ms: Date.now() - started, error: message.slice(0, 500) });
          return `Error: ${message}`;
        }
      };

      /** Runs outstanding tool calls. Returns false when one waits for the admin's approval. */
      const runPending = async () => {
        const pending = pendingCalls(messages).map((tc) => ({
          id: tc.id,
          call: { name: tc.function.name, args: parseArgs(tc.function.arguments) },
        }));

        // Lookups only: run them side by side, record results in call order.
        if (pending.length > 1 && !pending.some((p) => needsApproval(p.call))) {
          const results = await Promise.all(pending.map((p) => execute(p.id, p.call)));
          results.forEach((content, i) => messages.push({ role: "tool", tool_call_id: pending[i].id, content }));
          return true;
        }

        for (const { id, call } of pending) {
          if (needsApproval(call)) {
            if (!decision) {
              send({ t: "approval", id, label: describeCall(call), name: call.name, args: call.args });
              return false;
            }
            const approved = decision === "approve";
            decision = null;
            if (!approved) {
              send({ t: "step_start", id, label: describeCall(call), name: call.name, args: call.args });
              send({ t: "step_end", id, ok: false, ms: 0, error: "Declined by you." });
              messages.push({ role: "tool", tool_call_id: id, content: "The admin declined this action. Do not retry it unless asked." });
              continue;
            }
            console.info("rappi-agent write", JSON.stringify({ admin: user.id, label: describeCall(call) }));
          }
          messages.push({ role: "tool", tool_call_id: id, content: await execute(id, call) });
        }
        return true;
      };

      try {
        for (let turn = 0; turn < MAX_MODEL_TURNS; turn++) {
          if (!(await runPending())) break;
          if (req.signal.aborted) break;
          const reply = await chatTurn({
            messages: [{ role: "system", content: systemPrompt() }, ...messages],
            tools: AGENT_TOOLS,
            onText: (v) => send({ t: "text", v }),
            onThinking: (v) => send({ t: "thinking", v }),
            onModel: (name) => send({ t: "model", name }),
            signal: req.signal,
          });
          messages.push(reply);
          if (!reply.tool_calls?.length) break;
        }
        send({ t: "done", messages });
      } catch (error) {
        if (!req.signal.aborted) {
          send({ t: "error", message: error instanceof Error ? error.message.slice(0, 500) : "Agent failed." });
        }
        send({ t: "done", messages });
      } finally {
        if (open) controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
