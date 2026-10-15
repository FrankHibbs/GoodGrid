import { createClient } from "npm:@supabase/supabase-js@2";

const projectUrl = Deno.env.get("GOODGRID_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL");
const publishableKey = Deno.env.get("GOODGRID_PUBLISHABLE_KEY");
const secretKey = Deno.env.get("GOODGRID_SECRET_KEY");

export function adminClient() {
  if (!projectUrl || !secretKey) throw new Error("Supabase server secrets are not configured.");
  return createClient(projectUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function requireUser(request: Request) {
  if (!projectUrl || !publishableKey) throw new Error("Supabase authentication is not configured.");
  const authorization = request.headers.get("Authorization");
  if (!authorization) return null;
  const client = createClient(projectUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}
