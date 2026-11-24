"use client";

import { useState, type SubmitEvent } from "react";
import { reglerEntreprise } from "@/lib/actions/entreprise";
import { useAction } from "@/components/useAction";

interface Infos {
  nom: string;
  telephone: string;
  adresse: string;
  message: string;
}

// En-tête des reçus et relevés : réglé une fois, donc replié.
export function Entreprise({ infos }: { infos: Infos }) {
  const { enCours, lancer } = useAction();
  const [nom, setNom] = useState(infos.nom);
  const [telephone, setTelephone] = useState(infos.telephone);
  const [adresse, setAdresse] = useState(infos.adresse);
  const [message, setMessage] = useState(infos.message);

  const envoyer = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    lancer(() => reglerEntreprise({ nom, telephone, adresse, message }), { succes: "Entreprise enregistrée" });
  };

  return (
    <form onSubmit={envoyer} className="mt-3 space-y-2.5">
      <label className="block">
        <span className="etiquette">Nom de l&apos;entreprise</span>
        <input required maxLength={60} className="champ" value={nom} onChange={(e) => setNom(e.target.value)} />
      </label>
      <label className="block">
        <span className="etiquette">Téléphone(s)</span>
        <input maxLength={60} placeholder="+212 … / +224 …" className="champ" value={telephone} onChange={(e) => setTelephone(e.target.value)} />
      </label>
      <label className="block">
        <span className="etiquette">Adresse</span>
        <input maxLength={120} className="champ" value={adresse} onChange={(e) => setAdresse(e.target.value)} />
      </label>
      <label className="block">
        <span className="etiquette">Message en bas du reçu</span>
        <input maxLength={160} className="champ" value={message} onChange={(e) => setMessage(e.target.value)} />
      </label>
      <button disabled={enCours} className="btn-primaire w-full py-3 text-sm">
        {enCours ? "Enregistrement…" : "Enregistrer"}
      </button>
    </form>
  );
}
