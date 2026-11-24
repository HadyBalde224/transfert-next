"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { messageErreur, type Resultat } from "./resultat";

export async function reglerEntreprise(saisie: {
  nom: string;
  telephone: string;
  adresse: string;
  message: string;
}): Promise<Resultat> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("regler_entreprise", {
    p_nom: saisie.nom,
    p_telephone: saisie.telephone,
    p_adresse: saisie.adresse,
    p_message: saisie.message,
  });
  if (error) return { ok: false, error: messageErreur(error) };
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}
