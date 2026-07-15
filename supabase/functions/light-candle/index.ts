// POST /functions/v1/light-candle
// body: { wallet, graveId }
// Self-contained on purpose: doesn't import the shared helpers.ts (which
// pulls in npm:tweetnacl/bs58/supabase-js and used to pull in bad-words) —
// this function only ever needed supabase-js and doesn't verify signatures.
import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? "https://2bitdeveloper.github.io";
const CORS = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}
function admin() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

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
