import type { NextRequest } from "next/server";
import { exigerProfil, lireNoms, lireMois, lirePremierJour, lireReglages } from "@/lib/session";
import { aujourdhui, lirePeriode } from "@/lib/periode";
import { lireFiltres, lireTransferts } from "@/lib/transferts";
import { horodatage } from "@/lib/format";

const LOT = 1000;

// Un texte commençant par = + - @ serait exécuté comme formule par Excel.
const texte = (v: string) => {
  const s = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return `"${s.replace(/"/g, '""')}"`;
};
const num = (v: number) => String(v).replace(".", ",");

export async function GET(request: NextRequest) {
  const profil = await exigerProfil();
  const { parametres } = await lireReglages();
  const { noms } = await lireNoms();
  const params = Object.fromEntries(request.nextUrl.searchParams);
  const today = aujourdhui(parametres.fuseau);
  const periode = lirePeriode(
    params,
    today,
    await lirePremierJour(today),
    await lireMois(today),
    "mois"
  );
  const filtres = lireFiltres(params);
  if (profil.role !== "PATRON") filtres.statut = "VALIDE";
  const base = parametres.devise_base;

  const lignes = [
    [
      "N°", "Jour", "Saisi le", "Employé", "Statut", "Client", "Tél. client", "Bénéficiaire",
      "Tél. bénéficiaire", "Devise reçue", "Montant reçu", "Devise remise", "Montant remis",
      "Taux client", "Taux réel", "Frais %", "Frais", "Marge taux", "Bénéfice",
      "Zone", "Bénéfice zone", `Bénéfice ${base}`, "Note",
    ].map(texte).join(";"),
  ];
  for (let debut = 0; ; debut += LOT) {
    const { lignes: lot } = await lireTransferts(periode, filtres, debut, LOT);
    for (const t of lot) {
      lignes.push(
        [
          t.id, t.jour, texte(horodatage(t.cree_le, parametres.fuseau)),
          texte(noms[t.employe_id] ?? ""), t.statut === "VALIDE" ? "Validé" : "Supprimé",
          texte(t.nom_client), texte(t.telephone_client), texte(t.nom_beneficiaire),
          texte(t.telephone_beneficiaire), t.devise_source, num(t.montant_envoye), t.devise_cible,
          num(t.montant_recu), num(t.taux_client), num(t.taux_reel), num(t.frais_pct), num(t.frais),
          num(t.marge_taux), num(t.benefice), t.zone, num(t.benefice_zone), num(t.benefice_base),
          texte(t.note),
        ].join(";")
      );
    }
    if (lot.length < LOT) break;
  }

  // BOM : sans lui, Excel affiche mal les accents.
  return new Response(`﻿${lignes.join("\r\n")}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="transferts_${periode.debut}_${periode.fin}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
