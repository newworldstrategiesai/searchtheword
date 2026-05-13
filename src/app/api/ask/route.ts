import { vectorToPgLiteral } from "@/lib/embeddings/hybrid-search";
import { embedQuery, embeddingsConfigured } from "@/lib/embeddings/openai-embed";
import { searchSermonsServer } from "@/lib/sermons";
import { createPublicSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const SYSTEM_BASE = `You are the SearchTheWord assistant for Pastor Vaughn's teaching archive.
Answer only from the numbered retrieved excerpts. Do not use general Bible knowledge, denominational assumptions, or model memory.
Begin substantive answers with "According to Pastor Vaughn's teachings," unless the excerpts are insufficient.
Cite every factual claim with bracket labels like [1] or [2].
If the excerpts do not contain enough to answer, say: "I don't have enough from Pastor Vaughn's indexed teachings to answer that faithfully yet." Then suggest one relevant search term.`;

export type AskCitation = {
  index: number;
  sermonId: string;
  title: string;
  date: string | null;
  excerpt: string;
};

type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

const QUESTION_STOP_WORDS = new Set([
  "a",
  "an",
  "about",
  "and",
  "are",
  "can",
  "do",
  "does",
  "explain",
  "for",
  "important",
  "is",
  "me",
  "of",
  "please",
  "tell",
  "the",
  "to",
  "what",
  "why",
  "with",
]);

function openAiFailureReply(status: number, errBody: string): string {
  let code: string | undefined;
  let message = "";
  try {
    const j = JSON.parse(errBody) as { error?: { code?: string; message?: string } };
    code = j.error?.code;
    message = (j.error?.message ?? "").toLowerCase();
  } catch {
    /* ignore */
  }
  if (code === "insufficient_quota" || message.includes("quota") || message.includes("billing")) {
    return (
      "The AI assistant cannot run right now because the OpenAI account has hit its usage limit or billing needs attention. " +
      "Search still works for browsing sermons. Ask your site admin to check OpenAI billing, then try again."
    );
  }
  if (status === 429 || message.includes("rate limit")) {
    return "The AI service is busy right now. Wait a minute and try again, or use Search to browse sermons.";
  }
  if (status === 401) {
    return "The AI assistant is misconfigured (API key). Search still works; ask your site admin to fix the server API key.";
  }
  return "AI could not respond right now. Try again in a moment, or use Search to browse sermons.";
}

function buildArchiveSearchQueries(question: string): string[] {
  const raw = question.trim();
  const normalized = raw
    .replace(/[^\p{L}\p{N}: ]+/gu, " ")
    .split(/\s+/)
    .filter((word) => word.length > 1 && !QUESTION_STOP_WORDS.has(word.toLowerCase()))
    .join(" ")
    .trim();

  return Array.from(new Set([raw, normalized].filter((q) => q.length >= 2)));
}

async function buildArchiveRecordContext(question: string) {
  const queries = buildArchiveSearchQueries(question);
  const citations: AskCitation[] = [];
  const lines: string[] = [];
  const seen = new Set<string>();

  for (const query of queries) {
    const { results } = await searchSermonsServer({
      q: query,
      page: 1,
      limit: 6,
      mode: "all",
    });

    for (const result of results) {
      if (seen.has(result.id)) continue;
      const excerpt = [
        result.summary ? `Summary: ${result.summary}` : "",
        result.core_doctrine ? `Core doctrine: ${result.core_doctrine}` : "",
        result.scripture_ref ? `Scripture: ${result.scripture_ref}` : "",
      ]
        .filter(Boolean)
        .join("\n")
        .replace(/\s+/g, " ")
        .trim();

      if (!excerpt) continue;

      seen.add(result.id);
      const n = citations.length + 1;
      lines.push(`[${n}] ${result.title} (${result.date ?? "unknown date"}): ${excerpt.slice(0, 1400)}`);
      citations.push({
        index: n,
        sermonId: result.id,
        title: result.title,
        date: result.date,
        excerpt: excerpt.slice(0, 220),
      });

      if (citations.length >= 6) break;
    }

    if (citations.length > 0) break;
  }

  return {
    ragSection: lines.length
      ? `\n\n--- Retrieved archive records from Pastor Vaughn's spreadsheet/search index (use these when relevant) ---\n${lines.join("\n\n")}`
      : "",
    citations,
  };
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const messages = (body as { messages?: ChatMessage[] }).messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages array required" }, { status: 400 });
  }

  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUser?.content?.trim()) {
    return NextResponse.json({ error: "Last user message required" }, { status: 400 });
  }

  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    return NextResponse.json({
      reply:
        "The assistant is not configured yet. Your administrator can add a server-side chat API key (for example in `.env.local`) to enable this feature.\n\nUntil then, use Search to explore the sermon archive by topic, scripture, or keywords.",
      citations: [] as AskCitation[],
    });
  }

  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";

  let ragSection = "";
  let citations: AskCitation[] = [];

  if (embeddingsConfigured()) {
    try {
      const embedding = await embedQuery(lastUser.content);
      if (embedding) {
        const supabase = createPublicSupabaseClient();
        const { data: chunks, error } = await supabase.rpc("match_sermon_chunks", {
          query_embedding: vectorToPgLiteral(embedding),
          match_count: 12,
        });
        if (!error && chunks?.length) {
          const rows = chunks as {
            sermon_id: string;
            sermon_title: string;
            sermon_date: string | null;
            chunk_index: number;
            content: string;
            similarity: number;
          }[];
          const lines: string[] = [];
          rows.forEach((c, i) => {
            const n = i + 1;
            const excerpt = c.content.replace(/\s+/g, " ").trim().slice(0, 1400);
            const dateStr = c.sermon_date ? String(c.sermon_date) : "unknown date";
            lines.push(`[${n}] ${c.sermon_title} (${dateStr}): ${excerpt}`);
            citations.push({
              index: n,
              sermonId: String(c.sermon_id),
              title: String(c.sermon_title),
              date: c.sermon_date ? String(c.sermon_date) : null,
              excerpt: c.content.replace(/\s+/g, " ").trim().slice(0, 220),
            });
          });
          ragSection = `\n\n--- Retrieved sermon excerpts (use these when relevant) ---\n${lines.join("\n\n")}`;
        }
      }
    } catch (e) {
      console.error("Ask RAG retrieval error:", e);
    }
  }

  if (!ragSection) {
    try {
      const archive = await buildArchiveRecordContext(lastUser.content);
      ragSection = archive.ragSection;
      citations = archive.citations;
    } catch (e) {
      console.error("Ask archive fallback retrieval error:", e);
    }
  }

  if (!ragSection) {
    return NextResponse.json({
      reply:
        "I don't have enough from Pastor Vaughn's indexed teachings to answer that faithfully yet. Try Search with a specific scripture, doctrine, or topic from the archive.",
      citations: [] as AskCitation[],
    });
  }

  const systemContent = SYSTEM_BASE + ragSection;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: systemContent }, ...messages],
      max_tokens: 900,
      temperature: 0.1,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("Ask API chat error:", res.status, errText);
    /** Do not return RAG citations — the model did not produce an answer, so sources would be misleading. */
    const reply = openAiFailureReply(res.status, errText);
    return NextResponse.json({
      reply,
      citations: [] as AskCitation[],
      error: errText.slice(0, 400),
    });
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const rawReply = data.choices?.[0]?.message?.content?.trim() || "No response.";
  const reply =
    rawReply.startsWith("According to Pastor Vaughn") ||
    rawReply.startsWith("I don't have enough")
      ? rawReply
      : `According to Pastor Vaughn's teachings, ${rawReply.charAt(0).toLowerCase()}${rawReply.slice(1)}`;
  return NextResponse.json({ reply, citations });
}
