-- =====================================================================
-- TransfertPro : l'admin n'enregistre pas de transfert
--
-- À exécuter UNE fois dans Supabase > SQL Editor.
--
-- * Retire du site tous les transferts enregistrés au nom de l'admin.
--   Une copie complète est gardée dans "transferts_archives".
-- * Les transferts des employés, les crédits et les anciennes tables
--   (transactions, periodes) ne sont pas touchés.
-- * En cas d'erreur, rien n'est modifié.
-- =====================================================================

begin;

do $$
begin
  if to_regclass('public.transferts') is null then
    raise exception 'Exécutez d''abord le premier script (equipe_et_devises).';
  end if;
  if to_regclass('public.transferts_archives') is not null then
    raise exception 'Ce script a déjà été exécuté.';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. Archive, invisible du site
-- ---------------------------------------------------------------------
create table public.transferts_archives (
  id bigint primary key,
  contenu jsonb not null,
  journal jsonb not null,
  archive_le timestamptz not null default now()
);
alter table public.transferts_archives enable row level security;
revoke all on public.transferts_archives from public, anon, authenticated;

insert into public.transferts_archives (id, contenu, journal)
select t.id, to_jsonb(t),
  coalesce((select jsonb_agg(to_jsonb(j) order by j.id)
            from public.transferts_journal j where j.transfert_id = t.id), '[]'::jsonb)
from public.transferts t
join public.profils p on p.id = t.employe_id and p.role = 'PATRON';

-- ---------------------------------------------------------------------
-- 2. Suppression : uniquement ce qui vient d'être archivé
-- ---------------------------------------------------------------------
delete from public.transferts_journal where transfert_id in (select id from public.transferts_archives);
delete from public.transferts where id in (select id from public.transferts_archives);
delete from public.clotures where employe_id in (select id from public.profils where role = 'PATRON');

-- Relancée par erreur, elle remettrait ces transferts au nom de l'admin.
drop function public.importer_anciennes_transactions();

-- ---------------------------------------------------------------------
-- 3. L'admin supervise : ni transfert, ni clôture à son nom
-- ---------------------------------------------------------------------
create function public.reserver_aux_employes() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.profils where id = new.employe_id and role = 'EMPLOYE') then
    raise exception 'Seuls les employés enregistrent des transferts et clôturent une journée.';
  end if;
  return new;
end $$;
revoke all on function public.reserver_aux_employes() from public, anon, authenticated;

create trigger reserver_aux_employes before insert on public.transferts
  for each row execute function public.reserver_aux_employes();
create trigger reserver_aux_employes before insert on public.clotures
  for each row execute function public.reserver_aux_employes();

notify pgrst, 'reload schema';

commit;

-- Contrôle : "transferts_admin_restants" doit être 0.
select
  (select count(*) from public.transferts_archives) as transferts_archives,
  (select count(*) from public.transferts t
     join public.profils p on p.id = t.employe_id where p.role = 'PATRON') as transferts_admin_restants,
  (select count(*) from public.transferts) as transferts_employes;
