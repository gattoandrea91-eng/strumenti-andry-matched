create table if not exists public.soccertrend_signals (
  match_id text primary key,
  message_id bigint,
  home text not null,
  away text not null,
  start_home_goals integer not null default 0,
  start_away_goals integer not null default 0,
  start_goals integer not null default 0,
  signal_minute integer not null default 0,
  market text not null,
  score integer not null default 0,
  corners numeric not null default 0,
  touches numeric not null default 0,
  big_chances numeric not null default 0,
  shots numeric not null default 0,
  sot numeric not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.soccertrend_stats (
  id integer primary key default 1 check (id = 1),
  wins bigint not null default 0,
  losses bigint not null default 0,
  updated_at timestamptz not null default now()
);

insert into public.soccertrend_stats(id,wins,losses)
values(1,0,0)
on conflict (id) do nothing;

alter table public.soccertrend_signals enable row level security;
alter table public.soccertrend_stats enable row level security;

-- Nessuna policy pubblica: il browser non può leggere/scrivere queste tabelle.
-- L'endpoint server usa SUPABASE_SERVICE_ROLE_KEY su Vercel.

create index if not exists soccertrend_signals_created_idx on public.soccertrend_signals(created_at);