import { handleOptions, jsonResponse } from "../_shared/http.ts";
import { adminClient, requireUser } from "../_shared/supabase.ts";

Deno.serve(async request => {
  const options = handleOptions(request);
  if (options) return options;
  if (request.method !== "POST") return jsonResponse({ error: "Use POST to submit a ranked board." }, 405);

  try {
    const user = await requireUser(request);
    if (!user) return jsonResponse({ error: "Sign in to submit a ranked result." }, 401);

    const body = await request.json();
    const attemptId = body?.attemptId;
    const values = body?.values;
    if (typeof attemptId !== "string" || !Array.isArray(values)) {
      return jsonResponse({ error: "The ranked submission is incomplete." }, 400);
    }

    const admin = adminClient();
    const { data: attempt, error: attemptError } = await admin.from("ranked_attempts")
      .select("id,user_id,challenge_date,box_size,started_at,status")
      .eq("id", attemptId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (attemptError) throw attemptError;
    if (!attempt) return jsonResponse({ error: "This ranked attempt could not be found." }, 404);
    if (attempt.status !== "started") return jsonResponse({ error: "This ranked attempt has already been submitted." }, 409);

    const side = attempt.box_size * attempt.box_size;
    if (values.length !== side * side || values.some(value => !Number.isInteger(value) || value < 0 || value >= side)) {
      return jsonResponse({ error: "Fill every square before submitting." }, 400);
    }

    const { data: challenge, error: challengeError } = await admin.from("daily_challenges")
      .select("solution")
      .eq("challenge_date", attempt.challenge_date)
      .eq("box_size", attempt.box_size)
      .single();
    if (challengeError) throw challengeError;

    const solution = (challenge.solution as number[][]).flat();
    const invalidIndices = values.flatMap((value: number, index: number) => value === solution[index] ? [] : [index]);
    if (invalidIndices.length) return jsonResponse({ valid: false, invalidIndices });

    const elapsedMs = Math.max(1, Date.now() - Date.parse(attempt.started_at));
    const { data: finished, error: finishError } = await admin.rpc("finish_ranked_attempt", {
      p_attempt_id: attempt.id,
      p_user_id: user.id,
      p_elapsed_ms: elapsedMs
    }).maybeSingle();
    if (finishError) throw finishError;
    if (!finished) return jsonResponse({ error: "This ranked attempt has already been submitted." }, 409);

    return jsonResponse({ valid: true, elapsedMs: finished.elapsed_ms, challengeDate: finished.challenge_date });
  } catch (error) {
    console.error("ranked-submit failed", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Could not verify this result." }, 500);
  }
});
