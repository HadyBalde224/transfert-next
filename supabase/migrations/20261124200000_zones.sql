-- =====================================================================
-- TransfertPro : zones de travail (GNF, CFA...) et fin des commissions
--
-- À exécuter UNE fois dans Supabase > SQL Editor, après les scripts
-- "equipe_et_devises" et "admin_sans_transfert".
-- Aucun transfert n'est supprimé. En cas d'erreur, rien n'est modifié.
-- =====================================================================

begin;

do $$
begin
  if to_regclass('public.transferts_archives') is null then
    raise exception 'Exécutez d''abord le script "admin_sans_transfert".';
  end if;
  if to_regclass('public.zones_historique') is not null then
    raise exception 'Ce script a déjà été exécuté.';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. La zone de chaque employé, et son historique
-- ---------------------------------------------------------------------
alter table public.profils add column zone text references public.devises (code);

create table public.zones_historique (
  id bigint generated always as identity primary key,
  employe_id uuid not null references public.profils (id),
  ancienne text,
  nouvelle text,
  auteur_id uuid references public.profils (id),
  le timestamptz not null default now()
);
create index zones_historique_employe_idx on public.zones_historique (employe_id, id desc);
alter table public.zones_historique enable row level security;
revoke all on public.zones_historique from public, anon, authenticated;
grant select on public.zones_historique to authenticated;
create policy zones_historique_lecture on public.zones_historique for select to authenticated
  using ((select public.est_patron()));

create function public.verifier_zone() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.zone is null then return new; end if;
  if tg_op = 'UPDATE' and new.zone is not distinct from old.zone then return new; end if;
  if new.role <> 'EMPLOYE' then raise exception 'Seul un employé a une zone.'; end if;
  if not exists (
    select 1 from public.devises d
    where d.code = new.zone and d.actif
      and d.code <> (select devise_base from public.parametres where id = 1)
  ) then
    raise exception 'Zone invalide : %.', new.zone;
  end if;
  return new;
end $$;
revoke all on function public.verifier_zone() from public, anon, authenticated;
create trigger verifier_zone before insert or update on public.profils
  for each row execute function public.verifier_zone();

create function public.tracer_zone() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.zone is not null then
      insert into public.zones_historique (employe_id, ancienne, nouvelle, auteur_id)
      values (new.id, null, new.zone, auth.uid());
    end if;
  elsif new.zone is distinct from old.zone then
    insert into public.zones_historique (employe_id, ancienne, nouvelle, auteur_id)
    values (new.id, old.zone, new.zone, auth.uid());
  end if;
  return new;
end $$;
revoke all on function public.tracer_zone() from public, anon, authenticated;
create trigger tracer_zone after insert or update on public.profils
  for each row execute function public.tracer_zone();

drop function public.modifier_employe(uuid, text, boolean, numeric);
create function public.modifier_employe(p_id uuid, p_nom text, p_actif boolean, p_zone text)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.est_patron() then raise exception 'Action réservée au patron.'; end if;
  if coalesce(trim(p_nom), '') = '' then raise exception 'Le nom est requis.'; end if;
  if p_zone is null and p_actif then raise exception 'Choisissez une zone.'; end if;
  update public.profils
    set nom = left(trim(p_nom), 80), actif = p_actif, zone = coalesce(p_zone, zone)
    where id = p_id and role = 'EMPLOYE';
  if not found then raise exception 'Employé introuvable.'; end if;
end $$;
revoke all on function public.modifier_employe(uuid, text, boolean, text) from public, anon, authenticated;
grant execute on function public.modifier_employe(uuid, text, boolean, text) to authenticated;

-- ---------------------------------------------------------------------
-- 2. La zone de chaque transfert, figée à l'enregistrement
-- ---------------------------------------------------------------------
alter table public.transferts add column zone text references public.devises (code);
alter table public.transferts add column benefice_zone numeric;

-- Bénéfice (en devise reçue) exprimé dans la zone, au taux réel du transfert.
create function public.vers_zone(
  p_benefice numeric, p_source text, p_zone text, p_inverse boolean, p_taux_reel numeric, p_decimales integer
) returns numeric
language sql immutable set search_path = '' as $$
  select round(case
    when p_source = p_zone then p_benefice
    when p_inverse then p_benefice / p_taux_reel
    else p_benefice * p_taux_reel
  end, p_decimales)
$$;
revoke all on function public.vers_zone(numeric, text, text, boolean, numeric, integer)
  from public, anon, authenticated;

-- Nom en "z" : passe après reserver_aux_employes.
create function public.zone_appliquer() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    select zone into new.zone from public.profils where id = new.employe_id;
    if new.zone is null then
      raise exception 'Vous n''avez pas encore de zone. Demandez au patron de vous en donner une.';
    end if;
  else
    -- Changer la zone d'un employé ne touche jamais ses anciens transferts.
    new.zone := old.zone;
  end if;
  if new.zone not in (new.devise_source, new.devise_cible) then
    raise exception 'Ce transfert n''est pas dans la zone %.', new.zone;
  end if;
  new.commission_pct := 0;
  new.commission_base := 0;
  -- Sans changement de somme, on ne recalcule rien.
  if tg_op = 'INSERT' or new.benefice <> old.benefice
     or new.devise_source <> old.devise_source or new.devise_cible <> old.devise_cible then
    new.benefice_zone := public.vers_zone(new.benefice, new.devise_source, new.zone, new.inverse,
      new.taux_reel, (select decimales from public.devises where code = new.zone));
  end if;
  return new;
