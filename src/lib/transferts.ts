import "server-only";

import { createClient } from "@/lib/supabase/server";
import { un, type Params, type Periode } from "@/lib/periode";
import type { Transfert } from "@/lib/types";

export const PAR_PAGE = 50;

export interface Filtres {
  q: string;
  devise: string;
  employe: string;
  statut: string;
}

export function lireFiltres(params: Params): Filtres {
  const devise = un(params.devise) ?? "";
  const employe = un(params.employe) ?? "";
  const statut = un(params.statut) ?? "";
  return {
    // Retire les caractères qui ont un sens dans la syntaxe de filtre PostgREST.
    q: (un(params.q) ?? "").replace(/[,()%*\\":]/g, " ").trim().slice(0, 60),
    devise: /^[A-Z]{3}$/.test(devise) ? devise : "",
    employe: /^[0-9a-f-]{36}$/.test(employe) ? employe : "",
    statut: statut === "VALIDE" || statut === "ANNULE" ? statut : "",
  };
}

// La RLS limite déjà un employé à ses propres transferts.
export async function lireTransferts(periode: Periode, f: Filtres, debut: number, taille: number) {
  const supabase = await createClient();
  let requete = supabase
    .from("transferts")
    .select("*", { count: "exact" })
    .gte("jour", periode.debut)
    .lte("jour", periode.fin);

  if (f.devise) requete = requete.or(`devise_source.eq.${f.devise},devise_cible.eq.${f.devise}`);
  if (f.employe) requete = requete.eq("employe_id", f.employe);
  if (f.statut) requete = requete.eq("statut", f.statut);
  if (f.q) {
    const champs = ["nom_client", "telephone_client", "nom_beneficiaire", "telephone_beneficiaire"];
    const conditions = champs.map((c) => `${c}.ilike.%${f.q}%`);
    if (/^\d{1,9}$/.test(f.q)) conditions.push(`id.eq.${f.q}`);
    // Contrôle d'un reçu : son numéro (R-2026-000138) ou son code.
    const numero = /^R-\d{4}-(\d{6,9})$/i.exec(f.q);
    if (numero) conditions.push(`id.eq.${Number(numero[1])}`);
    const code = /^([0-9A-F]{5})-([0-9A-F]{5})$/i.exec(f.q);
    if (code) conditions.push(`code_recu.eq.${`${code[1]}-${code[2]}`.toUpperCase()}`);
    requete = requete.or(conditions.join(","));
  }

  const { data, count, error } = await requete
    .order("jour", { ascending: false })
    .order("id", { ascending: false })
    .range(debut, debut + taille - 1)
    .overrideTypes<Transfert[], { merge: false }>();
  // PGRST103 : page demandée au-delà de la dernière.
  if (error && error.code !== "PGRST103") throw new Error(error.message);
  return { lignes: data ?? [], total: count ?? 0 };
}
