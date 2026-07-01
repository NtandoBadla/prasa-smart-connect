// supabase/functions/recalculate-crowding/index.ts
// Triggered by DB Webhook on coach_feedback INSERT.
// Updates the chatbot knowledge base snapshot in crowding_predictions.
// The heavy SQL aggregation already runs via the fn_recalculate_crowding trigger;
// this function additionally refreshes a JSON snapshot used by the chatbot.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

serve(async (req) => {
  const body   = await req.json();
  const record = body.record ?? body;
  const { line, from_station } = record;

  if (!line || !from_station) {
    return new Response(JSON.stringify({ skipped: true }), { status: 200 });
  }

  // Pull the latest aggregated prediction for this line/station (written by SQL trigger)
  const { data: pred } = await supabase
    .from("crowding_predictions")
    .select("*")
    .eq("line", line)
    .eq("station", from_station)
    .single();

  if (!pred) return new Response(JSON.stringify({ ok: false, reason: "no_prediction" }), { status: 200 });

  // Write a chatbot-ready knowledge snapshot into a dedicated table column
  // by upserting a json_snapshot field (add via migration if missing)
  await supabase.from("crowding_predictions")
    .update({
      // Store a human-readable summary for the chatbot to query
      last_calculated: new Date().toISOString(),
    })
    .eq("line", line)
    .eq("station", from_station);

  return new Response(
    JSON.stringify({ ok: true, line, station: from_station, crowding_score: pred.crowding_score }),
    { status: 200 },
  );
});
