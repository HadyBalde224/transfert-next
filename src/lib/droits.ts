import "server-only";

import { createClient } from "@/lib/supabase/server";
import { aujourdhui } from "@/lib/periode";
import type { Profil, Transfert } from "@/lib/types";

// Reflet, pour l'affichage, de la règle de la base (verifier_delai) : un
// employé modifie ou supprime jusqu'à minuit, sauf journée clôturée.
export async function lireDroits(profil: Profil, fuseau: string) {
  const patron = profil.role === "PATRON";
  const today = aujourdhui(fuseau);
  let cloturee = false;
  if (!patron) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("clotures")
      .select("id")
      .eq("employe_id", profil.id)
      .eq("jour", today)
      .maybeSingle();
    if (error) throw new Error(error.message);
    cloturee = data !== null;
  }

  const modifiable = (t: Transfert) =>
    t.statut === "VALIDE" && (patron || (t.jour === today && !cloturee));

  // Explication affichée à l'employé.
  const explication = (t: Transfert) => {
    if (patron || t.statut !== "VALIDE") return "";
    if (t.jour !== today) return "Minuit est passé : seul l'admin peut modifier ou supprimer ce transfert.";
    return cloturee
      ? "Journée clôturée : seul l'admin peut modifier ou supprimer ce transfert."
      : "Modifiable jusqu'à minuit.";
  };
  return { modifiable, explication };
}
