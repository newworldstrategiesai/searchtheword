import { vectorToPgLiteral } from "@/lib/embeddings/hybrid-search";
import { embedQuery, embeddingsConfigured } from "@/lib/embeddings/openai-embed";
import { createPublicSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const SYSTEM_BASE = `You are a sermon archive assistant for a church. Be concise, warm, and faithful.
When numbered excerpts from sermons are provided, ground factual claims in them and cite sources using the bracket labels like [1] or [2] in your answer.
If the excerpts do not contain enough to answer, say so honestly and suggest using Search in the header for more.`;

export type AskCitation = {
  index: number;
  sermonId: string;
  title: string;
  date: string | null;
  excerpt: string;
};

type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

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
  const citations: AskCitation[] = [];

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
    ragSection =
      "\n\n(No close transcript excerpts were retrieved. Answer helpfully; suggest Search for specific sermons or verses.)";
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
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("Ask API chat error:", res.status, errText);
    return NextResponse.json({
      reply: "AI could not respond right now. Try again in a moment, or use Search to browse sermons.",
      citations,
    });
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const reply = data.choices?.[0]?.message?.content?.trim() || "No response.";
  return NextResponse.json({ reply, citations });
}
