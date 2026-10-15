import { handleOptions, jsonResponse } from "../_shared/http.ts";
import { createDailyPuzzle, isBoxSize } from "../_shared/sudoku.ts";
import { adminClient, requireUser } from "../_shared/supabase.ts";

Deno.serve(async request => {
  const options = handleOptions(request);
  if (options) return options;
  if (request.method !== "POST") return jsonResponse({ error: "Use POST for ranked challenges." }, 405);

  try {
    const user = await requireUser(request);
    if (!user) return jsonResponse({ error: "Sign in to start a ranked challenge." }, 401);

    const body = await request.json();
    const boxSize = body?.boxSize;
    if (!isBoxSize(boxSize)) return jsonResponse({ error: "Choose a valid puzzle size." }, 400);

    const admin = adminClient();
    const challengeDate = new Date().toISOString().slice(0, 10);
    let { data: challenge } = await admin.from("daily_challenges")
      .select("challenge_date,box_size,difficulty,puzzle")
      .eq("challenge_date", challengeDate)
      .eq("box_size", boxSize)
      .maybeSingle();

    if (!challenge) {
      const generated = createDailyPuzzle(boxSize, challengeDate);
      await admin.from("daily_challenges").upsert({
        challenge_date: challengeDate,
        box_size: boxSize,
        difficulty: "medium",
        puzzle: generated.puzzle,
        solution: generated.solution
      }, { onConflict: "challenge_date,box_size", ignoreDuplicates: true });
      const stored = await admin.from("daily_challenges")
        .select("challenge_date,box_size,difficulty,puzzle")
        .eq("challenge_date", challengeDate)
        .eq("box_size", boxSize)
        .single();
      if (stored.error || !stored.data) throw stored.error ?? new Error("Could not create the daily challenge.");
      challenge = stored.data;
    }

    let attemptQuery = await admin.from("ranked_attempts")
      .select("id,started_at,status,elapsed_ms,progress")
      .eq("user_id", user.id)
      .eq("challenge_date", challengeDate)
      .eq("box_size", boxSize)
      .maybeSingle();
    if (attemptQuery.error) throw attemptQuery.error;

    let attempt = attemptQuery.data;
    if (attempt?.status === "completed") {
      return jsonResponse({ error: "You have already completed this ranked challenge today." }, 409);
    }
    let resumed = Boolean(attempt);
    if (!attempt) {
      const inserted = await admin.from("ranked_attempts")
        .insert({ user_id: user.id, challenge_date: challengeDate, box_size: boxSize })
        .select("id,started_at,status,elapsed_ms,progress")
        .single();
      if (inserted.error) {
        // A second tab may have created the unique daily attempt at the same time.
        attemptQuery = await admin.from("ranked_attempts")
          .select("id,started_at,status,elapsed_ms,progress")
          .eq("user_id", user.id)
          .eq("challenge_date", challengeDate)
          .eq("box_size", boxSize)
          .maybeSingle();
        if (attemptQuery.error || !attemptQuery.data) throw inserted.error;
        attempt = attemptQuery.data;
        resumed = true;
      } else {
        attempt = inserted.data;
      }
    }

    return jsonResponse({
      date: challenge.challenge_date,
      boxSize: challenge.box_size,
      difficulty: "medium",
      puzzle: challenge.puzzle,
      progress: attempt.progress,
      attemptId: attempt.id,
      startedAt: attempt.started_at,
      resumed
    });
  } catch (error) {
    console.error("ranked-start failed", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Could not start this ranked challenge." }, 500);
  }
});
