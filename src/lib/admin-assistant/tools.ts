import type { SupabaseClient } from "@supabase/supabase-js";
import { searchSermonsServer } from "@/lib/sermons";
import { loadSermonTopicKeywordStrings } from "@/lib/sermon-admin";

export type ToolName =
  | "search_archive"
  | "list_sermons"
  | "get_sermon"
  | "list_users"
  | "suggest_navigation"
  | "propose_action";

export type ToolCall = {
  name: ToolName;
  arguments: Record<string, unknown>;
};

export type ToolResult = {
  name: ToolName;
  result: unknown;
};

export const TOOL_DEFINITIONS = [
  {
    type: "function" as const,
    function: {
      name: "search_archive",
      description:
        "Search the sermon archive by keyword, scripture, topic, or preacher. " +
        "Returns matching sermons with excerpts. Use when the admin asks about teaching content.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query" },
          limit: { type: "number", description: "Max results (1-10, default 6)" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_sermons",
      description:
        "List sermons in the database with optional search, sorting, and filtering. " +
        "Use when the admin asks 'how many sermons', 'show recent imports', 'find sermon by title', etc.",
      parameters: {
        type: "object",
        properties: {
          q: { type: "string", description: "Optional title/preacher search" },
          sort: { type: "string", enum: ["updated", "date"], description: "Sort order (default: updated)" },
          document_type: { type: "string", description: "Filter by type: pdf, Sermon, Bible Study, etc." },
          limit: { type: "number", description: "Max results (1-50, default 10)" },
          offset: { type: "number", description: "Pagination offset (default 0)" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_sermon",
      description:
        "Get full details of a specific sermon by ID, including topics, keywords, and full text. " +
        "Use when the admin asks about a specific sermon's details.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "Sermon UUID" },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_users",
      description:
        "List all app users with their role and last sign-in. " +
        "Use when the admin asks 'who has access', 'list users', 'how many admins', etc. " +
        "Only share email addresses when the admin explicitly requests them for support purposes.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "suggest_navigation",
      description:
        "Return a link the admin can click to navigate somewhere in the app. " +
        "Use when the admin asks 'how do I import', 'where is the sermon list', 'take me to…', etc.",
      parameters: {
        type: "object",
        properties: {
          destination: {
            type: "string",
            enum: [
              "/admin",
              "/admin/sermons",
              "/search",
              "/ask",
              "/account",
            ],
            description: "Canonical app path",
          },
          query_params: {
            type: "object",
            description: "Optional query params to append (e.g. {q: 'Romans', sort: 'date'})",
          },
          fragment: { type: "string", description: "Optional #hash (e.g. sermon ID)" },
          label: { type: "string", description: "Button label shown to the admin" },
        },
        required: ["destination", "label"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "propose_action",
      description:
        "Propose a destructive or sensitive operation that requires the admin's explicit confirmation before executing. " +
        "The admin will see a confirmation button in the UI. Use for: reindex embeddings, backfill full text, " +
        "creating a user, deleting a sermon, etc. NEVER execute these directly — always propose first.",
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: [
              "reindex_embeddings",
              "backfill_full_text",
              "delete_sermon",
            ],
            description: "The action to propose",
          },
          label: { type: "string", description: "Human-readable description of what will happen" },
          sermon_id: { type: "string", description: "Required for delete_sermon" },
          sermon_title: { type: "string", description: "Sermon title for display (delete_sermon)" },
        },
        required: ["action", "label"],
      },
    },
  },
];

export type ProposedAction = {
  action: "reindex_embeddings" | "backfill_full_text" | "delete_sermon";
  label: string;
  sermon_id?: string;
  sermon_title?: string;
};

function clamp(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

async function execSearchArchive(args: Record<string, unknown>) {
  const query = str(args.query);
  if (!query) return { error: "query is required" };

  const limit = clamp(args.limit, 1, 10, 6);
  const { results } = await searchSermonsServer({ q: query, page: 1, limit, mode: "all" });

  return results.map((r) => ({
    id: r.id,
    title: r.title,
    preacher: r.preacher,
    date: r.date,
    series: r.series ?? null,
    scripture_ref: r.scripture_ref ?? null,
    summary: r.summary?.slice(0, 300) ?? null,
    core_doctrine: r.core_doctrine?.slice(0, 200) ?? null,
  }));
}

async function execListSermons(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
) {
  const limit = clamp(args.limit, 1, 50, 10);
  const offset = clamp(args.offset, 0, 10000, 0);
  const sort = args.sort === "date" ? "date" : "updated";
  const docType = str(args.document_type);
  const q = str(args.q);

  let query = supabase
    .from("sermons")
    .select("id, title, preacher, date, series, document_type, updated_at", { count: "exact" });

  if (docType) query = query.eq("document_type", docType);
  if (q) {
    const safe = q.replace(/%/g, "").replace(/_/g, "").replace(/"/g, '\\"').slice(0, 120);
    if (safe) query = query.or(`title.ilike."%${safe}%",preacher.ilike."%${safe}%"`);
  }

  if (sort === "date") {
    query = query.order("date", { ascending: false, nullsFirst: false });
  } else {
    query = query.order("updated_at", { ascending: false });
  }

  const { data, error, count } = await query.range(offset, offset + limit - 1);
  if (error) return { error: error.message };

  return { total: count ?? 0, sermons: data ?? [] };
}

async function execGetSermon(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
) {
  const id = str(args.id);
  if (!id) return { error: "id is required" };

  const { data: sermon, error } = await supabase.from("sermons").select("*").eq("id", id).maybeSingle();
  if (error) return { error: error.message };
  if (!sermon) return { error: "Sermon not found" };

  const { topics, keywords } = await loadSermonTopicKeywordStrings(supabase, id);

  const full_text = (sermon.full_text as string | null)?.slice(0, 1500) ?? null;
  return {
    ...sermon,
    full_text: full_text ? `${full_text}… [truncated]` : null,
    topics,
    keywords,
  };
}

async function execListUsers(supabase: SupabaseClient) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=100`,
    {
      headers: {
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      },
    },
  );

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      return { error: "User management requires SUPABASE_SERVICE_ROLE_KEY (not configured on server)." };
    }
    return { error: `Failed to list users (${res.status})` };
  }

  const data = (await res.json()) as {
    users?: {
      id: string;
      email?: string;
      created_at?: string;
      last_sign_in_at?: string | null;
      app_metadata?: Record<string, unknown>;
    }[];
  };

  // Only surface minimal info; PII policy: email included but system prompt advises redaction in public contexts
  void supabase; // admin JWT already verified auth
  return (data.users ?? []).map((u) => ({
    id: u.id,
    email: u.email ?? "",
    created_at: u.created_at ?? null,
    last_sign_in_at: u.last_sign_in_at ?? null,
    role: (u.app_metadata?.role as string | undefined) ?? null,
  }));
}

function execProposeAction(args: Record<string, unknown>): { proposed_action: ProposedAction } | { error: string } {
  const action = str(args.action);
  const label = str(args.label);
  if (!action || !label) return { error: "action and label are required" };

  const validActions = ["reindex_embeddings", "backfill_full_text", "delete_sermon"];
  if (!validActions.includes(action)) return { error: `Invalid action: ${action}` };

  if (action === "delete_sermon" && !str(args.sermon_id)) {
    return { error: "sermon_id is required for delete_sermon" };
  }

  return {
    proposed_action: {
      action: action as ProposedAction["action"],
      label,
      sermon_id: str(args.sermon_id) || undefined,
      sermon_title: str(args.sermon_title) || undefined,
    },
  };
}

function execSuggestNavigation(args: Record<string, unknown>) {
  const destination = str(args.destination) || "/admin";
  const queryParams = args.query_params as Record<string, string> | undefined;
  const fragment = str(args.fragment);
  const label = str(args.label) || "Go";

  let url = destination;
  if (queryParams && typeof queryParams === "object") {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(queryParams)) {
      if (typeof v === "string" && v) sp.set(k, v);
    }
    const qs = sp.toString();
    if (qs) url += `?${qs}`;
  }
  if (fragment) url += `#${fragment}`;

  return { url, label };
}

export async function executeTool(
  supabase: SupabaseClient,
  call: ToolCall,
): Promise<ToolResult> {
  const args = call.arguments ?? {};

  switch (call.name) {
    case "search_archive":
      return { name: call.name, result: await execSearchArchive(args) };
    case "list_sermons":
      return { name: call.name, result: await execListSermons(supabase, args) };
    case "get_sermon":
      return { name: call.name, result: await execGetSermon(supabase, args) };
    case "list_users":
      return { name: call.name, result: await execListUsers(supabase) };
    case "suggest_navigation":
      return { name: call.name, result: execSuggestNavigation(args) };
    case "propose_action":
      return { name: call.name, result: execProposeAction(args) };
    default:
      return { name: call.name, result: { error: `Unknown tool: ${call.name}` } };
  }
}
