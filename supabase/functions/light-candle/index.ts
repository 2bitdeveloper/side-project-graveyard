// POST /functions/v1/light-candle
// body: { wallet, graveId }
// Candles are free and low-stakes (cosmetic, rate-limited to one per wallet
// per grave per day) so this endpoint intentionally does NOT require a
// signature — any connected address (including read-only viewers, e.g. for
// wallets like pump.fun's that can't sign messages to outside sites) can
// light a candle. Worst-case abuse is someone burning a stranger's daily
// slot; there's no value transfer and nothing permanent at stake.
import { admin, json, CORS } from "../_shared/helpers.ts";

const SOLANA_ADDR_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const { wallet, graveId } = await req.json();

    if (!wallet || !SOLANA_ADDR_RE.test(wallet)) return json({ error: "That doesn't look like a valid wallet address." }, 400);
    if (!graveId) return json({ error: "No grave specified." }, 400);

    const db = admin();
    const { error } = await db.from("candles").insert({ grave_id: graveId, wallet });

    if (error) {
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
