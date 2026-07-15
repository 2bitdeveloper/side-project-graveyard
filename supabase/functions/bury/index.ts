// POST /functions/v1/bury
// body: { wallet, timestamp, signature,
//   grave: { name, epitaph, cause, causeText?, born, died, style?, custom?, burnTx? } }
import {
  admin, json, CORS, verifyWallet, ripBalance, moderationFlag, tooSoon, getParsedTx, sumBurns,
  HOLD_THRESHOLD, TOKEN_MINT, TICKER, CUSTOM_TOMBSTONE_BURN,
} from "../_shared/helpers.ts";

const BURY_COOLDOWN_SECONDS = 60;
const STYLES = new Set(["marble", "onyx", "gold", "crystal"]);

const CAUSES = new Set([
  "scope creep", "new shiny framework", "it actually worked and I got bored",
  "AWS bill", "got a job", "rewrote it in Rust (never finished)",
  "the tutorial ended", "domain expired", "merge conflict with life",
  "life got in the way", "ran out of money", "perfectionism",
  "lost the passion", "the algorithm changed",
]);
const CUSTOM_CAUSE_SENTINEL = "Something else\u2026";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const { wallet, timestamp, signature, grave } = await req.json();

    const auth = verifyWallet("bury", wallet, timestamp, signature);
    if (!auth.ok) return json({ error: auth.err }, 401);

    const name = String(grave?.name ?? "").trim().slice(0, 40);
    const epitaph = String(grave?.epitaph ?? "").trim().slice(0, 140);
    if (!name || !epitaph) return json({ error: "A grave needs a name and an epitaph." }, 400);

    let cause: string;
    if (grave?.cause === CUSTOM_CAUSE_SENTINEL) {
      cause = String(grave?.causeText ?? "").trim().slice(0, 60);
      if (!cause) return json({ error: "Tell us how it really died." }, 400);
      const causeFlag = moderationFlag(cause);
      if (causeFlag) return json({ error: causeFlag }, 400);
    } else if (CAUSES.has(grave?.cause)) {
      cause = grave.cause;
    } else {
      return json({ error: "Unknown cause of death." }, 400);
    }

    const flag = moderationFlag(name) ?? moderationFlag(epitaph);
    if (flag) return json({ error: flag }, 400);

    if (TOKEN_MINT) {
      const balance = await ripBalance(wallet);
      if (balance < HOLD_THRESHOLD) {
        return json({ error: `Burial rites require holding ${HOLD_THRESHOLD.toLocaleString()} ${TICKER}.` }, 403);
      }
    }

    const db = admin();

    let style = "classic";
    let custom = false;
    let burnedAmount = 0;
    if (grave?.custom) {
      if (!TOKEN_MINT) return json({ error: `Custom tombstones unlock when ${TICKER} goes live.` }, 503);
      if (!STYLES.has(grave?.style)) return json({ error: "Unknown tombstone style." }, 400);
      if (!grave?.burnTx) return json({ error: "Missing the tombstone-burn transaction." }, 400);

      const { data: reused } = await db.from("burns").select("tx_signature").eq("tx_signature", grave.burnTx).maybeSingle();
      if (reused) return json({ error: "That burn already paid for something else." }, 409);

      const tx = await getParsedTx(grave.burnTx);
      if (!tx) return json({ error: "Transaction not found or not confirmed yet." }, 400);
      if (tx.meta?.err) return json({ error: "Transaction failed on-chain." }, 400);
      burnedAmount = sumBurns(tx, wallet);
      if (burnedAmount < CUSTOM_TOMBSTONE_BURN) {
        return json({ error: `Burn of ${CUSTOM_TOMBSTONE_BURN.toLocaleString()} ${TICKER} not found in that transaction.` }, 400);
      }
      style = grave.style;
      custom = true;
    }

    if (await tooSoon(db, "graves", wallet, BURY_COOLDOWN_SECONDS)) {
      return json({ error: "One burial at a time \u2014 the gravedigger needs a minute between plots." }, 429);
    }

    const { data, error } = await db.from("graves").insert({
      wallet, name, epitaph, cause, style, custom,
      born: String(grave?.born ?? "20??").slice(0, 4),
      died: String(grave?.died ?? new Date().getFullYear()).slice(0, 4),
    }).select().single();

    if (error) {
      if (error.code === "23505") return json({ error: "You already buried a project by that name." }, 409);
      throw error;
    }

    if (custom) {
      const { error: ledgerErr } = await db.from("burns").insert({
        tx_signature: grave.burnTx, grave_id: data.id, wallet,
        amount: burnedAmount, purpose: "custom_tombstone",
      });
      if (ledgerErr) console.error("custom tombstone ledger insert failed:", ledgerErr);
    }

    return json({ grave: data });
  } catch (e) {
    console.error("bury failed:", e);
    return json({ error: "The gravedigger is on break. Try again." }, 500);
  }
});
