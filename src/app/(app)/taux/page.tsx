import { EnTete, Section, Vide } from "@/components/ui";
import { AjouterZone, ZoneCarte } from "@/components/Taux";
import { createClient } from "@/lib/supabase/server";
import { exigerPatron, lireNoms, lireReglages, tot } from "@/lib/session";
import { lireTaux } from "@/lib/taux";
import { CATALOGUE } from "@/lib/zones";
import { horodatage, libelleTaux, pourcent } from "@/lib/format";
import type { TauxHistorique } from "@/lib/types";

export const metadata = { title: "Devises & taux" };

async function lireHistorique() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("taux_historique")
    .select("*")
    .order("id", { ascending: false })
    .limit(20)
    .overrideTypes<TauxHistorique[], { merge: false }>();
  if (error) throw new Error(error.message);
  return data;
}

export default async function PageTaux() {
  const lectures = tot(Promise.all([lireTaux(), lireHistorique()]));
  await exigerPatron();
  const { parametres, devises } = await lireReglages();
  const { noms } = await lireNoms();
  const [taux, data] = await lectures;
  const base = parametres.devise_base;

  const sens = (source: string, cible: string) => {
    const t = taux.find((x) => x.devise_source === source && x.devise_cible === cible && x.actif);
    return t ? { client: t.taux_client, reel: t.taux_reel, frais: t.frais_pct } : null;
  };
  const zones = devises
    .filter((d) => d.actif && d.code !== base)
    .map((d) => ({ code: d.code, nom: d.nom, aller: sens(base, d.code), retour: sens(d.code, base) }));
  const ajoutables = Object.keys(CATALOGUE).filter(
    (c) => c !== base && !zones.some((z) => z.code === c)
  );

  return (
    <>
      <EnTete titre="Devises & taux" sous={`Devise mère : ${base}. Chaque zone s'échange avec le ${base}.`} />
      <div className="space-y-5 p-4">
        <Section titre="Zones">
          <p className="mb-2 text-[11px] text-gray-600">
            Votre marge = écart entre le <b>taux client</b> (appliqué) et le <b>taux réel</b> (votre coût).
            Un nouveau taux ne change que les transferts à venir.
          </p>
          <div className="space-y-3">
            {zones.length === 0 && <Vide>Aucune zone. Ajoutez une devise ci-dessous.</Vide>}
            {zones.map((z) => (
              <ZoneCarte key={JSON.stringify(z)} zone={z} base={base} />
            ))}
            {ajoutables.length > 0 && <AjouterZone codes={ajoutables} base={base} />}
          </div>
        </Section>

        {data.length > 0 && (
          <details className="carte">
            <summary className="text-xs font-bold text-blue-600">Derniers changements de taux</summary>
            <ul className="mt-2 divide-y divide-gray-100 text-[11px]">
              {data.map((h) => (
                <li key={h.id} className="py-2">
                  <div className="font-bold text-gray-800">
                    {h.devise_source} → {h.devise_cible} {!h.actif && "(supprimé)"}
                  </div>
                  <div className="text-gray-600">
                    Client {libelleTaux({ ...h, taux: h.taux_client })} · réel{" "}
                    {libelleTaux({ ...h, taux: h.taux_reel })} · frais {pourcent(h.frais_pct)}
                  </div>
                  <div className="text-gray-500">
                    {horodatage(h.le, parametres.fuseau)} · {h.auteur_id ? noms[h.auteur_id] : "Installation"}
                  </div>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </>
  );
}
