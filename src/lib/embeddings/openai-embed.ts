import { DEFAULT_EMBEDDING_MODEL, EMBEDDING_BATCH_SIZE, EMBEDDING_DIMENSIONS } from "@/lib/embeddings/constants";

function getApiKey(): string | null {
  return process.env.OPENAI_API_KEY?.trim() || null;
}

export function embeddingsConfigured(): boolean {
  return Boolean(getApiKey());
}

export async function embedTexts(inputs: string[]): Promise<number[][]> {
  const key = getApiKey();
  if (!key) throw new Error("OPENAI_API_KEY is not set");
  const model = process.env.OPENAI_EMBEDDING_MODEL?.trim() || DEFAULT_EMBEDDING_MODEL;

  const out: number[][] = [];
  for (let i = 0; i < inputs.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = inputs.slice(i, i + EMBEDDING_BATCH_SIZE);
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: batch,
        dimensions: EMBEDDING_DIMENSIONS,
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`OpenAI embeddings error ${res.status}: ${t.slice(0, 400)}`);
    }
    const data = (await res.json()) as {
      data?: { embedding: number[]; index: number }[];
    };
    const rows = data.data ?? [];
    rows.sort((a, b) => a.index - b.index);
    for (const row of rows) {
      if (!row.embedding?.length) throw new Error("Empty embedding in response");
      out.push(row.embedding);
    }
  }
  return out;
}

export async function embedQuery(text: string): Promise<number[] | null> {
  if (!text.trim() || !getApiKey()) return null;
  const vecs = await embedTexts([text.trim()]);
  return vecs[0] ?? null;
}
