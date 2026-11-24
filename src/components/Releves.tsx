"use client";

import { useState } from "react";
import { FileText, Receipt, Share2 } from "lucide-react";
import { canvasEnJpeg, dessinerRecu, pdfDepuisJpeg, type DonneesRecu, type PageJpeg } from "@/lib/recu";
import { dessinerReleve, type DonneesReleve } from "@/lib/releve";
import { useToast } from "@/components/Toast";

type Action = "releve" | "recus" | "partage";

const A4 = 595.28;
const A6 = 297.64;

export function TelechargerReleves({
  releves,
  recus,
  nom,
}: {
  releves: DonneesReleve[];
  // null : trop nombreux, ou reçus pas encore activés.
  recus: DonneesRecu[] | null;
  nom: string;
}) {
  const { addToast } = useToast();
  const [enCours, setEnCours] = useState<Action | null>(null);
  const [avancement, setAvancement] = useState("");
  const [pret, setPret] = useState<File | null>(null);

  const pdfReleve = async () => {
    const pages: PageJpeg[] = [];
    for (const d of releves) {
      await dessinerReleve(d, async (c) => {
        pages.push(await canvasEnJpeg(c, 0.88));
        setAvancement(`page ${pages.length}`);
      });
    }
    return new File([pdfDepuisJpeg(pages, A4)], `releve_${nom}.pdf`, { type: "application/pdf" });
  };

  const pdfRecus = async () => {
    const pages: PageJpeg[] = [];
    for (const d of recus ?? []) {
      const c = dessinerRecu(d, 1.5);
      pages.push(await canvasEnJpeg(c, 0.85));
      c.width = 0;
      c.height = 0;
      setAvancement(`${pages.length} / ${recus!.length}`);
    }
    return new File([pdfDepuisJpeg(pages, A6)], `recus_${nom}.pdf`, { type: "application/pdf" });
  };

  const telecharger = (f: File) => {
    const url = URL.createObjectURL(f);
    const a = document.createElement("a");
    a.href = url;
    a.download = f.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  const lancer = async (action: Action) => {
    if (enCours) return;
    setEnCours(action);
    setAvancement("");
    try {
      if (action === "recus") {
        telecharger(await pdfRecus());
      } else if (action === "releve") {
        telecharger(await pdfReleve());
      } else {
        setPret(await pdfReleve());
      }
    } catch {
      addToast("Le document n'a pas pu être généré. Essayez une période plus courte.", "error");
    } finally {
      setEnCours(null);
      setAvancement("");
    }
  };

  // Le partage doit partir d'un clic : il se fait donc en deux temps.
  const partager = async () => {
    if (!pret) return lancer("partage");
    const contenu = { files: [pret], title: pret.name };
    if (!navigator.canShare?.(contenu)) {
      telecharger(pret);
      addToast("Partage impossible sur cet appareil : le PDF est téléchargé.", "info");
      return;
    }
    try {
      await navigator.share(contenu);
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) addToast("Le partage a échoué.", "error");
    }
  };

  const libelle = (a: Action, repos: string) => (enCours === a ? `Préparation ${avancement}…` : repos);

  return (
    <div className="space-y-2">
      <button
        className="btn-primaire w-full py-3 text-sm"
        disabled={enCours !== null}
        onClick={() => lancer("releve")}
      >
        <FileText size={16} /> {libelle("releve", "Télécharger le relevé global (PDF)")}
      </button>
      <div className="grid grid-cols-2 gap-2">
        <button
          className="btn-secondaire"
          disabled={enCours !== null || !recus || recus.length === 0}
          onClick={() => lancer("recus")}
        >
          <Receipt size={15} /> {libelle("recus", recus ? `Tous les reçus (${recus.length})` : "Tous les reçus")}
        </button>
        <button className="btn-secondaire" disabled={enCours !== null} onClick={partager}>
          <Share2 size={15} /> {libelle("partage", pret ? "Envoyer le relevé" : "Partager")}
        </button>
      </div>
    </div>
  );
}
