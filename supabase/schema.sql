-- =====================================================================
-- THE SIDE PROJECT GRAVEYARD — Supabase schema
-- Design: public reads, ALL writes go through edge functions using the
-- service-role key. Clients never insert/update directly.
-- =====================================================================

-- ---------- graves ----------
create table if not exists public.graves (
  id            uuid primary key default gen_random_uuid(),
  wallet        text not null,                     -- burier's base58 pubkey
  name          text not null check (char_length(name) between 1 and 40),
  epitaph       text not null check (char_length(epitaph) between 1 and 140),
  cause         text not null,
  born          text not null default '20??',
  died          text not null default to_char(now(), 'YYYY'),
  risen         boolean not null default false,
  risen_tx      text,                              -- burn tx signature, proof of resurrection
  candles_count integer not null default 0,        -- denormalized for cheap sorting
  community     boolean not null default false,    -- community memorials (Google Reader etc.)
  created_at    timestamptz not null default now()
);

-- one grave per (wallet, project name) — no duplicate burials
create unique index if not exists graves_wallet_name_uidx
  on public.graves (wallet, lower(name));

create index if not exists graves_candles_idx on public.graves (candles_count desc);
create index if not exists graves_created_idx on public.graves (created_at desc);

-- ---------- candles ----------
create table if not exists public.candles (
  id         bigint generated always as identity primary key,
  grave_id   uuid not null references public.graves(id) on delete cascade,
  wallet     text not null,
  lit_on     date not null default current_date,   -- metering column
  created_at timestamptz not null default now()
);

-- metering: one candle per wallet per grave per day
create unique index if not exists candles_meter_uidx
  on public.candles (grave_id, wallet, lit_on);

-- keep graves.candles_count in sync
create or replace function public.bump_candle_count()
returns trigger language plpgsql security definer as $$
begin
  update public.graves set candles_count = candles_count + 1 where id = new.grave_id;
  return new;
end $$;

drop trigger if exists trg_bump_candles on public.candles;
create trigger trg_bump_candles
  after insert on public.candles
  for each row execute function public.bump_candle_count();

-- ---------- burn ledger (resurrections) ----------
create table if not exists public.burns (
  tx_signature text primary key,                   -- prevents replaying one burn tx
  grave_id     uuid not null references public.graves(id),
  wallet       text not null,
  amount       numeric not null,
  created_at   timestamptz not null default now()
);

-- ---------- stats view (hero strip) ----------
create or replace view public.graveyard_stats as
select
  (select count(*)::int from public.graves)                       as buried,
  (select coalesce(sum(candles_count),0)::int from public.graves) as candles,
  (select count(*)::int from public.graves where risen)           as risen,
  (select coalesce(sum(amount),0) from public.burns)              as rip_burned;

-- ---------- RLS ----------
alter table public.graves  enable row level security;
alter table public.candles enable row level security;
alter table public.burns   enable row level security;

-- anyone can read; nobody but service-role can write (no insert/update policies)
create policy "graves are public reading" on public.graves  for select using (true);
create policy "candles are public reading" on public.candles for select using (true);
create policy "burns are public reading"   on public.burns   for select using (true);

-- grant the anon role read on the view
grant select on public.graveyard_stats to anon, authenticated;

-- ---------- security hardening (advisor fixes) ----------
alter view public.graveyard_stats set (security_invoker = true);
alter function public.bump_candle_count() set search_path = public, pg_temp;
revoke execute on function public.bump_candle_count() from anon, authenticated, public;

-- ---------- ECONOMY V2: see migration economy_v2_offerings_and_flames ----------
-- candle tiers (free/eternal), offerings ledger with 95/5 tithe,
-- graves.offered_total + eternal_flames, resurrection trigger at 10,000,
-- stats view: burned_total + sent_to_builders.

-- ---------- ECONOMY V3: custom tombstones ----------
-- graves.style (classic/marble/onyx/gold/crystal), graves.custom boolean.
-- Custom tombstones cost a 500 $GRAVE burn (verified in `bury`), pin to the
-- top via order-by (custom desc, created_at desc). Cause of death now also
-- accepts free text via the "Something else…" sentinel, moderated server-side.

-- ---------- ECONOMY V4: creator-set resurrection goals + pitch + trust link ----------
-- graves.resurrect_goal (numeric, 1,000–1,000,000, default 10,000, creator-set at bury time)
-- graves.pitch (free text, 500 chars, moderated, no links)
-- graves.link_url / graves.link_label (validated http(s) link + enum label)
-- apply_offering() trigger now compares against each grave's own resurrect_goal.
