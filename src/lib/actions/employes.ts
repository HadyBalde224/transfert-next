"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { adminConfigure, createAdminClient } from "@/lib/supabase/admin";
import { IDENTIFIANT_VALIDE, MOT_DE_PASSE_MIN, usernameToEmail } from "@/lib/identifiant";
import { messageErreur, type Resultat } from "./resultat";

// La clé secrète contourne la RLS : on demande donc d'abord à la base, avec
// la session de l'appelant, s'il est bien l'admin.
async function refusSiPasPatron(): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("est_patron");
  if (error || data !== true) return "Action réservée à l'admin.";
  if (!adminConfigure()) {
    return "La variable SUPABASE_SECRET_KEY n'est pas configurée sur le serveur.";
  }
  return null;
}

export async function creerEmploye(saisie: {
  nom: string;
  identifiant: string;
  motDePasse: string;
  zone: string;
}): Promise<Resultat> {
  const refus = await refusSiPasPatron();
  if (refus) return { ok: false, error: refus };

  const nom = String(saisie.nom).trim().slice(0, 80);
  const identifiant = String(saisie.identifiant).trim().toLowerCase();
  if (!nom) return { ok: false, error: "Le nom est requis." };
  if (!IDENTIFIANT_VALIDE.test(identifiant)) {
    return {
      ok: false,
      error: "Identifiant : 2 à 30 caractères, lettres sans accent, chiffres, point ou tiret.",
    };
  }
  if (String(saisie.motDePasse).length < MOT_DE_PASSE_MIN) {
    return { ok: false, error: `Mot de passe : ${MOT_DE_PASSE_MIN} caractères minimum.` };
  }
  if (!/^[A-Z]{3}$/.test(saisie.zone)) return { ok: false, error: "Choisissez une zone." };

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: usernameToEmail(identifiant),
    password: String(saisie.motDePasse),
    email_confirm: true,
  });
  if (error) {
    console.error("[creerEmploye]", error.message);
    return {
      ok: false,
      error:
        error.code === "email_exists"
          ? "Cet identifiant est déjà utilisé."
          : "Le compte n'a pas pu être créé. Réessayez avec un mot de passe plus fort.",
    };
  }

  const { error: erreurProfil } = await admin.from("profils").insert({
    id: data.user.id,
    identifiant,
    nom,
    role: "EMPLOYE",
    // Validée par la base (déclencheur verifier_zone).
    zone: saisie.zone,
  });
  if (erreurProfil) {
    // Sans profil, le compte serait inutilisable et bloquerait l'identifiant.
    await admin.auth.admin.deleteUser(data.user.id);
    return { ok: false, error: messageErreur(erreurProfil) };
  }
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

export async function modifierEmploye(saisie: {
  id: string;
  nom: string;
  actif: boolean;
  zone: string | null;
}): Promise<Resultat> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("modifier_employe", {
    p_id: saisie.id,
    p_nom: saisie.nom,
    p_actif: saisie.actif,
    p_zone: saisie.zone,
  });
  if (error) return { ok: false, error: messageErreur(error) };
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

export async function reinitialiserMotDePasse(id: string, motDePasse: string): Promise<Resultat> {
  const refus = await refusSiPasPatron();
  if (refus) return { ok: false, error: refus };
  if (String(motDePasse).length < MOT_DE_PASSE_MIN) {
    return { ok: false, error: `Mot de passe : ${MOT_DE_PASSE_MIN} caractères minimum.` };
  }

  // Uniquement les employés : jamais un compte quelconque du projet.
  const supabase = await createClient();
  const { data: cible } = await supabase
    .from("profils")
    .select("id")
    .eq("id", id)
    .eq("role", "EMPLOYE")
    .maybeSingle<{ id: string }>();
  if (!cible) return { ok: false, error: "Employé introuvable." };

  // La base refuse tout changement de mot de passe d'un employé sans cette
  // autorisation, valable une fois pendant une minute.
  const { error: refusBase } = await supabase.rpc("autoriser_mot_de_passe", { p_id: cible.id });
  if (refusBase) return { ok: false, error: messageErreur(refusBase) };

  const { error } = await createAdminClient().auth.admin.updateUserById(cible.id, {
    password: String(motDePasse),
  });
  if (error) {
    console.error("[reinitialiserMotDePasse]", error.message);
    return { ok: false, error: "Le mot de passe n'a pas pu être changé. Essayez-en un plus fort." };
  }
  return { ok: true, data: undefined };
}
