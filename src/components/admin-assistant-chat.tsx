"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowRight,
  Bot,
  ExternalLink,
  Loader2,
  Send,
  Shield,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ProposedAction, ToolResult } from "@/lib/admin-assistant/tools";
import {
  isAssistantNavChipResult,
  mergeSuggestNavigationChips,
  stripAndExtractNavigationBrackets,
} from "@/lib/assistant-chat-markup";
import { AssistantMessageBody } from "@/components/assistant-message-body";
import type { AskCitation } from "@/components/ask-assistant-chat";
import { fetchReindexEmbeddingsBatched } from "@/lib/embeddings/reindex-batched-fetch";

type ProposedActionResult = { proposed_action: ProposedAction };

type Msg = {
  role: "user" | "assistant";
  content: string;
  citations?: AskCitation[];
  toolResults?: ToolResult[];
};

const ADMIN_INTRO =
  "Hi — I'm your admin copilot. I can help you navigate the app, search the sermon archive, " +
  "look up sermon details, check who has access, and answer questions about Pastor Vaughn's indexed teachings.";

const STARTER_PROMPTS: { label: string; message: string }[] = [
  { label: "How many sermons?", message: "How many sermons do we have?" },
  { label: "Recent PDF imports", message: "Show me recent PDF imports" },
  { label: "Upload spreadsheet", message: "How do I upload a spreadsheet?" },
  { label: "Romans 8", message: "What did we teach on Romans 8?" },
];

function isProposedActionResult(r: unknown): r is ProposedActionResult {
  return (
    r != null &&
    typeof r === "object" &&
    "proposed_action" in r &&
    (r as ProposedActionResult).proposed_action != null
  );
}

function NavChip({ result }: { result: { url: string; label: string } }) {
  return (
    <Link
      href={result.url}
      className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-2.5 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10 dark:bg-primary/10 dark:hover:bg-primary/20"
    >
      <ArrowRight className="size-3" aria-hidden />
      {result.label}
    </Link>
  );
}

function ProposedActionCard({ action }: { action: ProposedAction }) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");

  async function onConfirm() {
    setStatus("loading");
    try {
      let endpoint = "";
      let method = "POST";
      if (action.action === "reindex_embeddings") {
        endpoint = "/api/admin/reindex-embeddings";
      } else if (action.action === "backfill_full_text") {
        endpoint = "/api/admin/backfill-full-text";
      } else if (action.action === "delete_sermon" && action.sermon_id) {
        endpoint = `/api/admin/sermons/${action.sermon_id}`;
        method = "DELETE";
      } else {
        toast.error("Invalid action");
        setStatus("error");
        return;
      }

      if (action.action === "reindex_embeddings") {
        const result = await fetchReindexEmbeddingsBatched();
        if (!result.ok) {
          toast.error("Action failed", { description: result.error });
          setStatus("error");
          return;
        }
        const warn =
          result.errors.length > 0
            ? ` (${result.errors.slice(0, 2).join("; ")})`
            : "";
        toast.success("Done", {
          description: `${result.totalSermons} sermons · ${result.totalChunks} chunks${warn ? ` — warnings:${warn}` : ""}`,
        });
        setStatus("done");
        return;
      }

      const res = await fetch(endpoint, { method, credentials: "same-origin" });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error("Action failed", { description: json.error ?? res.statusText });
        setStatus("error");
        return;
      }
      toast.success("Done", { description: action.label });
      setStatus("done");
    } catch {
      toast.error("Network error");
      setStatus("error");
    }
  }

  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2.5 dark:bg-amber-500/10">
      <p className="mb-2 text-xs font-medium text-amber-700 dark:text-amber-400">
        Proposed action
      </p>
      <p className="mb-2.5 text-sm text-foreground">{action.label}</p>
      {action.sermon_title && (
        <p className="mb-2 text-xs text-muted-foreground">
          Sermon: {action.sermon_title}
        </p>
      )}
      {status === "idle" && (
        <Button
          size="sm"
          variant="destructive"
          className="gap-1.5"
          onClick={() => void onConfirm()}
        >
          Confirm
        </Button>
      )}
      {status === "loading" && (
        <Button size="sm" variant="destructive" disabled className="gap-1.5">
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          Running…
        </Button>
      )}
      {status === "done" && (
        <p className="text-xs font-medium text-green-600 dark:text-green-400">
          Completed successfully.
        </p>
      )}
      {status === "error" && (
        <div className="flex items-center gap-2">
          <p className="text-xs text-destructive">Failed.</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setStatus("idle");
            }}
          >
            Retry
          </Button>
        </div>
      )}
    </div>
  );
}

