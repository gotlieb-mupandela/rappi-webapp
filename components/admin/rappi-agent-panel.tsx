"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Bot, Check, ChevronRight, Loader2, Plus, Send, Sparkles, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type HistoryMessage =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: unknown[] }
  | { role: "tool"; tool_call_id: string; content: string };

type Item =
  | { kind: "user"; text: string }
  | { kind: "assistant"; text: string }
  | { kind: "tool"; label: string; ok: boolean; error?: string }
  | { kind: "error"; text: string };

type Pending = { label: string; name: string; args: Record<string, unknown> };

type Saved = { history: HistoryMessage[]; items: Item[]; pending: Pending | null };

const STORE_KEY = "rappi-agent-chat";
const OPEN_KEY = "rappi-agent-open";

const SUGGESTIONS = [
  "How did sales go this month?",
  "Which products are low on stock?",
  "Do website and Odoo stock match for 100052.200?",
  "Who are our top 5 customers?",
];

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the chat still works for this page view.
  }
}

/* ---------- tiny markdown: paragraphs, lists, tables, **bold**, `code` ---------- */

function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    out.push(
      tok.startsWith("**") ? (
        <strong key={m.index}>{tok.slice(2, -2)}</strong>
      ) : (
        <code key={m.index} className="rounded bg-[var(--hover)] px-1 font-mono text-[0.85em]">
          {tok.slice(1, -1)}
        </code>
      ),
    );
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r/g, "").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    if (line.trim().startsWith("|")) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        const cells = lines[i].trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
        if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(cells);
        i++;
      }
      const [head, ...body] = rows;
      blocks.push(
        <div key={i} className="my-2 overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                {head?.map((c, k) => (
                  <th key={k} className="border-b border-[var(--border)] px-2 py-1 text-left font-semibold">
                    {inline(c)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((r, k) => (
                <tr key={k}>
                  {r.map((c, j) => (
                    <td key={j} className="border-b border-[var(--border)] px-2 py-1 align-top">
                      {inline(c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const entries: string[] = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
        entries.push(lines[i].replace(/^\s*([-*]|\d+\.)\s+/, ""));
        i++;
      }
      const List = ordered ? "ol" : "ul";
      blocks.push(
        <List key={i} className={cn("my-1 space-y-0.5 pl-5", ordered ? "list-decimal" : "list-disc")}>
          {entries.map((e, k) => (
            <li key={k}>{inline(e)}</li>
          ))}
        </List>,
      );
      continue;
    }
    const heading = /^#{1,4}\s+(.*)$/.exec(line);
    blocks.push(
      <p key={i} className={cn("my-1", heading && "font-semibold")}>
        {inline(heading ? heading[1] : line)}
      </p>,
    );
    i++;
  }
  return <>{blocks}</>;
}

/* ---------- panel ---------- */

/** Rendered in the browser only (see rappi-agent.tsx), so localStorage is safe to read here. */
export default function RappiAgentPanel() {
  const [saved] = useState(() => load<Saved | null>(STORE_KEY, null));
  const [open, setOpen] = useState(() => load(OPEN_KEY, window.innerWidth >= 1280));
  const [history, setHistory] = useState<HistoryMessage[]>(saved?.history ?? []);
  const [items, setItems] = useState<Item[]>(saved?.items ?? []);
  const [pending, setPending] = useState<Pending | null>(saved?.pending ?? null);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!busy) save(STORE_KEY, { history, items, pending } satisfies Saved);
  }, [history, items, pending, busy]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [items, pending, busy]);

  function toggle(next: boolean) {
    setOpen(next);
    save(OPEN_KEY, next);
  }

  async function run(messages: HistoryMessage[], decision?: "approve" | "reject") {
    setBusy(true);
    setPending(null);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let assistantOpen = false;

    const push = (item: Item) => {
      assistantOpen = false;
      setItems((prev) => [...prev, item]);
    };

    try {
      const res = await fetch("/api/admin/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, decision }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        push({ kind: "error", text: data?.error ?? `Request failed (${res.status}).` });
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 1);
          if (!line.trim()) continue;
          const e = JSON.parse(line);
          if (e.t === "text") {
            if (assistantOpen) {
              setItems((prev) => {
                const copy = [...prev];
                const last = copy[copy.length - 1];
                if (last?.kind === "assistant") copy[copy.length - 1] = { ...last, text: last.text + e.v };
                return copy;
              });
            } else {
              setItems((prev) => [...prev, { kind: "assistant", text: e.v }]);
              assistantOpen = true;
            }
          } else if (e.t === "tool") {
            push({ kind: "tool", label: e.label, ok: e.ok, error: e.error });
          } else if (e.t === "approval") {
            setPending({ label: e.label, name: e.name, args: e.args });
          } else if (e.t === "error") {
            push({ kind: "error", text: e.message });
          } else if (e.t === "done") {
            setHistory(e.messages);
          }
        }
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        push({ kind: "error", text: "Connection lost. Try again." });
      }
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  }

  function send(text: string) {
    const q = text.trim();
    if (!q || busy || pending) return;
    setInput("");
    setItems((prev) => [...prev, { kind: "user", text: q }]);
    const next: HistoryMessage[] = [...history, { role: "user", content: q }];
    setHistory(next);
    void run(next);
  }

  function reset() {
    abortRef.current?.abort();
    setHistory([]);
    setItems([]);
    setPending(null);
  }

  const panel = (
    <div className="flex h-full flex-col bg-[var(--footer-bg)]">
      <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent-muted)] text-[var(--accent)]">
          <Bot className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-[family-name:var(--font-oswald)] text-sm uppercase tracking-wide">Rappi Agent</p>
          <p className="text-[11px] text-[var(--muted)]">Website + Odoo</p>
        </div>
        <button
          type="button"
          onClick={reset}
          className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--hover)] hover:text-ink"
          aria-label="New chat"
          title="New chat"
        >
          <Plus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => toggle(false)}
          className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--hover)] hover:text-ink"
          aria-label="Close Rappi Agent"
        >
          <X className="h-4 w-4 lg:hidden" />
          <ChevronRight className="hidden h-4 w-4 lg:block" />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4 text-sm">
        {items.length === 0 ? (
          <div className="space-y-3 pt-4">
            <p className="text-[var(--muted)]">
              Ask about sales, stock, customers or orders, or tell me what to change. Changes wait for your approval.
            </p>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                className="flex w-full items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-left text-[13px] hover:bg-[var(--hover)]"
              >
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
                {s}
              </button>
            ))}
          </div>
        ) : null}

        {items.map((item, k) => {
          if (item.kind === "user") {
            return (
              <div key={k} className="ml-8 whitespace-pre-wrap rounded-2xl rounded-br-sm bg-[var(--accent-muted)] px-3 py-2">
                {item.text}
              </div>
            );
          }
          if (item.kind === "assistant") {
            return (
              <div key={k} className="break-words leading-relaxed">
                <Markdown text={item.text} />
              </div>
            );
          }
          if (item.kind === "tool") {
            return (
              <div key={k} className="flex items-start gap-1.5 text-xs text-[var(--muted)]">
                {item.ok ? (
                  <Check className="mt-0.5 h-3 w-3 shrink-0 text-[var(--accent)]" />
                ) : (
                  <XCircle className="mt-0.5 h-3 w-3 shrink-0 text-red-400" />
                )}
                <span>
                  {item.label}
                  {item.error ? <span className="block text-red-400">{item.error}</span> : null}
                </span>
              </div>
            );
          }
          return (
            <div key={k} className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {item.text}
            </div>
          );
        })}

        {pending ? (
          <div className="rounded-xl border border-[var(--accent)] bg-[var(--accent-muted)] p-3">
            <p className="text-xs uppercase tracking-wider text-[var(--accent)]">Approve change?</p>
            <p className="mt-1 font-medium">{pending.label}</p>
            <pre className="mt-2 max-h-48 overflow-auto rounded bg-black/30 p-2 font-mono text-[11px] leading-snug">
              {JSON.stringify(pending.args, null, 2)}
            </pre>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => void run(history, "approve")}
                className="flex-1 rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-black hover:opacity-90"
              >
                Approve
              </button>
              <button
                type="button"
                onClick={() => void run(history, "reject")}
                className="flex-1 rounded-lg border border-[var(--border)] px-3 py-2 text-sm hover:bg-[var(--hover)]"
              >
                Decline
              </button>
            </div>
          </div>
        ) : null}

        {busy ? (
          <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Working…
          </div>
        ) : null}
      </div>

      <form
        className="border-t border-[var(--border)] p-3"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <div className="flex items-end gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-2 focus-within:border-[var(--accent)]">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={1}
            placeholder={pending ? "Approve or decline the change first" : "Ask Rappi Agent…"}
            disabled={Boolean(pending)}
            className="max-h-40 min-h-[24px] flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-[var(--muted)]"
          />
          <button
            type="submit"
            disabled={busy || Boolean(pending) || !input.trim()}
            aria-label="Send"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)] text-black disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  );

  return (
    <>
      {open ? (
        <>
          <button
            type="button"
            aria-label="Close Rappi Agent"
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => toggle(false)}
          />
          <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-[420px] border-l border-[var(--border)] lg:sticky lg:top-0 lg:z-auto lg:h-dvh lg:w-[380px] lg:shrink-0">
            {panel}
          </aside>
        </>
      ) : (
        <button
          type="button"
          onClick={() => toggle(true)}
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-black shadow-lg hover:opacity-90"
        >
          <Bot className="h-4 w-4" />
          Rappi Agent
        </button>
      )}
    </>
  );
}
