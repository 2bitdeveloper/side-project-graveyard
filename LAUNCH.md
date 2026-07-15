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

## Economy v4 (current)
- Resurrection goals are now creator-set at burial time (1,000–1,000,000
  $GRAVE, default 10,000), not a global constant. The `apply_offering`
  trigger checks each grave's own `resurrect_goal`.
- New "RESURRECTION" section in the burial modal: optional pitch (what the
  project does / what finishing it needs, 500 chars, moderated) and a
  validated trust link (GitHub/Website/Twitter/Demo/Discord/Other, http(s)
  only, no local/private hosts) so funders can verify the project is real
  and follow its progress.
- Grave detail view now shows the pitch and an outbound link when present.
- New env: DEFAULT_RESURRECT_GOAL (10000), MIN_RESURRECT_GOAL (1000),
  MAX_RESURRECT_GOAL (1000000). OFFER_THRESHOLD is retired server-side.

## Bug fixes (this pass)
- Candles no longer require a wallet signature — only a connected address.
  They're free and low-stakes, so requiring a signature blocked anyone on a
  non-signing wallet (e.g. pump.fun's embedded wallet via the read-only
  viewer) from lighting one at all. All other actions (bury, eternal flame,
  custom tombstone, offer) still require a real signature.
- Eternal flame and offering controls are now visibly present but disabled
  pre-launch ("🔒 unlocks at launch") instead of hidden entirely — hiding
  them read as broken/missing to beta testers rather than "not live yet."

## Bug fixes (this pass, part 2)
- Root cause of "Failed to fetch" on candles: `npm:bad-words` (added during
  the security hardening pass) crashed the shared helpers module at cold
  start in Deno's edge runtime — every request, including the OPTIONS
  preflight, returned 503, which browsers surface as a generic fetch
  failure. Confirmed via `get_logs` (503 on OPTIONS, up to 2.1s execution
  time — a boot crash, not application logic). Replaced with a small
  dependency-free word-boundary filter. Affected and fixed: bury,
  eternal-flame, offer, light-candle (which was also decoupled from the
  shared helpers entirely, since it no longer needs signature verification).
- Wallet connections (including the read-only viewer) didn't survive a page
  refresh — state was memory-only. Added localStorage persistence: real
  wallets attempt a silent, trusted-only reconnect on load (no popup); the
  read-only viewer restores the saved address directly. Added a working
  "disconnect" option in the wallet picker (previously unreachable when no
  browser-extension wallet was detected — exactly the read-only scenario).
