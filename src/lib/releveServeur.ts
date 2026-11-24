import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Transfert } from "@/lib/types";

export const MAX_OPERATIONS = 2000;
const LOT = 1000;

// Opérations dans l'ordre chronologique, annulées comprises.
export async function lireOperations(debut: string, fin: string, employe?: string) {
  const supabase = await createClient();
  const lignes: Transfert[] = [];
  for (let i = 0; i <= MAX_OPERATIONS; i += LOT) {
    let requete = supabase.from("transferts").select("*").gte("jour", debut).lte("jour", fin);
    if (employe) requete = requete.eq("employe_id", employe);
    const { data, error } = await requete
      .order("jour")
      .order("cree_le")
      .order("id")
      .range(i, i + LOT - 1)
      .overrideTypes<Transfert[], { merge: false }>();
    if (error) throw new Error(error.message);
    lignes.push(...data);
    if (data.length < LOT) break;
  }
  return lignes.length > MAX_OPERATIONS
    ? { lignes: [], tropDeLignes: true }
    : { lignes, tropDeLignes: false };
}
