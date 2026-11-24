"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { messageErreur, type Resultat } from "./resultat";

// Doublon et mois à venir sont refusés par la base.
export async function ajouterMois(mois: string): Promise<Resultat<string>> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("ajouter_mois", { p_mois: mois });
  if (error) return { ok: false, error: messageErreur(error) };
  revalidatePath("/", "layout");
  return { ok: true, data: mois };
}

export async function supprimerMois(mois: string): Promise<Resultat> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("supprimer_mois", { p_mois: mois });
  if (error) return { ok: false, error: messageErreur(error) };
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}
