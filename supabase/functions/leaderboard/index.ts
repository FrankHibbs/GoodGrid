import { handleOptions, jsonResponse } from "../_shared/http.ts";
import { isBoxSize } from "../_shared/sudoku.ts";
import { adminClient } from "../_shared/supabase.ts";

Deno.serve(async request => {
  const options = handleOptions(request);
  if (options) return options;
  if (request.method !== "GET" && request.method !== "POST") {
    return jsonResponse({ error: "Use GET or POST for leaderboard results." }, 405);
  }

  try {
    const body = request.method === "POST" ? await request.json() : {};
    const url = new URL(request.url);
    const boxSize = body?.boxSize ?? Number(url.searchParams.get("boxSize"));
    const period = body?.period ?? url.searchParams.get("period") ?? "daily";
    if (!isBoxSize(boxSize) || !["daily", "all-time"].includes(period)) {
      return jsonResponse({ error: "Choose a valid puzzle size and ranking period." }, 400);
    }

    const challengeDate = new Date().toISOString().slice(0, 10);
    const { data, error } = await adminClient().rpc("get_ranked_leaderboard", {
      p_box_size: boxSize,
      p_challenge_date: period === "daily" ? challengeDate : null,
      p_all_time: period === "all-time"
    });
    if (error) throw error;
    return jsonResponse({ entries: data ?? [], date: challengeDate, boxSize, period });
  } catch (error) {
    console.error("leaderboard failed", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Could not load the leaderboard." }, 500);
  }
});
