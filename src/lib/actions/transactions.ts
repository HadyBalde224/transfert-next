"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { toTransaction, type Direction, type TransactionRow } from "@/lib/types";

const TAUX_FIXE = 1000;

export interface TransactionInput {
  nomClient: string;
  telephoneClient: string;
  direction: Direction;
  montantEnvoye: number;
  frais: number;
}

// Miroir de TransactionController#enregistrerTransfert / #modifierTransaction :
// Montant Net = Montant Envoyé - Frais, puis converti selon le sens et le taux.
function calculerMontantRecu(input: TransactionInput) {
  const montantNet = input.montantEnvoye - input.frais;
  const brut =
    input.direction === "MAD_TO_GNF"
      ? montantNet * TAUX_FIXE
      : montantNet / TAUX_FIXE;
  return Math.round(brut * 100) / 100;
}

export async function createTransaction(input: TransactionInput, periodeId: number) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié" as const };

  // Le mois vient du client (le menu déroulant du Dashboard) : on vérifie
  // qu'il appartient bien à l'utilisateur avant d'y rattacher la transaction
  // (la RLS sur "periodes" fait qu'un id d'un autre utilisateur ne renvoie rien).
  const { data: periodeValide } = await supabase
    .from("periodes")
    .select("id")
    .eq("id", periodeId)
    .maybeSingle();
  if (!periodeValide) return { error: "Mois invalide" as const };

  const { data, error } = await supabase
    .from("transactions")
    .insert({
      user_id: user.id,
      periode_id: periodeId,
      direction: input.direction,
      montant_envoye: input.montantEnvoye,
      nom_client: input.nomClient,
      telephone_client: input.telephoneClient,
      frais: input.frais,
      taux_echange: TAUX_FIXE,
      montant_recu: calculerMontantRecu(input),
    })
    .select()
    .single<TransactionRow>();

  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  return { data: toTransaction(data) };
}

export async function updateTransaction(id: number, input: TransactionInput) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("transactions")
    .update({
      direction: input.direction,
      montant_envoye: input.montantEnvoye,
      nom_client: input.nomClient,
      telephone_client: input.telephoneClient,
      frais: input.frais,
      taux_echange: TAUX_FIXE,
      montant_recu: calculerMontantRecu(input),
    })
    .eq("id", id)
    .select()
    .single<TransactionRow>();

  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  return { data: toTransaction(data) };
}

export async function deleteTransaction(id: number) {
  const supabase = await createClient();
  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  return { success: true as const };
}

export async function getTransaction(id: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select()
    .eq("id", id)
    .single<TransactionRow>();

  if (error) return { error: error.message };
  return { data: toTransaction(data) };
}
