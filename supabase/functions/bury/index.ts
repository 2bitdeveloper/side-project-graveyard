// POST /functions/v1/bury
// body: { wallet, timestamp, signature, grave: { name, epitaph, cause, born, died } }
import {
  admin, json, CORS, verifyWallet, ripBalance, moderationFlag, HOLD_THRESHOLD, RIP_MINT,
} from "../_shared/helpers.ts";

const CAUSES = new Set([
  "scope creep", "new shiny framework", "it actually worked and I got bored",
  "AWS bill", "got a job", "rewrote it in Rust (never finished)",
  "the tutorial ended", "domain expired", "merge conflict with life",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const { wallet, timestamp, signature, grave } = await req.json();

    // 1. prove wallet ownership
    const auth = verifyWallet("bury", wallet, timestamp, signature);
    if (!auth.ok) return json({ error: auth.err }, 401);

    // 2. validate + moderate content
    const name = String(grave?.name ?? "").trim().slice(0, 40);
    const epitaph = String(grave?.epitaph ?? "").trim().slice(0, 140);
    if (!name || !epitaph) return json({ error: "A grave needs a name and an epitaph." }, 400);
    if (!CAUSES.has(grave?.cause)) return json({ error: "Unknown cause of death." }, 400);
    const flag = moderationFlag(name) ?? moderationFlag(epitaph);
    if (flag) return json({ error: flag }, 400);

    // 3. hold-to-bury gate. Pre-launch (no mint set): burials are free.
    // Once RIP_MINT is set, the gate switches on automatically.
    if (RIP_MINT) {
      const balance = await ripBalance(wallet);
      if (balance < HOLD_THRESHOLD) {
        return json({ error: `Burial rites require holding ${HOLD_THRESHOLD.toLocaleString()} $RIP.` }, 403);
      }
    }

    // 4. insert (unique index rejects duplicate burials per wallet+name)
    const db = admin();
    const { data, error } = await db.from("graves").insert({
      wallet, name, epitaph,
      cause: grave.cause,
      born: String(grave?.born ?? "20??").slice(0, 4),
      died: String(grave?.died ?? new Date().getFullYear()).slice(0, 4),
    }).select().single();

    if (error) {
      if (error.code === "23505") return json({ error: "You already buried a project by that name." }, 409);
      throw error;
    }
    return json({ grave: data });
  } catch (e) {
    console.error("bury failed:", e);
    return json({ error: "The gravedigger is on break. Try again." }, 500);
  }
});
