// Relevé d'activité d'un employé, façon relevé bancaire : toutes les
// opérations dans l'ordre, jour par jour, avec le cumul et les totaux.
// Tout est déjà mis en forme : ce fichier ne fait que dessiner les pages A4.

export interface OperationReleve {
  id: number;
  heure: string;
  numero: string;
  client: string;
  beneficiaire: string;
  recu: string;
  remis: string;
  benefice: string;
  cumul: string;
  annule: boolean;
}

export interface JourReleve {
  jour: string;
  nb: string;
  total: string;
  operations: OperationReleve[];
}

export interface SectionReleve {
  zone: string;
  ouverture: string;
  cloture: string;
  total: string;
  jours: JourReleve[];
}

export interface DonneesReleve {
  entreprise: string;
  coordonnees: string;
  employe: string;
  identifiant: string;
  numero: string;
  periode: string;
  edite: string;
  resume: [string, string][];
  caisse: { devise: string; rentrees: string; sorties: string; solde: string }[];
  sections: SectionReleve[];
}

const L = 794;
const H = 1123;
const M = 42;
const PIED = 46;
const POLICE = "Arial, Helvetica, sans-serif";
// x de fin (droite) des colonnes chiffrées
const COL = { heure: M + 8, numero: M + 52, client: M + 152, recu: 466, remis: 572, benefice: 664, cumul: L - M - 8 };

interface Bloc {
  h: number;
  // À ne pas laisser seul en bas de page.
  avecSuivant?: boolean;
  // En-tête de colonnes à répéter en haut de la page suivante.
  entete?: Bloc;
  dessiner: (ctx: CanvasRenderingContext2D, y: number) => void;
}

interface Style {
  gras?: boolean;
  couleur?: string;
  droite?: boolean;
  max?: number;
  barre?: boolean;
}

function ecrire(ctx: CanvasRenderingContext2D, t: string, x: number, y: number, taille: number, s: Style = {}) {
  ctx.font = `${s.gras ? "bold " : ""}${taille}px ${POLICE}`;
  ctx.fillStyle = s.couleur ?? "#111827";
  ctx.textAlign = s.droite ? "right" : "left";
  let texte = t;
  if (s.max && ctx.measureText(texte).width > s.max) {
    while (texte.length > 1 && ctx.measureText(`${texte}…`).width > s.max) texte = texte.slice(0, -1);
    texte = `${texte.trimEnd()}…`;
  }
  ctx.fillText(texte, x, y);
  if (s.barre) {
    const l = ctx.measureText(texte).width;
    ctx.fillRect(s.droite ? x - l : x, y - taille * 0.33, l, 1);
  }
}

function enTeteColonnes(): Bloc {
  return {
    h: 28,
    avecSuivant: true,
    dessiner: (ctx, y) => {
      ctx.fillStyle = "#1e3a8a";
      ctx.fillRect(M, y, L - 2 * M, 24);
      const c = (t: string, x: number, droite = false) =>
        ecrire(ctx, t, x, y + 16, 10.5, { gras: true, couleur: "#ffffff", droite });
      c("Heure", COL.heure);
      c("N° de reçu", COL.numero);
      c("Client / bénéficiaire", COL.client);
      c("Reçu", COL.recu, true);
      c("Remis", COL.remis, true);
      // La zone est dans le titre au-dessus : un libellé long déborderait ici.
      c("Bénéfice", COL.benefice, true);
      c("Cumul", COL.cumul, true);
    },
  };
}

