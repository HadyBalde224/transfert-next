// Formatage écrit à la main plutôt qu'avec toLocaleString : le rendu est
// ainsi identique sur le serveur et dans le navigateur (pas d'erreur
// d'hydratation selon la version d'ICU).
const ESPACE = " ";

export function nombre(valeur: number, decimalesMax = 2) {
  const arrondi = Number(valeur).toFixed(decimalesMax);
  const [entier, dec = ""] = arrondi.replace("-", "").split(".");
  const negatif = Number(arrondi) < 0;
  const groupe = entier.replace(/\B(?=(\d{3})+(?!\d))/g, ESPACE);
  // 1 234,5 -> 1 234,50 : une somme garde ses décimales usuelles.
  const fin = Number(dec) > 0 ? `,${dec}` : "";
  return `${negatif ? "-" : ""}${groupe}${fin}`;
}

export function montant(valeur: number, code: string, decimales = 2) {
  return `${nombre(valeur, decimales)}${ESPACE}${code}`;
}

export function pourcent(valeur: number) {
  return `${sansZeros(valeur, 3)}${ESPACE}%`;
}

function sansZeros(valeur: number, max: number) {
  return String(Number(Number(valeur).toFixed(max))).replace(".", ",");
}

export function libelleTaux(t: {
  devise_source: string;
  devise_cible: string;
  inverse: boolean;
  taux: number;
}) {
  const v = sansZeros(t.taux, 8);
  return t.inverse
    ? `${v} ${t.devise_source} = 1 ${t.devise_cible}`
    : `1 ${t.devise_source} = ${v} ${t.devise_cible}`;
}

const MOIS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];
const JOURS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];

// "2026-11-24" -> "24/11/2026"
export function dateCourte(jour: string) {
  const [a, m, j] = jour.split("-");
  return `${j}/${m}/${a}`;
}

// "2026-11-24" -> "mar. 24 novembre 2026"
export function dateLongue(jour: string) {
  const [a, m, j] = jour.split("-").map(Number);
  const nomJour = JOURS[new Date(Date.UTC(a, m - 1, j)).getUTCDay()];
  return `${nomJour} ${j} ${MOIS[m - 1]} ${a}`;
}

// "2026-11" -> "novembre 2026"
export function moisLong(mois: string) {
  const [a, m] = mois.split("-").map(Number);
  return `${MOIS[m - 1]} ${a}`;
}

export function heure(iso: string, fuseau: string) {
  return new Intl.DateTimeFormat("fr-FR", { timeZone: fuseau, hour: "2-digit", minute: "2-digit" }).format(
    new Date(iso)
  );
}

export function horodatage(iso: string, fuseau: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: fuseau,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(new Date(iso))
    .replace(/[  ]/g, " ");
}
