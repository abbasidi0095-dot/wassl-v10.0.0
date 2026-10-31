import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase is used as the shared account directory. The app's own database
 * (JSON or Postgres) remains the source of truth for roles and sessions, so a
 * Supabase outage can never lock staff out.
 *
 * The publishable/anon key is safe to ship in the browser bundle. Writing
 * profiles requires the service-role key, which must stay server-side.
 */

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  "https://vgntmhvyhpnkceajfgqk.supabase.co";

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  "sb_publishable_IF-bN46qAXmbDi0Fn_sNqA_6sQ1OU3_";

const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    detectSessionInUrl: false,
  },
});

let adminClient: SupabaseClient | null = null;

/** Server-only client with write access. Null until a service-role key is set. */
export function getSupabaseAdmin(): SupabaseClient | null {
  if (!serviceRoleKey) return null;
  if (!adminClient) {
    adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return adminClient;
}

export function isSupabaseDirectoryEnabled(): boolean {
  return Boolean(serviceRoleKey);
}

export type SupabaseProfile = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "customer" | "merchant" | "driver";
};

/**
 * Mirror a profile into the Supabase `users` table.
 *
 * Returns false (never throws) when the directory is not configured or the
 * table is missing. Callers treat this as a best-effort sync, not a gate.
 */
export async function upsertSupabaseProfile(
  profile: SupabaseProfile,
): Promise<boolean> {
  const client = getSupabaseAdmin();
  if (!client) return false;

  try {
    const { error } = await client.from("users").upsert(
      {
        id: profile.id,
        email: profile.email.trim().toLowerCase(),
        name: profile.name,
        role: profile.role,
        last_sign_in_at: new Date().toISOString(),
      },
      { onConflict: "email" },
    );
    if (error) {
      console.error("[supabase] profile sync failed:", error.message);
      return false;
    }
    return true;
  } catch (error) {
    console.error("[supabase] profile sync failed:", error);
    return false;
  }
}

export async function getSupabaseProfileByEmail(
  email: string,
): Promise<SupabaseProfile | null> {
  const client = getSupabaseAdmin();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from("users")
      .select("id, email, name, role")
      .eq("email", email.trim().toLowerCase())
      .maybeSingle();
    if (error || !data) return null;
    return data as SupabaseProfile;
  } catch {
    return null;
  }
}

export default supabase;
