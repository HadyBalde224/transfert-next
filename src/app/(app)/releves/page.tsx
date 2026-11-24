import Link from "next/link";
import { Receipt } from "lucide-react";
import { Alerte, Badge, EnTete, Onglets, Section, Vide } from "@/components/ui";
import { SelecteurMois } from "@/components/FiltrePeriode";
import { Puces } from "@/components/Puces";
import { TelechargerReleves } from "@/components/Releves";
import { Entreprise } from "@/components/Entreprise";
import { createClient } from "@/lib/supabase/server";
import { exigerPatron, lireMois, lireNoms, lirePremierJour, lireReglages } from "@/lib/session";
import { ajouterJours, aujourdhui, jourValide, lirePeriode, TOUT, un } from "@/lib/periode";
import { construireReleve } from "@/lib/donneesReleve";
import { construireRecu } from "@/lib/donneesRecu";
import { lireOperations, MAX_OPERATIONS } from "@/lib/releveServeur";
import type { DonneesRecu } from "@/lib/recu";
import type { Rapport } from "@/lib/types";

export const metadata = { title: "Relevés" };

const MAX_RECUS = 200;

export default async function Releves({ searchParams }: PageProps<"/releves">) {
  await exigerPatron();
  const { parametres, decimales } = await lireReglages();
  const { profils, noms } = await lireNoms();
  const employes = profils.filter((p) => p.role === "EMPLOYE");
  const params = await searchParams;
  const today = aujourdhui(parametres.fuseau);
  const premier = await lirePremierJour(today);
  const mois = await lireMois(today);
  const choisi = employes.find((p) => p.id === un(params.employe));

  // Dates libres si elles sont valides, sinon le mois choisi.
  const du = un(params.du);
  const au = un(params.au);
  const libre = jourValide(du) && jourValide(au);
  const periode = lirePeriode({ m: params.m, v: "mois" }, today, premier, mois, "mois");
  let debut = libre ? du : periode.debut;
  let fin = libre ? au : periode.fin;
  if (debut > fin) [debut, fin] = [fin, debut];
  if (fin > today) fin = today;
  if (debut > fin) debut = fin;
  const bornee = libre || periode.mois !== TOUT;

  const { lignes, tropDeLignes } = await lireOperations(debut, fin, choisi?.id);
  const supabase = await createClient();
  const { data: avant, error } = await supabase.rpc("rapport", {
    p_debut: "2000-01-01",
    p_fin: ajouterJours(debut, -1),
    p_employe: choisi?.id ?? null,
  });
  if (error) throw new Error(error.message);
  const cumuls = (avant as Rapport).par_employe_zone;

  const maintenant = new Date().toISOString();
  const concernes = choisi ? [choisi] : employes.filter((p) => lignes.some((t) => t.employe_id === p.id));
  const releves = concernes.map((e) =>
    construireReleve({
      employe: e,
      transferts: lignes.filter((t) => t.employe_id === e.id),
      avant: Object.fromEntries(cumuls.filter((c) => c.employe_id === e.id).map((c) => [c.zone, c.benefice])),
      debut,
      fin,
      bornee,
      parametres,
      decimales,
      maintenant,
    })
  );
  const recus =
    lignes.length <= MAX_RECUS
      ? lignes.map((t) => construireRecu(t, parametres, decimales, noms[t.employe_id] ?? ""))
      : null;
  const recusPrets = recus?.every((r) => r !== null) ? (recus as DonneesRecu[]) : null;

  const entete = {
    nom: parametres.entreprise_nom ?? "",
    telephone: parametres.entreprise_telephone ?? "",
    adresse: parametres.entreprise_adresse ?? "",
    message: parametres.recu_message ?? "",
  };
  const dates: Record<string, string> = libre ? { du: debut, au: fin } : { m: periode.mois };
  const garderEmploye: Record<string, string> = choisi ? { employe: choisi.id } : {};

  return (
    <>
      <EnTete titre="Équipe" sous="Relevés et reçus de chaque employé">
        <div className="space-y-2.5">
          <Onglets
            onglets={[
              { href: "/journees", label: "Journées", actif: false },
              { href: "/employes", label: "Comptes", actif: false },
              { href: "/releves", label: "Relevés", actif: true },
            ]}
          />
          <SelecteurMois base="/releves" periode={periode} garder={garderEmploye} mois={mois} />
        </div>
      </EnTete>

      <div className="space-y-4 p-4">
        <Puces
          base="/releves"
          nom="employe"
          valeur={choisi?.id}
          tous="Toute l'équipe"
          options={employes.map((p) => ({ valeur: p.id, label: p.nom }))}
          garder={dates}
        />

        <form action="/releves" key={`${debut}${fin}`} className="grid grid-cols-2 gap-2">
          {choisi && <input type="hidden" name="employe" value={choisi.id} />}
          <label>
            <span className="etiquette">Du</span>
            <input type="date" name="du" required max={today} defaultValue={debut} className="champ bg-white px-2 shadow-sm" />
          </label>
          <label>
            <span className="etiquette">Au</span>
            <input type="date" name="au" required max={today} defaultValue={fin} className="champ bg-white px-2 shadow-sm" />
          </label>
          <button className="pilule col-span-2">Voir cette période</button>
        </form>

        {tropDeLignes ? (
          <Alerte>
            Plus de {MAX_OPERATIONS} opérations : choisissez une période plus courte ou un seul employé.
          </Alerte>
        ) : lignes.length === 0 && !choisi ? (
          <Vide>Aucune opération sur cette période.</Vide>
        ) : (
          <>
            <TelechargerReleves
              key={`${choisi?.id}${debut}${fin}${lignes.length}`}
              releves={releves}
              recus={recusPrets}
              nom={`${choisi?.identifiant ?? "equipe"}_${debut}_${fin}`}
            />
            {lignes.length > MAX_RECUS && (
              <p className="text-[11px] text-gray-500">
                « Tous les reçus » : {MAX_RECUS} au maximum. Réduisez la période pour les télécharger ensemble.
              </p>
            )}
            {recus && !recusPrets && (
              <p className="text-[11px] text-amber-800">
                Les reçus individuels attendent le script 20261124240000_recus.sql. Le relevé, lui, fonctionne.
              </p>
            )}

            {releves.map((r) => (
              <article key={r.identifiant} className="space-y-3">
                <div className="carte">
                  <div className="flex items-baseline justify-between gap-2">
                    <h2 className="truncate text-base font-black text-gray-800">{r.employe}</h2>
                    <span className="text-[11px] whitespace-nowrap text-gray-500">{r.periode}</span>
                  </div>
                  <dl className="mt-2 grid grid-cols-2 gap-2">
                    {r.resume.map(([label, valeur]) => (
                      <div key={label} className="rounded-lg bg-blue-50 p-2">
                        <dt className="text-[10px] font-bold text-blue-900">{label}</dt>
                        <dd className="text-sm font-black text-blue-900">{valeur}</dd>
                      </div>
                    ))}
                  </dl>
                </div>

                {r.sections.length === 0 && <Vide>Aucune opération sur cette période.</Vide>}
                {r.sections.map((s) => (
                  <Section key={s.zone} titre={`Opérations · zone ${s.zone}`}>
                    <div className="carte p-0">
                      <div className="flex justify-between gap-2 rounded-t-xl bg-emerald-50 px-3 py-2 text-[11px] font-bold text-emerald-900">
                        <span>Cumul avant</span>
                        <span>{s.ouverture}</span>
                      </div>
                      {s.jours.map((j) => (
                        <div key={j.jour}>
                          <div className="flex justify-between gap-2 bg-gray-100 px-3 py-1.5 text-[11px] font-bold text-gray-600">
                            <span>
                              {j.jour} · {j.nb}
                            </span>
                            <span>{j.total}</span>
                          </div>
                          <ul className="divide-y divide-gray-100">
                            {j.operations.map((o) => (
                              <li key={o.id} className={o.annule ? "opacity-60" : ""}>
                                <Link
                                  href={`/transferts/${o.id}/recu`}
                                  prefetch={false}
                                  className="flex items-center gap-2 px-3 py-2"
                                >
                                  <Receipt size={15} className="shrink-0 text-blue-600" aria-label="Voir le reçu" />
                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate text-xs font-bold text-gray-800">{o.client}</span>
                                    <span className="block text-[10px] text-gray-500">
                                      {o.heure} · {o.numero}
                                    </span>
                                    <span className="block text-[10px] text-gray-600">
                                      {o.recu} → {o.remis}
                                    </span>
                                  </span>
                                  <span className="shrink-0 text-right">
                                    {o.annule ? (
                                      <Badge ton="rouge">Supprimé</Badge>
                                    ) : (
                                      <span className="block text-xs font-black text-amber-800">{o.benefice}</span>
                                    )}
                                    <span className="block text-[10px] text-gray-500">{o.cumul}</span>
                                  </span>
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                      <div className="flex justify-between gap-2 rounded-b-xl bg-emerald-50 px-3 py-2 text-[11px] font-bold text-emerald-900">
                        <span>Total {s.total}</span>
                        <span>Cumul final {s.cloture}</span>
                      </div>
                    </div>
                  </Section>
                ))}
              </article>
            ))}
          </>
        )}

        {parametres.entreprise_nom && (
          <details className="carte">
            <summary className="text-xs font-bold text-gray-500">
              En-tête des documents : {parametres.entreprise_nom}
            </summary>
            <Entreprise key={JSON.stringify(entete)} infos={entete} />
          </details>
        )}
      </div>
    </>
  );
}
