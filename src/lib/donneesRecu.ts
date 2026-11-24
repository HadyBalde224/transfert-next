import { numeroRecu, type DonneesRecu } from "@/lib/recu";
import { sommeEnLettres } from "@/lib/lettres";
import { horodatage, libelleTaux, montant, pourcent } from "@/lib/format";
import type { Parametres, Transfert } from "@/lib/types";

// null tant que le script "recus" n'a pas été exécuté.
export function construireRecu(
  t: Transfert,
  parametres: Parametres,
  decimales: Record<string, number>,
  agent: string
): DonneesRecu | null {
  if (!t.code_recu || !parametres.entreprise_nom) return null;
  const f = (v: number, d: string) => montant(v, d, decimales[d]);
  const aRemettre = f(t.montant_recu, t.devise_cible);
  return {
    entreprise: parametres.entreprise_nom,
    telephone: parametres.entreprise_telephone,
    adresse: parametres.entreprise_adresse,
    message: parametres.recu_message,
    numero: numeroRecu(t.id, t.jour),
    code: t.code_recu,
    date: horodatage(t.cree_le, parametres.fuseau),
    agent,
    aRemettre,
    enLettres: sommeEnLettres(t.montant_recu, t.devise_cible),
    expediteur: [t.nom_client, t.telephone_client].filter(Boolean),
    beneficiaire: t.nom_beneficiaire
      ? [t.nom_beneficiaire, t.telephone_beneficiaire].filter(Boolean)
      : ["Non précisé"],
    lignes: [
      ["Montant versé", f(t.montant_envoye, t.devise_source)],
      [`Frais (${pourcent(t.frais_pct)})`, f(t.frais, t.devise_source)],
      ["Montant converti", f(t.montant_envoye - t.frais, t.devise_source)],
      ["Taux appliqué", libelleTaux({ ...t, taux: t.taux_client })],
      ["Somme à remettre", aRemettre],
    ],
    mention:
      t.modifie_le && t.statut === "VALIDE"
        ? `Reçu rectifié le ${horodatage(t.modifie_le, parametres.fuseau)} : il remplace le précédent.`
        : "",
    annule: t.statut === "ANNULE",
  };
}
