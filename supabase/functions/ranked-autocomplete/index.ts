import { handleOptions, jsonResponse } from "../_shared/http.ts";
import { adminClient, requireUser } from "../_shared/supabase.ts";

const AUTOCOMPLETE_TESTER_EMAIL = "nhibbert@ithaca.edu";

Deno.serve(async request => {
  const options = handleOptions(request);
  if (options) return options;
  if (request.method !== "POST") return jsonResponse({ error: "Use POST to autocomplete a ranked test puzzle." }, 405);

  try {
    const user = await requireUser(request);
    if (!user) return jsonResponse({ error: "Sign in to use puzzle autocomplete." }, 401);
    if (user.email?.trim().toLowerCase() !== AUTOCOMPLETE_TESTER_EMAIL) {
      return jsonResponse({ error: "Puzzle autocomplete is only available to the authorized test account." }, 403);
    }

    const body = await request.json();
    if (typeof body?.attemptId !== "string") return jsonResponse({ error: "A ranked attempt is required." }, 400);

    const admin = adminClient();
    const { data: attempt, error: attemptError } = await admin.from("ranked_attempts")
      .select("id,user_id,challenge_date,box_size,status")
      .eq("id", body.attemptId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (attemptError) throw attemptError;
    if (!attempt) return jsonResponse({ error: "This ranked attempt could not be found." }, 404);
    if (attempt.status !== "started") return jsonResponse({ error: "This ranked attempt is not active." }, 409);

    const { data: challenge, error: challengeError } = await admin.from("daily_challenges")
      .select("solution")
      .eq("challenge_date", attempt.challenge_date)
      .eq("box_size", attempt.box_size)
      .single();
    if (challengeError) throw challengeError;

    const { data: paused, error: pauseError } = await admin.rpc("pause_ranked_attempt", {
      p_attempt_id: attempt.id,
      p_user_id: user.id
    }).maybeSingle();
    if (pauseError) throw pauseError;
    if (!paused) return jsonResponse({ error: "This ranked attempt is no longer active." }, 409);

    return jsonResponse({ solution: (challenge.solution as number[][]).flat(), elapsedMs: paused.elapsed_ms, paused: true });
  } catch (error) {
    console.error("ranked-autocomplete failed", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Could not autocomplete this ranked puzzle." }, 500);
  }
});
