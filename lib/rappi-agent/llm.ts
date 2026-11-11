import "server-only";

/** OpenAI-style chat messages, as OpenRouter takes them. */
export type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };

export type AssistantMessage = { role: "assistant"; content: string | null; tool_calls?: ToolCall[] };

export type ChatMessage =
  | { role: "system" | "user"; content: string }
  | AssistantMessage
  | { role: "tool"; tool_call_id: string; content: string };

export type ChatTool = {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
};

export class LlmConfigError extends Error {}

export function llmConfig() {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) throw new LlmConfigError("OPENROUTER_API_KEY is not set on the server.");
  const models = (process.env.OPENROUTER_MODEL?.trim() || DEFAULT_MODELS)
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  return { apiKey, models };
}

function validJson(text: string) {
  try {
    const v = JSON.parse(text || "{}");
    return v && typeof v === "object" && !Array.isArray(v) ? JSON.stringify(v) : "{}";
  } catch {
    return "{}";
  }
}

/**
 * Tried in order: OpenRouter moves to the next one when a model is down or rate-limited.
 * openrouter/free last, as a catch-all for any free model that supports tools.
 */
const DEFAULT_MODELS = "baidu/ernie-5.5-flash-preview:free,nvidia/nemotron-3.5-lightning:free,openrouter/free";

/**
 * One streamed chat turn on OpenRouter. Calls onText for each content chunk
 * and returns the whole assistant message (text and tool calls) at the end.
 */
export async function chatTurn(opts: {
  messages: ChatMessage[];
  tools: ChatTool[];
  onText: (text: string) => void;
  /** The model's reasoning as it streams, when the model shares it. */
  onThinking?: (text: string) => void;
  /** Which model OpenRouter actually used (matters with fallbacks and openrouter/free). */
  onModel?: (model: string) => void;
  signal?: AbortSignal;
}): Promise<AssistantMessage> {
  const { apiKey, models } = llmConfig();
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-Title": "Rappi Agent",
    },
    body: JSON.stringify({
      ...(models.length > 1 ? { models } : { model: models[0] }),
      messages: opts.messages,
      tools: opts.tools,
      stream: true,
      // Speed: short reasoning, and the fastest provider serving the model.
      reasoning: { effort: "low" },
      provider: { sort: "throughput" },
    }),
    signal: opts.signal,
  });
  if (!res.ok || !res.body) {
    const detail = (await res.text().catch(() => "")).slice(0, 300);
    throw new Error(`OpenRouter ${res.status}: ${detail || res.statusText}`);
  }

  let content = "";
  let modelSeen = false;
  const calls: ToolCall[] = [];
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const handle = (line: string) => {
    // SSE: "data: {...}" lines; ": comment" keep-alives; "data: [DONE]" at the end.
    if (!line.startsWith("data:")) return;
    const data = line.slice(5).trim();
    if (!data || data === "[DONE]") return;
    const chunk = JSON.parse(data) as {
      error?: { message?: string };
      model?: string;
      choices?: Array<{
        delta?: {
          content?: string | null;
          reasoning?: string | null;
          tool_calls?: Array<{ index: number; id?: string; function?: { name?: string; arguments?: string } }>;
        };
      }>;
    };
    if (chunk.error) throw new Error(`OpenRouter: ${chunk.error.message ?? "stream error"}`);
    if (chunk.model && !modelSeen) {
      modelSeen = true;
      opts.onModel?.(chunk.model);
    }
    const delta = chunk.choices?.[0]?.delta;
    if (!delta) return;
    if (delta.reasoning) opts.onThinking?.(delta.reasoning);
    if (delta.content) {
      content += delta.content;
      opts.onText(delta.content);
    }
    for (const tc of delta.tool_calls ?? []) {
      const slot = (calls[tc.index] ??= { id: "", type: "function", function: { name: "", arguments: "" } });
      if (tc.id) slot.id = tc.id;
      if (tc.function?.name) slot.function.name += tc.function.name;
      if (tc.function?.arguments) slot.function.arguments += tc.function.arguments;
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf("\n")) !== -1) {
      handle(buffer.slice(0, nl).trim());
      buffer = buffer.slice(nl + 1);
    }
  }
  handle(buffer.trim());

  const toolCalls = calls.filter(Boolean).map((c, i) => ({
    ...c,
    id: c.id || `call_${Date.now()}_${i}`,
    // A malformed call must still be valid JSON, or OpenRouter rejects the whole history next turn.
    function: { name: c.function.name, arguments: validJson(c.function.arguments) },
  }));
  return { role: "assistant", content: content || null, ...(toolCalls.length ? { tool_calls: toolCalls } : {}) };
}