function blocsDe(d: DonneesReleve): Bloc[] {
  const blocs: Bloc[] = [];

  // Titre et identité
  blocs.push({
    h: 104,
    dessiner: (ctx, y) => {
      ecrire(ctx, "RELEVÉ D'ACTIVITÉ", M, y + 26, 22, { gras: true, couleur: "#1e3a8a" });
      ecrire(ctx, `N° ${d.numero}`, M, y + 46, 11.5, { couleur: "#4b5563" });
      ecrire(ctx, `Édité le ${d.edite}`, M, y + 62, 11.5, { couleur: "#4b5563" });
      ctx.fillStyle = "#f3f4f6";
      ctx.beginPath();
      ctx.roundRect(L / 2 - 20, y + 4, L / 2 - M + 20, 82, 10);
      ctx.fill();
      const x = L / 2 - 4;
      const max = L - M - 12 - x;
      ecrire(ctx, "Employé", x, y + 24, 10.5, { couleur: "#6b7280" });
      ecrire(ctx, d.employe, x, y + 42, 15, { gras: true, max });
      ecrire(ctx, `Identifiant : ${d.identifiant}`, x, y + 58, 11.5, { couleur: "#4b5563", max });
      ecrire(ctx, `Période : ${d.periode}`, x, y + 75, 11.5, { gras: true, max });
    },
  });

  // Résumé en tuiles
  const largeur = (L - 2 * M - 8 * (d.resume.length - 1)) / d.resume.length;
  blocs.push({
    h: 70,
    dessiner: (ctx, y) => {
      d.resume.forEach(([label, valeur], i) => {
        const x = M + i * (largeur + 8);
        ctx.fillStyle = "#eff6ff";
        ctx.beginPath();
        ctx.roundRect(x, y, largeur, 54, 8);
        ctx.fill();
        ecrire(ctx, label, x + 10, y + 19, 10.5, { couleur: "#4b5563", max: largeur - 16 });
        ecrire(ctx, valeur, x + 10, y + 41, 15, { gras: true, couleur: "#1e3a8a", max: largeur - 16 });
      });
    },
  });

  // Rentrées et sorties par devise
  if (d.caisse.length > 0) {
    blocs.push({
      h: 26,
      avecSuivant: true,
      dessiner: (ctx, y) => {
        ecrire(ctx, "RENTRÉES ET SORTIES", M, y + 14, 11, { gras: true, couleur: "#6b7280" });
        const c = (t: string, x: number) => ecrire(ctx, t, x, y + 14, 10.5, { gras: true, couleur: "#6b7280", droite: true });
        c("Rentrées", 420);
        c("Sorties", 580);
        c("Solde", COL.cumul);
      },
    });
    for (const k of d.caisse) {
      blocs.push({
        h: 22,
        dessiner: (ctx, y) => {
          ctx.fillStyle = "#e5e7eb";
          ctx.fillRect(M, y - 4, L - 2 * M, 1);
          ecrire(ctx, k.devise, M + 8, y + 12, 12, { gras: true });
          ecrire(ctx, k.rentrees, 420, y + 12, 12, { couleur: "#047857", droite: true });
          ecrire(ctx, k.sorties, 580, y + 12, 12, { couleur: "#b91c1c", droite: true });
          ecrire(ctx, k.solde, COL.cumul, y + 12, 12, { gras: true, droite: true });
        },
      });
    }
    blocs.push({ h: 14, dessiner: () => {} });
  }

  if (d.sections.length === 0) {
    blocs.push({
      h: 60,
      dessiner: (ctx, y) => ecrire(ctx, "Aucune opération sur cette période.", M, y + 30, 13, { couleur: "#6b7280" }),
    });
  }

  for (const s of d.sections) {
    const entete = enTeteColonnes();
    const bandeau = (gauche: string, droite: string): Bloc["dessiner"] => (ctx, y) => {
      ctx.fillStyle = "#ecfdf5";
      ctx.fillRect(M, y, L - 2 * M, 24);
      ecrire(ctx, gauche, M + 8, y + 16, 11.5, { gras: true, couleur: "#065f46" });
      ecrire(ctx, droite, COL.cumul, y + 16, 12, { gras: true, couleur: "#065f46", droite: true });
    };
    blocs.push({
      h: 26,
      avecSuivant: true,
      dessiner: (ctx, y) => ecrire(ctx, `ZONE ${s.zone.toUpperCase()}`, M, y + 16, 13, { gras: true, couleur: "#1e3a8a" }),
    });
    blocs.push(entete);
    blocs.push({ h: 28, avecSuivant: true, entete, dessiner: bandeau("Bénéfice cumulé avant la période", s.ouverture) });

    for (const j of s.jours) {
      blocs.push({
        h: 24,
        avecSuivant: true,
        entete,
        dessiner: (ctx, y) => {
          ctx.fillStyle = "#f3f4f6";
          ctx.fillRect(M, y, L - 2 * M, 20);
          ecrire(ctx, `${j.jour}  ·  ${j.nb}`, M + 8, y + 14, 11, { gras: true, couleur: "#374151" });
          ecrire(ctx, j.total, COL.benefice, y + 14, 11, { gras: true, couleur: "#374151", droite: true });
        },
      });
      for (const o of j.operations) {
        blocs.push({
          h: o.beneficiaire ? 34 : 24,
          entete,
          dessiner: (ctx, y) => {
            const gris = o.annule ? "#9ca3af" : undefined;
            ecrire(ctx, o.heure, COL.heure, y + 14, 11, { couleur: "#6b7280" });
            ecrire(ctx, o.numero, COL.numero, y + 14, 11, { couleur: gris ?? "#4b5563" });
            const max = COL.recu - 88 - COL.client;
            ecrire(ctx, o.client, COL.client, y + 14, 11, { gras: true, couleur: gris, max });
            if (o.beneficiaire) {
              ecrire(ctx, `→ ${o.beneficiaire}`, COL.client, y + 27, 10, { couleur: "#6b7280", max });
            }
            const n = { couleur: gris, droite: true, barre: o.annule };
            ecrire(ctx, o.recu, COL.recu, y + 14, 11, n);
            ecrire(ctx, o.remis, COL.remis, y + 14, 11, n);
            ecrire(ctx, o.annule ? "SUPPRIMÉ" : o.benefice, COL.benefice, y + 14, 11, {
              droite: true,
              gras: true,
              couleur: o.annule ? "#b91c1c" : "#92400e",
            });
            ecrire(ctx, o.cumul, COL.cumul, y + 14, 11, { droite: true, couleur: "#4b5563" });
            ctx.fillStyle = "#f3f4f6";
            ctx.fillRect(M, y + (o.beneficiaire ? 32 : 22), L - 2 * M, 1);
          },
        });
      }
    }
    blocs.push({ h: 30, entete, dessiner: bandeau(`Total de la période : ${s.total}`, `Cumul final : ${s.cloture}`) });
    blocs.push({ h: 12, dessiner: () => {} });
  }

  // Signatures
  blocs.push({
    h: 110,
    dessiner: (ctx, y) => {
      for (const [t, x] of [["Signature de l'employé", M], ["Signature du responsable", L / 2 + 20]] as const) {
        ecrire(ctx, t, x, y + 26, 11.5, { couleur: "#6b7280" });
        ctx.fillStyle = "#9ca3af";
        ctx.fillRect(x, y + 92, L / 2 - M - 40, 1);
      }
    },
  });
  return blocs;
}

