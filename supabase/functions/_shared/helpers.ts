// Shared helpers for graveyard edge functions (Deno runtime)
import nacl from "npm:tweetnacl@1.0.3";
import bs58 from "npm:bs58@5.0.0";
import { createClient } from "npm:@supabase/supabase-js@2";
import Filter from "npm:bad-words@4.0.0"; // maintained third-party profanity list
const profanity = new Filter();

export const RPC_URL = Deno.env.get("RPC_URL")!; // set as function secret              // Helius endpoint
export const TOKEN_MINT = Deno.env.get("TOKEN_MINT") ?? ""; // empty = pre-launch mode
export const TICKER = Deno.env.get("TICKER") ?? "$GRAVE";
export const FLAME_BURN = Number(Deno.env.get("FLAME_BURN") ?? "1000");
export const OFFER_THRESHOLD = Number(Deno.env.get("OFFER_THRESHOLD") ?? "10000");
export const MIN_OFFER = Number(Deno.env.get("MIN_OFFER") ?? "100");            // set after launch
export const TOKEN_DECIMALS = Number(Deno.env.get("TOKEN_DECIMALS") ?? "6");
export const HOLD_THRESHOLD = Number(Deno.env.get("HOLD_THRESHOLD") ?? "1000");


// locked to the live site; set ALLOWED_ORIGIN secret to override (e.g. for local dev)
const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? "https://2bitdeveloper.github.io";
export const CORS = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

export function admin() {
  // service-role client — bypasses RLS; exists only inside edge functions
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

/**
 * Stateless wallet auth. The client signs:
 *   graveyard:{action}:{wallet}:{isoTimestamp}
 * We verify the ed25519 signature and that the timestamp is fresh (<5 min).
 * Upgrade path: server-issued nonces in a table if replay-within-5-min
 * ever matters for an action (it doesn't for burials/candles).
 */
export function verifyWallet(
  action: string,
  wallet: string,
  timestamp: string,
  signatureB58: string,
): { ok: true } | { ok: false; err: string } {
  const age = Date.now() - Date.parse(timestamp);
  if (isNaN(age) || age < -30_000 || age > 300_000) {
    return { ok: false, err: "Signature expired — reconnect and retry." };
  }
  const message = `graveyard:${action}:${wallet}:${timestamp}`;
  try {
    const valid = nacl.sign.detached.verify(
      new TextEncoder().encode(message),
      bs58.decode(signatureB58),
      bs58.decode(wallet),
    );
    return valid ? { ok: true } : { ok: false, err: "Invalid signature." };
  } catch {
    return { ok: false, err: "Malformed signature or wallet." };
  }
}

/** Sum the wallet's $RIP across its token accounts. Returns UI amount. */
export async function ripBalance(wallet: string): Promise<number> {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getTokenAccountsByOwner",
      params: [wallet, { mint: TOKEN_MINT }, { encoding: "jsonParsed" }],
    }),
  });
  const data = await res.json();
  const accounts = data?.result?.value ?? [];
  return accounts.reduce(
    (sum: number, a: any) =>
      sum + (a.account.data.parsed.info.tokenAmount.uiAmount ?? 0),
    0,
  );
}

/** Pattern-level moderation: block URLs, handles, and obvious spam vectors. */

/* fetch a confirmed transaction, jsonParsed */
export async function getParsedTx(sig: string): Promise<any | null> {
  const res = await fetch(RPC_URL, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getTransaction",
      params: [sig, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0, commitment: "confirmed" }] }),
  });
  return (await res.json())?.result ?? null;
}

/* total TOKEN_MINT burned by wallet in this tx */
export function sumBurns(tx: any, wallet: string): number {
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
    if (info.mint !== TOKEN_MINT) continue;
    if ((info.authority ?? info.multisigAuthority) !== wallet) continue;
    burned += p.type === "burnChecked"
      ? Number(info.tokenAmount.uiAmount)
      : Number(info.amount) / 10 ** TOKEN_DECIMALS;
  }
  return burned;
}

/* net TOKEN_MINT balance change for owner across the tx (post - pre) */
export function tokenDelta(tx: any, owner: string): number {
  const bal = (arr: any[]) => (arr ?? [])
    .filter((b: any) => b.mint === TOKEN_MINT && b.owner === owner)
    .reduce((s: number, b: any) => s + Number(b.uiTokenAmount?.uiAmount ?? 0), 0);
  return bal(tx.meta?.postTokenBalances) - bal(tx.meta?.preTokenBalances);
}

const BLOCK_PATTERNS = [
  /https?:\/\//i,
  /\bwww\./i,
  /\.(com|io|xyz|net|org|fun|lol|gg)\b/i,
  /t\.me\//i,
  /@\w{3,}/,
  /discord\.gg/i,
  /[A-HJ-NP-Za-km-z1-9]{32,44}/, // raw base58 addresses (CA shilling in epitaphs)
];
export function moderationFlag(text: string): string | null {
  for (const p of BLOCK_PATTERNS) if (p.test(text)) return "Links, handles, and addresses can't be engraved on stones.";
  if (profanity.isProfane(text)) return "Let's keep the epitaphs printable, please.";
  return null;
}

/** Simple per-wallet cooldown so free actions (burials) can't be spammed. */
export async function tooSoon(db: ReturnType<typeof admin>, table: string, wallet: string, seconds: number): Promise<boolean> {
  const { data } = await db.from(table).select("created_at")
    .eq("wallet", wallet).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!data) return false;
  return (Date.now() - Date.parse(data.created_at)) < seconds * 1000;
}
