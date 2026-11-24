-- =====================================================================
-- TransfertPro : employés, multi-devises, bénéfices, clôtures de journée
--
-- À exécuter UNE fois dans Supabase > SQL Editor.
--
-- * Les anciennes tables (transactions, periodes, credits, remboursements)
--   ne perdent aucune ligne : "transactions" est copiée vers "transferts".
--   L'ancienne version de l'application continue donc de fonctionner.
-- * Tout est dans une transaction : en cas d'erreur, rien n'est modifié.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 0. Vérifications
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['transactions', 'periodes', 'credits', 'remboursements'] loop
    if to_regclass('public.' || t) is null then
      raise exception 'Table "%" introuvable : êtes-vous dans le bon projet Supabase ?', t;
    end if;
  end loop;
  if to_regclass('public.transferts') is not null then
    raise exception 'Cette migration a déjà été exécutée (la table "transferts" existe).';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------
create table public.profils (
  id uuid primary key references auth.users (id) on delete restrict,
  identifiant text not null unique,
  nom text not null check (length(trim(nom)) > 0),
  role text not null check (role in ('PATRON', 'EMPLOYE')),
  actif boolean not null default true,
  taux_commission numeric(5, 2) not null default 0 check (taux_commission between 0 and 100),
  cree_le timestamptz not null default now()
);

create table public.devises (
  code text primary key check (code ~ '^[A-Z]{3}$'),
  nom text not null,
  decimales smallint not null default 2 check (decimales between 0 and 4),
  -- Combien d'unités de cette devise valent 1 unité de la devise de base.
  -- Sert uniquement à additionner des bénéfices de devises différentes.
  unites_par_base numeric check (unites_par_base > 0),
  actif boolean not null default true,
  ordre smallint not null default 100
);

create table public.parametres (
  id smallint primary key default 1 check (id = 1),
  devise_base text not null references public.devises (code),
  fuseau text not null default 'Africa/Casablanca',
  employe_modifie_frais boolean not null default false
);

create table public.taux_change (
  id bigint generated always as identity primary key,
  devise_source text not null references public.devises (code),
  devise_cible text not null references public.devises (code),
  -- inverse = false : 1 source = taux cible    (1 MAD = 1000 GNF)
  -- inverse = true  : taux source = 1 cible    (1000 GNF = 1 MAD)
  inverse boolean not null default false,
  taux_client numeric not null check (taux_client > 0),
  taux_reel numeric not null check (taux_reel > 0),
  frais_pct numeric(6, 3) not null default 0 check (frais_pct between 0 and 100),
  actif boolean not null default true,
  maj_le timestamptz not null default now(),
  maj_par uuid references public.profils (id),
  unique (devise_source, devise_cible),
  check (devise_source <> devise_cible)
);

create table public.taux_historique (
  id bigint generated always as identity primary key,
  devise_source text not null,
  devise_cible text not null,
  inverse boolean not null,
  taux_client numeric not null,
  taux_reel numeric not null,
  frais_pct numeric not null,
  actif boolean not null,
  auteur_id uuid references public.profils (id),
  le timestamptz not null default now()
);

create table public.transferts (
  id bigint generated always as identity primary key,
  employe_id uuid not null references public.profils (id),
  jour date not null,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz,
  statut text not null default 'VALIDE' check (statut in ('VALIDE', 'ANNULE')),
  nom_client text not null,
  telephone_client text not null default '',
  nom_beneficiaire text not null default '',
  telephone_beneficiaire text not null default '',
  note text not null default '',
  devise_source text not null references public.devises (code),
  devise_cible text not null references public.devises (code),
  montant_envoye numeric not null,
  -- Conditions figées au moment du transfert : changer un taux plus tard
  -- ne modifie jamais l'historique.
  frais_pct numeric not null,
  frais numeric not null,
  inverse boolean not null,
  taux_client numeric not null,
  taux_reel numeric not null,
  montant_recu numeric not null,
  marge_taux numeric not null,
  benefice numeric not null,
  unites_par_base numeric not null check (unites_par_base > 0),
  benefice_base numeric not null,
  commission_pct numeric not null default 0,
  commission_base numeric not null default 0,
  -- Empêche un double enregistrement (double clic, réseau instable).
  cle uuid unique,
  -- Id dans l'ancienne table "transactions".
  ancien_id bigint unique,
  check (ancien_id is not null or (montant_envoye > 0 and frais >= 0 and frais <= montant_envoye))
);
create index transferts_jour_idx on public.transferts (jour desc, id desc);
create index transferts_employe_jour_idx on public.transferts (employe_id, jour desc);

