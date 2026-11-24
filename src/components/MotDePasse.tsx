"use client";

import { useState, type SubmitEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { MOT_DE_PASSE_MIN } from "@/lib/identifiant";
import { useAction } from "@/components/useAction";

// Mot de passe de l'admin. Pour un employé, la base ignore ce changement
// (voir la migration admin_seul).
export function MotDePasse() {
  const { enCours, lancer, addToast } = useAction();
  const [nouveau, setNouveau] = useState("");
  const [confirmation, setConfirmation] = useState("");

  const envoyer = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (nouveau !== confirmation) {
      addToast("Les deux mots de passe sont différents.", "warning");
      return;
    }
    lancer(
      async () => {
        const { error } = await createClient().auth.updateUser({ password: nouveau });
        if (!error) return { ok: true as const, data: undefined };
        return {
          ok: false as const,
          error:
            error.code === "same_password"
              ? "Choisissez un mot de passe différent de l'actuel."
              : "Le mot de passe n'a pas pu être changé. Essayez-en un plus fort, ou reconnectez-vous.",
        };
      },
      {
        succes: "Mot de passe changé",
        apres: () => {
          setNouveau("");
          setConfirmation("");
        },
      }
    );
  };

  return (
    <form onSubmit={envoyer} className="carte space-y-2.5">
      <div className="grid grid-cols-2 gap-2">
        <label>
          <span className="etiquette">Nouveau</span>
          <input id="mdp" type="password" autoComplete="new-password" required minLength={MOT_DE_PASSE_MIN} className="champ" value={nouveau} onChange={(e) => setNouveau(e.target.value)} />
        </label>
        <label>
          <span className="etiquette">Confirmer</span>
          <input id="mdp2" type="password" autoComplete="new-password" required minLength={MOT_DE_PASSE_MIN} className="champ" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} />
        </label>
      </div>
      <button disabled={enCours} className="btn-secondaire w-full">Changer mon mot de passe</button>
    </form>
  );
}
