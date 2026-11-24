import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, CalendarCheck, Coins, Users, Wallet } from "lucide-react";
import {
  Alerte,
  Badge,
  BoutonNouveau,
  CarteBenefice,
  EnTeteAccueil,
  IconeLien,
  Section,
  Vide,
} from "@/components/ui";
import { Deconnexion } from "@/components/Deconnexion";
import { PilulesPeriode, SelecteurMois } from "@/components/FiltrePeriode";
import { GraphiqueBenefice, type Barre } from "@/components/GraphiqueBenefice";
import { Puces } from "@/components/Puces";
import { TransfertCarte } from "@/components/TransfertCarte";
import { createClient } from "@/lib/supabase/server";
import { exigerProfil, lireNoms, lireMois, lirePremierJour, lireReglages, prechargerPeriodes } from "@/lib/session";
import { lireFiltres, lireTransferts } from "@/lib/transferts";
import { aujourdhui, listeJours, lirePeriode, paramsPeriode, TOUT, type Periode } from "@/lib/periode";
import { NouveauMois, RetirerMois } from "@/components/Mois";
import { lireDroits } from "@/lib/droits";
import { nomZone } from "@/lib/zones";
import { dateCourte, dateLongue, moisLong, montant, nombre } from "@/lib/format";
import type { Cloture, Rapport } from "@/lib/types";

export const metadata = { title: "Accueil" };

const RECENTS = 5;
const JOURNEE = 50;

// Une colonne par jour, ou par mois pour tout l'historique.
function barres(r: Rapport, p: Periode, today: string): Barre[] {
  const parMois = p.mois === TOUT;
  const groupes = new Map<string, Barre>();
  for (const j of listeJours(p.debut, p.fin < today ? p.fin : today)) {
    const cle = parMois ? j.slice(0, 7) : j;
    if (groupes.has(cle)) continue;
    groupes.set(cle, {
      cle,
      label: parMois ? moisLong(cle) : dateLongue(j),
      court: parMois ? `${cle.slice(5)}/${cle.slice(2, 4)}` : String(Number(j.slice(8))),
      valeur: 0,
      nb: 0,
    });
  }
  for (const x of r.par_jour) {
    const b = groupes.get(parMois ? x.jour.slice(0, 7) : x.jour);
    if (b) {
      b.valeur += x.benefice;
      b.nb += x.nb;
    }
  }
  return [...groupes.values()];
}

// Rentrées = ce que les clients donnent ; sorties = ce qui leur est remis.
function caisse(r: Rapport) {
  const m = new Map<string, { entree: number; sortie: number }>();
  const ligne = (d: string) => {
    if (!m.has(d)) m.set(d, { entree: 0, sortie: 0 });
    return m.get(d)!;
  };
  for (const c of r.par_corridor) {
    ligne(c.source).entree += c.volume;
    ligne(c.cible).sortie += c.remis;
  }
  return m;
}

