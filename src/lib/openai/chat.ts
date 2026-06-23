/**
 * OpenAI chat-completions helper with automatic model fallback.
 *
 * The Ask + admin assistant features previously called a single model
 * (gpt-4o-mini). When that model's per-day request limit (RPD) was exhausted,
 * every request 429'd and users saw "AI is busy" until the limit reset at
 * midnight UTC. To prevent that, we try the primary model first and, on a
 * rate-limit / quota error, automatically retry on a fallback model that has
 * its own separate request bucket.
 *
 * Configure via env:
 *   OPENAI_MODEL            primary model (default: gpt-4o-mini)
 *   OPENAI_FALLBACK_MODELS  comma-separated fallbacks (default: gpt-4o)
 */

const CHAT_ENDPOINT = "https://api.openai.com/v1/chat/completions";

export type OpenAiChatMessage = {
  role: "user" | "assistant" | "system" | "tool";
  content: string | null;
  tool_call_id?: string;
  tool_calls?: {
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }[];
};

export type ChatCompletion = {
  choices?: {
    message?: OpenAiChatMessage;
    finish_reason?: string;
  }[];
};

/** Body fields the caller controls; `model` is supplied by the helper. */
export type ChatRequestBody = {
  messages: unknown[];
  max_tokens?: number;
  temperature?: number;
  tools?: unknown[];
  tool_choice?: unknown;
};

export type ChatResult =
  | { ok: true; model: string; usedFallback: boolean; data: ChatCompletion }
  | { ok: false; status: number; errText: string; model: string };

/** Ordered list of models to try, primary first, de-duplicated. */
export function getChatModels(): string[] {
  const primary = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const fallbacks = (process.env.OPENAI_FALLBACK_MODELS?.trim() || "gpt-4o")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  return Array.from(new Set([primary, ...fallbacks]));
}

/** A 429, or an explicit quota/billing error, means this bucket is unusable — try the next model. */
function isExhaustion(status: number, errText: string): boolean {
  if (status === 429) return true;
  try {
    const j = JSON.parse(errText) as { error?: { code?: string; message?: string } };
    const code = j.error?.code;
    const msg = (j.error?.message ?? "").toLowerCase();
    return code === "insufficient_quota" || msg.includes("quota") || msg.includes("rate limit");
  } catch {
    return false;
  }
}

/**
 * Call chat completions, walking the model fallback chain on rate-limit/quota
 * errors. Non-exhaustion errors (e.g. 400, 401) fail fast without burning the
 * fallback. The helper reads the response body, so callers use the returned
 * `data` / `errText` rather than the raw Response.
 */
export async function chatWithFallback(key: string, body: ChatRequestBody): Promise<ChatResult> {
  const models = getChatModels();
  let last: { status: number; errText: string; model: string } | null = null;

  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    const res = await fetch(CHAT_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ...body, model }),
    });

    if (res.ok) {
      const data = (await res.json()) as ChatCompletion;
      if (i > 0) {
        console.warn(`OpenAI fallback succeeded on "${model}" after primary models were exhausted.`);
      }
      return { ok: true, model, usedFallback: i > 0, data };
    }

    const errText = await res.text();
    last = { status: res.status, errText, model };

    const hasMore = i < models.length - 1;
    if (hasMore && isExhaustion(res.status, errText)) {
      console.warn(
        `OpenAI model "${model}" returned ${res.status}; falling back to "${models[i + 1]}".`,
      );
      continue;
    }
    break;
  }

  return {
    ok: false,
    status: last?.status ?? 500,
    errText: last?.errText ?? "No OpenAI response",
    model: last?.model ?? models[0],
  };
}
