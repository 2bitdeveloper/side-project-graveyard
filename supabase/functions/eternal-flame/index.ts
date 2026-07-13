// POST /functions/v1/eternal-flame
// body: { wallet, timestamp, signature, graveId, burnTx }
import {
  admin, json, CORS, verifyWallet, getParsedTx, sumBurns, TOKEN_MINT, FLAME_BURN, TICKER,
} from "../_shared/helpers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const { wallet, timestamp, signature, graveId, burnTx } = await req.json();

    const auth = verifyWallet("flame", wallet, timestamp, signature);
    if (!auth.ok) return json({ error: auth.err }, 401);
    if (!TOKEN_MINT) return json({ error: `Eternal flames unlock when ${TICKER} goes live.` }, 503);
    if (!graveId || !burnTx) return json({ error: "Missing grave or burn transaction." }, 400);

    const db = admin();
    const { data: grave } = await db.from("graves").select("id").eq("id", graveId).single();
    if (!grave) return json({ error: "That grave doesn't exist." }, 404);

    const { data: existing } = await db.from("candles")
      .select("id").eq("grave_id", graveId).eq("wallet", wallet).eq("tier", "eternal").maybeSingle();
    if (existing) return json({ error: "Your flame already burns here. It is eternal, after all." }, 409);

    const tx = await getParsedTx(burnTx);
    if (!tx) return json({ error: "Transaction not found or not confirmed yet." }, 400);
    if (tx.meta?.err) return json({ error: "Transaction failed on-chain." }, 400);
    const burned = sumBurns(tx, wallet);
    if (burned < FLAME_BURN) {
      return json({ error: `Burn of ${FLAME_BURN.toLocaleString()} ${TICKER} not found in that transaction.` }, 400);
    }

    const { error: ledgerErr } = await db.from("burns").insert({
      tx_signature: burnTx, grave_id: graveId, wallet, amount: burned, purpose: "eternal_flame",
    });
    if (ledgerErr?.code === "23505") return json({ error: "That burn already lit a flame." }, 409);
    if (ledgerErr) throw ledgerErr;

    const { error: candleErr } = await db.from("candles")
      .insert({ grave_id: graveId, wallet, tier: "eternal" });
    if (candleErr) throw candleErr;

    const { data: g } = await db.from("graves")
      .select("candles_count, eternal_flames").eq("id", graveId).single();
    return json({ candles: g?.candles_count, eternal: g?.eternal_flames });
  } catch (e) {
    console.error("eternal-flame failed:", e);
    return json({ error: "The flame guttered. Try again." }, 500);
  }
});
