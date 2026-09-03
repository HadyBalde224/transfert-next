"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { toCredit, type CreditRow, type CreditType } from "@/lib/types";

export interface CreditInput {
  type: CreditType;
  nomPersonne: string;
  motif: string | null;
  montantInitial: number;
}

const CREDIT_SELECT = "*, remboursements(*)";

export async function createCredit(input: CreditInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié" as const };

  const { data, error } = await supabase
    .from("credits")
    .insert({
      user_id: user.id,
      type: input.type,
      nom_personne: input.nomPersonne,
      motif: input.motif,
      montant_initial: input.montantInitial,
      montant_rembourse: 0,
    })
    .select(CREDIT_SELECT)
    .single<CreditRow>();

  if (error) return { error: error.message };
  revalidatePath("/credits");
  return { data: toCredit(data) };
}

export async function deleteCredit(id: number) {
  const supabase = await createClient();
  const { error } = await supabase.from("credits").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/credits");
  return { success: true as const };
}

// Miroir de CreditController#rembourser : plafonnement du montant côté
// fonction Postgres (rembourser_credit), garanti atomique. On recharge
// ensuite le crédit avec ses remboursements pour renvoyer la forme
// attendue par l'UI (identique à ce que Spring renvoyait).
export async function rembourserCredit(creditId: number, montant: number) {
  const supabase = await createClient();
  const { error: rpcError } = await supabase.rpc("rembourser_credit", {
    p_credit_id: creditId,
    p_montant: montant,
  });
  if (rpcError) return { error: rpcError.message };

  const { data, error } = await supabase
    .from("credits")
    .select(CREDIT_SELECT)
    .eq("id", creditId)
    .single<CreditRow>();

  if (error) return { error: error.message };
  revalidatePath("/credits");
  return { data: toCredit(data) };
}

export async function supprimerRemboursement(remboursementId: number, creditId: number) {
  const supabase = await createClient();
  const { error: rpcError } = await supabase.rpc("supprimer_remboursement", {
    p_remboursement_id: remboursementId,
  });
  if (rpcError) return { error: rpcError.message };

  const { data, error } = await supabase
    .from("credits")
    .select(CREDIT_SELECT)
    .eq("id", creditId)
    .single<CreditRow>();

  if (error) return { error: error.message };
  revalidatePath("/credits");
  return { data: toCredit(data) };
}
