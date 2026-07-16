create table if not exists public.graves (
  id            uuid primary key default gen_random_uuid(),
  wallet        text not null,
  name          text not null check (char_length(name) between 1 and 40),
  epitaph       text not null check (char_length(epitaph) between 1 and 140),
  cause         text not null,
  born          text not null default '20??',
  died          text not null default to_char(now(), 'YYYY'),
  risen         boolean not null default false,
  risen_tx      text,
  candles_count integer not null default 0,
  community     boolean not null default false,
  created_at    timestamptz not null default now(),
  offered_total   numeric not null default 0,
  eternal_flames  integer not null default 0,
  style           text not null default 'classic'
                  check (style in ('classic','marble','onyx','gold','crystal')),
  custom          boolean not null default false,
  resurrect_goal  numeric not null default 10000
                  check (resurrect_goal >= 1000 and resurrect_goal <= 1000000),
  pitch           text,
  link_url        text,
  link_label      text
                  check (link_label is null or link_label in ('GitHub','Website','Twitter/X','Demo','Discord','Other'))
);

create unique index if not exists graves_wallet_name_uidx on public.graves (wallet, lower(name));
create index if not exists graves_candles_idx on public.graves (candles_count desc);
create index if not exists graves_created_idx on public.graves (created_at desc);
create index if not exists graves_custom_created_idx on public.graves (custom desc, created_at desc);

create table if not exists public.candles (
  id         bigint generated always as identity primary key,
  grave_id   uuid not null references public.graves(id) on delete cascade,
  wallet     text not null,
  lit_on     date not null default current_date,
  created_at timestamptz not null default now(),
  tier       text not null default 'free' check (tier in ('free','eternal'))
);

create unique index if not exists candles_free_meter_uidx on public.candles (grave_id, wallet, lit_on) where tier = 'free';
create unique index if not exists candles_eternal_uidx on public.candles (grave_id, wallet) where tier = 'eternal';

create table if not exists public.burns (
  tx_signature text primary key,
  grave_id     uuid not null references public.graves(id),
  wallet       text not null,
  amount       numeric not null,
  created_at   timestamptz not null default now(),
  purpose      text not null default 'resurrection'
);

create table if not exists public.offerings (
  tx_signature    text primary key,
  grave_id        uuid not null references public.graves(id),
  from_wallet     text not null,
  amount_to_owner numeric not null,
  amount_burned   numeric not null,
  created_at      timestamptz not null default now()
);

create or replace function public.bump_candle_count()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.graves set
    candles_count = candles_count + 1,
    eternal_flames = eternal_flames + (case when new.tier = 'eternal' then 1 else 0 end)
  where id = new.grave_id;
  return new;
end $$;
revoke execute on function public.bump_candle_count() from anon, authenticated, public;

drop trigger if exists trg_bump_candles on public.candles;
create trigger trg_bump_candles
  after insert on public.candles
  for each row execute function public.bump_candle_count();

create or replace function public.apply_offering()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare gross numeric := new.amount_to_owner + new.amount_burned;
begin
  update public.graves g set
    offered_total = g.offered_total + gross,
    risen_tx = case when (not g.risen) and (g.offered_total + gross >= g.resurrect_goal) then new.tx_signature else g.risen_tx end,
    risen = g.risen or (g.offered_total + gross >= g.resurrect_goal)
  where g.id = new.grave_id;
  return new;
end $$;
revoke execute on function public.apply_offering() from anon, authenticated, public;

drop trigger if exists trg_apply_offering on public.offerings;
create trigger trg_apply_offering
  after insert on public.offerings
  for each row execute function public.apply_offering();

create or replace view public.graveyard_stats with (security_invoker = true) as
select
  (select count(*)::int from public.graves)                       as buried,
  (select coalesce(sum(candles_count),0)::int from public.graves) as candles,
  (select count(*)::int from public.graves where risen)           as risen,
  (select coalesce((select sum(amount) from public.burns),0)
        + coalesce((select sum(amount_burned) from public.offerings),0)) as burned_total,
  (select coalesce(sum(amount_to_owner),0) from public.offerings) as sent_to_builders;

grant select on public.graveyard_stats to anon, authenticated;

alter table public.graves    enable row level security;
alter table public.candles   enable row level security;
alter table public.burns     enable row level security;
alter table public.offerings enable row level security;

create policy "graves are public reading" on public.graves for select using (true);
create policy "candles are public reading" on public.candles for select using (true);
create policy "burns are public reading" on public.burns for select using (true);
create policy "offerings are public reading" on public.offerings for select using (true);
