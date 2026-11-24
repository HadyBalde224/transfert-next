-- =====================================================================
-- TransfertPro : l'employé corrige pendant 24 heures, ensuite l'admin seul
--
-- À exécuter UNE fois dans Supabase > SQL Editor, après "recus".
-- Aucune donnée n'est supprimée. En cas d'erreur, rien n'est modifié.
--
-- * Pendant 24 h après l'enregistrement, un employé peut modifier ou
--   supprimer SES transferts, sauf si sa journée est clôturée.
-- * Passé ce délai, seul l'admin le peut.
-- * "Supprimer" retire le transfert des comptes ; l'admin en garde la trace.
-- =====================================================================

begin;

do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'transferts' and column_name = 'code_recu') then
    raise exception 'Exécutez d''abord le script "recus".';
  end if;
  if to_regprocedure('public.verifier_delai(uuid, date, timestamptz)') is not null then
    raise exception 'Ce script a déjà été exécuté.';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. La règle, à un seul endroit
-- ---------------------------------------------------------------------
create function public.verifier_delai(p_employe uuid, p_jour date, p_cree_le timestamptz) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_employe is distinct from auth.uid() then
    raise exception 'Ce transfert n''est pas le vôtre.';
  end if;
  if p_cree_le < now() - interval '24 hours' then
    raise exception 'Plus de 24 heures : seul le patron peut modifier ou supprimer ce transfert.';
  end if;
  if exists (select 1 from public.clotures where employe_id = p_employe and jour = p_jour) then
    raise exception 'Cette journée est clôturée. Demandez au patron de la rouvrir.';
  end if;
end $$;
revoke all on function public.verifier_delai(uuid, date, timestamptz) from public, anon, authenticated;

-- Filet de sécurité sur la table : couvre toutes les fonctions d'écriture.
create function public.limiter_employe() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if public.est_employe() then
    if tg_op = 'DELETE' then raise exception 'Action réservée au patron.'; end if;
    if old.statut <> 'VALIDE' then raise exception 'Ce transfert est supprimé.'; end if;
    perform public.verifier_delai(old.employe_id, old.jour, old.cree_le);
    -- La date et l'auteur ne bougent jamais : sinon le délai se contournerait.
    new.employe_id := old.employe_id;
    new.jour := old.jour;
    new.cree_le := old.cree_le;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
revoke all on function public.limiter_employe() from public, anon, authenticated;

drop trigger refuser_employe on public.transferts;
create trigger limiter_employe before update or delete on public.transferts
  for each row execute function public.limiter_employe();

-- ---------------------------------------------------------------------
-- 2. Modifier
-- ---------------------------------------------------------------------
create or replace function public.modifier_transfert(
  p_id bigint, p_source text, p_cible text, p_montant numeric, p_frais_pct numeric,
  p_taux_vu numeric, p_nom_client text, p_telephone_client text,
  p_nom_beneficiaire text, p_telephone_beneficiaire text, p_note text, p_motif text
) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  moi public.profils;
  par public.parametres;
  av public.transferts;
  ap public.transferts;
  t public.taux_change;
  ds public.devises;
  dc public.devises;
  db public.devises;
  calc record;
  meme_paire boolean;
  pct numeric;
