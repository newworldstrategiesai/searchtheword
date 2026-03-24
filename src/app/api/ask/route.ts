import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const SYSTEM = `You are a sermon archive assistant for a church. Be concise, warm, and faithful. You do not have direct access to sermon transcripts unless retrieval (RAG) is configured—when users ask for specific sermons or quotes, point them to the Search archive and suggest they use topics, scripture, or keywords.`;

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
    });
  }

  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: SYSTEM }, ...messages],
      max_tokens: 900,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("Ask API chat error:", res.status, errText);
    return NextResponse.json({
      reply: "AI could not respond right now. Try again in a moment, or use Search to browse sermons.",
    });
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const reply = data.choices?.[0]?.message?.content?.trim() || "No response.";
  return NextResponse.json({ reply });
}
