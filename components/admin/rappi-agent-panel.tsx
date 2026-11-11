"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Bot,
  Boxes,
  Brain,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Database,
  Loader2,
  Maximize2,
  MessageSquareText,
  Minimize2,
  Plus,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  Square,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ types */

type HistoryMessage =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: unknown[] }
  | { role: "tool"; tool_call_id: string; content: string };

type Step = {
  type: "step";
  id: string;
  label: string;
  name: string;
  args: Record<string, unknown>;
  status: "running" | "ok" | "error";
  /** A change that ran without asking because auto-approve was on. */
  auto?: boolean;
  ms?: number;
  preview?: string;
  error?: string;
};

type Activity = { type: "thought"; text: string } | { type: "note"; text: string } | Step;

type Pending = { id: string; label: string; name: string; args: Record<string, unknown> };

type Run = {
  kind: "run";
  id: string;
  startedAt: number;
  endedAt?: number;
  status: "running" | "done" | "waiting" | "stopped" | "error";
  activity: Activity[];
  answer: string;
  model?: string;
  error?: string;
  pending?: Pending;
};

type Turn = { kind: "user"; id: string; text: string } | Run;

type Saved = { v: 2; history: HistoryMessage[]; turns: Turn[] };

/* ------------------------------------------------------------------ storage */

const STORE_KEY = "rappi-agent-chat-v2";
const OPEN_KEY = "rappi-agent-open";
const WIDE_KEY = "rappi-agent-wide";
const AUTO_KEY = "rappi-agent-auto-approve";
const MAX_SAVED_TURNS = 60;

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

const uid = () => Math.random().toString(36).slice(2, 10);

/* ------------------------------------------------------------------ suggestions */

const SUGGESTIONS = [
  { icon: Sparkles, text: "How did sales go this month?" },
  { icon: Boxes, text: "Which products are almost out of stock?" },
  { icon: Database, text: "Compare website and Odoo stock for 100052.200" },
  { icon: MessageSquareText, text: "Who are our top customers?" },
];

/* ------------------------------------------------------------------ markdown */

function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\((https?:\/\/[^)\s]+)\)|\*[^*\s][^*]*\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    const k = m.index;
    if (tok.startsWith("**")) out.push(<strong key={k}>{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith("`"))
      out.push(
        <code key={k} className="rounded bg-white/10 px-1 py-px font-mono text-[0.85em]">
          {tok.slice(1, -1)}
        </code>,
      );
    else if (tok.startsWith("["))
      out.push(
        <a key={k} href={m[2]} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] underline underline-offset-2">
          {tok.slice(1, tok.indexOf("]"))}
        </a>,
      );
    else out.push(<em key={k}>{tok.slice(1, -1)}</em>);
    last = k + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const LIST_RE = /^\s*([-*•]|\d+[.)])\s+/;

