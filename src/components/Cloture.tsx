"use client";

import { useState, type SubmitEvent } from "react";
import { cloturerJournee, rouvrirJournee } from "@/lib/actions/transferts";
import { useAction } from "@/components/useAction";

export function CloturerForm({ nb, benefice }: { nb: number; benefice: string }) {
  const { enCours, lancer } = useAction();
  const [rapport, setRapport] = useState("");

  const envoyer = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const ok = window.confirm(
      `Clôturer la journée avec ${nb} transfert(s) et ${benefice} de bénéfice ? Vous ne pourrez plus rien ajouter, modifier ni supprimer aujourd'hui.`
    );
    if (ok) lancer(() => cloturerJournee(rapport), { succes: "Journée clôturée" });
  };

  return (
    <form onSubmit={envoyer} className="space-y-2.5">
      <label className="block">
        <span className="surtitre block">Ce que j&apos;ai fait aujourd&apos;hui</span>
        <textarea
          id="rapport"
          rows={4}
          maxLength={2000}
          className="champ"
          placeholder="Remarques, clients en attente… (facultatif)"
          value={rapport}
          onChange={(e) => setRapport(e.target.value)}
        />
      </label>
      <button disabled={enCours} className="btn-primaire w-full py-3 text-sm">
        {enCours ? "Clôture…" : "Clôturer ma journée"}
      </button>
    </form>
  );
}

export function RouvrirBouton({ id, nom }: { id: number; nom: string }) {
  const { enCours, lancer } = useAction();
  return (
    <button
      className="text-xs font-bold text-red-600 disabled:opacity-50"
      disabled={enCours}
      onClick={() => {
        if (window.confirm(`Rouvrir la journée de ${nom} ? Son rapport de clôture sera effacé.`)) {
          lancer(() => rouvrirJournee(id), { succes: "Journée rouverte" });
        }
      }}
    >
      Rouvrir
    </button>
  );
}
