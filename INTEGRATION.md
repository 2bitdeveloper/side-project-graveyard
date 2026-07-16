# Backend integration guide

## 1. Apply the schema
Supabase dashboard → SQL editor → paste `schema.sql` → run.

## 2. Set edge function secrets
```bash
supabase secrets set RPC_URL="https://mainnet.helius-rpc.com/?api-key=YOUR_KEY"
supabase secrets set TOKEN_MINT="PASTE_MINT_AFTER_LAUNCH"
supabase secrets set ALLOWED_ORIGIN="https://2bitdeveloper.github.io"
```
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically. See LAUNCH.md for the full list of optional secrets and their defaults.

## 3. Deploy the functions
```bash
supabase functions deploy bury
supabase functions deploy light-candle
supabase functions deploy eternal-flame
supabase functions deploy offer
```
All four are deployed with JWT verification on. Every request needs both headers:
```
apikey: SUPABASE_ANON_KEY
Authorization: Bearer SUPABASE_ANON_KEY
```

Auth beyond that varies by function. `bury` and `light-candle` skip wallet signature checks entirely while `TOKEN_MINT` is unset (pre-launch beta), accepting any plausibly-shaped wallet address. Once `TOKEN_MINT` is set, `bury` requires a real signed message; `light-candle` still doesn't, since candles are free and low-stakes. `eternal-flame` and `offer` always require a signature and are locked until `TOKEN_MINT` is set, since both involve real token burns.

## 4. Client wiring

### Signing a request
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

### bury
```ts
const res = await fetch(`${SUPABASE_URL}/functions/v1/bury`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  },
  body: JSON.stringify({
    ...(await signedPayload("bury", wallet)),
    grave: { name, epitaph, cause, born, died, resurrectGoal, pitch, linkUrl, linkLabel },
  }),
});
```

### light-candle
```ts
body: JSON.stringify({ wallet: wallet.publicKey!.toBase58(), graveId })
```

### eternal-flame — burn 1,000 $GRAVE, then verify
```ts
import { createBurnCheckedInstruction, getAssociatedTokenAddressSync } from "@solana/spl-token";

const ata = getAssociatedTokenAddressSync(new PublicKey(TOKEN_MINT), wallet.publicKey!);
const ix = createBurnCheckedInstruction(ata, new PublicKey(TOKEN_MINT), wallet.publicKey!, BigInt(1_000 * 10 ** 6), 6);
const burnTx = await sendAndConfirm(ix);

body: JSON.stringify({ ...(await signedPayload("flame", wallet)), graveId, burnTx })
```

### offer — one transaction, 95% transfer + 5% burn
```ts
body: JSON.stringify({ ...(await signedPayload("offer", wallet)), graveId, offerTx })
```

### Reads — straight PostgREST, no function needed
```ts
const { data: graves } = await supabase
  .from("graves").select("*")
  .order("custom", { ascending: false })
  .order("created_at", { ascending: false })
  .range(page * 24, page * 24 + 23);

const { data: stats } = await supabase.from("graveyard_stats").select("*").single();

const { data: mourned } = await supabase
  .from("graves").select("name, cause, candles_count")
  .order("candles_count", { ascending: false }).limit(3);
```

## 5. Security notes
- Clients can only select. Every write goes through a function holding the service-role key; RLS has no insert or update policies.
- Candle and burial rate limits are enforced in the database (unique indexes, a cooldown check), not just app logic.
- Burn and offering replay is blocked by primary keys on the transaction signature.
- Epitaph, name, and pitch moderation blocks links, handles, and addresses at the pattern level, plus a short profanity list.
- CORS is locked to `ALLOWED_ORIGIN`. Override it for local development.
