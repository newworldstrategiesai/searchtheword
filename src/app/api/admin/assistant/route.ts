import { getAdminSupabase } from "@/lib/require-admin";
import { ADMIN_ASSISTANT_SYSTEM_PROMPT } from "@/lib/admin-assistant/system-prompt";
import {
  executeTool,
  TOOL_DEFINITIONS,
  type ToolCall,
  type ToolName,
  type ToolResult,
} from "@/lib/admin-assistant/tools";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ChatMessage = {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  tool_call_id?: string;
  tool_calls?: {
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }[];
};

const MAX_TOOL_ROUNDS = 4;
const VALID_TOOL_NAMES = new Set(TOOL_DEFINITIONS.map((t) => t.function.name));

export async function POST(request: Request) {
  const auth = await getAdminSupabase();
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const incomingMessages = (body as { messages?: ChatMessage[] }).messages;
  if (!Array.isArray(incomingMessages) || incomingMessages.length === 0) {
    return NextResponse.json({ error: "messages array required" }, { status: 400 });
  }

  const lastUser = [...incomingMessages].reverse().find((m) => m.role === "user");
  if (!lastUser?.content?.trim()) {
    return NextResponse.json({ error: "Last user message required" }, { status: 400 });
  }

  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    return NextResponse.json({
      reply:
        "The admin assistant is not configured yet — OPENAI_API_KEY must be set on the server. " +
        "You can still use the app normally; all admin pages are in /admin.",
      tool_results: [],
    });
  }

  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const { supabase } = auth;

  const messages: ChatMessage[] = [
    { role: "system", content: ADMIN_ASSISTANT_SYSTEM_PROMPT },
    ...incomingMessages.filter((m) => m.role === "user" || m.role === "assistant"),
  ];

  const allToolResults: ToolResult[] = [];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        tools: TOOL_DEFINITIONS,
        tool_choice: "auto",
        max_tokens: 1200,
        temperature: 0.2,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Admin assistant API error:", res.status, errText);
      return NextResponse.json({
        reply: "Could not reach the AI service right now. Try again in a moment.",
        tool_results: allToolResults,
      });
    }

    const data = (await res.json()) as {
      choices?: {
        message?: ChatMessage;
        finish_reason?: string;
      }[];
    };

    const choice = data.choices?.[0];
    if (!choice?.message) {
      return NextResponse.json({
        reply: "No response from the AI service.",
        tool_results: allToolResults,
      });
    }

    const assistantMsg = choice.message;
    messages.push(assistantMsg);

    if (choice.finish_reason !== "tool_calls" || !assistantMsg.tool_calls?.length) {
      return NextResponse.json({
        reply: assistantMsg.content?.trim() || "No response.",
        tool_results: allToolResults,
      });
    }

    for (const tc of assistantMsg.tool_calls) {
      const toolName = tc.function.name as ToolName;

      if (!VALID_TOOL_NAMES.has(toolName)) {
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify({ error: `Unknown tool: ${toolName}` }),
        });
        continue;
      }

      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(tc.function.arguments) as Record<string, unknown>;
      } catch {
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify({ error: "Invalid tool arguments" }),
        });
        continue;
      }

      const toolCall: ToolCall = { name: toolName, arguments: args };
      const toolResult = await executeTool(supabase, toolCall);
      allToolResults.push(toolResult);

      messages.push({
        role: "tool",
        tool_call_id: tc.id,
        content: JSON.stringify(toolResult.result),
      });
    }
  }

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  return NextResponse.json({
    reply: lastAssistant?.content?.trim() || "I hit my tool call limit for this turn. Could you rephrase or ask something more specific?",
    tool_results: allToolResults,
  });
}
