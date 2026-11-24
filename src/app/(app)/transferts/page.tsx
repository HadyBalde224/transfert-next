import Link from "next/link";
import { Download, Search } from "lucide-react";
import { BoutonNouveau, EnTete, Vide } from "@/components/ui";
import { PilulesPeriode, SelecteurMois } from "@/components/FiltrePeriode";
import { Puces } from "@/components/Puces";
import { TransfertCarte } from "@/components/TransfertCarte";
import { exigerProfil, lireNoms, lireMois, lirePremierJour, lireReglages, prechargerPeriodes } from "@/lib/session";
import { aujourdhui, lirePeriode, paramsPeriode, un } from "@/lib/periode";
import { lireDroits } from "@/lib/droits";
import { lireFiltres, lireTransferts, PAR_PAGE } from "@/lib/transferts";

export const metadata = { title: "Transferts" };

export default async function Transferts({ searchParams }: PageProps<"/transferts">) {
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
  const periode = lirePeriode(params, today, premier, mois, "mois");
  const filtres = lireFiltres(params);
  // Un transfert supprimé disparaît de la liste de l'employé.
  if (!patron) filtres.statut = "VALIDE";
  const page = Math.max(1, Math.floor(Number(un(params.page))) || 1);
  const [{ lignes, total }, droits] = await Promise.all([
    lireTransferts(periode, filtres, (page - 1) * PAR_PAGE, PAR_PAGE),
    lireDroits(profil, parametres.fuseau),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAR_PAGE));

  const actifs = Object.fromEntries(Object.entries(filtres).filter(([, v]) => v)) as Record<string, string>;
  const sans = (nom: string) =>
    Object.fromEntries(Object.entries({ ...paramsPeriode(periode), ...actifs }).filter(([k]) => k !== nom));
  const lienPage = (n: number) =>
    `/transferts?${new URLSearchParams({ ...paramsPeriode(periode), ...actifs, page: String(n) })}`;

  return (
    <>
      <EnTete
        titre={patron ? "Transferts" : "Mes transferts"}
        sous={`${total} transfert${total > 1 ? "s" : ""}`}
        actions={
          <a
            href={`/transferts/export?${new URLSearchParams({ ...paramsPeriode(periode), ...actifs })}`}
            download
            aria-label="Exporter pour Excel"
            title="Exporter pour Excel"
            className="rounded-full bg-white/10 p-2 hover:bg-white/20"
          >
            <Download size={18} />
          </a>
        }
      >
        <SelecteurMois base="/transferts" periode={periode} garder={actifs} mois={mois} />
      </EnTete>

      <div className="space-y-3 p-4">
        <form action="/transferts" key={filtres.q} className="relative">
          {Object.entries(sans("q")).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          <Search className="absolute top-3.5 left-3 text-gray-400" size={16} />
          <input
            name="q"
            type="search"
            defaultValue={filtres.q}
            placeholder="Nom, tél, n° ou code de reçu..."
            aria-label="Rechercher"
            className="champ bg-white pl-9 shadow-sm"
          />
        </form>
        <PilulesPeriode base="/transferts" periode={periode} garder={actifs} today={today} />
        {patron && (
          <Puces
            base="/transferts"
            nom="devise"
            valeur={filtres.devise}
            tous="Toutes devises"
            options={devises.filter((d) => d.actif).map((d) => ({ valeur: d.code, label: d.code }))}
            garder={sans("devise")}
          />
        )}
        {patron && employes.length > 0 && (
          <Puces
            base="/transferts"
            nom="employe"
            valeur={filtres.employe}
            tous="Toute l'équipe"
            options={employes.map((p) => ({ valeur: p.id, label: p.nom }))}
            garder={sans("employe")}
          />
        )}

        {lignes.length === 0 ? (
          <Vide>Aucune opération trouvée.</Vide>
        ) : (
          lignes.map((t) => (
            <TransfertCarte
              key={t.id}
              t={t}
              decimales={decimales}
              fuseau={parametres.fuseau}
              base={parametres.devise_base}
              employe={patron ? noms[t.employe_id] : undefined}
              patron={patron}
              modifiable={droits.modifiable(t)}
            />
          ))
        )}

        {pages > 1 && (
          <div className="flex items-center justify-between text-xs">
            {page > 1 ? (
              <Link href={lienPage(page - 1)} className="btn-secondaire">
                Précédent
              </Link>
            ) : (
              <span />
            )}
            <span className="font-medium text-gray-500">
              Page {page} / {pages}
            </span>
            {page < pages ? (
              <Link href={lienPage(page + 1)} className="btn-secondaire">
                Suivant
              </Link>
            ) : (
              <span />
            )}
          </div>
        )}
      </div>
      {!patron && <BoutonNouveau />}
    </>
  );
}
