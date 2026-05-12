"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Bot, MessageSquare, Send, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type AskCitation = {
  index: number;
  sermonId: string;
  title: string;
  date: string | null;
  excerpt: string;
};

type Msg = { role: "user" | "assistant"; content: string; citations?: AskCitation[] };

export const ASK_ASSISTANT_INTRO =
  "Hi — I’m your sermon assistant. I only answer from Pastor Vaughn’s indexed teachings and cite the sermon excerpts I used. For exact keyword or scripture lookup, use Search in the header.";

type AskAssistantChatProps = {
  variant: "page" | "widget";
  className?: string;
};

export function AskAssistantChat({ variant, className }: AskAssistantChatProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<Msg[]>([{ role: "assistant", content: ASK_ASSISTANT_INTRO }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const nextUser: Msg = { role: "user", content: text };
    setInput("");
    setMessages((m) => [...m, nextUser]);
    setLoading(true);

    const history = [...messages, nextUser].map(({ role, content }) => ({ role, content }));

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });
      const json = (await res.json()) as {
        reply?: string;
        error?: string;
        citations?: AskCitation[];
      };
      const reply =
        json.reply ?? (json.error ? `Something went wrong: ${json.error}` : "No reply.");
      if (json.error && !json.reply) {
        toast.error("Assistant could not reply", { description: json.error });
      }
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: reply,
          citations: Array.isArray(json.citations) ? json.citations : [],
        },
      ]);
    } catch {
      toast.error("Network error", { description: "Check your connection and try again." });
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "Network error. Check your connection and try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const isPage = variant === "page";

  return (
    <div
      className={cn(
        isPage
          ? "mx-auto flex min-h-[calc(100dvh-8rem)] max-w-3xl flex-col px-4 py-8"
          : "flex min-h-0 flex-1 flex-col overflow-hidden",
        className,
      )}
    >
      {isPage && (
        <div className="mb-6 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Layer 2</p>
          <h1 className="text-2xl font-bold tracking-tight">Ask AI</h1>
          <p className="text-sm text-muted-foreground">
            Answers are grounded in Pastor Vaughn&apos;s indexed teachings and should cite retrieved sermon
            excerpts. For browse mode, use{" "}
            <button
              type="button"
              onClick={() => router.push("/search")}
              className="font-medium text-foreground underline underline-offset-2 hover:text-primary"
            >
              Search
            </button>
            .
          </p>
        </div>
      )}

      {!isPage && (
        <div className="mb-3 shrink-0 space-y-1 border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" aria-hidden />
            <p className="text-sm font-semibold text-foreground">Ask AI</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Same assistant as the full page — grounded in indexed teachings with sources.{" "}
            <Link href="/ask" className="font-medium text-primary underline-offset-2 hover:underline">
              Open Ask page
            </Link>
          </p>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-border bg-card/50 shadow-sm">
        <div
          className={cn(
            "min-h-0 flex-1 space-y-4 overflow-y-auto p-4",
            isPage ? "min-h-[280px] md:min-h-[360px] md:p-6" : "min-h-0",
          )}
        >
          {messages.map((m, i) => (
            <div
              key={i}
              className={cn("flex gap-2 sm:gap-3", m.role === "user" ? "flex-row-reverse" : "flex-row")}
            >
              <div
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border sm:h-8 sm:w-8",
                  m.role === "user"
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "border-border bg-muted text-muted-foreground",
                )}
              >
                {m.role === "user" ? <User className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <Bot className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
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
                  {m.content}
                </div>
                {m.role === "assistant" && m.citations && m.citations.length > 0 && (
                  <div className="rounded-xl border border-border/80 bg-background/80 px-2.5 py-2 text-xs dark:bg-background/40 sm:px-3">
                    <p className="mb-1.5 font-medium text-muted-foreground">Sources</p>
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
                          {c.date && <span className="text-muted-foreground"> · {c.date}</span>}
                          {c.excerpt && (
                            <p className="mt-0.5 line-clamp-2 text-muted-foreground">{c.excerpt}</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-2 sm:gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-muted sm:h-8 sm:w-8">
                <Bot className="h-3.5 w-3.5 text-muted-foreground sm:h-4 sm:w-4" />
              </div>
              <div className="rounded-2xl bg-muted/80 px-3 py-2 text-sm text-muted-foreground sm:px-4 sm:py-2.5">
                Thinking…
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={(e) => void onSubmit(e)} className="border-t border-border p-2.5 sm:p-3 md:p-4">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question…"
              className="min-h-10 flex-1 sm:min-h-11"
              disabled={loading}
              aria-label="Message"
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
