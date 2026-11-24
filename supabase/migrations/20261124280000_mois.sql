-- =====================================================================
-- TransfertPro : l'admin ajoute les mois
--
-- À exécuter UNE fois dans Supabase > SQL Editor, après "recus".
-- Aucune donnée n'est supprimée. En cas d'erreur, rien n'est modifié.
--
-- * Un mois ne s'ajoute qu'une fois, et jamais avant d'être arrivé.
-- * Un mois vide peut être retiré, sauf le mois en cours.
-- * Un transfert n'est jamais bloqué : son mois s'ajoute tout seul.
-- =====================================================================

begin;

do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'transferts' and column_name = 'code_recu') then
    raise exception 'Exécutez d''abord le script "recus".';
  end if;
  if to_regclass('public.mois') is not null then
    raise exception 'Ce script a déjà été exécuté.';
  end if;
end $$;

create table public.mois (
  cle text primary key check (cle ~ '^20[0-9]{2}-(0[1-9]|1[0-2])$'),
  ajoute_par uuid references public.profils (id),
  ajoute_le timestamptz not null default now()
);
alter table public.mois enable row level security;
revoke all on public.mois from public, anon, authenticated;
grant select on public.mois to authenticated;
create policy mois_lecture on public.mois for select to authenticated
  using ((select public.est_actif()));

-- Départ : le mois en cours et ceux qui contiennent des transferts.
insert into public.mois (cle)
select to_char(public.aujourdhui(), 'YYYY-MM')
union
select to_char(jour, 'YYYY-MM') from public.transferts where statut = 'VALIDE';

create function public.ajouter_mois(p_mois text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.est_patron() then raise exception 'Action réservée au patron.'; end if;
  if p_mois is null or p_mois !~ '^20[0-9]{2}-(0[1-9]|1[0-2])$' then raise exception 'Mois invalide.'; end if;
  if p_mois > to_char(public.aujourdhui(), 'YYYY-MM') then
    raise exception 'Ce mois n''est pas encore arrivé.';
  end if;
  insert into public.mois (cle, ajoute_par) values (p_mois, auth.uid()) on conflict do nothing;
  if not found then raise exception 'Ce mois existe déjà.'; end if;
end $$;

create function public.supprimer_mois(p_mois text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.est_patron() then raise exception 'Action réservée au patron.'; end if;
  if p_mois = to_char(public.aujourdhui(), 'YYYY-MM') then
    raise exception 'Le mois en cours ne peut pas être retiré.';
  end if;
  if exists (select 1 from public.transferts where statut = 'VALIDE' and to_char(jour, 'YYYY-MM') = p_mois) then
    raise exception 'Ce mois contient des transferts, il ne peut pas être retiré.';
  end if;
  delete from public.mois where cle = p_mois;
  if not found then raise exception 'Mois introuvable.'; end if;
end $$;

-- Un transfert fait dans un mois non ajouté (ou rétabli dans un mois retiré)
-- l'ajoute, pour ne jamais disparaître de l'écran.
create function public.assurer_mois() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.statut = 'VALIDE' then
    insert into public.mois (cle) values (to_char(new.jour, 'YYYY-MM')) on conflict do nothing;
  end if;
  return null;
end $$;
create trigger assurer_mois after insert or update on public.transferts
  for each row execute function public.assurer_mois();

revoke all on function public.ajouter_mois(text), public.supprimer_mois(text), public.assurer_mois()
  from public, anon, authenticated;
grant execute on function public.ajouter_mois(text), public.supprimer_mois(text) to authenticated;

notify pgrst, 'reload schema';

commit;

select 'OK : mois activés' as resultat, (select string_agg(cle, ', ' order by cle) from public.mois) as mois;
