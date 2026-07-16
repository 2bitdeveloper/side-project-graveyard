# Launch checklist

The site is live, the database is seeded, and the edge functions are deployed. Everything runs in pre-launch mode until a token exists: burials and candles are free and don't require a wallet, while eternal flames, custom tombstones, and offerings stay locked and disabled with a "unlocks at launch" label.

## Before launch
- [ ] Test the full loop on the live site: connect a wallet, bury a test project, light a candle.
- [ ] Record or screenshot the cemetery for launch content.
- [ ] Pre-write the launch thread. Pin the site URL everywhere first.

## At launch (order matters)
1. Launch on pump.fun and select **Cashback Coin** (100% of creator fees go to traders, locked forever at creation). Copy the mint address.
2. Supabase dashboard → Project Settings → Edge Functions → Secrets: add `TOKEN_MINT = <CA>`. Takes effect on the next request.
3. Edit `index.html`, set `CONFIG.TOKEN_MINT = "<CA>"`, commit, push. Pages redeploys in about a minute and updates the footer CA and unlocks the resurrect flow client-side.
4. Post the CA on every channel at the same time, and confirm the site footer shows it. The site is the canonical CA source.

## After launch
- Set `RPC_URL` as a function secret and rotate the Helius API key — the current key has been shared in chat, treat it as exposed.
- Watch new epitaphs for the first day or two.
- Consider a recurring content thread (a weekly burial spotlight, etc.) to keep the cemetery active.

## How the economy works
- **Candles** are free, forever, and don't require a wallet during beta.
- **Eternal flame**: burn 1,000 $GRAVE for a permanent golden flame, one per wallet per grave.
- **Custom tombstone**: burn 500 $GRAVE, choose a marble/onyx/gold/crystal style, and the grave pins to the top of the cemetery.
- **Offerings**: minimum 100 $GRAVE, sent in one transaction — 95% goes to the project's creator, 5% is burned.
- **Resurrection**: each creator sets their own funding goal at burial time (1,000–1,000,000 $GRAVE, default 10,000). Once total offerings reach that goal, the grave flips to RISEN automatically.
- Burial also accepts an optional pitch (what the project does, 500 characters) and a link (GitHub, website, demo, etc.) so funders can verify the project before offering.

## Known limitation
Graves buried anonymously before launch carry a placeholder wallet address. Once the token is live, offerings sent to those graves will fail since there's no real wallet to receive the transfer. Anyone who wants their project resurrectable after launch should connect a real wallet before burying, even during beta. A "claim your grave" flow to fix this after the fact hasn't been built yet.

## Env reference (function secrets — all optional except TOKEN_MINT)
| Secret | Default | Purpose |
|---|---|---|
| TOKEN_MINT | unset | token mint address; enables all gating |
| RPC_URL | Helius fallback | balance and burn verification |
| ALLOWED_ORIGIN | site origin | CORS allowlist |
| HOLD_THRESHOLD | 1000 | $GRAVE needed to bury once live |
| FLAME_BURN | 1000 | cost of an eternal flame |
| CUSTOM_TOMBSTONE_BURN | 500 | cost of a custom tombstone |
| MIN_OFFER | 100 | minimum offering |
| DEFAULT_RESURRECT_GOAL | 10000 | default goal if none is set |
| MIN_RESURRECT_GOAL | 1000 | floor on creator-set goals |
| MAX_RESURRECT_GOAL | 1000000 | ceiling on creator-set goals |
| TOKEN_DECIMALS | 6 | pump.fun default |