create table public.transferts_journal (
  id bigint generated always as identity primary key,
  transfert_id bigint not null references public.transferts (id),
  auteur_id uuid not null references public.profils (id),
  action text not null,
  motif text not null default '',
  avant jsonb not null,
  apres jsonb not null,
  le timestamptz not null default now()
);
create index transferts_journal_transfert_idx on public.transferts_journal (transfert_id, id desc);

create table public.clotures (
  id bigint generated always as identity primary key,
  employe_id uuid not null references public.profils (id),
  jour date not null,
  rapport text not null default '',
  nb_transferts integer not null,
  benefice_base numeric not null,
  commission_base numeric not null,
  totaux jsonb not null,
  cloture_le timestamptz not null default now(),
  unique (employe_id, jour)
);

-- ---------------------------------------------------------------------
-- 2. Fonctions de droits
--    "security definer" pour lire profils sans boucler sur sa propre RLS.
-- ---------------------------------------------------------------------
create function public.mon_role() returns text
language sql stable security definer set search_path = '' as $$
  select role from public.profils where id = auth.uid() and actif
$$;

create function public.est_patron() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.mon_role() = 'PATRON', false)
$$;

create function public.est_actif() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.mon_role() is not null
$$;

-- Vrai même pour un employé désactivé.
create function public.est_employe() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profils where id = auth.uid() and role = 'EMPLOYE')
$$;

create function public.aujourdhui() returns date
language sql stable security definer set search_path = '' as $$
  select (now() at time zone (select fuseau from public.parametres where id = 1))::date
$$;

-- ---------------------------------------------------------------------
-- 3. Calcul d'un transfert
-- ---------------------------------------------------------------------
create function public.calculer_transfert(
  p_montant numeric, p_frais_pct numeric, p_inverse boolean,
  p_taux_client numeric, p_taux_reel numeric,
  p_dec_source integer, p_dec_cible integer, p_unites_par_base numeric, p_dec_base integer,
  p_commission_pct numeric,
  out frais numeric, out montant_recu numeric, out marge_taux numeric,
  out benefice numeric, out benefice_base numeric, out commission_base numeric
) language plpgsql immutable set search_path = '' as $$
declare
  net numeric;
begin
  frais := round(p_montant * p_frais_pct / 100, p_dec_source);
  net := p_montant - frais;
  if p_inverse then
    montant_recu := round(net / p_taux_client, p_dec_cible);
    marge_taux := round(net * (1 - p_taux_reel / p_taux_client), p_dec_source);
  else
    montant_recu := round(net * p_taux_client, p_dec_cible);
    marge_taux := round(net * (1 - p_taux_client / p_taux_reel), p_dec_source);
  end if;
  benefice := frais + marge_taux;
  benefice_base := round(benefice / p_unites_par_base, p_dec_base);
  commission_base := round(greatest(benefice_base, 0) * p_commission_pct / 100, p_dec_base);
end $$;

