import { handleOptions, jsonResponse } from "../_shared/http.ts";
import { adminClient, requireUser } from "../_shared/supabase.ts";

Deno.serve(async request => {
  const options = handleOptions(request);
  if (options) return options;
  if (request.method !== "POST") return jsonResponse({ error: "Use POST to save ranked progress." }, 405);

  try {
    const user = await requireUser(request);
    if (!user) return jsonResponse({ error: "Sign in to save ranked progress." }, 401);

    const body = await request.json();
    const attemptId = body?.attemptId;
    const values = body?.values;
    const notes = body?.notes;
    const updatedAt = Number.isFinite(body?.updatedAt) ? Number(body.updatedAt) : Date.now();
    if (typeof attemptId !== "string" || !Array.isArray(values) || !Array.isArray(notes)) {
      return jsonResponse({ error: "Ranked progress is incomplete." }, 400);
    }

    const admin = adminClient();
    const { data: attempt, error: attemptError } = await admin.from("ranked_attempts")
      .select("id,user_id,challenge_date,box_size,status")
      .eq("id", attemptId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (attemptError) throw attemptError;
    if (!attempt || attempt.status !== "started") return jsonResponse({ error: "This ranked attempt is no longer active." }, 409);

    const side = attempt.box_size * attempt.box_size;
    if (values.length !== side * side || notes.length !== side * side
      || values.some(value => !Number.isInteger(value) || value < -1 || value >= side)
      || notes.some(cellNotes => !Array.isArray(cellNotes)
        || cellNotes.length > side
        || cellNotes.some((value: unknown) => !Number.isInteger(value) || (value as number) < 0 || (value as number) >= side))) {
      return jsonResponse({ error: "Ranked progress contains invalid cells." }, 400);
    }

    const { data: challenge, error: challengeError } = await admin.from("daily_challenges")
      .select("puzzle")
      .eq("challenge_date", attempt.challenge_date)
      .eq("box_size", attempt.box_size)
      .single();
    if (challengeError) throw challengeError;
    if (!challenge) return jsonResponse({ error: "The challenge is no longer available." }, 404);
    const puzzle = challenge.puzzle as number[][];
    const original = puzzle.flat();
    if (values.some((value: number, index: number) => original[index] !== -1 && value !== original[index])) {
      return jsonResponse({ error: "Given symbols cannot be changed." }, 400);
    }

    const { error: updateError } = await admin.from("ranked_attempts")
      .update({ progress: { values, notes, updatedAt } })
      .eq("id", attempt.id)
      .eq("user_id", user.id)
      .eq("status", "started");
    if (updateError) throw updateError;
    return jsonResponse({ saved: true });
  } catch (error) {
    console.error("ranked-progress failed", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Could not save ranked progress." }, 500);
  }
});