function ToolResultCards({ results }: { results: ToolResult[] }) {
  const navResults = results
    .filter((r) => r.name === "suggest_navigation" && isAssistantNavChipResult(r.result))
    .map((r) => r.result as { url: string; label: string });

  const proposedActions = results
    .filter((r) => r.name === "propose_action" && isProposedActionResult(r.result))
    .map((r) => (r.result as ProposedActionResult).proposed_action);

  const dataResults = results.filter(
    (r) =>
      r.name !== "suggest_navigation" &&
      r.name !== "propose_action" &&
      r.result != null,
  );

  if (navResults.length === 0 && dataResults.length === 0 && proposedActions.length === 0) return null;

  return (
    <div className="space-y-2">
      {proposedActions.map((pa, i) => (
        <ProposedActionCard key={`pa-${i}`} action={pa} />
      ))}
      {navResults.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {navResults.map((nr, i) => (
            <NavChip key={i} result={nr} />
          ))}
        </div>
      )}
      {dataResults.map((dr, i) => {
        const res = dr.result as Record<string, unknown> | unknown[];
        const sermons = Array.isArray(res)
          ? res
          : "sermons" in (res as Record<string, unknown>)
            ? (res as { sermons: unknown[] }).sermons
            : null;
        const total =
          !Array.isArray(res) && "total" in (res as Record<string, unknown>)
            ? (res as { total: number }).total
            : null;

        if (sermons && Array.isArray(sermons) && sermons.length > 0) {
          return (
            <div
              key={i}
              className="rounded-lg border border-border/80 bg-background/80 px-2.5 py-2 text-xs dark:bg-background/40"
            >
              <p className="mb-1 font-medium text-muted-foreground">
                {dr.name === "search_archive" ? "Search results" : "Sermons"}
                {total != null && ` (${total} total)`}
              </p>
              <ul className="space-y-1">
                {(sermons as { id: string; title: string; preacher?: string; date?: string }[])
                  .slice(0, 8)
                  .map((s) => (
                    <li key={s.id} className="flex items-center gap-1.5">
                      <Link
                        href={`/sermon/${s.id}`}
                        className="font-medium text-primary underline-offset-2 hover:underline"
                      >
                        {s.title}
                      </Link>
                      {s.date && (
                        <span className="text-muted-foreground">
                          · {String(s.date).slice(0, 10)}
                        </span>
                      )}
                      <Link
                        href={`/admin/sermons#${s.id}`}
                        className="ml-auto text-muted-foreground hover:text-foreground"
                        title="Edit in admin"
                      >
                        <ExternalLink className="size-3" />
                      </Link>
                    </li>
                  ))}
              </ul>
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}

type AdminAssistantChatProps = {
  className?: string;
};

export function AdminAssistantChat({ className }: AdminAssistantChatProps) {
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: ADMIN_INTRO },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const showStarterButtons =
    messages.length === 1 && messages[0]?.role === "assistant" && !loading;

  async function sendUserMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const nextUser: Msg = { role: "user", content: trimmed };
    const historyMessages: Msg[] = [...messages, nextUser];
    setInput("");
    setMessages(historyMessages);
    setLoading(true);

    const history = historyMessages.map(({ role, content }) => ({ role, content }));

    try {
      const res = await fetch("/api/admin/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ messages: history }),
      });
      const json = (await res.json()) as {
        reply?: string;
        error?: string;
        tool_results?: ToolResult[];
      };

      if (res.status === 401) {
        toast.error("Not authorized", {
          description: "Admin access required for this assistant.",
        });
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content:
              "You need to be signed in as an admin to use this assistant. Please sign in at /login.",
          },
        ]);
        return;
      }

      const reply =
        json.reply ??
        (json.error ? `Something went wrong: ${json.error}` : "No reply.");

      if (json.error && !json.reply) {
        toast.error("Assistant error", { description: json.error });
      }

      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: reply,
          toolResults: Array.isArray(json.tool_results)
            ? json.tool_results
            : [],
        },
      ]);
    } catch {
      toast.error("Network error", {
        description: "Check your connection and try again.",
      });
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: "Network error. Check your connection and try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    void sendUserMessage(input);
  }

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col overflow-hidden", className)}>
      <div className="mb-3 shrink-0 space-y-1 border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" aria-hidden />
          <p className="text-sm font-semibold text-foreground">Admin Copilot</p>
        </div>
        <p className="text-xs text-muted-foreground">
          App help, sermon data, user access, and teaching Q&A — all in one place.
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-border bg-card/50 shadow-sm">
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          {messages.map((m, i) => {
            const bracketParsed =
              m.role === "assistant" ? stripAndExtractNavigationBrackets(m.content) : null;
            const bubbleText = bracketParsed ? bracketParsed.cleanText : m.content;
            const displayToolResults =
              m.role === "assistant"
                ? mergeSuggestNavigationChips(m.toolResults, bracketParsed?.navigations ?? [])
                : m.toolResults;

            return (
              <div
                key={i}
                className={cn(
                  "flex gap-2 sm:gap-3",
                  m.role === "user" ? "flex-row-reverse" : "flex-row",
                )}
              >
                <div
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border sm:h-8 sm:w-8",
                    m.role === "user"
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-400",
                  )}
                >
                  {m.role === "user" ? (
                    <User className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  ) : (
                    <Bot className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  )}
                </div>
                <div className="min-w-0 max-w-[90%] space-y-2">
                  <div
                    className={cn(
                      "rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap sm:px-4 sm:py-2.5",
                      m.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/80 text-foreground",
                    )}
                  >
                    <AssistantMessageBody role={m.role} content={bubbleText} />
                  </div>
                  {showStarterButtons && i === 0 && m.role === "assistant" && (
                    <div className="flex flex-col gap-2 pt-1">
                      <p className="text-xs font-medium text-muted-foreground">Try one tap:</p>
                      <div className="flex flex-col gap-2">
                        {STARTER_PROMPTS.map((p) => (
                          <Button
                            key={p.message}
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={loading}
                            className="h-auto min-h-9 w-full justify-start whitespace-normal px-3 py-2 text-left text-xs font-normal sm:text-sm"
                            onClick={() => void sendUserMessage(p.message)}
                          >
                            {p.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                  {displayToolResults && displayToolResults.length > 0 && (
                    <ToolResultCards results={displayToolResults} />
                  )}
                  {m.citations && m.citations.length > 0 && (
                    <div className="rounded-xl border border-border/80 bg-background/80 px-2.5 py-2 text-xs dark:bg-background/40 sm:px-3">
                      <p className="mb-1.5 font-medium text-muted-foreground">
                        Sources
                      </p>
                      <ul className="space-y-1.5">
                        {m.citations.map((c) => (
                          <li key={`${c.sermonId}-${c.index}`}>
                            <span className="font-mono text-[0.65rem] text-muted-foreground sm:text-[0.7rem]">
                              [{c.index}]
                            </span>{" "}
                            <Link
                              href={`/sermon/${c.sermonId}`}
                              className="font-medium text-primary underline-offset-2 hover:underline"
                            >
                              {c.title}
                            </Link>
                            {c.date && (
                              <span className="text-muted-foreground">
                                {" "}
                                · {c.date}
                              </span>
                            )}
                            {c.excerpt && (
                              <p className="mt-0.5 line-clamp-2 text-muted-foreground">
                                {c.excerpt}
                              </p>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {loading && (
            <div className="flex gap-2 sm:gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/10 sm:h-8 sm:w-8">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-600 dark:text-amber-400 sm:h-4 sm:w-4" />
              </div>
              <div className="rounded-2xl bg-muted/80 px-3 py-2 text-sm text-muted-foreground sm:px-4 sm:py-2.5">
                Working on it…
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={onSubmit} className="border-t border-border p-2.5 sm:p-3">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything about the app…"
              className="min-h-10 flex-1 sm:min-h-11"
              disabled={loading}
              aria-label="Admin assistant message"
            />
            <Button
              type="submit"
              disabled={loading || !input.trim()}
              size="lg"
              className="hidden gap-2 sm:inline-flex"
            >
              <Send className="h-4 w-4" />
              Send
            </Button>
            <Button
              type="submit"
              disabled={loading || !input.trim()}
              size="icon"
              className="h-10 w-10 shrink-0 sm:hidden"
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
