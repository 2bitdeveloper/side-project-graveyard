// Shared helpers v7 — dependency-free profanity filter (removes npm:bad-words,
// which appears to have Deno edge-runtime compatibility issues that crashed
// the function at cold start — every request, including OPTIONS, 503'd).
import nacl from "npm:tweetnacl@1.0.3";
import bs58 from "npm:bs58@5.0.0";
import { createClient } from "npm:@supabase/supabase-js@2";

export const RPC_URL = Deno.env.get("RPC_URL") ?? "https://mainnet.helius-rpc.com/?api-key=3480e0ac-2fe9-415c-962c-6ec8c8337290";
export const TOKEN_MINT = Deno.env.get("TOKEN_MINT") ?? Deno.env.get("RIP_MINT") ?? "";
export const TICKER = Deno.env.get("TICKER") ?? "$GRAVE";
export const TOKEN_DECIMALS = Number(Deno.env.get("TOKEN_DECIMALS") ?? "6");
export const HOLD_THRESHOLD = Number(Deno.env.get("HOLD_THRESHOLD") ?? "1000");
export const FLAME_BURN = Number(Deno.env.get("FLAME_BURN") ?? "1000");
export const MIN_OFFER = Number(Deno.env.get("MIN_OFFER") ?? "100");
export const CUSTOM_TOMBSTONE_BURN = Number(Deno.env.get("CUSTOM_TOMBSTONE_BURN") ?? "500");
export const DEFAULT_RESURRECT_GOAL = Number(Deno.env.get("DEFAULT_RESURRECT_GOAL") ?? "10000");
export const MIN_RESURRECT_GOAL = Number(Deno.env.get("MIN_RESURRECT_GOAL") ?? "1000");
export const MAX_RESURRECT_GOAL = Number(Deno.env.get("MAX_RESURRECT_GOAL") ?? "1000000");

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? "https://2bitdeveloper.github.io";
export const CORS = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}
export function admin() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}
export function verifyWallet(action: string, wallet: string, timestamp: string, signatureB58: string):
  { ok: true } | { ok: false; err: string } {
  const age = Date.now() - Date.parse(timestamp);
  if (isNaN(age) || age < -30_000 || age > 300_000) return { ok: false, err: "Signature expired — reconnect and retry." };
  const message = `graveyard:${action}:${wallet}:${timestamp}`;
  try {
    const valid = nacl.sign.detached.verify(new TextEncoder().encode(message), bs58.decode(signatureB58), bs58.decode(wallet));
    return valid ? { ok: true } : { ok: false, err: "Invalid signature." };
  } catch { return { ok: false, err: "Malformed signature or wallet." }; }
}
export async function ripBalance(wallet: string): Promise<number> {
  const res = await fetch(RPC_URL, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getTokenAccountsByOwner",
      params: [wallet, { mint: TOKEN_MINT }, { encoding: "jsonParsed" }] }) });
  const data = await res.json();
  return (data?.result?.value ?? []).reduce((s: number, a: any) => s + (a.account.data.parsed.info.tokenAmount.uiAmount ?? 0), 0);
}
export async function getParsedTx(sig: string): Promise<any | null> {
  const res = await fetch(RPC_URL, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getTransaction",
      params: [sig, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0, commitment: "confirmed" }] }) });
  return (await res.json())?.result ?? null;
}
export function sumBurns(tx: any, wallet: string): number {
  const all = [...(tx.transaction.message.instructions ?? []), ...(tx.meta?.innerInstructions ?? []).flatMap((i: any) => i.instructions)];
  let burned = 0;
  for (const ix of all) {
    const p = ix?.parsed;
    if (ix?.program !== "spl-token" || !p) continue;
    if (p.type !== "burn" && p.type !== "burnChecked") continue;
    const info = p.info;
    if (info.mint !== TOKEN_MINT) continue;
    if ((info.authority ?? info.multisigAuthority) !== wallet) continue;
    burned += p.type === "burnChecked" ? Number(info.tokenAmount.uiAmount) : Number(info.amount) / 10 ** TOKEN_DECIMALS;
  }
  return burned;
}
export function tokenDelta(tx: any, owner: string): number {
  const bal = (arr: any[]) => (arr ?? []).filter((b: any) => b.mint === TOKEN_MINT && b.owner === owner)
    .reduce((s: number, b: any) => s + Number(b.uiTokenAmount?.uiAmount ?? 0), 0);
  return bal(tx.meta?.postTokenBalances) - bal(tx.meta?.preTokenBalances);
}
const BLOCK_PATTERNS = [
  /https?:\/\//i, /\bwww\./i, /\.(com|io|xyz|net|org|fun|lol|gg)\b/i,
  /t\.me\//i, /@\w{3,}/, /discord\.gg/i, /[A-HJ-NP-Za-km-z1-9]{32,44}/,
];
const PROFANITY = [
  "fuck","shit","bitch","asshole","bastard","cunt","dick","piss","cock",
  "slut","whore","fag","faggot","nigger","nigga","retard","douchebag",
];
const PROFANITY_RE = new RegExp("\\b(" + PROFANITY.join("|") + ")\\b", "i");
export function moderationFlag(text: string): string | null {
  for (const p of BLOCK_PATTERNS) if (p.test(text)) return "Links, handles, and addresses can't be engraved on stones.";
  if (PROFANITY_RE.test(text)) return "Let's keep it printable, please.";
  return null;
}
export async function tooSoon(db: ReturnType<typeof admin>, table: string, wallet: string, seconds: number): Promise<boolean> {
  const { data } = await db.from(table).select("created_at").eq("wallet", wallet).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!data) return false;
  return (Date.now() - Date.parse(data.created_at)) < seconds * 1000;
}
export function validateLink(raw: string): { ok: true; url: string } | { ok: false; err: string } {
  if (raw.length > 300) return { ok: false, err: "That link is too long." };
  let u: URL;
  try { u = new URL(raw); } catch { return { ok: false, err: "That doesn't look like a valid link." }; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return { ok: false, err: "Links must start with http:// or https://." };
  const host = u.hostname.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1" || host.startsWith("192.168.") || host.startsWith("10.") || !host.includes(".")) {
    return { ok: false, err: "That link needs to point somewhere public." };
  }
  return { ok: true, url: u.toString() };
}
