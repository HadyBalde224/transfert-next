// Tout ce qui figure sur un reçu, déjà mis en forme. Le bénéfice, la marge et
// le taux réel n'y entrent jamais : ce document est remis au client.
export interface DonneesRecu {
  entreprise: string;
  telephone: string;
  adresse: string;
  message: string;
  numero: string;
  code: string;
  date: string;
  agent: string;
  aRemettre: string;
  enLettres: string;
  expediteur: string[];
  beneficiaire: string[];
  lignes: [string, string][];
  mention: string;
  annule: boolean;
}

// n° 138 du 24/11/2026 -> "R-2026-000138"
export function numeroRecu(id: number, jour: string) {
  return `R-${jour.slice(0, 4)}-${String(id).padStart(6, "0")}`;
}

// --- Dessin ----------------------------------------------------------------
// Une seule source pour l'écran, l'impression, l'image et le PDF : ce qui est
// vu est exactement ce qui est remis. Le canevas accepte tous les alphabets.
const L = 720;
const M = 44;
const POLICE = "Arial, Helvetica, sans-serif";

export function dessinerRecu(d: DonneesRecu, echelle = 2): HTMLCanvasElement {
  // Premier passage à blanc pour connaître la hauteur.
  const brouillon = document.createElement("canvas").getContext("2d")!;
  const hauteur = tracer(brouillon, d, 0);
  const canvas = document.createElement("canvas");
  canvas.width = L * echelle;
  canvas.height = hauteur * echelle;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(echelle, echelle);
  tracer(ctx, d, hauteur);
  return canvas;
}

function decouper(ctx: CanvasRenderingContext2D, texte: string, max: number): string[] {
  const lignes: string[] = [];
  let courante = "";
  for (const mot of texte.split(/\s+/).filter(Boolean)) {
    const essai = courante ? `${courante} ${mot}` : mot;
    if (ctx.measureText(essai).width <= max) {
      courante = essai;
      continue;
    }
    if (courante) lignes.push(courante);
    courante = mot;
    // Un mot plus large que la ligne est coupé.
    while (ctx.measureText(courante).width > max) {
      let n = courante.length - 1;
      while (n > 1 && ctx.measureText(courante.slice(0, n)).width > max) n -= 1;
      lignes.push(courante.slice(0, n));
      courante = courante.slice(n);
    }
  }
  if (courante) lignes.push(courante);
  return lignes;
}

