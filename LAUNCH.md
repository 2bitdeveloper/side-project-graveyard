# ⚰ LAUNCH DAY — the only variable left is the CA

Everything is deployed and running in pre-launch mode:
site live on Pages, DB seeded, functions ACTIVE. Burials are FREE until
the mint exists; resurrections are locked. Both switch over automatically
when the mint address lands in the two places below.

## Before launch (any time)
- [ ] Test the full loop on the live site: connect Phantom → bury a test
      project → light a candle. (Both work pre-launch, no tokens needed.)
- [ ] Screenshot/record the cemetery for launch content.
- [ ] Pre-write the launch thread. Pin the site URL everywhere first.

## At launch (order matters)
1. [ ] Launch on pump.fun — select **CASHBACK COIN** (100% of creator fees
       to traders, locked forever at creation). Copy the mint address (CA).
2. [ ] Supabase dashboard → Project Settings → Edge Functions → Secrets:
       add `TOKEN_MINT = <CA>`. Takes effect on the next request —
       burial gating and resurrections switch on instantly.
3. [ ] Edit `index.html` → `CONFIG.TOKEN_MINT = "<CA>"` → commit → push.
       Pages redeploys in ~1 min. This updates the footer CA display and
       unlocks the resurrect button client-side.
4. [ ] Post the CA simultaneously on every channel + confirm the site
       footer shows it. The site being the canonical CA source is the
       clone-spam defense.

## After launch
- [ ] Set `RPC_URL` as a function secret in the dashboard and then
      rotate the Helius API key. The current key is baked into the
      deployed (private) function code as a fallback AND has appeared in
      a chat session — treat it as semi-exposed and rotate when convenient.
- [ ] Watch epitaphs for the first day; the moderation filter blocks
      links/handles/CAs but creative vandals are creative.
- [ ] First "Funeral Friday" thread: bury a legendary dead project,
      invite quote-tweets.

## Env reference (function secrets, all optional except TOKEN_MINT)
| Secret          | Default (baked)     | Purpose                     |
|-----------------|---------------------|-----------------------------|
| TOKEN_MINT        | "" (pre-launch)     | token mint; enables gating  |
| RPC_URL         | Helius fallback     | balance + burn verification |
| HOLD_THRESHOLD  | 1000                | $GRAVE needed to bury         |
| BURN_AMOUNT     | 10000               | $GRAVE burned to resurrect    |
| TOKEN_DECIMALS  | 6                   | pump.fun default            |

## Economy v2 (current)
- Candles: free forever (top of funnel).
- Eternal flame: burn 1,000 $GRAVE → permanent golden flame (one per wallet per grave).
- Offerings: min 100 $GRAVE, one tx = 95% transferChecked to builder + 5% burnChecked tithe.
- Resurrection: automatic at 10,000 $GRAVE gross offerings (DB trigger).
- Functions: bury, light-candle, eternal-flame, offer. `resurrect` is deprecated/dormant.
- New env names: TOKEN_MINT (was RIP_MINT), plus optional TICKER, FLAME_BURN, OFFER_THRESHOLD, MIN_OFFER.

## Security hardening (this pass)
- CORS locked to https://2bitdeveloper.github.io (was `*`). Override with
  the `ALLOWED_ORIGIN` secret for local/dev testing.
- Epitaphs/names now pass through a maintained profanity filter
  (`bad-words` npm package) in addition to the link/handle/address blocks.
- Free burials are rate-limited: one grave per wallet per 60 seconds,
  enforced server-side in `bury`.
- Wallet coverage extended: Wallet Standard auto-discovery (catches nearly
  all modern extensions) + legacy fallback list now covers Phantom,
  Solflare, Backpack, OKX, Bitget, Trust, Coinbase, Glow, Nightly, Coin98,
  MathWallet, Exodus, Clover — plus mobile deep-links for Phantom/Solflare
  when no wallet is injected.

## Economy v3 (current)
- Custom tombstones: burn 500 $GRAVE, choose marble/onyx/gold/crystal style,
  grave pins to the top of the cemetery (order: custom desc, created_at desc).
  Locked pre-launch (needs TOKEN_MINT), same as flames/offerings.
- Cause of death: dropdown now includes "Something else…", revealing a free-text
  field (60 chars, moderated server-side) instead of the fixed enum.
- Wallet picker: added a read-only address viewer for pump.fun's embedded wallet
  (Privy-based, doesn't inject into external sites). Lets people browse without
  a signing wallet; any bury/candle/flame/offer attempt explains it needs a
  real signing wallet (Phantom, Solflare, or an exported pump.fun key).
- New env: CUSTOM_TOMBSTONE_BURN (default 500).