begin
  select * into moi from public.profils where id = auth.uid() and actif;
  if moi.id is null then raise exception 'Compte inactif ou inconnu.'; end if;

  select * into av from public.transferts
    where id = p_id and (moi.role = 'PATRON' or employe_id = moi.id);
  if av.id is null then raise exception 'Transfert introuvable.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(av.employe_id::text || av.jour::text, 0));
  select * into av from public.transferts where id = p_id for update;

  if av.statut <> 'VALIDE' then raise exception 'Ce transfert est annulé.'; end if;
  if moi.role = 'EMPLOYE' then
    perform public.verifier_delai(av.employe_id, av.jour, av.cree_le);
  end if;
  if coalesce(trim(p_nom_client), '') = '' then raise exception 'Le nom du client est requis.'; end if;
  if coalesce(trim(p_motif), '') = '' then raise exception 'Indiquez le motif de la correction.'; end if;

  select * into par from public.parametres where id = 1;
  select * into ds from public.devises where code = p_source;
  select * into dc from public.devises where code = p_cible;
  select * into db from public.devises where code = par.devise_base;
  if ds.code is null or dc.code is null then raise exception 'Devise inconnue.'; end if;
  if p_montant is null or p_montant <= 0 or p_montant > 1e15 then
    raise exception 'Montant invalide.';
  end if;

  ap := av;
  meme_paire := av.devise_source = p_source and av.devise_cible = p_cible;
  if not meme_paire then
    select * into t from public.taux_change
      where devise_source = p_source and devise_cible = p_cible and actif;
    if t.id is null or not ds.actif or not dc.actif then
      raise exception 'Aucun taux actif pour % vers %.', p_source, p_cible;
    end if;
    if ds.unites_par_base is null then
      raise exception 'La valeur de % n''est pas encore réglée par le patron.', p_source;
    end if;
    if p_taux_vu is distinct from t.taux_client then
      raise exception 'Le taux vient de changer. Vérifiez le nouveau montant puis validez.';
    end if;
    ap.devise_source := p_source;
    ap.devise_cible := p_cible;
    ap.inverse := t.inverse;
    ap.taux_client := t.taux_client;
    ap.taux_reel := t.taux_reel;
    ap.unites_par_base := ds.unites_par_base;
  end if;

  pct := case when meme_paire then av.frais_pct else t.frais_pct end;
  if moi.role = 'PATRON' or par.employe_modifie_frais then pct := coalesce(p_frais_pct, pct); end if;
  if pct < 0 or pct > 100 then raise exception 'Les frais doivent être entre 0 et 100 %%.'; end if;

  -- Sans changement de somme, de frais ou de devises, on ne recalcule rien :
  -- corriger un nom ne doit pas déplacer un bénéfice d'un centime.
  if not meme_paire or p_montant <> av.montant_envoye or pct <> av.frais_pct then
    if p_montant <> round(p_montant, ds.decimales) then
      raise exception 'Trop de décimales pour une somme en %.', p_source;
    end if;
    select * into calc from public.calculer_transfert(
      p_montant, pct, ap.inverse, ap.taux_client, ap.taux_reel,
      ds.decimales, dc.decimales, ap.unites_par_base, db.decimales, av.commission_pct);
    ap.montant_envoye := p_montant;
    ap.frais_pct := pct;
    ap.frais := calc.frais;
    ap.montant_recu := calc.montant_recu;
    ap.marge_taux := calc.marge_taux;
    ap.benefice := calc.benefice;
    ap.benefice_base := calc.benefice_base;
    ap.commission_base := calc.commission_base;
  end if;

  ap.nom_client := left(trim(p_nom_client), 120);
  ap.telephone_client := left(trim(coalesce(p_telephone_client, '')), 40);
  ap.nom_beneficiaire := left(trim(coalesce(p_nom_beneficiaire, '')), 120);
  ap.telephone_beneficiaire := left(trim(coalesce(p_telephone_beneficiaire, '')), 40);
  ap.note := left(trim(coalesce(p_note, '')), 500);
  ap.modifie_le := now();

  update public.transferts set
    devise_source = ap.devise_source, devise_cible = ap.devise_cible, inverse = ap.inverse,
    taux_client = ap.taux_client, taux_reel = ap.taux_reel, unites_par_base = ap.unites_par_base,
    montant_envoye = ap.montant_envoye, frais_pct = ap.frais_pct, frais = ap.frais,
    montant_recu = ap.montant_recu, marge_taux = ap.marge_taux, benefice = ap.benefice,
    benefice_base = ap.benefice_base, commission_base = ap.commission_base,
    nom_client = ap.nom_client, telephone_client = ap.telephone_client,
    nom_beneficiaire = ap.nom_beneficiaire, telephone_beneficiaire = ap.telephone_beneficiaire,
    note = ap.note, modifie_le = ap.modifie_le
  where id = p_id;

  insert into public.transferts_journal (transfert_id, auteur_id, action, motif, avant, apres)
  values (p_id, moi.id, 'MODIFICATION', left(trim(p_motif), 300), to_jsonb(av), to_jsonb(ap));
  return p_id;
end $$;

-- ---------------------------------------------------------------------
-- 3. Supprimer (et rétablir, réservé à l'admin)
-- ---------------------------------------------------------------------
create or replace function public.changer_statut_transfert(p_id bigint, p_statut text, p_motif text)
returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  moi public.profils;
  av public.transferts;
begin
  select * into moi from public.profils where id = auth.uid() and actif;
  if moi.id is null then raise exception 'Compte inactif ou inconnu.'; end if;
  if p_statut is null or p_statut not in ('VALIDE', 'ANNULE') then raise exception 'Statut invalide.'; end if;
  if moi.role <> 'PATRON' and p_statut = 'VALIDE' then raise exception 'Action réservée au patron.'; end if;
  if coalesce(trim(p_motif), '') = '' then raise exception 'Indiquez le motif.'; end if;

  select * into av from public.transferts
    where id = p_id and (moi.role = 'PATRON' or employe_id = moi.id);
  if av.id is null then raise exception 'Transfert introuvable.'; end if;
  -- Même verrou que la clôture de la journée.
  perform pg_advisory_xact_lock(hashtextextended(av.employe_id::text || av.jour::text, 0));
  select * into av from public.transferts where id = p_id for update;
  if av.statut = p_statut then return p_id; end if;
  if moi.role <> 'PATRON' then perform public.verifier_delai(av.employe_id, av.jour, av.cree_le); end if;

  update public.transferts set statut = p_statut, modifie_le = now() where id = p_id;
  insert into public.transferts_journal (transfert_id, auteur_id, action, motif, avant, apres)
  values (p_id, moi.id, case when p_statut = 'ANNULE' then 'ANNULATION' else 'RETABLISSEMENT' end,
          left(trim(p_motif), 300), to_jsonb(av), to_jsonb(av) || jsonb_build_object('statut', p_statut));
  return p_id;
end $$;

notify pgrst, 'reload schema';

commit;

select 'OK : corrections pendant 24 heures' as resultat;
