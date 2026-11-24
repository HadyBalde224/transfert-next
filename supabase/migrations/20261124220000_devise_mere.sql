-- =====================================================================
-- TransfertPro : le MAD devise mère, une zone par devise
--
-- À exécuter UNE fois dans Supabase > SQL Editor, après "zones".
-- Aucun transfert n'est supprimé. En cas d'erreur, rien n'est modifié.
--
-- * Toute devise s'échange uniquement avec le MAD.
-- * Restent actives : GNF et XOF. Les autres se rajoutent depuis le site.
-- * Supprimer une devise la retire du site ; son historique est conservé.
-- =====================================================================

begin;

do $$
declare
  v_noms text;
begin
  if to_regclass('public.zones_historique') is null then
    raise exception 'Exécutez d''abord le script "zones".';
  end if;
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'devises' and column_name = 'forte') then
    raise exception 'Ce script a déjà été exécuté.';
  end if;
  select string_agg(nom || ' (' || zone || ')', ', ') into v_noms
    from public.profils where actif and zone is not null and zone not in ('GNF', 'XOF');
  if v_noms is not null then
    raise exception 'Donnez d''abord la zone GNF ou XOF à : %.', v_noms;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. Devises
-- ---------------------------------------------------------------------
-- forte = false : le taux s'écrit "1 MAD = 1000 GNF"
-- forte = true  : le taux s'écrit "1 EUR = 10,80 MAD"
alter table public.devises add column forte boolean not null default false;

update public.devises set actif = false where code not in ('MAD', 'GNF', 'XOF');
update public.devises set actif = true where code in ('MAD', 'GNF', 'XOF');

-- Les échanges qui ne passent pas par le MAD disparaissent (l'historique des
-- taux et les transferts déjà faits gardent leurs conditions).
delete from public.taux_change
  where (select devise_base from public.parametres where id = 1) not in (devise_source, devise_cible);
update public.taux_change t set actif = false
  from public.devises d where d.code in (t.devise_source, t.devise_cible) and not d.actif;

-- Les taux réels donnent la valeur d'une devise : plus rien à saisir deux fois.
update public.devises d set unites_par_base = case when t.inverse then 1 / t.taux_reel else t.taux_reel end
  from public.taux_change t, public.parametres p
  where p.id = 1 and t.devise_source = p.devise_base and t.devise_cible = d.code;

-- ---------------------------------------------------------------------
-- 2. Historique des taux : une ligne par vrai changement
-- ---------------------------------------------------------------------
drop trigger tracer_taux on public.taux_change;
create or replace function public.tracer_taux() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.taux_historique
    (devise_source, devise_cible, inverse, taux_client, taux_reel, frais_pct, actif, auteur_id)
  values (new.devise_source, new.devise_cible, new.inverse, new.taux_client, new.taux_reel,
          new.frais_pct, new.actif, auth.uid());
  return new;
end $$;
create trigger tracer_taux after insert or update on public.taux_change
  for each row execute function public.tracer_taux();

create function public.taux_avec_base() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select devise_base from public.parametres where id = 1)
     not in (new.devise_source, new.devise_cible) then
    raise exception 'Tout échange passe par la devise mère.';
  end if;
  return new;
end $$;
revoke all on function public.taux_avec_base() from public, anon, authenticated;
create trigger taux_avec_base before insert or update on public.taux_change
  for each row execute function public.taux_avec_base();

-- ---------------------------------------------------------------------
-- 3. Seul chemin pour ajouter, régler ou supprimer une devise
-- ---------------------------------------------------------------------
drop policy devises_ajout on public.devises;
drop policy devises_maj on public.devises;
drop policy taux_ajout on public.taux_change;
drop policy taux_maj on public.taux_change;
revoke insert, update on public.devises from authenticated;
revoke insert (nom, decimales, unites_par_base, actif, ordre),
       update (nom, decimales, unites_par_base, actif, ordre) on public.devises from authenticated;
revoke insert, update on public.taux_change from authenticated;