-- ---------------------------------------------------------------------
-- 4. Opérations (seul chemin d'écriture sur transferts et clotures)
-- ---------------------------------------------------------------------
create function public.creer_transfert(
  p_cle uuid, p_source text, p_cible text, p_montant numeric, p_frais_pct numeric,
  p_taux_vu numeric, p_nom_client text, p_telephone_client text,
  p_nom_beneficiaire text, p_telephone_beneficiaire text, p_note text
) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  moi public.profils;
  par public.parametres;
  t public.taux_change;
  ds public.devises;
  dc public.devises;
  db public.devises;
  calc record;
  pct numeric;
  j date := public.aujourdhui();
  existant public.transferts;
  nouvel_id bigint;
begin
  select * into moi from public.profils where id = auth.uid() and actif;
  if moi.id is null then raise exception 'Compte inactif ou inconnu.'; end if;
  if p_cle is null then raise exception 'Requête invalide.'; end if;

  perform pg_advisory_xact_lock(hashtextextended(moi.id::text || j::text, 0));

  select * into existant from public.transferts where cle = p_cle;
  if existant.id is not null then
    if existant.employe_id <> moi.id then raise exception 'Requête invalide.'; end if;
    if existant.devise_source <> p_source or existant.devise_cible <> p_cible
       or existant.montant_envoye is distinct from p_montant
       or existant.nom_client <> left(trim(coalesce(p_nom_client, '')), 120) then
      raise exception 'Ce transfert est déjà enregistré sous le n° %. Corrigez-le depuis la liste.', existant.id;
    end if;
    return existant.id;
  end if;

  if moi.role = 'EMPLOYE'
     and exists (select 1 from public.clotures where employe_id = moi.id and jour = j) then
    raise exception 'Votre journée est clôturée. Demandez au patron de la rouvrir.';
  end if;

  select * into par from public.parametres where id = 1;
  select * into t from public.taux_change
    where devise_source = p_source and devise_cible = p_cible and actif;
  if t.id is null then raise exception 'Aucun taux actif pour % vers %.', p_source, p_cible; end if;
  select * into ds from public.devises where code = p_source and actif;
  select * into dc from public.devises where code = p_cible and actif;
  if ds.code is null or dc.code is null then raise exception 'Devise inactive.'; end if;
  if ds.unites_par_base is null then
    raise exception 'La valeur de % n''est pas encore réglée par le patron.', p_source;
  end if;
  select * into db from public.devises where code = par.devise_base;

  if p_taux_vu is distinct from t.taux_client then
    raise exception 'Le taux vient de changer. Vérifiez le nouveau montant puis validez.';
  end if;
  if p_montant is null or p_montant <= 0 or p_montant > 1e15 then
    raise exception 'Montant invalide.';
  end if;
  if p_montant <> round(p_montant, ds.decimales) then
    raise exception 'Trop de décimales pour une somme en %.', p_source;
  end if;
  if coalesce(trim(p_nom_client), '') = '' then raise exception 'Le nom du client est requis.'; end if;

  pct := t.frais_pct;
  if moi.role = 'PATRON' or par.employe_modifie_frais then
    pct := coalesce(p_frais_pct, t.frais_pct);
  end if;
  if pct < 0 or pct > 100 then raise exception 'Les frais doivent être entre 0 et 100 %%.'; end if;

  select * into calc from public.calculer_transfert(
    p_montant, pct, t.inverse, t.taux_client, t.taux_reel,
    ds.decimales, dc.decimales, ds.unites_par_base, db.decimales, moi.taux_commission);

  insert into public.transferts (
    employe_id, jour, nom_client, telephone_client, nom_beneficiaire, telephone_beneficiaire,
    note, devise_source, devise_cible, montant_envoye, frais_pct, frais, inverse,
    taux_client, taux_reel, montant_recu, marge_taux, benefice, unites_par_base,
    benefice_base, commission_pct, commission_base, cle
  ) values (
    moi.id, j, left(trim(p_nom_client), 120), left(trim(coalesce(p_telephone_client, '')), 40),
    left(trim(coalesce(p_nom_beneficiaire, '')), 120),
    left(trim(coalesce(p_telephone_beneficiaire, '')), 40),
    left(trim(coalesce(p_note, '')), 500), p_source, p_cible, p_montant, pct, calc.frais, t.inverse,
    t.taux_client, t.taux_reel, calc.montant_recu, calc.marge_taux, calc.benefice,
    ds.unites_par_base, calc.benefice_base, moi.taux_commission, calc.commission_base, p_cle
  ) returning id into nouvel_id;
  return nouvel_id;
end $$;

create function public.modifier_transfert(
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
    if av.jour <> public.aujourdhui() then
      raise exception 'Seul un transfert du jour peut être corrigé. Contactez le patron.';
    end if;
    if exists (select 1 from public.clotures where employe_id = moi.id and jour = av.jour) then
      raise exception 'Votre journée est clôturée. Demandez au patron de la rouvrir.';
    end if;
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

create function public.changer_statut_transfert(p_id bigint, p_statut text, p_motif text)
returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  av public.transferts;
begin
  if not public.est_patron() then raise exception 'Action réservée au patron.'; end if;
  if p_statut is null or p_statut not in ('VALIDE', 'ANNULE') then raise exception 'Statut invalide.'; end if;
  if coalesce(trim(p_motif), '') = '' then raise exception 'Indiquez le motif.'; end if;
  select * into av from public.transferts where id = p_id for update;
  if av.id is null then raise exception 'Transfert introuvable.'; end if;
  if av.statut = p_statut then return p_id; end if;
  update public.transferts set statut = p_statut, modifie_le = now() where id = p_id;
  insert into public.transferts_journal (transfert_id, auteur_id, action, motif, avant, apres)
  values (p_id, auth.uid(), case when p_statut = 'ANNULE' then 'ANNULATION' else 'RETABLISSEMENT' end,
          left(trim(p_motif), 300), to_jsonb(av), to_jsonb(av) || jsonb_build_object('statut', p_statut));
  return p_id;
end $$;

create function public.cloturer_journee(p_rapport text) returns bigint
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
  insert into public.clotures (employe_id, jour, rapport, nb_transferts, benefice_base, commission_base, totaux)
  select auth.uid(), j, left(trim(coalesce(p_rapport, '')), 2000),
    (select count(*) from public.transferts x
      where x.employe_id = auth.uid() and x.jour = j and x.statut = 'VALIDE'),
    (select coalesce(sum(x.benefice_base), 0) from public.transferts x
      where x.employe_id = auth.uid() and x.jour = j and x.statut = 'VALIDE'),
    (select coalesce(sum(x.commission_base), 0) from public.transferts x
      where x.employe_id = auth.uid() and x.jour = j and x.statut = 'VALIDE'),
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'devise', s.devise_source, 'nb', s.nb, 'volume', s.volume, 'benefice', s.benefice)
        order by s.devise_source)
      from (
        select x.devise_source, count(*) nb, sum(x.montant_envoye) volume, sum(x.benefice) benefice
        from public.transferts x
        where x.employe_id = auth.uid() and x.jour = j and x.statut = 'VALIDE'
        group by x.devise_source
      ) s), '[]'::jsonb)
  returning id into nouvel_id;
  return nouvel_id;
