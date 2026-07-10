// POST /functions/v1/resurrect
// body: { wallet, timestamp, signature, graveId, burnTx }
//
// Flow: client sends the burn transaction on-chain first (10,000 $RIP,
// spl-token burn/burnChecked), waits for confirmation, then calls this
// with the tx signature. We verify the burn actually happened, belongs
// to this wallet + mint, meets the amount, and hasn't been used before.
import {
  admin, json, CORS, verifyWallet, RPC_URL, RIP_MINT, BURN_AMOUNT, TOKEN_DECIMALS,
} from "../_shared/helpers.ts";

async function verifyBurnTx(sig: string, wallet: string) {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0", id: 1, method: "getTransaction",
      params: [sig, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0, commitment: "confirmed" }],
    }),
  });
  const tx = (await res.json())?.result;
  if (!tx) return { ok: false as const, err: "Transaction not found or not confirmed yet." };
  if (tx.meta?.err) return { ok: false as const, err: "Transaction failed on-chain." };

  // find spl-token burn instructions (top-level and inner)
  const all = [
    ...(tx.transaction.message.instructions ?? []),
    ...(tx.meta?.innerInstructions ?? []).flatMap((i: any) => i.instructions),
  ];
  let burned = 0;
  for (const ix of all) {
    const p = ix?.parsed;
    if (ix?.program !== "spl-token" || !p) continue;
    if (p.type !== "burn" && p.type !== "burnChecked") continue;
    const info = p.info;
    const mintOk = info.mint === RIP_MINT;
    const authority = info.authority ?? info.multisigAuthority;
    if (!mintOk || authority !== wallet) continue;
    burned += p.type === "burnChecked"
      ? Number(info.tokenAmount.uiAmount)
      : Number(info.amount) / 10 ** TOKEN_DECIMALS;
  }
  if (burned < BURN_AMOUNT) {
    return { ok: false as const, err: `Burn of ${BURN_AMOUNT.toLocaleString()} $RIP not found in that transaction.` };
  }
  return { ok: true as const, burned };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const { wallet, timestamp, signature, graveId, burnTx } = await req.json();

    const auth = verifyWallet("resurrect", wallet, timestamp, signature);
    if (!auth.ok) return json({ error: auth.err }, 401);
    if (!graveId || !burnTx) return json({ error: "Missing grave or burn transaction." }, 400);

    const db = admin();

    // grave must exist, belong to this wallet, and still be dead
    const { data: grave } = await db.from("graves")
      .select("id, wallet, risen").eq("id", graveId).single();
    if (!grave) return json({ error: "That grave doesn't exist." }, 404);
    if (grave.wallet !== wallet) return json({ error: "Only the one who buried it may raise it." }, 403);
    if (grave.risen) return json({ error: "It has already risen." }, 409);

    // verify the burn on-chain
    const burn = await verifyBurnTx(burnTx, wallet);
    if (!burn.ok) return json({ error: burn.err }, 400);

    // ledger insert first — primary key on tx_signature blocks replay
    const { error: ledgerErr } = await db.from("burns").insert({
      tx_signature: burnTx, grave_id: graveId, wallet, amount: burn.burned,
    });
    if (ledgerErr?.code === "23505") {
      return json({ error: "That burn has already raised a project." }, 409);
    }
    if (ledgerErr) throw ledgerErr;

    await db.from("graves")
      .update({ risen: true, risen_tx: burnTx }).eq("id", graveId);

    return json({ risen: true, burned: burn.burned });
  } catch (e) {
    console.error("resurrect failed:", e);
    return json({ error: "The ritual fizzled. Try again." }, 500);
  }
});
