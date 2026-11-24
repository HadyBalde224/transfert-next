import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Badge, BoutonNouveau, EnTete, Section } from "@/components/ui";
import { ActionsTransfert } from "@/components/ActionsTransfert";
import { createClient } from "@/lib/supabase/server";
import { exigerProfil, lireNoms, lireReglages } from "@/lib/session";
import { lireDroits } from "@/lib/droits";
import { lireTransfert } from "@/lib/transfert";
import { nomZone } from "@/lib/zones";
import { dateLongue, horodatage, libelleTaux, montant, pourcent } from "@/lib/format";
import type { JournalEntree, Transfert } from "@/lib/types";

export const metadata = { title: "Transfert" };

const CHAMPS: [keyof Transfert, string][] = [
  ["nom_client", "Client"],
  ["telephone_client", "Tél. client"],
  ["nom_beneficiaire", "Bénéficiaire"],
  ["telephone_beneficiaire", "Tél. bénéficiaire"],
  ["devise_source", "Devise reçue"],
  ["devise_cible", "Devise remise"],
  ["montant_envoye", "Montant reçu"],
  ["frais_pct", "Frais %"],
  ["montant_recu", "Montant remis"],
  ["benefice", "Bénéfice"],
  ["note", "Note"],
  ["statut", "Statut"],
];

const ACTIONS = {
  MODIFICATION: "Correction",
  ANNULATION: "Suppression",
  RETABLISSEMENT: "Rétablissement",
};

function Ligne({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-t border-gray-100 py-2 first:border-0">
      <dt className="text-gray-500">{label}</dt>
      <dd className="min-w-0 text-right font-bold break-words text-gray-800">{children}</dd>
    </div>
  );
}

export default async function DetailTransfert({ params }: PageProps<"/transferts/[id]">) {
  const profil = await exigerProfil();
  const patron = profil.role === "PATRON";
  const { id } = await params;
  const t = await lireTransfert(id);
  if (!t) notFound();

  const { parametres, decimales } = await lireReglages();
  const { noms } = await lireNoms();
  const { modifiable, explication } = await lireDroits(profil, parametres.fuseau);
  const base = parametres.devise_base;
  const src = (v: number) => montant(v, t.devise_source, decimales[t.devise_source]);

  let journal: JournalEntree[] = [];
  if (patron) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("transferts_journal")
      .select("*")
      .eq("transfert_id", t.id)
      .order("id", { ascending: false })
      .overrideTypes<JournalEntree[], { merge: false }>();
    journal = data ?? [];
  }

  return (
    <>
      <EnTete
        titre={`Transfert n° ${t.id}`}
        sous={dateLongue(t.jour)}
        retour="/transferts"
        actions={t.statut === "ANNULE" && <Badge ton="rouge">Supprimé</Badge>}
      />
      <div className="space-y-4 p-4 text-sm">
        <div className="carte text-center">
          <div className="text-xs text-gray-500">À remettre</div>
          <div className="text-3xl font-black text-emerald-700">
            {montant(t.montant_recu, t.devise_cible, decimales[t.devise_cible])}
          </div>
          <div className="mt-1 text-xs font-medium text-gray-500">
            Reçu du client : <b className="text-gray-800">{src(t.montant_envoye)}</b>
          </div>
        </div>

        <dl className="carte py-1.5">
          <Ligne label="Client">{t.nom_client}</Ligne>
          <Ligne label="Téléphone">{t.telephone_client || "-"}</Ligne>
          {t.nom_beneficiaire && <Ligne label="Bénéficiaire">{t.nom_beneficiaire}</Ligne>}
          {t.telephone_beneficiaire && <Ligne label="Tél. bénéficiaire">{t.telephone_beneficiaire}</Ligne>}
          <Ligne label="Taux">{libelleTaux({ ...t, taux: t.taux_client })}</Ligne>
          <Ligne label={`Frais (${pourcent(t.frais_pct)})`}>{src(t.frais)}</Ligne>
          <Ligne label="Enregistré par">{noms[t.employe_id]}</Ligne>
          <Ligne label="Le">{horodatage(t.cree_le, parametres.fuseau)}</Ligne>
          {t.note && <Ligne label="Note">{t.note}</Ligne>}
        </dl>

        {/* Le bénéfice ne figure pas sur le reçu imprimé remis au client. */}
        <dl className="no-print carte border-amber-200 bg-amber-50 py-1.5">
          {patron && (
            <>
              <Ligne label="Frais">{src(t.frais)}</Ligne>
              <Ligne label="Marge sur taux">{src(t.marge_taux)}</Ligne>
            </>
          )}
          <Ligne label={`Bénéfice (zone ${nomZone(t.zone)})`}>
            {montant(t.benefice_zone, t.zone, decimales[t.zone])}
          </Ligne>
          {patron && (
            <Ligne label={`Bénéfice en ${base}`}>{montant(t.benefice_base, base, decimales[base])}</Ligne>
          )}
        </dl>

        <ActionsTransfert
          id={t.id}
          statut={t.statut}
          patron={patron}
          modifiable={modifiable(t)}
          resume={`${t.nom_client} · ${src(t.montant_envoye)}`}
        />
        {explication(t) && <p className="no-print text-center text-[11px] text-gray-500">{explication(t)}</p>}

        {journal.length > 0 && (
          <div className="no-print">
            <Section titre="Historique des corrections">
              <ol className="carte space-y-3 text-xs">
                {journal.map((j) => (
                  <li key={j.id}>
                    <div className="font-bold text-gray-800">
                      {ACTIONS[j.action]} par {noms[j.auteur_id] ?? "?"}
                    </div>
                    <div className="text-[11px] text-gray-500">
                      {horodatage(j.le, parametres.fuseau)} · Motif : {j.motif}
                    </div>
                    <ul className="mt-1 list-disc pl-4 text-gray-700">
                      {CHAMPS.filter(([c]) => j.avant[c] !== j.apres[c]).map(([c, label]) => (
                        <li key={c}>
                          {label} : <s className="text-gray-400">{String(j.avant[c] || "vide")}</s> →{" "}
                          {String(j.apres[c] || "vide")}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
            </Section>
          </div>
        )}
      </div>
      {!patron && <BoutonNouveau />}
    </>
  );
}
