// POST /functions/v1/offer
// body: { wallet, timestamp, signature, graveId, offerTx }
// One tx: transferChecked 95% to the grave owner + burnChecked 5% tithe.
import {
  admin, json, CORS, verifyWallet, getParsedTx, sumBurns, tokenDelta,
  TOKEN_MINT, MIN_OFFER, OFFER_THRESHOLD, TICKER,
} from "../_shared/helpers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const { wallet, timestamp, signature, graveId, offerTx } = await req.json();

    const auth = verifyWallet("offer", wallet, timestamp, signature);
    if (!auth.ok) return json({ error: auth.err }, 401);
    if (!TOKEN_MINT) return json({ error: `Offerings unlock when ${TICKER} goes live.` }, 503);
    if (!graveId || !offerTx) return json({ error: "Missing grave or offering transaction." }, 400);

    const db = admin();
    const { data: grave } = await db.from("graves")
      .select("id, wallet, community, offered_total, risen").eq("id", graveId).single();
    if (!grave) return json({ error: "That grave doesn't exist." }, 404);
    if (grave.community || grave.wallet === "the-keeper") {
      return json({ error: "Community memorials accept candles only — there is no one left to pay." }, 403);
    }

    const tx = await getParsedTx(offerTx);
    if (!tx) return json({ error: "Transaction not found or not confirmed yet." }, 400);
    if (tx.meta?.err) return json({ error: "Transaction failed on-chain." }, 400);

    const received = tokenDelta(tx, grave.wallet);
    const burned = sumBurns(tx, wallet);
    const spent = -tokenDelta(tx, wallet);
    const gross = received + burned;

    if (received <= 0) return json({ error: "No transfer to the creator found in that transaction." }, 400);
    if (gross < MIN_OFFER * 0.99) return json({ error: `Offerings start at ${MIN_OFFER} ${TICKER}.` }, 400);
    if (burned < gross * 0.05 * 0.95) return json({ error: "The tithe is missing — 5% of every offering is burned." }, 400);
    if (spent < gross * 0.99) return json({ error: "Offering must come from the signing wallet." }, 400);

    const { error: ledgerErr } = await db.from("offerings").insert({
      tx_signature: offerTx, grave_id: graveId, from_wallet: wallet,
      amount_to_owner: received, amount_burned: burned,
    });
    if (ledgerErr?.code === "23505") return json({ error: "That offering was already counted." }, 409);
    if (ledgerErr) throw ledgerErr;

    const { data: g } = await db.from("graves")
      .select("offered_total, risen").eq("id", graveId).single();
    return json({ offered_total: g?.offered_total, risen: g?.risen, threshold: OFFER_THRESHOLD, counted: gross });
  } catch (e) {
    console.error("offer failed:", e);
    return json({ error: "The offering was not received. Try again." }, 500);
  }
});
