import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Devise, Parametres, Profil } from "@/lib/types";

type Session =
  | { etat: "migration" }
  | { etat: "zones" }
  | { etat: "sans-profil" }
  | { etat: "inactif" }
  | { etat: "ok"; profil: Profil };

// Une seule lecture par requête, même si layout et page la demandent.
export const lireSession = cache(async (): Promise<Session> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data, error } = await supabase
    .from("profils")
    .select("*")
    .eq("id", user.id)
    .maybeSingle<Profil>();

  if (error) {
    // Table absente : le script SQL n'a pas encore été exécuté.
    if (error.code === "PGRST205" || error.code === "42P01") return { etat: "migration" };
    throw new Error(error.message);
  }
  if (!data) return { etat: "sans-profil" };
  // Colonne absente : le script des zones n'a pas encore été exécuté.
  if (!("zone" in data)) return { etat: "zones" };
  if (!data.actif) return { etat: "inactif" };
  return { etat: "ok", profil: data };
});

export async function exigerProfil(): Promise<Profil> {
  const s = await lireSession();
  if (s.etat !== "ok") redirect("/acces");
  return s.profil;
}

export async function exigerPatron(): Promise<Profil> {
  const profil = await exigerProfil();
  if (profil.role !== "PATRON") redirect("/dashboard");
  return profil;
}

export const lireReglages = cache(async () => {
  const supabase = await createClient();
  const [par, dev] = await Promise.all([
    supabase.from("parametres").select("*").eq("id", 1).single<Parametres>(),
    supabase.from("devises").select("*").order("ordre").order("code").returns<Devise[]>(),
  ]);
  if (par.error) throw new Error(par.error.message);
  if (dev.error) throw new Error(dev.error.message);
  // Colonne absente : le script "devise_mere" n'a pas encore été exécuté.
  if (dev.data.length > 0 && !("forte" in dev.data[0])) redirect("/acces?script=devises");
  const decimales = Object.fromEntries(dev.data.map((d) => [d.code, d.decimales]));
  return { parametres: par.data, devises: dev.data, decimales };
});

// Jour du plus ancien transfert visible (borne de la liste des mois).
export const lirePremierJour = cache(async (defaut: string) => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transferts")
    .select("jour")
    .order("jour")
    .limit(1)
    .maybeSingle<{ jour: string }>();
  if (error) throw new Error(error.message);
  return data && data.jour < defaut ? data.jour : defaut;
});

// Mois ajoutés par l'admin (ou par un premier transfert), du plus récent au
// plus ancien.
export const lireMois = cache(async (today: string) => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("mois")
    .select("cle")
    .order("cle", { ascending: false })
    .overrideTypes<{ cle: string }[], { merge: false }>();
  // Table absente : le script "mois" n'a pas encore été exécuté.
  if (error && error.code !== "PGRST205" && error.code !== "42P01") throw new Error(error.message);
  const liste = (data ?? []).map((m) => m.cle);
  return liste.length > 0 ? liste : [today.slice(0, 7)];
});

// id -> nom. Un employé n'y trouve que lui-même (RLS).
export const lireNoms = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("profils").select("*").order("nom").returns<Profil[]>();
  if (error) throw new Error(error.message);
  return { profils: data, noms: Object.fromEntries(data.map((p) => [p.id, p.nom])) };
});
