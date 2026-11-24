import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Transfert } from "@/lib/types";

export async function lireTransfert(id: string): Promise<Transfert | null> {
  if (!/^\d{1,15}$/.test(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transferts")
    .select("*")
    .eq("id", Number(id))
    .maybeSingle<Transfert>();
  if (error) throw new Error(error.message);
  return data;
}