create function public.regler_taux(
  p_source text, p_cible text, p_inverse boolean, p_client numeric, p_reel numeric, p_frais numeric
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_client is null or p_reel is null or p_client <= 0 or p_reel <= 0
     or p_client > 1e9 or p_reel > 1e9 then
    raise exception 'Les taux doivent être supérieurs à 0.';
  end if;
  if p_frais is null or p_frais < 0 or p_frais > 100 then
    raise exception 'Les frais doivent être entre 0 et 100 %%.';
  end if;
  insert into public.taux_change as t
    (devise_source, devise_cible, inverse, taux_client, taux_reel, frais_pct, actif, maj_par)
  values (p_source, p_cible, p_inverse, p_client, p_reel, p_frais, true, auth.uid())
  on conflict (devise_source, devise_cible) do update set
    inverse = excluded.inverse, taux_client = excluded.taux_client, taux_reel = excluded.taux_reel,
    frais_pct = excluded.frais_pct, actif = true, maj_le = now(), maj_par = excluded.maj_par
  where (t.inverse, t.taux_client, t.taux_reel, t.frais_pct, t.actif)
    is distinct from (excluded.inverse, excluded.taux_client, excluded.taux_reel, excluded.frais_pct, true);
end $$;

create function public.enregistrer_devise(
  p_code text, p_nom text, p_decimales integer, p_forte boolean,
  p_client_aller numeric, p_reel_aller numeric, p_frais_aller numeric,
  p_client_retour numeric, p_reel_retour numeric, p_frais_retour numeric
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_base text;
begin
  if not public.est_patron() then raise exception 'Action réservée au patron.'; end if;
  select devise_base into v_base from public.parametres where id = 1;
  if p_code is null or p_code !~ '^[A-Z]{3}$' or p_code = v_base then
    raise exception 'Devise invalide.';
  end if;
  insert into public.devises (code, nom, decimales, forte, actif)
  values (p_code, left(trim(p_nom), 60), p_decimales, p_forte, true)
  on conflict (code) do update set nom = excluded.nom, forte = excluded.forte, actif = true;

  -- Aller : MAD vers la devise. Retour : la devise vers MAD.
  perform public.regler_taux(v_base, p_code, p_forte, p_client_aller, p_reel_aller, p_frais_aller);
  perform public.regler_taux(p_code, v_base, not p_forte, p_client_retour, p_reel_retour, p_frais_retour);
  update public.devises
    set unites_par_base = case when p_forte then 1 / p_reel_aller else p_reel_aller end
    where code = p_code;
end $$;

create function public.supprimer_devise(p_code text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_noms text;
begin
  if not public.est_patron() then raise exception 'Action réservée au patron.'; end if;
  if p_code = (select devise_base from public.parametres where id = 1) then
    raise exception 'La devise mère ne peut pas être supprimée.';
  end if;
  select string_agg(nom, ', ' order by nom) into v_noms
    from public.profils where zone = p_code and actif;
  if v_noms is not null then
    raise exception 'Changez d''abord la zone de : %.', v_noms;
  end if;
  update public.devises set actif = false where code = p_code and actif;
  if not found then raise exception 'Devise introuvable.'; end if;
  update public.taux_change set actif = false, maj_le = now(), maj_par = auth.uid()
    where p_code in (devise_source, devise_cible) and actif;
end $$;

revoke all on function
  public.regler_taux(text, text, boolean, numeric, numeric, numeric),
  public.enregistrer_devise(text, text, integer, boolean, numeric, numeric, numeric, numeric, numeric, numeric),
  public.supprimer_devise(text), public.tracer_taux()
  from public, anon, authenticated;
grant execute on function
  public.enregistrer_devise(text, text, integer, boolean, numeric, numeric, numeric, numeric, numeric, numeric),
  public.supprimer_devise(text)
  to authenticated;

notify pgrst, 'reload schema';

commit;

select 'OK : MAD devise mère' as resultat,
  (select string_agg(code, ', ' order by ordre, code) from public.devises where actif) as devises_actives;
