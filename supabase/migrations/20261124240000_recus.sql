-- =====================================================================
-- TransfertPro : vrais reçus
--
-- À exécuter UNE fois dans Supabase > SQL Editor, après "admin_seul",
-- "zones" et "devise_mere". Aucune donnée n'est supprimée.
-- =====================================================================

begin;

do $$
begin
  if to_regclass('public.autorisations_mot_de_passe') is null then
    raise exception 'Exécutez d''abord le script "admin_seul" : il n''est pas encore passé.';
  end if;
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'devises' and column_name = 'forte') then
    raise exception 'Exécutez d''abord le script "devise_mere".';
  end if;
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'transferts' and column_name = 'code_recu') then
    raise exception 'Ce script a déjà été exécuté.';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. Code de contrôle : unique, tiré au hasard, donc impossible à deviner
--    à partir du numéro du reçu.
-- ---------------------------------------------------------------------
create function public.nouveau_code_recu() returns text
language sql volatile set search_path = '' as $$
  select substr(c, 1, 5) || '-' || substr(c, 6, 5)
  from (select upper(replace(gen_random_uuid()::text, '-', '')) as c) s
$$;
revoke all on function public.nouveau_code_recu() from public, anon, authenticated;

-- Les transferts existants reçoivent chacun le leur.
alter table public.transferts add column code_recu text not null default public.nouveau_code_recu();
alter table public.transferts add constraint transferts_code_recu_key unique (code_recu);

create function public.figer_code_recu() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.code_recu := old.code_recu;
  return new;
end $$;
revoke all on function public.figer_code_recu() from public, anon, authenticated;
create trigger figer_code_recu before update on public.transferts
  for each row execute function public.figer_code_recu();

-- ---------------------------------------------------------------------
-- 2. L'entreprise, imprimée en tête des reçus
-- ---------------------------------------------------------------------
alter table public.parametres add column entreprise_nom text not null default 'TransfertPro';
alter table public.parametres add column entreprise_telephone text not null default '';
alter table public.parametres add column entreprise_adresse text not null default '';
alter table public.parametres add column recu_message text not null default 'Merci de votre confiance.';

create function public.regler_entreprise(p_nom text, p_telephone text, p_adresse text, p_message text)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.est_patron() then raise exception 'Action réservée au patron.'; end if;
  if coalesce(trim(p_nom), '') = '' then raise exception 'Le nom de l''entreprise est requis.'; end if;
  update public.parametres set
    entreprise_nom = left(trim(p_nom), 60),
    entreprise_telephone = left(trim(coalesce(p_telephone, '')), 60),
    entreprise_adresse = left(trim(coalesce(p_adresse, '')), 120),
    recu_message = left(trim(coalesce(p_message, '')), 160)
  where id = 1;
end $$;
revoke all on function public.regler_entreprise(text, text, text, text) from public, anon, authenticated;
grant execute on function public.regler_entreprise(text, text, text, text) to authenticated;

notify pgrst, 'reload schema';

commit;

select 'OK : reçus activés' as resultat,
  (select count(*) from public.transferts) as transferts,
  (select count(distinct code_recu) from public.transferts) as codes_uniques;
