"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { toPeriode, type PeriodeRow } from "@/lib/types";
import { libelleMoisCourant } from "@/lib/mois";

// Renvoie la periode active de l'utilisateur (la plus recemment creee).
// En cree une si aucune n'existe encore (filet de securite, ne devrait pas
// arriver pour un compte existant grace a la migration initiale).
export async function getActivePeriode() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié" as const };

  const { data: existing, error: fetchError } = await supabase
    .from("periodes")
    .select()
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle<PeriodeRow>();

  if (fetchError) return { error: fetchError.message };
  if (existing) return { data: toPeriode(existing) };

  const { data: created, error: createError } = await supabase
    .from("periodes")
    .insert({ user_id: user.id, libelle: libelleMoisCourant() })
    .select()
    .single<PeriodeRow>();

  if (createError) return { error: createError.message };
  return { data: toPeriode(created) };
}

export async function createPeriode() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié" as const };

  const base = libelleMoisCourant();
  const { data: memes } = await supabase
    .from("periodes")
    .select("libelle")
    .ilike("libelle", `${base}%`);

  let libelle = base;
  if (memes && memes.some((m) => m.libelle === base)) {
    let n = 2;
    while (memes.some((m) => m.libelle === `${base} (${n})`)) n += 1;
    libelle = `${base} (${n})`;
  }

  const { data, error } = await supabase
    .from("periodes")
    .insert({ user_id: user.id, libelle })
    .select()
    .single<PeriodeRow>();

  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  return { data: toPeriode(data) };
}

// Ne supprime que les mois vides (0 transaction), pour éviter de perdre des
// données par erreur. Un mois créé par erreur (donc vide) peut être annulé.
// Le mois calendaire en cours (ex: "Septembre 2026" si on est en septembre)
// n'est jamais supprimable, même vide : c'est celui qui sert de filet de
// secours (getActivePeriode) et qu'on s'attend à toujours retrouver. Un
// doublon créé par erreur ce même mois (libellé "... (2)") reste supprimable.
export async function deletePeriode(
  id: number
): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient();

  const { data: periode, error: periodeError } = await supabase
    .from("periodes")
    .select("libelle")
    .eq("id", id)
    .maybeSingle<{ libelle: string }>();

  if (periodeError) return { error: periodeError.message };
  if (!periode) return { error: "Mois introuvable." as const };
  if (periode.libelle === libelleMoisCourant()) {
    return { error: "Le mois en cours ne peut pas être supprimé." as const };
  }

  const { count, error: countError } = await supabase
    .from("transactions")
    .select("*", { count: "exact", head: true })
    .eq("periode_id", id);

  if (countError) return { error: countError.message };
  if (count && count > 0) {
    return { error: "Ce mois contient des transactions, il ne peut pas être supprimé." as const };
  }

  const { error } = await supabase.from("periodes").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  return { success: true as const };
}
