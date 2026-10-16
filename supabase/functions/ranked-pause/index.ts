import { handleOptions, jsonResponse } from "../_shared/http.ts";
import { adminClient, requireUser } from "../_shared/supabase.ts";

Deno.serve(async request => {
  const options = handleOptions(request);
  if (options) return options;
  if (request.method !== "POST") return jsonResponse({ error: "Use POST to pause a ranked challenge." }, 405);

  try {
    const user = await requireUser(request);
    if (!user) return jsonResponse({ error: "Sign in to pause this ranked challenge." }, 401);

    const body = await request.json();
    if (typeof body?.attemptId !== "string") {
      return jsonResponse({ error: "A ranked attempt is required." }, 400);
    }

    const { data, error } = await adminClient().rpc("pause_ranked_attempt", {
      p_attempt_id: body.attemptId,
      p_user_id: user.id
    }).maybeSingle();
    if (error) throw error;
    if (!data) return jsonResponse({ error: "This ranked attempt is not active." }, 409);

    return jsonResponse({ paused: true, elapsedMs: data.elapsed_ms });
  } catch (error) {
    console.error("ranked-pause failed", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Could not pause this ranked challenge." }, 500);
  }
});