end $$;

create function public.rouvrir_journee(p_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.est_patron() then raise exception 'Action réservée au patron.'; end if;
  delete from public.clotures where id = p_id;
  if not found then raise exception 'Clôture introuvable.'; end if;
end $$;

create function public.modifier_employe(p_id uuid, p_nom text, p_actif boolean, p_taux_commission numeric)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.est_patron() then raise exception 'Action réservée au patron.'; end if;
  if coalesce(trim(p_nom), '') = '' then raise exception 'Le nom est requis.'; end if;
  if p_taux_commission is null or p_taux_commission < 0 or p_taux_commission > 100 then
    raise exception 'La commission doit être entre 0 et 100 %%.';
  end if;
  update public.profils
    set nom = left(trim(p_nom), 80), actif = p_actif, taux_commission = p_taux_commission
    where id = p_id and role = 'EMPLOYE';
  if not found then raise exception 'Employé introuvable.'; end if;
end $$;

-- Rapport complet en un seul appel. "security invoker" : la RLS s'applique,
-- un employé n'obtient donc que ses propres chiffres.
create function public.rapport(p_debut date, p_fin date, p_employe uuid default null)
returns jsonb
language sql stable security invoker set search_path = '' as $$
  with x as (
    select t.*, p.nom as employe_nom
    from public.transferts t join public.profils p on p.id = t.employe_id
    where t.statut = 'VALIDE' and t.jour between p_debut and p_fin
      and (p_employe is null or t.employe_id = p_employe)
  )
  select jsonb_build_object(
    'total', (select jsonb_build_object('nb', count(*), 'benefice', coalesce(sum(benefice_base), 0),
        'commission', coalesce(sum(commission_base), 0)) from x),
    'par_jour', coalesce((select jsonb_agg(to_jsonb(s) order by s.jour) from (
        select jour, count(*) nb, sum(benefice_base) benefice, sum(commission_base) commission
        from x group by jour) s), '[]'::jsonb),
    'par_employe', coalesce((select jsonb_agg(to_jsonb(s) order by s.benefice desc) from (
        select employe_id, employe_nom nom, count(*) nb, sum(benefice_base) benefice,
          sum(commission_base) commission from x group by employe_id, employe_nom) s), '[]'::jsonb),
    'par_devise', coalesce((select jsonb_agg(to_jsonb(s) order by s.benefice_base desc) from (
        select devise_source devise, count(*) nb, sum(montant_envoye) volume, sum(frais) frais,
          sum(marge_taux) marge, sum(benefice) benefice, sum(benefice_base) benefice_base
        from x group by devise_source) s), '[]'::jsonb),
    'par_corridor', coalesce((select jsonb_agg(to_jsonb(s) order by s.benefice_base desc) from (
        select devise_source source, devise_cible cible, count(*) nb, sum(montant_envoye) volume,
          sum(montant_recu) remis, sum(benefice_base) benefice_base
        from x group by devise_source, devise_cible) s), '[]'::jsonb)
  )
$$;

-- ---------------------------------------------------------------------
-- 5. Historique automatique des taux
-- ---------------------------------------------------------------------
create function public.tracer_taux() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.maj_le := now();
  new.maj_par := auth.uid();
  insert into public.taux_historique
    (devise_source, devise_cible, inverse, taux_client, taux_reel, frais_pct, actif, auteur_id)
  values (new.devise_source, new.devise_cible, new.inverse, new.taux_client, new.taux_reel,
          new.frais_pct, new.actif, auth.uid());
  return new;
end $$;
create trigger tracer_taux before insert or update on public.taux_change
  for each row execute function public.tracer_taux();

-- ---------------------------------------------------------------------
-- 6. Droits et RLS
-- ---------------------------------------------------------------------
alter table public.profils enable row level security;
alter table public.devises enable row level security;
alter table public.parametres enable row level security;
alter table public.taux_change enable row level security;
alter table public.taux_historique enable row level security;
alter table public.transferts enable row level security;
alter table public.transferts_journal enable row level security;
alter table public.clotures enable row level security;

revoke all on public.profils, public.devises, public.parametres, public.taux_change,
  public.taux_historique, public.transferts, public.transferts_journal, public.clotures
  from public, anon, authenticated;
grant select on public.profils, public.devises, public.parametres, public.taux_change,
  public.taux_historique, public.transferts, public.transferts_journal, public.clotures
  to authenticated;
grant insert, update on public.taux_change to authenticated;
grant insert, update (nom, decimales, unites_par_base, actif, ordre) on public.devises to authenticated;
-- La devise de base ne se change pas : les bénéfices déjà figés sont dans cette devise.
grant update (employe_modifie_frais) on public.parametres to authenticated;
grant select, insert, delete on public.profils to service_role;

create policy profils_lecture on public.profils for select to authenticated
  using (id = (select auth.uid()) or (select public.est_patron()));
create policy devises_lecture on public.devises for select to authenticated
  using ((select public.est_actif()));
create policy devises_ajout on public.devises for insert to authenticated
  with check ((select public.est_patron()));
create policy devises_maj on public.devises for update to authenticated
  using ((select public.est_patron())) with check ((select public.est_patron()));
create policy parametres_lecture on public.parametres for select to authenticated
  using ((select public.est_actif()));
create policy parametres_maj on public.parametres for update to authenticated
  using ((select public.est_patron())) with check ((select public.est_patron()));
create policy taux_lecture on public.taux_change for select to authenticated
  using ((select public.est_actif()));
create policy taux_ajout on public.taux_change for insert to authenticated
  with check ((select public.est_patron()));
create policy taux_maj on public.taux_change for update to authenticated
  using ((select public.est_patron())) with check ((select public.est_patron()));
create policy taux_historique_lecture on public.taux_historique for select to authenticated
  using ((select public.est_patron()));
create policy transferts_lecture on public.transferts for select to authenticated
  using ((select public.est_patron())
    or (employe_id = (select auth.uid()) and (select public.est_actif())));
create policy transferts_journal_lecture on public.transferts_journal for select to authenticated
  using ((select public.est_patron()));
create policy clotures_lecture on public.clotures for select to authenticated
  using ((select public.est_patron())
    or (employe_id = (select auth.uid()) and (select public.est_actif())));

revoke all on function
  public.mon_role(), public.est_patron(), public.est_actif(), public.est_employe(), public.aujourdhui(),
  public.calculer_transfert(numeric, numeric, boolean, numeric, numeric, integer, integer, numeric, integer, numeric),
  public.creer_transfert(uuid, text, text, numeric, numeric, numeric, text, text, text, text, text),
  public.modifier_transfert(bigint, text, text, numeric, numeric, numeric, text, text, text, text, text, text),
  public.changer_statut_transfert(bigint, text, text),
  public.cloturer_journee(text), public.rouvrir_journee(bigint),
  public.modifier_employe(uuid, text, boolean, numeric),
  public.rapport(date, date, uuid), public.tracer_taux()
  from public, anon, authenticated;
grant execute on function
  public.mon_role(), public.est_patron(), public.est_actif(), public.est_employe(), public.aujourdhui(),
  public.creer_transfert(uuid, text, text, numeric, numeric, numeric, text, text, text, text, text),
  public.modifier_transfert(bigint, text, text, numeric, numeric, numeric, text, text, text, text, text, text),
  public.changer_statut_transfert(bigint, text, text),
  public.cloturer_journee(text), public.rouvrir_journee(bigint),
  public.modifier_employe(uuid, text, boolean, numeric),
  public.rapport(date, date, uuid)
  to authenticated;

-- ---------------------------------------------------------------------
-- 7. Anciennes tables : fermées aux employés, quelles que soient les
--    policies déjà en place.
-- ---------------------------------------------------------------------
create function public.refuser_employe() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if public.est_employe() then raise exception 'Action réservée au patron.'; end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
revoke all on function public.refuser_employe() from public, anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['transactions', 'periodes', 'credits', 'remboursements'] loop
    if not (select relrowsecurity from pg_class where oid = ('public.' || t)::regclass) then
      execute format('alter table public.%I enable row level security', t);
      if t = 'remboursements' then
        create policy proprietaire on public.remboursements for all to authenticated
          using (exists (select 1 from public.credits c where c.id = credit_id and c.user_id = auth.uid()))
          with check (exists (select 1 from public.credits c where c.id = credit_id and c.user_id = auth.uid()));
      else
        execute format('create policy proprietaire on public.%I for all to authenticated
          using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
      end if;
      raise notice 'RLS était désactivée sur "%" : elle est maintenant activée.', t;
    end if;
    execute format('create policy pas_les_employes on public.%I as restrictive for all to authenticated
      using (not (select public.est_employe())) with check (not (select public.est_employe()))', t);
    -- Couvre aussi les fonctions "security definer" (rembourser_credit...).
    execute format('create trigger refuser_employe before insert or update or delete on public.%I
      for each row execute function public.refuser_employe()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 8. Données de départ
-- ---------------------------------------------------------------------
-- La valeur des FCFA n'est volontairement pas devinée : le patron la règle
-- dans l'écran "Devises & taux".
insert into public.devises (code, nom, decimales, unites_par_base, ordre) values
  ('MAD', 'Dirham marocain', 2, 1, 1),
  ('GNF', 'Franc guinéen', 0, 1000, 2),
  ('XOF', 'Franc CFA (Afrique de l''Ouest)', 0, null, 3),
  ('XAF', 'Franc CFA (Afrique centrale)', 0, null, 4);

-- Crédits et dettes : devise au choix (les existants restent en MAD).
alter table public.credits add column devise text not null default 'MAD'
  references public.devises (code);

insert into public.parametres (devise_base) values ('MAD');

insert into public.taux_change (devise_source, devise_cible, inverse, taux_client, taux_reel, frais_pct) values
  ('MAD', 'GNF', false, 1000, 1000, 3),
  ('GNF', 'MAD', true, 1000, 1000, 3);

-- Compte patron.
do $$
declare
  -- S'il existe plusieurs comptes, remplacez null par l'identifiant de
  -- connexion du patron, entre apostrophes.
  v_identifiant text := null;
  v_nb integer;
  v_user record;
  v_autre record;
begin
  select count(*) into v_nb from auth.users
    where v_identifiant is null or split_part(email, '@', 1) = lower(v_identifiant);
  if v_nb <> 1 then
    raise exception 'Impossible de choisir le patron : % compte(s) trouvé(s). Comptes existants : %. Renseignez v_identifiant dans la section 8.',
      v_nb, (select string_agg(split_part(email, '@', 1), ', ') from auth.users);
  end if;
  select id, split_part(email, '@', 1) as identifiant into v_user from auth.users
    where v_identifiant is null or split_part(email, '@', 1) = lower(v_identifiant);

  -- Garde-fou : ne pas désigner un compte presque vide par erreur.
  select split_part(u.email, '@', 1) as identifiant, count(*) as nb into v_autre
    from public.transactions t join auth.users u on u.id = t.user_id
    where u.id <> v_user.id group by u.email order by count(*) desc limit 1;
  select count(*) into v_nb from public.transactions where user_id = v_user.id;
  if coalesce(v_autre.nb, 0) > v_nb then
    raise exception 'Vérifiez le patron : "%" a % transaction(s), mais "%" en a %.',
      v_user.identifiant, v_nb, v_autre.identifiant, v_autre.nb;
  end if;

  insert into public.profils (id, identifiant, nom, role)
  values (v_user.id, v_user.identifiant, initcap(v_user.identifiant), 'PATRON');
end $$;

-- Copie des anciennes transactions. Peut être relancée sans doublon, pour
-- reprendre ce qui aurait été saisi entre-temps dans l'ancienne version :
--   select public.importer_anciennes_transactions();
create function public.importer_anciennes_transactions() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  n integer;
begin
  insert into public.transferts (
    employe_id, jour, cree_le, nom_client, telephone_client, devise_source, devise_cible,
    montant_envoye, frais_pct, frais, inverse, taux_client, taux_reel, montant_recu,
    marge_taux, benefice, unites_par_base, benefice_base, ancien_id
  )
  select p.id,
    (o.le at time zone (select fuseau from public.parametres where id = 1))::date,
    o.le, o.nom, o.tel,
    case when o.vers_gnf then 'MAD' else 'GNF' end,
    case when o.vers_gnf then 'GNF' else 'MAD' end,
    o.montant,
    case when o.montant > 0 then round(o.frais / o.montant * 100, 6) else 0 end,
    o.frais, not o.vers_gnf, o.taux, o.taux, o.recu, 0, o.frais,
    case when o.vers_gnf then 1 else o.taux end,
    case when o.vers_gnf then round(o.frais, 2) else round(o.frais / o.taux, 2) end,
    o.id
  from (
    select t.id, t.user_id,
      coalesce(t.date_transaction::timestamptz, now()) as le,
      coalesce(nullif(trim(t.nom_client), ''), 'Anonyme') as nom,
      coalesce(t.telephone_client, '') as tel,
      t.direction::text = 'MAD_TO_GNF' as vers_gnf,
      coalesce(t.montant_envoye, 0)::numeric as montant,
      coalesce(t.frais, 0)::numeric as frais,
      coalesce(nullif(t.taux_echange, 0), 1000)::numeric as taux,
      coalesce(t.montant_recu, 0)::numeric as recu
    from public.transactions t
  ) o
  join public.profils p on p.id = o.user_id and p.role = 'PATRON'
  where not exists (select 1 from public.transferts x where x.ancien_id = o.id)
  order by o.id;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.importer_anciennes_transactions() from public, anon, authenticated;

select public.importer_anciennes_transactions();

notify pgrst, 'reload schema';

commit;

-- Contrôle : les deux nombres doivent être identiques.
select
  (select count(*) from public.transactions t
     where t.user_id = (select id from public.profils where role = 'PATRON')) as anciennes_transactions,
  (select count(*) from public.transferts where ancien_id is not null) as transferts_copies;
