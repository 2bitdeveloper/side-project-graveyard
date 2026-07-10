# Graveyard backend — integration guide

## 1. Apply the schema
Supabase dashboard → SQL editor → paste `schema.sql` → run. Or:
```bash
supabase db push   # if you manage migrations locally
```

## 2. Set edge function secrets
```bash
supabase secrets set RPC_URL="https://mainnet.helius-rpc.com/?api-key=YOUR_KEY"
supabase secrets set RIP_MINT="PASTE_MINT_AFTER_LAUNCH"
supabase secrets set TOKEN_DECIMALS="6"
supabase secrets set HOLD_THRESHOLD="1000"
supabase secrets set BURN_AMOUNT="10000"
```
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.

## 3. Deploy the functions
```bash
supabase functions deploy bury
supabase functions deploy light-candle
supabase functions deploy resurrect
```
All three allow anonymous invocation (auth happens via wallet signature),
so deploy with `--no-verify-jwt` or disable JWT verification per-function
in the dashboard.

## 4. Client wiring (replaces the prototype stubs)

### Signing helper (wallet-adapter)
```ts
import bs58 from "bs58";

async function signedPayload(action: string, wallet: WalletContextState) {
  const timestamp = new Date().toISOString();
  const message = `graveyard:${action}:${wallet.publicKey!.toBase58()}:${timestamp}`;
  const sig = await wallet.signMessage!(new TextEncoder().encode(message));
  return {
    wallet: wallet.publicKey!.toBase58(),
    timestamp,
    signature: bs58.encode(sig),
  };
}
```

### bury()
```ts
const res = await fetch(`${SUPABASE_URL}/functions/v1/bury`, {
  method: "POST",
  headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
  body: JSON.stringify({
    ...(await signedPayload("bury", wallet)),
    grave: { name, epitaph, cause, born, died },
  }),
});
```

### lightCandle()
```ts
body: JSON.stringify({ ...(await signedPayload("candle", wallet)), graveId })
```

### resurrect() — burn first, then verify
```ts
import { createBurnCheckedInstruction, getAssociatedTokenAddressSync } from "@solana/spl-token";

const ata = getAssociatedTokenAddressSync(new PublicKey(RIP_MINT), wallet.publicKey!);
const ix = createBurnCheckedInstruction(
  ata, new PublicKey(RIP_MINT), wallet.publicKey!,
  BigInt(10_000 * 10 ** 6), 6,
);
const burnTx = await sendAndConfirm(ix); // your existing tx helper

body: JSON.stringify({ ...(await signedPayload("resurrect", wallet)), graveId, burnTx })
```

### Reads (no function needed — straight PostgREST, RLS allows select)
```ts
const { data: graves } = await supabase
  .from("graves").select("*")
  .order("created_at", { ascending: false })
  .range(page * 24, page * 24 + 23);          // paginate the cemetery

const { data: stats } = await supabase.from("graveyard_stats").select("*").single();

const { data: mourned } = await supabase
  .from("graves").select("name, cause, candles_count")
  .order("candles_count", { ascending: false }).limit(3);
```

## 5. Security notes
- Clients can only SELECT. Every write path goes through a function
  holding the service-role key; RLS has no insert/update policies.
- Candle metering is enforced by the DB (unique index), not app logic —
  a hostile client gains nothing by calling the endpoint in a loop.
- Burn replay is blocked by the `burns.tx_signature` primary key.
- Epitaph moderation blocks links/handles/CAs at the pattern level;
  add a wordlist or an LLM moderation pass later if vandalism shows up.
- Before launch, tighten `Access-Control-Allow-Origin` in helpers.ts to
  `https://2bitdeveloper.github.io`.

## 6. Order of operations at launch
1. Deploy schema + functions with `RIP_MINT` as a placeholder.
2. Launch the token on pump.fun, copy the mint.
3. `supabase secrets set RIP_MINT="..."` (functions pick it up instantly).
4. Update the CA in the site footer, push to main, Pages redeploys.
