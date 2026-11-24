"use client";

import { useState, type SubmitEvent } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Trash2 } from "lucide-react";
import { ajouterMois, supprimerMois } from "@/lib/actions/mois";
import { moisLong } from "@/lib/format";
import { Dialogue } from "@/components/Dialogue";
import { useAction } from "@/components/useAction";

const majuscule = (t: string) => t[0].toUpperCase() + t.slice(1);
const NUMEROS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));

// "courant" : AAAA-MM du jour. "existants" : mois déjà ajoutés.
export function NouveauMois({ courant, existants }: { courant: string; existants: string[] }) {
  const router = useRouter();
  const { enCours, lancer } = useAction();
  const [ouvert, setOuvert] = useState(false);
  const [annee, setAnnee] = useState(courant.slice(0, 4));
  const [numero, setNumero] = useState(courant.slice(5));
  const choisi = `${annee}-${numero}`;
  const refus = existants.includes(choisi)
    ? "Ce mois existe déjà."
    : choisi > courant
      ? "Ce mois n'est pas encore arrivé."
      : "";
  const annees = [0, 1, 2].map((n) => String(Number(courant.slice(0, 4)) - n));

  const envoyer = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (refus) return;
    lancer(() => ajouterMois(choisi), {
      succes: `Nouveau mois : ${moisLong(choisi)}`,
      apres: (m) => {
        setOuvert(false);
        router.push(`/dashboard?v=mois&m=${m}`);
      },
    });
  };

  return (
    <>
      <button
        type="button"
        aria-label="Nouveau mois"
        title="Nouveau mois"
        onClick={() => setOuvert(true)}
        className="rounded-full bg-white/10 p-2 backdrop-blur-sm transition hover:bg-white/20"
      >
        <CalendarPlus size={18} />
      </button>
      {ouvert && (
        <Dialogue titre="Ajouter un mois" fermer={() => setOuvert(false)}>
          <form onSubmit={envoyer} className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <label>
                <span className="etiquette">Mois</span>
                <select className="champ" value={numero} onChange={(e) => setNumero(e.target.value)}>
                  {NUMEROS.map((n) => (
                    <option key={n} value={n}>
                      {majuscule(moisLong(`${annee}-${n}`).split(" ")[0])}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="etiquette">Année</span>
                <select className="champ" value={annee} onChange={(e) => setAnnee(e.target.value)}>
                  {annees.map((a) => (
                    <option key={a}>{a}</option>
                  ))}
                </select>
              </label>
            </div>
            {refus && <p className="text-xs font-bold text-red-700">{refus}</p>}
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className="btn-secondaire py-3" onClick={() => setOuvert(false)}>
                Retour
              </button>
              <button disabled={enCours || refus !== ""} className="btn-primaire py-3">
                {enCours ? "Ajout…" : "Ajouter"}
              </button>
            </div>
          </form>
        </Dialogue>
      )}
    </>
  );
}

// À côté du mois affiché, seulement s'il est vide et n'est pas le mois en cours.
export function RetirerMois({ mois }: { mois: string }) {
  const router = useRouter();
  const { enCours, lancer } = useAction();
  return (
    <button
      type="button"
      disabled={enCours}
      aria-label={`Retirer ${moisLong(mois)}`}
      title="Retirer ce mois (vide)"
      className="mb-3 p-1.5 text-blue-200 transition hover:text-red-300 disabled:opacity-50"
      onClick={() => {
        if (window.confirm(`Retirer ${moisLong(mois)} de la liste ? Ce mois est vide.`)) {
          lancer(() => supprimerMois(mois), {
            succes: "Mois retiré",
            apres: () => router.push("/dashboard"),
          });
        }
      }}
    >
      <Trash2 size={16} />
    </button>
  );
}
