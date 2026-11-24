-- =====================================================================
-- TransfertPro : l'employé corrige jusqu'à minuit, ensuite l'admin seul
--
-- À exécuter dans Supabase > SQL Editor, après "corrections_24h".
-- Remplace le délai de 24 heures. Peut être relancé sans risque.
--
-- Minuit s'entend à l'heure de l'entreprise (paramètre "fuseau").
-- =====================================================================

begin;

do $$
begin
  if to_regprocedure('public.verifier_delai(uuid, date, timestamptz)') is null then
    raise exception 'Exécutez d''abord le script "corrections_24h".';
  end if;
end $$;

create or replace function public.verifier_delai(p_employe uuid, p_jour date, p_cree_le timestamptz) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_employe is distinct from auth.uid() then
    raise exception 'Ce transfert n''est pas le vôtre.';
  end if;
  if p_jour <> public.aujourdhui() then
    raise exception 'Minuit est passé : seul le patron peut modifier ou supprimer ce transfert.';
  end if;
  if exists (select 1 from public.clotures where employe_id = p_employe and jour = p_jour) then
    raise exception 'Cette journée est clôturée. Demandez au patron de la rouvrir.';
  end if;
end $$;
revoke all on function public.verifier_delai(uuid, date, timestamptz) from public, anon, authenticated;

commit;

select 'OK : corrections jusqu''à minuit' as resultat,
  (select fuseau from public.parametres where id = 1) as heure_de;
