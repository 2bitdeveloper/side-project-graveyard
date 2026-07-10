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
1. [ ] Launch on pump.fun — select **Creator Fees** (locked forever at
       creation, this is the revenue model). Copy the mint address (CA).
2. [ ] Supabase dashboard → Project Settings → Edge Functions → Secrets:
       add `RIP_MINT = <CA>`. Takes effect on the next request —
       burial gating and resurrections switch on instantly.
3. [ ] Edit `index.html` → `CONFIG.RIP_MINT = "<CA>"` → commit → push.
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

## Env reference (function secrets, all optional except RIP_MINT)
| Secret          | Default (baked)     | Purpose                     |
|-----------------|---------------------|-----------------------------|
| RIP_MINT        | "" (pre-launch)     | token mint; enables gating  |
| RPC_URL         | Helius fallback     | balance + burn verification |
| HOLD_THRESHOLD  | 1000                | $RIP needed to bury         |
| BURN_AMOUNT     | 10000               | $RIP burned to resurrect    |
| TOKEN_DECIMALS  | 6                   | pump.fun default            |