export default async function Accueil({ searchParams }: PageProps<"/dashboard">) {
  prechargerPeriodes();
  const profil = await exigerProfil();
  const patron = profil.role === "PATRON";
  const { parametres, devises, decimales } = await lireReglages();
  const { profils, noms } = await lireNoms();
  // L'admin supervise : il n'enregistre pas de transfert.
  const employes = profils.filter((p) => p.role === "EMPLOYE");
  const params = await searchParams;
  const today = aujourdhui(parametres.fuseau);
  const premier = await lirePremierJour(today);
  const mois = await lireMois(today);
  const periode = lirePeriode(params, today, premier, mois, patron ? "mois" : "jour");
  const demande = lireFiltres(params).employe;
  const employe = patron ? employes.find((p) => p.id === demande)?.id : undefined;

  const supabase = await createClient();
  const [rap, liste, clo, droits] = await Promise.all([
    supabase.rpc("rapport", { p_debut: periode.debut, p_fin: periode.fin, p_employe: employe ?? null }),
    lireTransferts(
      periode,
      // Un transfert supprimé disparaît de la liste de l'employé.
      { q: "", devise: "", statut: patron ? "" : "VALIDE", employe: employe ?? "" },
      0,
      patron ? RECENTS : JOURNEE
    ),
    supabase.from("clotures").select("*").eq("jour", today).overrideTypes<Cloture[], { merge: false }>(),
    lireDroits(profil, parametres.fuseau),
  ]);
  const erreur = rap.error ?? clo.error;
  if (erreur) throw new Error(erreur.message);
  const r = rap.data as Rapport;

  const base = parametres.devise_base;
  const fmt = (v: number) => montant(v, base, decimales[base]);
  const dev = (v: number, d: string) => nombre(v, decimales[d]);
  const { nb, benefice } = r.total;
  const courant = today.slice(0, 7);
  const retirable =
    patron && !employe && nb === 0 && periode.vue === "mois" && periode.mois !== TOUT && periode.mois !== courant;
  const enZone = (v: number, z: string) => montant(v, z, decimales[z]);
  const casesZone = r.par_zone.map((z) => ({ label: nomZone(z.zone), valeur: enZone(z.benefice, z.zone) }));
  // L'employé lit son bénéfice dans sa zone ; l'admin, dans la devise de base.
  const maZone = profil.zone;
  const totalZone = enZone(r.par_zone.find((z) => z.zone === maZone)?.benefice ?? 0, maZone ?? base);
  const autresZones = r.par_zone.some((z) => z.zone !== maZone);
  const sansZone = employes.filter((p) => p.actif && !p.zone);
  const garder: Record<string, string> = employe ? { employe } : {};
  const lienTransferts = `/transferts?${new URLSearchParams({ ...paramsPeriode(periode), ...garder })}`;
  const aRegler = devises.filter((d) => d.actif && d.unites_par_base === null);
  const dujour = new Map(clo.data!.map((c) => [c.employe_id, c]));
  const quand =
    periode.vue === "jour"
      ? "d'aujourd'hui"
      : periode.vue === "date"
        ? `du ${dateCourte(periode.debut)}`
        : periode.mois === TOUT
          ? "au total"
          : "du mois";

  // L'admin les voit en premier ; l'employé, après ses transferts.
  // L'employé n'y voit que sa zone.
  const lignesCaisse = [...caisse(r)].filter(([d]) => patron || r.par_zone.some((z) => z.zone === d));
  const rentrees = nb > 0 && (
    <Section titre="Rentrées et sorties">
      <div className="space-y-2">
        {lignesCaisse.map(([d, c]) => (
          <div key={d} className="carte">
            <div className="mb-2 flex items-baseline justify-between">
              <span className="text-sm font-black text-gray-800">{d}</span>
              <span className="text-xs font-bold text-gray-600">
                Solde{" "}
                <b className={c.entree - c.sortie < 0 ? "text-red-600" : "text-gray-900"}>
                  {c.entree - c.sortie > 0 && "+"}
                  {dev(c.entree - c.sortie, d)}
                </b>
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-emerald-50 p-2">
                <div className="flex items-center text-[10px] font-bold text-emerald-800">
                  <ArrowDownLeft size={13} className="mr-0.5" /> Rentrées
                </div>
                <div className="text-sm font-black text-emerald-900">{dev(c.entree, d)}</div>
              </div>
              <div className="rounded-lg bg-red-50 p-2">
                <div className="flex items-center text-[10px] font-bold text-red-800">
                  <ArrowUpRight size={13} className="mr-0.5" /> Sorties
                </div>
                <div className="text-sm font-black text-red-900">{dev(c.sortie, d)}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );

  return (
    <>
      <EnTeteAccueil
        accent={patron ? "Admin" : profil.nom}
        icones={
          <>
            {patron && (
              <>
                <NouveauMois courant={courant} existants={mois} />
                <IconeLien href="/journees" label="Équipe">
                  <Users size={18} />
                </IconeLien>
                <IconeLien href="/taux" label="Devises et taux">
                  <Coins size={18} />
                </IconeLien>
                <IconeLien href="/credits" label="Crédits et dettes">
                  <Wallet size={18} />
                </IconeLien>
              </>
            )}
            {!patron && (
              <IconeLien href="/journees" label="Ma journée">
                <CalendarCheck size={18} />
              </IconeLien>
            )}
            <Deconnexion icone />
          </>
        }
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1">
            <SelecteurMois base="/dashboard" periode={periode} garder={garder} mois={mois} />
            {retirable && <RetirerMois mois={periode.mois} />}
          </div>
          {!patron && maZone && (
            <span className="rounded-lg bg-white px-3 py-1.5 text-xs font-black text-blue-800">
              Zone {nomZone(maZone)}
            </span>
          )}
        </div>
        <CarteBenefice
          titre={`Bénéfices ${quand}`}
          total={patron ? fmt(benefice) : totalZone}
          detail={`${nb} transfert${nb > 1 ? "s" : ""}`}
          cases={patron || autresZones ? casesZone : []}
        />
      </EnTeteAccueil>

      <div className="space-y-5 p-4">
        <PilulesPeriode base="/dashboard" periode={periode} garder={garder} today={today} />
        {patron && employes.length > 0 && (
          <Puces
            base="/dashboard"
            nom="employe"
            valeur={employe}
            tous="Toute l'équipe"
            options={employes.map((p) => ({ valeur: p.id, label: p.nom }))}
            garder={paramsPeriode(periode)}
          />
        )}

        {patron && !mois.includes(courant) && (
          <Alerte>
            Le mois de {moisLong(courant)} n&apos;est pas encore ajouté : touchez l&apos;icône calendrier en haut.
          </Alerte>
        )}
        {patron && sansZone.length > 0 && (
          <Alerte>
            {sansZone.map((p) => p.nom).join(", ")} : zone à choisir avant de pouvoir travailler.{" "}
            <Link href="/employes" className="font-bold underline">
              Choisir
            </Link>
          </Alerte>
        )}
        {!patron && !maZone && (
          <Alerte>Vous n&apos;avez pas encore de zone. Demandez à l&apos;admin de vous en donner une.</Alerte>
        )}

        {patron && aRegler.length > 0 && (
          <Alerte>
            {aRegler.map((d) => d.code).join(" et ")} : taux à régler.{" "}
            <Link href="/taux" className="font-bold underline">
              Régler
            </Link>
          </Alerte>
        )}

        {patron && rentrees}

        {patron && nb > 0 && periode.vue === "mois" && (
          <Section titre={`Bénéfice par ${periode.mois === TOUT ? "mois" : "jour"} (${base})`}>
            <div className="carte">
              <GraphiqueBenefice barres={barres(r, periode, today)} devise={base} />
              <details className="mt-3">
                <summary className="text-xs font-bold text-blue-600">Détail par jour</summary>
                <ul className="mt-2 divide-y divide-gray-100 text-xs">
                  {[...r.par_jour].reverse().map((j) => (
                    <li key={j.jour}>
                      <Link
                        href={`/transferts?${new URLSearchParams({ ...garder, v: "date", d: j.jour, m: j.jour.slice(0, 7) })}`}
                        prefetch={false}
                        className="flex justify-between gap-2 py-2"
                      >
                        <span className="text-gray-600">
                          {dateCourte(j.jour)} · {j.nb} transfert{j.nb > 1 ? "s" : ""}
                        </span>
                        <b>{fmt(j.benefice)}</b>
                      </Link>
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          </Section>
        )}

        {patron && !employe && r.par_employe.length > 0 && (
          <Section titre="Par employé">
            <div className="carte divide-y divide-gray-100 py-1">
              {r.par_employe.map((e) => (
                <Link
                  key={e.employe_id}
                  href={`/dashboard?${new URLSearchParams({ ...paramsPeriode(periode), employe: e.employe_id })}`}
                  className="flex items-center justify-between gap-2 py-2.5"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-gray-800">{e.nom}</span>
                    <span className="text-[11px] text-gray-500">
                      {e.nb} transfert{e.nb > 1 ? "s" : ""}
                      {r.par_employe_zone
                        .filter((z) => z.employe_id === e.employe_id)
                        .map((z) => ` · ${enZone(z.benefice, z.zone)}`)}
                    </span>
                  </span>
                  <b className="text-sm whitespace-nowrap">{fmt(e.benefice)}</b>
                </Link>
              ))}
            </div>
          </Section>
        )}

        {!patron && (
          <Link href="/journees" className="carte flex items-center justify-between text-sm font-bold">
            Ma journée
            {dujour.has(profil.id) ? <Badge ton="vert">Clôturée</Badge> : <Badge ton="ambre">À clôturer</Badge>}
          </Link>
        )}

        <Section
          titre={patron ? "Derniers transferts" : "Mes transferts"}
          lien={
            liste.total > 0 && (
              <Link href={lienTransferts} className="text-xs font-bold text-blue-600">
                Tout voir ({liste.total})
              </Link>
            )
          }
        >
          {liste.lignes.length === 0 ? (
            <Vide>Aucune opération trouvée.</Vide>
          ) : (
            <div className="space-y-3">
              {liste.lignes.map((t) => (
                <TransfertCarte
                  key={t.id}
                  t={t}
                  decimales={decimales}
                  fuseau={parametres.fuseau}
                  base={base}
                  employe={patron ? noms[t.employe_id] : undefined}
                  patron={patron}
                  modifiable={droits.modifiable(t)}
                />
              ))}
            </div>
          )}
        </Section>
        {!patron && rentrees}
      </div>

      {!patron && <BoutonNouveau />}
    </>
  );
}