// Répartit les blocs en pages ; l'en-tête de colonnes se répète.
export function paginer<T extends { h: number; avecSuivant?: boolean; entete?: T }>(
  blocs: T[],
  disponible: number
): T[][] {
  const pages: T[][] = [[]];
  let reste = disponible;
  blocs.forEach((b, i) => {
    // Les blocs "avecSuivant" restent collés à ce qui les suit.
    let besoin = b.h;
    for (let k = i; blocs[k]?.avecSuivant && blocs[k + 1]; k++) besoin += blocs[k + 1].h;
    if (besoin > reste && pages[pages.length - 1].length > 0) {
      const page: T[] = [];
      reste = disponible;
      if (b.entete) {
        page.push(b.entete);
        reste -= b.entete.h;
      }
      pages.push(page);
    }
    pages[pages.length - 1].push(b);
    reste -= b.h;
  });
  return pages;
}

const HAUT = 92;

// Dessine les pages une par une (une seule en mémoire à la fois).
export async function dessinerReleve(
  d: DonneesReleve,
  pour: (page: HTMLCanvasElement) => Promise<void>,
  echelle = 2
) {
  const pages = paginer(blocsDe(d), H - HAUT - PIED);
  for (let n = 0; n < pages.length; n++) {
    const canvas = document.createElement("canvas");
    canvas.width = L * echelle;
    canvas.height = H * echelle;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(echelle, echelle);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, L, H);

    const fond = ctx.createLinearGradient(0, 0, L, 0);
    fond.addColorStop(0, "#1d4ed8");
    fond.addColorStop(1, "#1e3a8a");
    ctx.fillStyle = fond;
    ctx.fillRect(0, 0, L, 72);
    ecrire(ctx, d.entreprise.toUpperCase(), M, d.coordonnees ? 34 : 44, 20, {
      gras: true,
      couleur: "#ffffff",
      max: L - 2 * M - 150,
    });
    if (d.coordonnees) ecrire(ctx, d.coordonnees, M, 54, 11, { couleur: "#dbeafe", max: L - 2 * M - 150 });
    ecrire(ctx, d.employe, L - M, 34, 12, { gras: true, couleur: "#ffffff", droite: true, max: 140 });
    ecrire(ctx, d.periode, L - M, 52, 10.5, { couleur: "#dbeafe", droite: true });

    let y = HAUT;
    for (const b of pages[n]) {
      b.dessiner(ctx, y);
      y += b.h;
    }

    ctx.fillStyle = "#e5e7eb";
    ctx.fillRect(M, H - PIED + 6, L - 2 * M, 1);
    ecrire(ctx, `Relevé ${d.numero} · document interne`, M, H - 20, 10, { couleur: "#6b7280" });
    ecrire(ctx, `Page ${n + 1} / ${pages.length}`, L - M, H - 20, 10, { couleur: "#6b7280", droite: true });
    await pour(canvas);
    // Libère la mémoire (Safari iOS est limité).
    canvas.width = 0;
    canvas.height = 0;
  }
}
