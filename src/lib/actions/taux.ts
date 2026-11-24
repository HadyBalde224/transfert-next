"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CATALOGUE } from "@/lib/zones";
import { messageErreur, type Resultat } from "./resultat";

export interface SensTaux {
  client: number;
  reel: number;
  frais: number;
}

// Ajoute une devise ou met à jour ses taux, dans les deux sens avec la
// devise mère. Droits et valeurs sont vérifiés par la base.
export async function enregistrerDevise(saisie: {
  code: string;
  aller: SensTaux;
  retour: SensTaux;
}): Promise<Resultat> {
  const modele = Object.hasOwn(CATALOGUE, saisie.code) ? CATALOGUE[saisie.code] : undefined;
  if (!modele) return { ok: false, error: "Devise inconnue." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("enregistrer_devise", {
    p_code: saisie.code,
    p_nom: modele.nom,
    p_decimales: modele.decimales,
    p_forte: modele.forte,
    p_client_aller: saisie.aller.client,
    p_reel_aller: saisie.aller.reel,
    p_frais_aller: saisie.aller.frais,
    p_client_retour: saisie.retour.client,
    p_reel_retour: saisie.retour.reel,
    p_frais_retour: saisie.retour.frais,
  });
  if (error) return { ok: false, error: messageErreur(error) };
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

export async function supprimerDevise(code: string): Promise<Resultat> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("supprimer_devise", { p_code: code });
  if (error) return { ok: false, error: messageErreur(error) };
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}