function tracer(ctx: CanvasRenderingContext2D, d: DonneesRecu, hauteur: number): number {
  let y = 0;
  const police = (taille: number, gras = false) => {
    ctx.font = `${gras ? "bold " : ""}${taille}px ${POLICE}`;
  };
  const texte = (
    t: string,
    x: number,
    taille: number,
    o: { gras?: boolean; couleur?: string; align?: CanvasTextAlign; max?: number; interligne?: number } = {}
  ) => {
    police(taille, o.gras);
    ctx.fillStyle = o.couleur ?? "#1f2937";
    ctx.textAlign = o.align ?? "left";
    for (const l of decouper(ctx, t, o.max ?? L - 2 * M)) {
      y += o.interligne ?? taille * 1.3;
      ctx.fillText(l, x, y);
    }
  };
  const trait = (avant = 18, apres = 8) => {
    y += avant;
    ctx.strokeStyle = "#d1d5db";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.moveTo(M, y);
    ctx.lineTo(L - M, y);
    ctx.stroke();
    ctx.setLineDash([]);
    y += apres;
  };
  const paire = (label: string, valeur: string, gras = false) => {
    const depart = y;
    police(21);
    const largeurLabel = Math.min(ctx.measureText(label).width, 270);
    texte(label, M, 21, { couleur: "#6b7280", max: 270, interligne: 31 });
    const finLabel = y;
    y = depart;
    texte(valeur, L - M, 21, {
      gras: true,
      couleur: gras ? "#047857" : "#111827",
      align: "right",
      max: L - 2 * M - largeurLabel - 20,
      interligne: 31,
    });
    y = Math.max(y, finLabel) + 5;
  };

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, L, hauteur);

  // En-tête de l'entreprise : sa hauteur dépend du texte.
  const enTete = (peindre: boolean) => {
    y = 18;
    const c = peindre ? "#ffffff" : "rgba(0,0,0,0)";
    texte(d.entreprise.toUpperCase(), L / 2, 34, { gras: true, couleur: c, align: "center" });
    const pied = [d.adresse, d.telephone].filter(Boolean);
    for (const p of pied) {
      texte(p, L / 2, 19, { couleur: peindre ? "#dbeafe" : c, align: "center", interligne: 27 });
    }
    y += 26;
  };
  enTete(false);
  const fond = ctx.createLinearGradient(0, 0, L, y);
  fond.addColorStop(0, "#1d4ed8");
  fond.addColorStop(1, "#1e3a8a");
  ctx.fillStyle = fond;
  ctx.fillRect(0, 0, L, y);
  enTete(true);

  y += 14;
  texte("REÇU DE TRANSFERT", L / 2, 25, { gras: true, align: "center" });
  texte(`N° ${d.numero}`, L / 2, 22, { gras: true, couleur: "#1d4ed8", align: "center", interligne: 31 });
  texte(d.date, L / 2, 19, { couleur: "#6b7280", align: "center", interligne: 27 });

  // Somme à remettre
  y += 22;
  const haut = y;
  const boite = (peindre: boolean) => {
    y = haut + 8;
    const c = (v: string) => (peindre ? v : "rgba(0,0,0,0)");
    texte("SOMME À REMETTRE", L / 2, 18, { gras: true, couleur: c("#047857"), align: "center", interligne: 27 });
    texte(d.aRemettre, L / 2, 46, { gras: true, couleur: c("#065f46"), align: "center" });
    if (d.enLettres) {
      y += 4;
      texte(d.enLettres, L / 2, 18, { couleur: c("#047857"), align: "center", max: L - 2 * M - 50, interligne: 25 });
    }
    y += 20;
  };
  boite(false);
  ctx.fillStyle = "#ecfdf5";
  ctx.strokeStyle = "#a7f3d0";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(M, haut, L - 2 * M, y - haut, 16);
  ctx.fill();
  ctx.stroke();
  boite(true);

  // Expéditeur et bénéficiaire, côte à côte
  y += 14;
  const debut = y;
  const colonne = (titre: string, lignes: string[], x: number) => {
    y = debut;
    texte(titre, x, 17, { gras: true, couleur: "#6b7280", interligne: 26 });
    for (const l of lignes) {
      texte(l, x, 22, { gras: l === lignes[0], max: (L - 2 * M) / 2 - 20, interligne: 30 });
    }
    return y;
  };
  const g = colonne("EXPÉDITEUR", d.expediteur, M);
  const dr = colonne("BÉNÉFICIAIRE", d.beneficiaire, L / 2 + 10);
  y = Math.max(g, dr);

  trait();
  d.lignes.forEach(([label, valeur], i) => paire(label, valeur, i === d.lignes.length - 1));
  trait(12, 8);
  paire("Agent", d.agent);
  if (d.mention) {
    texte(d.mention, M, 18, { couleur: "#b45309", interligne: 27 });
  }

  // Code de contrôle
  y += 18;
  const hc = y;
  ctx.fillStyle = "#f3f4f6";
  ctx.beginPath();
  ctx.roundRect(M, hc, L - 2 * M, 84, 14);
  ctx.fill();
  texte("CODE DE CONTRÔLE", L / 2, 16, { gras: true, couleur: "#6b7280", align: "center", interligne: 30 });
  texte(d.code, L / 2, 30, { gras: true, align: "center", interligne: 38 });
  y = hc + 84;

  // Signatures
  y += 34;
  police(18);
  for (const [t, x] of [["Signature du client", M], ["Signature de l'agent", L / 2 + 20]] as const) {
    ctx.textAlign = "left";
    ctx.fillStyle = "#6b7280";
    ctx.fillText(t, x, y);
    ctx.strokeStyle = "#9ca3af";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y + 78);
    ctx.lineTo(x + (L - 2 * M) / 2 - 24, y + 78);
    ctx.stroke();
  }
  y += 92;

  if (d.message) texte(d.message, L / 2, 19, { couleur: "#4b5563", align: "center", interligne: 28 });
  texte("Conservez ce reçu : il est demandé en cas de réclamation.", L / 2, 16, {
    couleur: "#9ca3af",
    align: "center",
    interligne: 26,
  });
  y += 30;

  if (d.annule) {
    ctx.save();
    ctx.translate(L / 2, (hauteur || y) / 2);
    ctx.rotate(-Math.PI / 6);
    police(130, true);
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(220, 38, 38, 0.28)";
    ctx.fillText("ANNULÉ", 0, 45);
    ctx.restore();
  }
  return Math.ceil(y);
}

