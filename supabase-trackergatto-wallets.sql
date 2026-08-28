-- TrackerGatto: dati privati per utente + wallet + trasferimenti
-- Eseguire una volta nel SQL Editor di Supabase.

create extension if not exists pgcrypto;

create table if not exists public.tracker_holders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.tracker_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  holder_id uuid not null references public.tracker_holders(id) on delete cascade,
  name text not null,
  note text default '',
  balance numeric(14,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.tracker_wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  wallet_type text not null default 'ALTRO',
  note text default '',
  balance numeric(14,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.tracker_movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  movement_date date not null default current_date,
  movement_type text not null,
  amount numeric(14,2) not null check (amount >= 0),
  account_id uuid references public.tracker_accounts(id) on delete set null,
  wallet_id uuid references public.tracker_wallets(id) on delete set null,
  description text default '',
  created_at timestamptz not null default now()
);

create table if not exists public.tracker_bets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid references public.tracker_accounts(id) on delete set null,
  bet_date date not null default current_date,
  description text default '',
  stake numeric(14,2) not null default 0,
  odds numeric(10,3) not null default 0,
  status text not null default 'PENDING',
  profit numeric(14,2) not null default 0,
  created_at timestamptz not null default now()
);

alter table public.tracker_holders enable row level security;
alter table public.tracker_accounts enable row level security;
alter table public.tracker_wallets enable row level security;
alter table public.tracker_movements enable row level security;
alter table public.tracker_bets enable row level security;

do $$
declare t text;
begin
  foreach t in array array['tracker_holders','tracker_accounts','tracker_wallets','tracker_movements','tracker_bets'] loop
    execute format('drop policy if exists %I on public.%I', t || '_own_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_own_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_own_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_own_delete', t);
    execute format('create policy %I on public.%I for select using (auth.uid() = user_id)', t || '_own_select', t);
    execute format('create policy %I on public.%I for insert with check (auth.uid() = user_id)', t || '_own_insert', t);
    execute format('create policy %I on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)', t || '_own_update', t);
    execute format('create policy %I on public.%I for delete using (auth.uid() = user_id)', t || '_own_delete', t);
  end loop;
end $$;

create index if not exists tracker_holders_user_idx on public.tracker_holders(user_id);
create index if not exists tracker_accounts_user_idx on public.tracker_accounts(user_id);
create index if not exists tracker_wallets_user_idx on public.tracker_wallets(user_id);
create index if not exists tracker_movements_user_idx on public.tracker_movements(user_id);
create index if not exists tracker_bets_user_idx on public.tracker_bets(user_id);

-- La RLS impedisce a un utente di leggere/modificare dati di qualsiasi altro utente.
