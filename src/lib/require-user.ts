import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

/** Match proxy.ts: don't let a Supabase outage hang the request ~20s. */
const AUTH_TIMEOUT_MS = 4000;

export type SessionUser = { id: string; app_metadata?: { role?: string } };

/**
 * Require any signed-in account (not just admin). Returns a JSON 401 when there
 * is no session, so API routes degrade cleanly. Used to gate the public Ask
 * assistant so only account holders can spend OpenAI budget.
 */
export async function getSessionUser(): Promise<
  | { ok: true; supabase: SupabaseClient; user: SessionUser }
  | { ok: false; response: NextResponse }
> {
  const supabase = (await createServerSupabaseClient()) as unknown as SupabaseClient;

  let user: SessionUser | null = null;
  try {
    const result = await Promise.race([
      supabase.auth.getUser(),
      new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), AUTH_TIMEOUT_MS)),
    ]);
    if (result !== "timeout") {
      user = (result.data?.user as SessionUser | null) ?? null;
    }
  } catch {
    user = null;
  }

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "Sign in required.",
          code: "auth_required",
          reply:
            "Please sign in to use the assistant. If you don’t have an account yet, ask your church admin to create one for you.",
          citations: [],
        },
        { status: 401 },
      ),
    };
  }

  return { ok: true, supabase, user };
}
