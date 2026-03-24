import { getAdminSupabase } from "@/lib/require-admin";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function serviceUnavailable() {
  return NextResponse.json(
    { error: "User management is not configured (missing SUPABASE_SERVICE_ROLE_KEY on the server)." },
    { status: 503 },
  );
}

export async function GET() {
  const auth = await getAdminSupabase();
  if (!auth.ok) return auth.response;

  let adminClient;
  try {
    adminClient = createAdminSupabaseClient();
  } catch {
    return serviceUnavailable();
  }

  const { data, error } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 100 });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const users =
    data.users?.map((u) => ({
      id: u.id,
      email: u.email ?? "",
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
      role: (u.app_metadata?.role as string | undefined) ?? null,
    })) ?? [];

  return NextResponse.json({ users });
}

type CreateUserBody = {
  email?: string;
  password?: string;
  role?: string;
};

export async function POST(request: Request) {
  const auth = await getAdminSupabase();
  if (!auth.ok) return auth.response;

  let body: CreateUserBody;
  try {
    body = (await request.json()) as CreateUserBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = String(body.email ?? "")
    .trim()
    .toLowerCase();
  const password = String(body.password ?? "");
  const asAdmin = body.role === "admin";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  let adminClient;
  try {
    adminClient = createAdminSupabaseClient();
  } catch {
    return serviceUnavailable();
  }

  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: asAdmin ? { role: "admin" } : {},
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    user: {
      id: data.user.id,
      email: data.user.email,
      role: (data.user.app_metadata?.role as string | undefined) ?? null,
    },
  });
}
