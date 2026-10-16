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
  if (!authorization) {
    console.warn("Ranked request is missing the Authorization header.");
    return null;
  }
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) {
    console.warn("Ranked request has a malformed Authorization header.");
    return null;
  }
  const client = createClient(projectUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) {
    console.error("Supabase rejected the ranked user token.", {
      message: error?.message ?? "No user returned",
      status: error?.status ?? null,
      code: error?.code ?? null
    });
    return null;
  }
  return data.user;
}
