import type { Devise } from "@/lib/types";

// Devises que l'admin peut ajouter depuis le menu déroulant.
// "forte" : plus facile à lire dans l'autre sens ("1 EUR = 10,80 MAD").
export const CATALOGUE: Record<string, { nom: string; decimales: number; forte: boolean }> = {
  GNF: { nom: "Franc guinéen", decimales: 0, forte: false },
  XOF: { nom: "Franc CFA (Afrique de l'Ouest)", decimales: 0, forte: false },
  XAF: { nom: "Franc CFA (Afrique centrale)", decimales: 0, forte: false },
  EUR: { nom: "Euro", decimales: 2, forte: true },
  USD: { nom: "Dollar américain", decimales: 2, forte: true },
};

// Une zone de travail est une devise autre que la devise mère.
const NOMS: Record<string, string> = { XOF: "CFA (XOF)", XAF: "CFA (XAF)" };

export function nomZone(code: string) {
  return NOMS[code] ?? code;
}

export function zonesPossibles(devises: Devise[], base: string) {
  return devises.filter((d) => d.actif && d.code !== base).map((d) => d.code);
}
