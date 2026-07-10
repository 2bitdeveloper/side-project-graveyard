// Shared helpers for graveyard edge functions (Deno runtime)
import nacl from "npm:tweetnacl@1.0.3";
import bs58 from "npm:bs58@5.0.0";
import { createClient } from "npm:@supabase/supabase-js@2";

export const RPC_URL = Deno.env.get("RPC_URL")!;              // Helius endpoint
export const RIP_MINT = Deno.env.get("RIP_MINT")!;            // set after launch
export const TOKEN_DECIMALS = Number(Deno.env.get("TOKEN_DECIMALS") ?? "6");
export const HOLD_THRESHOLD = Number(Deno.env.get("HOLD_THRESHOLD") ?? "1000");
export const BURN_AMOUNT = Number(Deno.env.get("BURN_AMOUNT") ?? "10000");

export const CORS = {
  "Access-Control-Allow-Origin": "*", // tighten to your Pages origin in prod
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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
      params: [wallet, { mint: RIP_MINT }, { encoding: "jsonParsed" }],
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
  return null;
}