end $$;
revoke all on function public.zone_appliquer() from public, anon, authenticated;

-- Transferts déjà enregistrés : la zone est la devise autre que le MAD.
update public.transferts t set
  zone = z.code,
  benefice_zone = public.vers_zone(t.benefice, t.devise_source, z.code, t.inverse, t.taux_reel, z.decimales),
  commission_pct = 0,
  commission_base = 0
from public.devises z
where z.code = case
  when t.devise_cible <> (select devise_base from public.parametres where id = 1) then t.devise_cible
  else t.devise_source end;

alter table public.transferts alter column zone set not null;
alter table public.transferts alter column benefice_zone set not null;
create trigger zone_appliquer before insert or update on public.transferts
  for each row execute function public.zone_appliquer();

-- ---------------------------------------------------------------------
-- 3. Plus de commissions
-- ---------------------------------------------------------------------
update public.profils set taux_commission = 0;
update public.clotures set commission_base = 0;

-- ---------------------------------------------------------------------
-- 4. Clôtures et rapports par zone
-- ---------------------------------------------------------------------
alter table public.clotures add column par_zone jsonb not null default '[]'::jsonb;

create or replace function public.cloturer_journee(p_rapport text) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  j date := public.aujourdhui();
  nouvel_id bigint;
begin
  if not public.est_actif() then raise exception 'Compte inactif ou inconnu.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || j::text, 0));
  if exists (select 1 from public.clotures where employe_id = auth.uid() and jour = j) then
    raise exception 'Cette journée est déjà clôturée.';
  end if;
  insert into public.clotures
    (employe_id, jour, rapport, nb_transferts, benefice_base, commission_base, totaux, par_zone)
  select auth.uid(), j, left(trim(coalesce(p_rapport, '')), 2000),
    (select count(*) from public.transferts x
      where x.employe_id = auth.uid() and x.jour = j and x.statut = 'VALIDE'),
    (select coalesce(sum(x.benefice_base), 0) from public.transferts x
      where x.employe_id = auth.uid() and x.jour = j and x.statut = 'VALIDE'),
    0,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'devise', s.devise_source, 'nb', s.nb, 'volume', s.volume, 'benefice', s.benefice)
        order by s.devise_source)
      from (
        select x.devise_source, count(*) nb, sum(x.montant_envoye) volume, sum(x.benefice) benefice
        from public.transferts x
        where x.employe_id = auth.uid() and x.jour = j and x.statut = 'VALIDE'
        group by x.devise_source
      ) s), '[]'::jsonb),
    coalesce((
      select jsonb_agg(to_jsonb(s) order by s.zone)
      from (
        select x.zone, count(*) nb, sum(x.benefice_zone) benefice
        from public.transferts x
        where x.employe_id = auth.uid() and x.jour = j and x.statut = 'VALIDE'
        group by x.zone
      ) s), '[]'::jsonb)
  returning id into nouvel_id;
  return nouvel_id;
end $$;

create or replace function public.rapport(p_debut date, p_fin date, p_employe uuid default null)
returns jsonb
language sql stable security invoker set search_path = '' as $$
  with x as (
    select t.*, p.nom as employe_nom
    from public.transferts t join public.profils p on p.id = t.employe_id
    where t.statut = 'VALIDE' and t.jour between p_debut and p_fin
      and (p_employe is null or t.employe_id = p_employe)
  )
  select jsonb_build_object(
    'total', (select jsonb_build_object('nb', count(*), 'benefice', coalesce(sum(benefice_base), 0)) from x),
    'par_jour', coalesce((select jsonb_agg(to_jsonb(s) order by s.jour) from (
        select jour, count(*) nb, sum(benefice_base) benefice from x group by jour) s), '[]'::jsonb),
    'par_zone', coalesce((select jsonb_agg(to_jsonb(s) order by s.benefice_base desc) from (
        select zone, count(*) nb, sum(benefice_zone) benefice, sum(benefice_base) benefice_base
        from x group by zone) s), '[]'::jsonb),
    'par_employe', coalesce((select jsonb_agg(to_jsonb(s) order by s.benefice desc) from (
        select employe_id, employe_nom nom, count(*) nb, sum(benefice_base) benefice
        from x group by employe_id, employe_nom) s), '[]'::jsonb),
    'par_employe_zone', coalesce((select jsonb_agg(to_jsonb(s) order by s.employe_id, s.zone) from (
        select employe_id, zone, count(*) nb, sum(benefice_zone) benefice
        from x group by employe_id, zone) s), '[]'::jsonb),
    'par_corridor', coalesce((select jsonb_agg(to_jsonb(s) order by s.benefice_base desc) from (
        select devise_source source, devise_cible cible, count(*) nb, sum(montant_envoye) volume,
          sum(montant_recu) remis, sum(benefice_base) benefice_base
        from x group by devise_source, devise_cible) s), '[]'::jsonb)
  )
$$;

notify pgrst, 'reload schema';

commit;

select 'OK : zones activées' as resultat,
  (select count(*) from public.profils where role = 'EMPLOYE' and zone is null) as employes_sans_zone;
