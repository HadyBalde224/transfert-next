"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { messageErreur, type Resultat } from "./resultat";

export interface SaisieTransfert {
  source: string;
  cible: string;
  montant: number;
  fraisPct: number;
  tauxVu: number;
  nomClient: string;
  telephoneClient: string;
  nomBeneficiaire: string;
  telephoneBeneficiaire: string;
  note: string;
}

// Droits, taux et bénéfice sont vérifiés et calculés dans la base
// (voir supabase/migrations) : ces actions ne font que transmettre.
const versSql = (s: SaisieTransfert) => ({
  p_source: s.source,
  p_cible: s.cible,
  p_montant: s.montant,
  p_frais_pct: s.fraisPct,
  p_taux_vu: s.tauxVu,
  p_nom_client: s.nomClient,
  p_telephone_client: s.telephoneClient,
  p_nom_beneficiaire: s.nomBeneficiaire,
  p_telephone_beneficiaire: s.telephoneBeneficiaire,
  p_note: s.note,
});

export async function creerTransfert(cle: string, saisie: SaisieTransfert): Promise<Resultat<number>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("creer_transfert", { p_cle: cle, ...versSql(saisie) });
  if (error) return { ok: false, error: messageErreur(error) };
  revalidatePath("/", "layout");
  return { ok: true, data: data as number };
}

export async function modifierTransfert(
  id: number,
  saisie: SaisieTransfert,
  motif: string
): Promise<Resultat<number>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("modifier_transfert", {
    p_id: id,
    ...versSql(saisie),
    p_motif: motif,
  });
  if (error) return { ok: false, error: messageErreur(error) };
  revalidatePath("/", "layout");
  return { ok: true, data: data as number };
}

export async function changerStatut(
  id: number,
  statut: "VALIDE" | "ANNULE",
  motif: string
): Promise<Resultat> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("changer_statut_transfert", {
    p_id: id,
    p_statut: statut,
    p_motif: motif,
  });
  if (error) return { ok: false, error: messageErreur(error) };
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

export async function cloturerJournee(rapport: string): Promise<Resultat> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cloturer_journee", { p_rapport: rapport });
  if (error) return { ok: false, error: messageErreur(error) };
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

export async function rouvrirJournee(id: number): Promise<Resultat> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("rouvrir_journee", { p_id: id });
  if (error) return { ok: false, error: messageErreur(error) };
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}
