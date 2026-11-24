import { numeroRecu } from "@/lib/recu";
import { nomZone } from "@/lib/zones";
import { dateCourte, dateLongue, heure, horodatage, montant, nombre } from "@/lib/format";
import type { DonneesReleve, SectionReleve } from "@/lib/releve";
import type { Parametres, Profil, Transfert } from "@/lib/types";

interface Entree {
  employe: Profil;
  // Dans l'ordre chronologique, annulés compris.
  transferts: Transfert[];
  // Bénéfice cumulé par zone avant la période.
  avant: Record<string, number>;
  debut: string;
  fin: string;
  // false si on demande tout l'historique : il n'y a pas d'"avant".
  bornee: boolean;
  parametres: Parametres;
  decimales: Record<string, number>;
  maintenant: string;
}

export function construireReleve(e: Entree): DonneesReleve {
  const { parametres: p, decimales } = e;
  const f = (v: number, d: string) => montant(v, d, decimales[d]);
  const arrondi = (v: number, d: string) => Number(v.toFixed(decimales[d] ?? 2));
  const valides = e.transferts.filter((t) => t.statut === "VALIDE");

  const sections: SectionReleve[] = [];
  for (const zone of [...new Set(e.transferts.map((t) => t.zone))].sort()) {
    const lignes = e.transferts.filter((t) => t.zone === zone);
    const ouverture = e.avant[zone] ?? 0;
    let cumul = ouverture;
    const jours: SectionReleve["jours"] = [];
    for (const jour of [...new Set(lignes.map((t) => t.jour))]) {
      const duJour = lignes.filter((t) => t.jour === jour);
      const ok = duJour.filter((t) => t.statut === "VALIDE");
      jours.push({
        jour: dateLongue(jour),
        nb: `${ok.length} opération${ok.length > 1 ? "s" : ""}`,
        total: nombre(ok.reduce((s, t) => s + t.benefice_zone, 0), decimales[zone]),
        operations: duJour.map((t) => {
          if (t.statut === "VALIDE") cumul = arrondi(cumul + t.benefice_zone, zone);
          return {
            id: t.id,
            heure: heure(t.cree_le, p.fuseau),
            numero: numeroRecu(t.id, t.jour),
            client: t.nom_client,
            beneficiaire: t.nom_beneficiaire,
            recu: f(t.montant_envoye, t.devise_source),
            remis: f(t.montant_recu, t.devise_cible),
            benefice: nombre(t.benefice_zone, decimales[zone]),
            cumul: nombre(cumul, decimales[zone]),
            annule: t.statut === "ANNULE",
          };
        }),
      });
    }
    sections.push({
      zone: nomZone(zone),
      ouverture: f(ouverture, zone),
      total: f(arrondi(cumul - ouverture, zone), zone),
      cloture: f(cumul, zone),
      jours,
    });
  }

  const caisse = new Map<string, { e: number; s: number }>();
  const ligne = (d: string) => caisse.get(d) ?? caisse.set(d, { e: 0, s: 0 }).get(d)!;
  for (const t of valides) {
    ligne(t.devise_source).e += t.montant_envoye;
    ligne(t.devise_cible).s += t.montant_recu;
  }

  const base = p.devise_base;
  const annules = e.transferts.length - valides.length;
  const resume: DonneesReleve["resume"] = [["Opérations", String(valides.length)]];
  if (annules > 0) resume.push(["Supprimées", String(annules)]);
  for (const s of sections) resume.push([`Bénéfice ${s.zone}`, s.total]);
  resume.push([`Bénéfice en ${base}`, f(valides.reduce((x, t) => x + t.benefice_base, 0), base)]);

  return {
    entreprise: p.entreprise_nom || "TransfertPro",
    coordonnees: [p.entreprise_adresse, p.entreprise_telephone].filter(Boolean).join(" · "),
    employe: e.employe.nom,
    identifiant: e.employe.identifiant,
    numero: `REL-${e.debut.replaceAll("-", "")}-${e.fin.replaceAll("-", "")}-${e.employe.identifiant}`,
    periode: e.bornee
      ? e.debut === e.fin
        ? dateCourte(e.debut)
        : `${dateCourte(e.debut)} au ${dateCourte(e.fin)}`
      : `Tout, au ${dateCourte(e.fin)}`,
    edite: horodatage(e.maintenant, p.fuseau),
    resume,
    caisse: [...caisse].map(([d, c]) => ({
      devise: d,
      rentrees: nombre(c.e, decimales[d]),
      sorties: nombre(c.s, decimales[d]),
      solde: `${c.e - c.s > 0 ? "+" : ""}${nombre(c.e - c.s, decimales[d])}`,
    })),
    sections,
  };
}
