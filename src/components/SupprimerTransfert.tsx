"use client";

import { useState, type ReactNode, type SubmitEvent } from "react";
import { changerStatut } from "@/lib/actions/transferts";
import { Dialogue } from "@/components/Dialogue";
import { useAction } from "@/components/useAction";

const RAISONS = ["Erreur de saisie", "Doublon", "Client annule"];

// Supprime (ou rétablit) sans quitter la page. Le motif est obligatoire en
// base : une raison courante est déjà choisie pour aller vite.
export function SupprimerTransfert({
  id,
  resume,
  retablir = false,
  className,
  children,
}: {
  id: number;
  resume: string;
  retablir?: boolean;
  className: string;
  children: ReactNode;
}) {
  const { enCours, lancer } = useAction();
  const [ouvert, setOuvert] = useState(false);
  const [raison, setRaison] = useState(RAISONS[0]);
  const [autre, setAutre] = useState("");
  const libre = retablir || raison === "";

  const envoyer = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    lancer(() => changerStatut(id, retablir ? "VALIDE" : "ANNULE", libre ? autre : raison), {
      succes: retablir ? "Transfert rétabli" : "Transfert supprimé",
      apres: () => setOuvert(false),
    });
  };

  return (
    <>
      <button type="button" className={className} onClick={() => setOuvert(true)}>
        {children}
      </button>
      {ouvert && (
        <Dialogue
          titre={retablir ? "Rétablir ce transfert ?" : "Supprimer ce transfert ?"}
          fermer={() => setOuvert(false)}
        >
          <p className="text-sm text-gray-600">{resume}</p>
          <form onSubmit={envoyer} className="space-y-3">
            {!retablir && (
              <div className="flex flex-wrap gap-2" role="group" aria-label="Raison">
                {[...RAISONS, ""].map((r) => (
                  <button
                    key={r}
                    type="button"
                    aria-pressed={raison === r}
                    onClick={() => setRaison(r)}
                    className={`puce ${raison === r ? "puce-active" : ""}`}
                  >
                    {r || "Autre…"}
                  </button>
                ))}
              </div>
            )}
            {libre && (
              <input
                autoFocus
                required
                maxLength={300}
                aria-label="Motif"
                placeholder="Écrivez la raison"
                className="champ"
                value={autre}
                onChange={(e) => setAutre(e.target.value)}
              />
            )}
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className="btn-secondaire py-3" onClick={() => setOuvert(false)}>
                Retour
              </button>
              <button
                disabled={enCours}
                className={`btn py-3 text-white ${retablir ? "bg-blue-600 hover:bg-blue-700" : "bg-red-600 hover:bg-red-700"}`}
              >
                {enCours ? "Un instant…" : retablir ? "Rétablir" : "Oui, supprimer"}
              </button>
            </div>
          </form>
        </Dialogue>
      )}
    </>
  );
}
