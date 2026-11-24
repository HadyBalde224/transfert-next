"use client";

import { useEffect, useState } from "react";
import { Download, Printer, Share2 } from "lucide-react";
import { canvasEnJpeg, dessinerRecu, pdfDepuisJpeg, type DonneesRecu } from "@/lib/recu";
import { useToast } from "@/components/Toast";

interface Fichiers {
  image: string;
  pdf: File;
}

const enPng = (c: HTMLCanvasElement) =>
  new Promise<Blob>((ok, ko) => c.toBlob((b) => (b ? ok(b) : ko(new Error("image"))), "image/png"));

// Les fichiers sont préparés à l'ouverture : le partage doit partir
// immédiatement au clic, sinon le téléphone le refuse.
export function Recu({ donnees }: { donnees: DonneesRecu }) {
  const { addToast } = useToast();
  const [fichiers, setFichiers] = useState<Fichiers | null>(null);
  const [echec, setEchec] = useState(false);
  const cle = JSON.stringify(donnees);

  useEffect(() => {
    let annule = false;
    let adresse = "";
    (async () => {
      try {
        const d = JSON.parse(cle) as DonneesRecu;
        const canvas = dessinerRecu(d);
        const [png, jpeg] = await Promise.all([enPng(canvas), canvasEnJpeg(canvas)]);
        if (annule) return;
        const pdf = new File([pdfDepuisJpeg([jpeg], 297.64)], `recu_${d.numero}.pdf`, {
          type: "application/pdf",
        });
        adresse = URL.createObjectURL(png);
        setFichiers({ image: adresse, pdf });
      } catch {
        if (!annule) setEchec(true);
      }
    })();
    return () => {
      annule = true;
      if (adresse) URL.revokeObjectURL(adresse);
    };
  }, [cle]);

  const telecharger = () => {
    if (!fichiers) return;
    const url = URL.createObjectURL(fichiers.pdf);
    const a = document.createElement("a");
    a.href = url;
    a.download = fichiers.pdf.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  const partager = async () => {
    if (!fichiers) return;
    const contenu = { files: [fichiers.pdf], title: `Reçu ${donnees.numero}` };
    if (!navigator.canShare?.(contenu)) {
      telecharger();
      addToast("Partage impossible sur cet appareil : le PDF est téléchargé.", "info");
      return;
    }
    try {
      await navigator.share(contenu);
    } catch (e) {
      // L'utilisateur a simplement fermé la fenêtre de partage.
      if (!(e instanceof DOMException && e.name === "AbortError")) {
        addToast("Le partage a échoué. Téléchargez le PDF.", "error");
      }
    }
  };

  if (echec) {
    return <p className="carte text-sm text-red-700">Le reçu n&apos;a pas pu être généré sur cet appareil.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="no-print grid grid-cols-3 gap-2">
        <button className="btn-primaire" disabled={!fichiers} onClick={partager}>
          <Share2 size={15} /> Partager
        </button>
        <button className="btn-secondaire" disabled={!fichiers} onClick={telecharger}>
          <Download size={15} /> PDF
        </button>
        <button className="btn-secondaire" disabled={!fichiers} onClick={() => window.print()}>
          <Printer size={15} /> Imprimer
        </button>
      </div>
      {fichiers ? (
        // Image générée dans le navigateur : next/image n'apporterait rien.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={fichiers.image}
          alt={`Reçu ${donnees.numero}, à remettre ${donnees.aRemettre}, code ${donnees.code}`}
          className="w-full rounded-xl shadow-lg print:mx-auto print:max-h-[270mm] print:w-auto print:max-w-[105mm] print:rounded-none print:shadow-none"
        />
      ) : (
        <div className="flex justify-center py-20" role="status" aria-label="Préparation du reçu">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      )}
    </div>
  );
}
