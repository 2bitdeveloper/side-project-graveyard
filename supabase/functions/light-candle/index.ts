// POST /functions/v1/light-candle
// body: { wallet, timestamp, signature, graveId }
import { admin, json, CORS, verifyWallet } from "../_shared/helpers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const { wallet, timestamp, signature, graveId } = await req.json();

    const auth = verifyWallet("candle", wallet, timestamp, signature);
    if (!auth.ok) return json({ error: auth.err }, 401);
    if (!graveId) return json({ error: "No grave specified." }, 400);

    const db = admin();
    const { error } = await db.from("candles").insert({ grave_id: graveId, wallet });

    if (error) {
      // unique (grave_id, wallet, lit_on) violation = already lit today
      if (error.code === "23505") {
        return json({ error: "You've already lit a candle here today. Come back tomorrow." }, 429);
      }
      if (error.code === "23503") return json({ error: "That grave doesn't exist." }, 404);
      throw error;
    }

    const { data: grave } = await db.from("graves")
      .select("candles_count").eq("id", graveId).single();
    return json({ candles: grave?.candles_count ?? null });
  } catch (e) {
    console.error("light-candle failed:", e);
    return json({ error: "The wind blew it out. Try again." }, 500);
  }
});
