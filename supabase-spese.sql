create table if not exists public.spese (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome text not null,
  categoria text not null default 'Extra',
  importo numeric(12,2) not null check (importo >= 0),
  scadenza date not null,
  pagata boolean not null default false,
  data_pagamento date,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.spese enable row level security;

drop policy if exists "spese_select_own" on public.spese;
create policy "spese_select_own" on public.spese for select using (auth.uid() = user_id);

drop policy if exists "spese_insert_own" on public.spese;
create policy "spese_insert_own" on public.spese for insert with check (auth.uid() = user_id);

drop policy if exists "spese_update_own" on public.spese;
create policy "spese_update_own" on public.spese for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "spese_delete_own" on public.spese;
create policy "spese_delete_own" on public.spese for delete using (auth.uid() = user_id);

create index if not exists spese_user_scadenza_idx on public.spese(user_id, scadenza desc);