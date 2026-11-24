-- =====================================================================
-- TransfertPro : seul l'admin modifie
--
-- À exécuter UNE fois dans Supabase > SQL Editor, après le premier script.
-- Aucune donnée n'est supprimée. En cas d'erreur, rien n'est modifié.
--
-- * Un employé enregistre, consulte et clôture sa journée. C'est tout.
-- * Seul l'admin change les mots de passe et identifiants des employés.
-- =====================================================================

begin;

do $$
begin
  if to_regclass('public.transferts') is null then
    raise exception 'Exécutez d''abord le premier script (equipe_et_devises).';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. Un transfert enregistré ne peut plus être touché par un employé.
--    (Le déclencheur s'applique aussi à modifier_transfert.)
-- ---------------------------------------------------------------------
create trigger refuser_employe before update or delete on public.transferts
  for each row execute function public.refuser_employe();

-- Les frais standard fixés par l'admin s'appliquent toujours.
update public.parametres set employe_modifie_frais = false where id = 1;

-- ---------------------------------------------------------------------
-- 2. Mots de passe : uniquement avec l'autorisation de l'admin
-- ---------------------------------------------------------------------
create table public.autorisations_mot_de_passe (
  employe_id uuid primary key references public.profils (id) on delete cascade,
  expire_le timestamptz not null
);
alter table public.autorisations_mot_de_passe enable row level security;
revoke all on public.autorisations_mot_de_passe from public, anon, authenticated;

create function public.autoriser_mot_de_passe(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.est_patron() then raise exception 'Action réservée au patron.'; end if;
  if not exists (select 1 from public.profils where id = p_id and role = 'EMPLOYE') then
    raise exception 'Employé introuvable.';
  end if;
  insert into public.autorisations_mot_de_passe (employe_id, expire_le)
  values (p_id, now() + interval '1 minute')
  on conflict (employe_id) do update set expire_le = excluded.expire_le;
end $$;
revoke all on function public.autoriser_mot_de_passe(uuid) from public, anon, authenticated;
grant execute on function public.autoriser_mot_de_passe(uuid) to authenticated;

-- Sans autorisation, l'ancienne valeur est conservée. On ne lève pas
-- d'erreur : Supabase met lui-même ces lignes à jour lors des connexions, et
-- une erreur ici pourrait empêcher quelqu'un d'entrer.
create function public.proteger_compte_employe() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.encrypted_password is distinct from old.encrypted_password
     or new.email is distinct from old.email then
    if exists (select 1 from public.profils where id = old.id and role = 'EMPLOYE') then
      new.email := old.email;
      if new.encrypted_password is distinct from old.encrypted_password then
        delete from public.autorisations_mot_de_passe
          where employe_id = old.id and expire_le > now();
        if not found then new.encrypted_password := old.encrypted_password; end if;
      end if;
    end if;
  end if;
  return new;
end $$;
revoke all on function public.proteger_compte_employe() from public, anon, authenticated;

create trigger proteger_compte_employe before update on auth.users
  for each row execute function public.proteger_compte_employe();

notify pgrst, 'reload schema';

commit;

select 'OK : seul l''admin peut modifier' as resultat;
