"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { CreditType } from "@/lib/types";
import { messageErreur, type Resultat } from "./resultat";

// Les crédits sont en MAD (valeur par défaut de la colonne devise).
export interface CreditInput {
  type: CreditType;
  nomPersonne: string;
  motif: string | null;
  montantInitial: number;
}

const OK = { ok: true as const, data: undefined };

export async function createCredit(input: CreditInput): Promise<Resultat> {
  if (!(Number.isFinite(input.montantInitial) && input.montantInitial > 0)) {
    return { ok: false, error: "Montant invalide." };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Session expirée. Reconnectez-vous." };

  const { error } = await supabase.from("credits").insert({
    user_id: user.id,
    type: input.type,
    nom_personne: input.nomPersonne,
    motif: input.motif,
    montant_initial: input.montantInitial,
    montant_rembourse: 0,
  });
  if (error) return { ok: false, error: messageErreur(error) };
  revalidatePath("/credits");
  return OK;
}

export async function deleteCredit(id: number): Promise<Resultat> {
  const supabase = await createClient();
  const { error } = await supabase.from("credits").delete().eq("id", id);
  if (error) return { ok: false, error: messageErreur(error) };
  revalidatePath("/credits");
  return OK;
}

// Plafonnement et atomicité garantis par la fonction Postgres.
export async function rembourserCredit(creditId: number, montant: number): Promise<Resultat> {
  if (!(Number.isFinite(montant) && montant > 0)) return { ok: false, error: "Montant invalide." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("rembourser_credit", {
    p_credit_id: creditId,
    p_montant: montant,
  });
  if (error) return { ok: false, error: messageErreur(error) };
  revalidatePath("/credits");
  return OK;
}

export async function supprimerRemboursement(remboursementId: number): Promise<Resultat> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("supprimer_remboursement", {
    p_remboursement_id: remboursementId,
  });
  if (error) return { ok: false, error: messageErreur(error) };
  revalidatePath("/credits");
  return OK;
}
