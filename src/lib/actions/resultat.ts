import type { PostgrestError } from "@supabase/supabase-js";

export type Resultat<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

// Les messages P0001 viennent de nos "raise exception" : ils sont écrits pour
// l'utilisateur. Les autres erreurs SQL restent dans les journaux du serveur.
export function messageErreur(error: PostgrestError): string {
  // Les fonctions SQL disent encore "patron" : c'est l'admin.
  if (error.code === "P0001") {
    return error.message
      .replaceAll("au patron", "à l'admin")
      .replaceAll("le patron", "l'admin")
      .replace("Ce transfert est annulé", "Ce transfert est supprimé");
  }
  if (error.code === "23505") return "Cet élément existe déjà.";
  console.error("[supabase]", error.code, error.message);
  if (error.code === "42501") return "Vous n'avez pas le droit de faire cette action.";
  return "L'opération a échoué. Réessayez.";
}
