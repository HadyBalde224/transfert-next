import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Devise, Taux } from "@/lib/types";

export async function lireTaux(): Promise<Taux[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("taux_change")
    .select("*")
    .order("id")
    .overrideTypes<Taux[], { merge: false }>();
  if (error) throw new Error(error.message);
  return data;
}

// Paires réellement utilisables : taux actif, deux devises actives, et
// valeur de la devise encaissée connue (nécessaire au calcul du bénéfice).
export async function lireTauxActifs(devises: Devise[]) {
  const parCode = new Map(devises.map((d) => [d.code, d]));
  return (await lireTaux()).filter((t) => {
    const s = parCode.get(t.devise_source);
    const c = parCode.get(t.devise_cible);
    return t.actif && s?.actif && c?.actif && s.unites_par_base !== null;
  });
}
