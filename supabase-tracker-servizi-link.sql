-- MBrain Tracker: collegamento facoltativo tra puntate e servizi personali
-- Da eseguire UNA VOLTA nel SQL Editor del progetto Supabase MBrain.
-- Non cancella o altera le puntate esistenti; quelle storiche restano senza servizio fino all'assegnazione manuale.
begin;
-- La tabella servizi esiste già nel progetto, utilizzata dalla pagina servizi.html.
create unique index if not exists services_owner_pair_idx on public.services(user_id,id);
alter table public.tracker_bets add column if not exists service_id uuid null;
-- Vincolo composito: una puntata può puntare soltanto a un servizio dello stesso proprietario.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tracker_bets_owner_service_fk' and conrelid='public.tracker_bets'::regclass) then
    alter table public.tracker_bets add constraint tracker_bets_owner_service_fk
      foreign key (user_id,service_id) references public.services(user_id,id)
      on delete set null (service_id);
  end if;
end $$;
create index if not exists tracker_bets_user_service_idx on public.tracker_bets(user_id,service_id);
alter table public.tracker_bets enable row level security;
alter table public.services enable row level security;
-- L'app usa sempre user_id=auth.uid() nelle query. Queste policy richiedono anche che la sessione sia autenticata.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='services' and policyname='mbrain_services_owner_select') then
    create policy mbrain_services_owner_select on public.services for select to authenticated using (user_id=auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='services' and policyname='mbrain_services_owner_insert') then
    create policy mbrain_services_owner_insert on public.services for insert to authenticated with check (user_id=auth.uid());
  end if;
end $$;
commit;
-- IMPORTANTE: controllare che non esistano altre policy permissive pubbliche su services/service_entries.
-- Le policy OR si sommano: una policy pubblica troppo permissiva vanificherebbe l'isolamento.
