// Périodes de consultation. Une journée commerciale est une date
// "AAAA-MM-JJ" dans le fuseau de l'entreprise (paramètre en base).
export type Vue = "mois" | "jour" | "date";
export const TOUT = "tout";

export interface Periode {
  vue: Vue;
  // "AAAA-MM", ou TOUT pour tout l'historique.
  mois: string;
  debut: string;
  fin: string;
}

export function aujourdhui(fuseau: string) {
  // "en-CA" donne directement AAAA-MM-JJ.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: fuseau,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function ajouterJours(jour: string, n: number) {
  const d = new Date(`${jour}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function jourValide(v: string | undefined): v is string {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

export type Params = Record<string, string | string[] | undefined>;

export function un(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

function finDeMois(mois: string) {
  const [a, m] = mois.split("-").map(Number);
  return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
}

// "proposes" : mois proposés à l'écran. Un autre mois dans l'URL est ignoré.
export function lirePeriode(
  params: Params,
  today: string,
  premier: string,
  proposes: string[],
  defaut: Vue
): Periode {
  const v = un(params.v);
  const m = un(params.m);
  const d = un(params.d);
  const vue = v === "mois" || v === "jour" || v === "date" ? v : defaut;
  const courant = today.slice(0, 7);
  // Par défaut le mois en cours, ou le dernier ajouté s'il ne l'est pas encore.
  const defautMois = proposes.includes(courant) ? courant : (proposes[0] ?? courant);
  const mois = m && (m === TOUT || proposes.includes(m)) ? m : defautMois;

  if (vue === "jour") return { vue, mois, debut: today, fin: today };
  if (vue === "date") {
    const jour = jourValide(d) ? d : today;
    return { vue, mois, debut: jour, fin: jour };
  }
  if (mois === TOUT) return { vue, mois, debut: premier, fin: today };
  return { vue, mois, debut: `${mois}-01`, fin: finDeMois(mois) };
}

// Paramètres d'URL qui redonnent cette période.
export function paramsPeriode(p: Periode): Record<string, string> {
  const r: Record<string, string> = { v: p.vue, m: p.mois };
  if (p.vue === "date") r.d = p.debut;
  return r;
}

export function listeJours(debut: string, fin: string) {
  const jours: string[] = [];
  for (let j = debut; j <= fin; j = ajouterJours(j, 1)) jours.push(j);
  return jours;
}