// --- PDF -------------------------------------------------------------------
export interface PageJpeg {
  octets: Uint8Array;
  largeur: number;
  hauteur: number;
}

export async function canvasEnJpeg(c: HTMLCanvasElement, qualite = 0.92): Promise<PageJpeg> {
  const { width: largeur, height: hauteur } = c;
  const blob = await new Promise<Blob>((ok, ko) =>
    c.toBlob((b) => (b ? ok(b) : ko(new Error("image"))), "image/jpeg", qualite)
  );
  return { octets: new Uint8Array(await blob.arrayBuffer()), largeur, hauteur };
}

// Un PDF d'une image par page. "largeurPt" : largeur du papier en points
// (297,64 = A6, 595,28 = A4) ; la hauteur suit les proportions de l'image.
export function pdfDepuisJpeg(pages: PageJpeg[], largeurPt: number): Blob {
  const enc = new TextEncoder();
  const morceaux: Uint8Array[] = [];
  const positions: number[] = [];
  let taille = 0;
  const ajouter = (x: string | Uint8Array) => {
    const b = typeof x === "string" ? enc.encode(x) : x;
    morceaux.push(b);
    taille += b.length;
  };
  const objet = (n: number, corps: string, flux?: Uint8Array) => {
    positions[n] = taille;
    ajouter(`${n} 0 obj\n${corps}\n`);
    if (flux) {
      ajouter("stream\n");
      ajouter(flux);
      ajouter("\nendstream\n");
    }
    ajouter("endobj\n");
  };

  ajouter("%PDF-1.4\n");
  objet(1, "<< /Type /Catalog /Pages 2 0 R >>");
  // Trois objets par page : la page, son image, son contenu.
  const num = (i: number) => 3 + i * 3;
  objet(2, `<< /Type /Pages /Kids [${pages.map((_, i) => `${num(i)} 0 R`).join(" ")}] /Count ${pages.length} >>`);
  pages.forEach((p, i) => {
    const n = num(i);
    const h = Math.round(((largeurPt * p.hauteur) / p.largeur) * 100) / 100;
    const contenu = enc.encode(`q ${largeurPt} 0 0 ${h} 0 0 cm /I Do Q`);
    objet(
      n,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${largeurPt} ${h}] /Resources << /XObject << /I ${n + 1} 0 R >> >> /Contents ${n + 2} 0 R >>`
    );
    objet(
      n + 1,
      `<< /Type /XObject /Subtype /Image /Width ${p.largeur} /Height ${p.hauteur} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.octets.length} >>`,
      p.octets
    );
    objet(n + 2, `<< /Length ${contenu.length} >>`, contenu);
  });
  const total = 3 + pages.length * 3;
  const xref = taille;
  ajouter(
    `xref\n0 ${total}\n0000000000 65535 f \n${positions
      .slice(1)
      .map((p) => `${String(p).padStart(10, "0")} 00000 n \n`)
      .join("")}trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  );
  return new Blob(morceaux as BlobPart[], { type: "application/pdf" });
}
