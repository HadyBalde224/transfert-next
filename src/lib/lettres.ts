// Nombres en toutes lettres, pour "Arrêté à la somme de…".
const UNITES = [
  "zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix",
  "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf",
];
const DIZAINES = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante"];

// "accord" : vrai si rien ne suit (quatre-vingts, deux cents).
function sous100(n: number, accord: boolean): string {
  if (n < 20) return UNITES[n];
  if (n < 70) {
    const d = DIZAINES[Math.floor(n / 10)];
    const u = n % 10;
    if (u === 0) return d;
    return u === 1 ? `${d} et un` : `${d}-${UNITES[u]}`;
  }
  if (n < 80) return n === 71 ? "soixante et onze" : `soixante-${UNITES[n - 60]}`;
  if (n === 80) return accord ? "quatre-vingts" : "quatre-vingt";
  return `quatre-vingt-${UNITES[n - 80]}`;
}

function sous1000(n: number, accord: boolean): string {
  const c = Math.floor(n / 100);
  const reste = n % 100;
  if (c === 0) return sous100(n, accord);
  const cent = c === 1 ? "cent" : `${UNITES[c]} cent${reste === 0 && accord ? "s" : ""}`;
  return reste === 0 ? cent : `${cent} ${sous100(reste, accord)}`;
}

export function enLettres(n: number): string {
  if (n === 0) return "zéro";
  const parts: string[] = [];
  const milliards = Math.floor(n / 1e9);
  const millions = Math.floor((n % 1e9) / 1e6);
  const milliers = Math.floor((n % 1e6) / 1e3);
  const reste = n % 1e3;
  // "million" et "milliard" sont des noms : l'accord reste devant eux.
  if (milliards) parts.push(`${sous1000(milliards, true)} milliard${milliards > 1 ? "s" : ""}`);
  if (millions) parts.push(`${sous1000(millions, true)} million${millions > 1 ? "s" : ""}`);
  if (milliers) parts.push(milliers === 1 ? "mille" : `${sous1000(milliers, false)} mille`);
  if (reste) parts.push(sous1000(reste, true));
  return parts.join(" ");
}

// [singulier, pluriel, sous-unité]
const NOMS: Record<string, [string, string, string]> = {
  MAD: ["dirham", "dirhams", "centime"],
  GNF: ["franc guinéen", "francs guinéens", "centime"],
  XOF: ["franc CFA", "francs CFA", "centime"],
  XAF: ["franc CFA", "francs CFA", "centime"],
  EUR: ["euro", "euros", "centime"],
  USD: ["dollar", "dollars", "cent"],
};

export function sommeEnLettres(montant: number, code: string): string {
  const centimesTotal = Math.round(montant * 100);
  // Au-delà, les mots n'aident plus personne (et les nombres ne sont plus exacts).
  if (!Number.isSafeInteger(centimesTotal) || montant < 0 || montant >= 1e12) return "";
  const entier = Math.floor(centimesTotal / 100);
  const centimes = centimesTotal % 100;
  const [un, plusieurs, sous] = NOMS[code] ?? [code, code, "centime"];
  // "un million de francs", mais "un million cent francs".
  const de = entier >= 1e6 && entier % 1e6 === 0 ? (/^[aeiou]/i.test(plusieurs) ? "d'" : "de ") : "";
  let texte = `${enLettres(entier)} ${de}${entier >= 2 ? plusieurs : un}`;
  if (centimes) texte += ` et ${enLettres(centimes)} ${sous}${centimes >= 2 ? "s" : ""}`;
  return texte[0].toUpperCase() + texte.slice(1);
}