function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r/g, "").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const key = `b${i}`;
    if (!line.trim()) {
      i++;
      continue;
    }
    if (line.trim().startsWith("```")) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) code.push(lines[i++]);
      i++;
      blocks.push(
        <pre key={key} className="my-2 overflow-x-auto rounded-lg bg-black/40 p-3 font-mono text-[12px] leading-snug">
          {code.join("\n")}
        </pre>,
      );
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
        <div key={key} className="my-2 overflow-x-auto rounded-lg border border-[var(--border)]">
          <table className="w-full border-collapse text-[12.5px]">
            <thead className="bg-white/5">
              <tr>
                {head?.map((c, k) => (
                  <th key={k} className="whitespace-nowrap px-2.5 py-1.5 text-left font-semibold">
                    {inline(c)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((r, k) => (
                <tr key={k} className="border-t border-[var(--border)]">
                  {r.map((c, j) => (
                    <td key={j} className="px-2.5 py-1.5 align-top">
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
    if (LIST_RE.test(line)) {
      const ordered = /^\s*\d/.test(line);
      const entries: string[] = [];
      while (i < lines.length && LIST_RE.test(lines[i])) entries.push(lines[i++].replace(LIST_RE, ""));
      const List = ordered ? "ol" : "ul";
      blocks.push(
        <List key={key} className={cn("my-1.5 space-y-1 pl-5", ordered ? "list-decimal" : "list-disc marker:text-[var(--accent)]")}>
          {entries.map((e, k) => (
            <li key={k}>{inline(e)}</li>
          ))}
        </List>,
      );
      continue;
    }
    if (/^-{3,}$|^\*{3,}$/.test(line.trim())) {
      blocks.push(<hr key={key} className="my-3 border-[var(--border)]" />);
      i++;
      continue;
    }
    if (line.startsWith(">")) {
      blocks.push(
        <blockquote key={key} className="my-2 border-l-2 border-[var(--accent)] pl-3 text-[var(--muted)]">
          {inline(line.replace(/^>\s?/, ""))}
        </blockquote>,
      );
      i++;
      continue;
    }
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      blocks.push(
        <p key={key} className={cn("mb-1 mt-3 font-semibold first:mt-0", heading[1].length <= 2 ? "text-[15px]" : "text-sm")}>
          {inline(heading[2])}
        </p>,
      );
      i++;
      continue;
    }
    blocks.push(
      <p key={key} className="my-1.5">
        {inline(line)}
      </p>,
    );
    i++;
  }
  return <>{blocks}</>;
}

/* ------------------------------------------------------------------ small pieces */

function formatMs(ms: number) {
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)} s`;
}

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

function pretty(text: string) {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

function StepIcon({ step }: { step: Step }) {
  if (step.status === "running") return <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--accent)]" />;
  if (step.status === "error") return <XCircle className="h-3.5 w-3.5 text-red-400" />;
  if (step.name === "odoo_call") return <Boxes className="h-3.5 w-3.5 text-sky-300" />;
  return <Database className="h-3.5 w-3.5 text-[var(--accent)]" />;
}

function StepRow({ step }: { step: Step }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="relative pl-6">
      <span className="absolute left-0 top-1">
        <StepIcon step={step} />
      </span>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-start gap-2 text-left hover:text-ink"
      >
        <span className={cn("flex-1", step.status === "error" && "text-red-300")}>
          {step.label}
          {step.status === "running" ? <span className="text-[var(--muted)]">…</span> : null}
          {step.auto ? (
            <span className="ml-1.5 rounded bg-amber-400/15 px-1 py-px text-[10px] font-medium uppercase text-amber-400">auto</span>
          ) : null}
        </span>
        {step.ms !== undefined ? <span className="shrink-0 tabular-nums text-[var(--muted)]">{formatMs(step.ms)}</span> : null}
        <ChevronRight className={cn("mt-0.5 h-3 w-3 shrink-0 text-[var(--muted)] transition-transform", open && "rotate-90")} />
      </button>
      {open ? (
        <div className="mt-1.5 space-y-1.5">
          <div>
            <p className="mb-0.5 text-[10px] uppercase tracking-wider text-[var(--muted)]">Request</p>
            <pre className="max-h-40 overflow-auto rounded-md bg-black/40 p-2 font-mono text-[11px] leading-snug">
              {JSON.stringify(step.args, null, 2)}
            </pre>
          </div>
          {step.error ? (
            <p className="rounded-md bg-red-500/10 p-2 text-[11px] text-red-300">{step.error}</p>
          ) : step.preview ? (
            <div>
              <p className="mb-0.5 text-[10px] uppercase tracking-wider text-[var(--muted)]">Result</p>
              <pre className="max-h-56 overflow-auto rounded-md bg-black/40 p-2 font-mono text-[11px] leading-snug">
                {pretty(step.preview)}
              </pre>
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function ThoughtRow({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 220;
  return (
    <li className="relative pl-6">
      <span className="absolute left-0 top-1">
        <Brain className="h-3.5 w-3.5 text-violet-300" />
      </span>
      <p className="whitespace-pre-wrap italic text-[var(--muted)]">
        {long && !open ? `${text.slice(0, 220).trim()}…` : text.trim()}
        {long ? (
          <button type="button" onClick={() => setOpen((v) => !v)} className="ml-1 not-italic text-[var(--accent)] hover:underline">
            {open ? "less" : "more"}
          </button>
        ) : null}
      </p>
    </li>
  );
}

/** Live status line while working; a summary once done. Click to see every step. */
function ActivityBlock({ run }: { run: Run }) {
  const running = run.status === "running";
  const [open, setOpen] = useState(false);
  const now = useNow(running);
  const steps = run.activity.filter((a): a is Step => a.type === "step");
  const elapsed = (run.endedAt ?? now) - run.startedAt;

  if (!running && run.activity.length === 0) return null;

  const current = [...steps].reverse().find((s) => s.status === "running");
  const lastItem = run.activity[run.activity.length - 1];
  const liveLabel = current
    ? `${current.label}…`
    : run.answer
      ? "Writing answer…"
      : lastItem?.type === "thought"
        ? "Thinking…"
        : steps.length
          ? "Reading results…"
          : "Thinking…";

  const failed = steps.filter((s) => s.status === "error").length;
  const summary =
    run.status === "waiting"
      ? "Waiting for your approval"
      : run.status === "stopped"
        ? "Stopped"
        : `Worked for ${formatMs(elapsed)}`;

  return (
    <div className="text-[12.5px]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="group flex w-full items-center gap-2 rounded-lg py-1 text-left text-[var(--muted)] hover:text-ink"
      >
        {running ? (
          <span className="relative flex h-3.5 w-3.5 items-center justify-center">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--accent)] opacity-30" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--accent)]" />
          </span>
        ) : (
          <Sparkles className="h-3.5 w-3.5 text-[var(--accent)]" />
        )}
        <span className={cn("flex-1 truncate", running && "rappi-shimmer")}>{running ? liveLabel : summary}</span>
        <span className="shrink-0 tabular-nums">
          {running ? formatMs(elapsed) : `${steps.length} step${steps.length === 1 ? "" : "s"}${failed ? ` · ${failed} failed` : ""}`}
        </span>
        <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform", !open && "-rotate-90")} />
      </button>

      {open ? (
        <ol className="mt-1.5 space-y-2.5 border-l border-[var(--border)] py-1 pl-3">
          {run.activity.length === 0 ? <li className="text-[var(--muted)]">Starting…</li> : null}
          {run.activity.map((a, k) =>
            a.type === "step" ? (
              <StepRow key={a.id} step={a} />
            ) : a.type === "thought" ? (
              <ThoughtRow key={k} text={a.text} />
            ) : (
              <li key={k} className="relative pl-6">
                <span className="absolute left-0 top-1">
                  <MessageSquareText className="h-3.5 w-3.5 text-[var(--muted)]" />
                </span>
                <div className="text-[var(--muted)]">
                  <Markdown text={a.text} />
                </div>
              </li>
            ),
          )}
          {run.model ? <li className="pl-6 text-[11px] text-[var(--muted)]">Model: {run.model}</li> : null}
        </ol>
      ) : null}
    </div>
  );
}

function ArgValue({ value }: { value: unknown }) {
  if (value === null || value === undefined) return <span className="text-[var(--muted)]">empty</span>;
  if (typeof value === "object") {
    return <code className="break-all font-mono text-[11px]">{JSON.stringify(value)}</code>;
  }
  return <span className="break-all">{String(value)}</span>;
}

function ApprovalCard({
  pending,
  onDecide,
  disabled,
}: {
  pending: Pending;
  onDecide: (d: "approve" | "reject") => void;
  disabled: boolean;
}) {
  const [raw, setRaw] = useState(false);
  const entries = Object.entries(pending.args);
  const destructive = /delete|unlink/i.test(`${pending.name} ${String(pending.args.method ?? "")}`);
  return (
    <div
      className={cn(
        "rounded-xl border p-3",
        destructive ? "border-red-500/60 bg-red-500/10" : "border-[var(--accent)] bg-[var(--accent-muted)]",
      )}
    >
      <div className="flex items-center gap-2">
        {destructive ? <AlertTriangle className="h-4 w-4 text-red-400" /> : <ShieldCheck className="h-4 w-4 text-[var(--accent)]" />}
        <p className={cn("text-[11px] font-semibold uppercase tracking-wider", destructive ? "text-red-300" : "text-[var(--accent)]")}>
          {destructive ? "Approve deletion?" : "Approve change?"}
        </p>
      </div>
      <p className="mt-1.5 text-sm font-medium">{pending.label}</p>
      {raw ? (
        <pre className="mt-2 max-h-56 overflow-auto rounded-md bg-black/40 p-2 font-mono text-[11px] leading-snug">
          {JSON.stringify(pending.args, null, 2)}
        </pre>
      ) : (
        <dl className="mt-2 space-y-1 rounded-md bg-black/25 p-2 text-[12px]">
          {entries.map(([k, v]) => (
            <div key={k} className="grid grid-cols-[88px_1fr] gap-2">
              <dt className="text-[var(--muted)]">{k}</dt>
              <dd>
                <ArgValue value={v} />
              </dd>
            </div>
          ))}
        </dl>
      )}
      <button type="button" onClick={() => setRaw((v) => !v)} className="mt-1 text-[11px] text-[var(--muted)] hover:text-ink">
        {raw ? "Show summary" : "Show raw request"}
      </button>
      <div className="mt-2.5 flex gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onDecide("approve")}
          className={cn(
            "flex-1 rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-50",
            destructive ? "bg-red-500 text-white hover:bg-red-400" : "bg-[var(--accent)] text-black hover:opacity-90",
          )}
        >
          Approve
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onDecide("reject")}
          className="flex-1 rounded-lg border border-[var(--border)] px-3 py-2 text-sm hover:bg-[var(--hover)] disabled:opacity-50"
        >
          Decline
        </button>
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1200);
        });
      }}
      className="flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-[var(--hover)] hover:text-ink"
      aria-label="Copy answer"
    >
      {done ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {done ? "Copied" : "Copy"}
    </button>
  );
}

/* ------------------------------------------------------------------ panel */

/** Rendered in the browser only (see rappi-agent.tsx), so localStorage is safe to read here. */
export default function RappiAgentPanel() {
  const [saved] = useState(() => {
    const s = load<Saved | null>(STORE_KEY, null);
    if (!s || s.v !== 2) return null;
    // A reload mid-run leaves nothing running.
    s.turns = s.turns.map((t) => (t.kind === "run" && t.status === "running" ? { ...t, status: "stopped", endedAt: t.endedAt ?? Date.now() } : t));
    return s;
  });
  const [open, setOpen] = useState(() => load(OPEN_KEY, window.innerWidth >= 1280));
  const [wide, setWide] = useState(() => load(WIDE_KEY, false));
  const [autoApprove, setAutoApprove] = useState(() => load<unknown>(AUTO_KEY, false) === true);
  const [history, setHistory] = useState<HistoryMessage[]>(saved?.history ?? []);
  const [turns, setTurns] = useState<Turn[]>(saved?.turns ?? []);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const stickRef = useRef(true);

  const lastRun = [...turns].reverse().find((t): t is Run => t.kind === "run");
  const waiting = lastRun?.status === "waiting" && lastRun.pending;

  useEffect(() => {
    if (!busy) save(STORE_KEY, { v: 2, history, turns: turns.slice(-MAX_SAVED_TURNS) } satisfies Saved);
  }, [history, turns, busy]);

  // Follow the stream unless the admin has scrolled up to read.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [turns]);

  const toggle = useCallback((next: boolean) => {
    setOpen(next);
    save(OPEN_KEY, next);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        toggle(!open);
      } else if (e.key === "Escape" && open && window.innerWidth < 1024) {
        toggle(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, toggle]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Auto-grow the composer.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  const patchRun = useCallback((runId: string, fn: (r: Run) => Run) => {
    setTurns((prev) => prev.map((t) => (t.kind === "run" && t.id === runId ? fn(t) : t)));
  }, []);

  async function stream(messages: HistoryMessage[], runId: string, decision?: "approve" | "reject") {
    setBusy(true);
    stickRef.current = true;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let finished = false;

    const finish = (status: Run["status"], extra: Partial<Run> = {}) => {
      finished = true;
      patchRun(runId, (r) => ({ ...r, status, endedAt: Date.now(), ...extra }));
    };

    try {
      const res = await fetch("/api/admin/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, decision, autoApprove }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        finish("error", { error: data?.error ?? `Request failed (${res.status}).` });
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let pendingSeen: Pending | undefined;
      let errorSeen: string | undefined;

      const onEvent = (e: Record<string, unknown>) => {
        switch (e.t) {
          case "model":
            patchRun(runId, (r) => ({ ...r, model: String(e.name) }));
            break;
          case "thinking":
            patchRun(runId, (r) => {
              const activity = [...r.activity];
              const last = activity[activity.length - 1];
              if (last?.type === "thought") activity[activity.length - 1] = { ...last, text: last.text + String(e.v) };
              else activity.push({ type: "thought", text: String(e.v) });
              return { ...r, activity };
            });
            break;
          case "text":
            patchRun(runId, (r) => ({ ...r, answer: r.answer + String(e.v) }));
            break;
          case "step_start":
            patchRun(runId, (r) => {
              const activity = [...r.activity];
              // Text written before a lookup is narration, not the final answer.
              if (r.answer.trim()) activity.push({ type: "note", text: r.answer.trim() });
              activity.push({
                type: "step",
                id: String(e.id),
                label: String(e.label),
                name: String(e.name),
                args: (e.args as Record<string, unknown>) ?? {},
                status: "running",
                ...(e.auto ? { auto: true } : {}),
              });
              return { ...r, activity, answer: "" };
            });
            break;
          case "step_end":
            patchRun(runId, (r) => ({
              ...r,
              activity: r.activity.map((a) =>
                a.type === "step" && a.id === e.id
                  ? {
                      ...a,
                      status: e.ok ? "ok" : "error",
                      ms: Number(e.ms),
                      preview: e.preview as string | undefined,
                      error: e.error as string | undefined,
                    }
                  : a,
              ),
            }));
            break;
          case "approval":
            pendingSeen = {
              id: String(e.id),
              label: String(e.label),
              name: String(e.name),
              args: (e.args as Record<string, unknown>) ?? {},
            };
            patchRun(runId, (r) => {
              const activity = [...r.activity];
              if (r.answer.trim()) activity.push({ type: "note", text: r.answer.trim() });
              return { ...r, activity, answer: "" };
            });
            break;
          case "error":
            errorSeen = String(e.message);
            break;
          case "done":
            setHistory(e.messages as HistoryMessage[]);
            break;
        }
      };

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 1);
          if (line.trim()) onEvent(JSON.parse(line));
        }
      }

      if (errorSeen) finish("error", { error: errorSeen });
      else if (pendingSeen) finish("waiting", { pending: pendingSeen });
      else finish("done", { pending: undefined });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") finish("stopped");
      else finish("error", { error: "Connection lost. Try again." });
    } finally {
      if (!finished) finish("done");
      abortRef.current = null;
      setBusy(false);
    }
  }

  function ask(text: string) {
    const q = text.trim();
    if (!q || busy || waiting) return;
    setInput("");
    const runId = uid();
    setTurns((prev) => [
      ...prev,
      { kind: "user", id: uid(), text: q },
      { kind: "run", id: runId, startedAt: Date.now(), status: "running", activity: [], answer: "" },
    ]);
    const next: HistoryMessage[] = [...history, { role: "user", content: q }];
    setHistory(next);
    void stream(next, runId);
  }

  function decide(d: "approve" | "reject") {
    if (!lastRun || busy) return;
    patchRun(lastRun.id, (r) => ({ ...r, status: "running", pending: undefined, endedAt: undefined }));
    void stream(history, lastRun.id, d);
  }

  function stop() {
    abortRef.current?.abort();
  }

  function reset() {
    abortRef.current?.abort();
    setHistory([]);
    setTurns([]);
    setInput("");
    inputRef.current?.focus();
  }

  function setWideMode(next: boolean) {
    setWide(next);
    save(WIDE_KEY, next);
  }

  function setAutoMode(next: boolean) {
    setAutoApprove(next);
    save(AUTO_KEY, next);
  }

  const lastUserText = [...turns].reverse().find((t) => t.kind === "user")?.text;

  const panel = (
    <div className="flex h-full flex-col bg-[var(--footer-bg)]">
      {/* header */}
      <div className="flex items-center gap-2.5 border-b border-[var(--border)] px-4 py-3">
        <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent)] text-black">
          <Bot className="h-[18px] w-[18px]" />
          <span
            className={cn(
              "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--footer-bg)]",
              busy ? "animate-pulse bg-amber-400" : "bg-emerald-400",
            )}
          />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-[family-name:var(--font-oswald)] text-[15px] uppercase leading-none tracking-wide">Rappi Agent</p>
          <p className="mt-1 truncate text-[11px] text-[var(--muted)]">
            {busy
              ? "Working…"
              : autoApprove
                ? "Full access · auto-approve on (deletes still ask)"
                : "Full access · changes need your approval"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAutoMode(!autoApprove)}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg hover:bg-[var(--hover)]",
            autoApprove ? "text-amber-400" : "text-[var(--muted)] hover:text-ink",
          )}
          aria-pressed={autoApprove}
          aria-label={autoApprove ? "Turn off auto-approve" : "Turn on auto-approve"}
          title={
            autoApprove
              ? "Auto-approve is on: changes run without asking. Deletes still ask. Click to turn off."
              : "Auto-approve is off: every change asks first. Click to let changes run without asking (deletes still ask)."
          }
        >
          <Zap className={cn("h-4 w-4", autoApprove && "fill-current")} />
        </button>
        <button
          type="button"
          onClick={reset}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--hover)] hover:text-ink"
          aria-label="New chat"
          title="New chat"
        >
          <Plus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setWideMode(!wide)}
          className="hidden h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--hover)] hover:text-ink lg:flex"
          aria-label={wide ? "Narrow panel" : "Wide panel"}
          title={wide ? "Narrow panel" : "Wide panel"}
        >
          {wide ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={() => toggle(false)}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--hover)] hover:text-ink"
          aria-label="Close Rappi Agent"
          title="Close (Ctrl+J)"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* conversation */}
      <div
        ref={scrollRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
        }}
        className="flex-1 overflow-y-auto px-4 py-4 text-sm"
      >
        {turns.length === 0 ? (
          <div className="flex min-h-full flex-col justify-center gap-4 pb-6">
            <div>
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent-muted)] text-[var(--accent)]">
                <Sparkles className="h-5 w-5" />
              </span>
              <p className="mt-3 font-[family-name:var(--font-oswald)] text-lg uppercase tracking-wide">How can I help?</p>
              <p className="mt-1 text-[13px] text-[var(--muted)]">
                Ask about sales, stock, customers or orders across the website and Odoo, or tell me what to change. Nothing
                changes until you approve it.
              </p>
            </div>
            <div className="grid gap-2">
              {SUGGESTIONS.map(({ icon: Icon, text }) => (
                <button
                  key={text}
                  type="button"
                  onClick={() => ask(text)}
                  className="flex items-center gap-2.5 rounded-xl border border-[var(--border)] px-3 py-2.5 text-left text-[13px] transition-colors hover:border-[var(--accent)] hover:bg-[var(--hover)]"
                >
                  <Icon className="h-4 w-4 shrink-0 text-[var(--accent)]" />
                  {text}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="space-y-5">
          {turns.map((t) =>
            t.kind === "user" ? (
              <div key={t.id} className="flex justify-end">
                <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-[var(--accent-muted)] px-3.5 py-2 text-[13.5px]">
                  {t.text}
                </div>
              </div>
            ) : (
              <div key={t.id} className="space-y-2">
                <ActivityBlock run={t} />
                {t.answer ? (
                  <div className="break-words text-[13.5px] leading-relaxed">
                    <Markdown text={t.answer} />
                    {t.status === "running" ? (
                      <span className="ml-0.5 inline-block h-3.5 w-1.5 translate-y-0.5 animate-pulse bg-[var(--accent)]" />
                    ) : null}
                  </div>
                ) : null}
                {t.status === "waiting" && t.pending ? (
                  <ApprovalCard pending={t.pending} onDecide={decide} disabled={busy} />
                ) : null}
                {t.status === "error" ? (
                  <div className="flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-[12.5px] text-red-300">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span className="flex-1">{t.error}</span>
                  </div>
                ) : null}
                {t.status !== "running" && t.status !== "waiting" ? (
                  <div className="flex items-center gap-1 text-[11px] text-[var(--muted)]">
                    {t.answer ? <CopyButton text={t.answer} /> : null}
                    {t.id === lastRun?.id && lastUserText ? (
                      <button
                        type="button"
                        onClick={() => ask(lastUserText)}
                        disabled={busy}
                        className="flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-[var(--hover)] hover:text-ink disabled:opacity-40"
                      >
                        <RotateCcw className="h-3 w-3" />
                        Ask again
                      </button>
                    ) : null}
                    {t.status === "stopped" ? <span className="px-1.5">Stopped</span> : null}
                  </div>
                ) : null}
              </div>
            ),
          )}
        </div>
      </div>

      {/* composer */}
      <form
        className="border-t border-[var(--border)] p-3"
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
      >
        <div className="flex items-end gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-2 transition-colors focus-within:border-[var(--accent)]">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                ask(input);
              }
            }}
            rows={1}
            placeholder={waiting ? "Approve or decline the change above" : "Ask Rappi Agent…"}
            disabled={Boolean(waiting)}
            className="max-h-40 min-h-[24px] flex-1 resize-none bg-transparent px-1 py-0.5 text-[13.5px] outline-none placeholder:text-[var(--muted)] focus:outline-none focus-visible:outline-none disabled:opacity-60"
          />
          {busy ? (
            <button
              type="button"
              onClick={stop}
              aria-label="Stop"
              title="Stop"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-ink hover:bg-white/20"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={Boolean(waiting) || !input.trim()}
              aria-label="Send"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)] text-black transition-opacity disabled:opacity-30"
            >
              <Send className="h-4 w-4" />
            </button>
          )}
        </div>
        <p className="mt-1.5 px-1 text-[10.5px] text-[var(--muted)]">
          Enter to send · Shift+Enter for a new line · Ctrl+J to open or close
        </p>
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
          <aside
            className={cn(
              "fixed inset-y-0 right-0 z-50 w-full max-w-[460px] border-l border-[var(--border)] shadow-2xl lg:sticky lg:top-0 lg:z-auto lg:h-dvh lg:max-w-none lg:shrink-0 lg:shadow-none",
              wide ? "lg:w-[600px]" : "lg:w-[400px]",
            )}
          >
            {panel}
          </aside>
        </>
      ) : (
        <button
          type="button"
          onClick={() => toggle(true)}
          title="Open Rappi Agent (Ctrl+J)"
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-[var(--accent)] py-3 pl-3.5 pr-4 text-sm font-semibold text-black shadow-lg shadow-black/40 transition-transform hover:scale-[1.03]"
        >
          <Bot className="h-4 w-4" />
          Rappi Agent
        </button>
      )}
    </>
  );
}
