import { redirect } from "next/navigation";
import { Deconnexion } from "@/components/Deconnexion";
import { lireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Accès" };

const MESSAGES = {
  migration: {
    titre: "Base de données à mettre à jour",
    texte:
      "Exécutez le script supabase/migrations/20261124120000_equipe_et_devises.sql dans Supabase (SQL Editor), puis rechargez cette page.",
  },
  zones: {
    titre: "Un script à exécuter",
    texte:
      "Exécutez le script supabase/migrations/20261124200000_zones.sql dans Supabase (SQL Editor), puis rechargez cette page.",
  },
  devises: {
    titre: "Un script à exécuter",
    texte:
      "Exécutez le script supabase/migrations/20261124220000_devise_mere.sql dans Supabase (SQL Editor), puis rechargez cette page.",
  },
  "sans-profil": {
    titre: "Compte non autorisé",
    texte: "Ce compte n'est rattaché à aucun employé. Contactez l'admin.",
  },
  inactif: {
    titre: "Compte désactivé",
    texte: "Votre accès a été désactivé. Contactez l'admin.",
  },
};

// Hors du groupe (app) : un compte sans accès y est envoyé sans boucle.
export default async function Acces({ searchParams }: PageProps<"/acces">) {
  const session = await lireSession();
  let etat: keyof typeof MESSAGES;
  if (session.etat !== "ok") {
    etat = session.etat;
  } else {
    if ((await searchParams).script !== "devises") redirect("/dashboard");
    const supabase = await createClient();
    const { error } = await supabase.from("devises").select("forte").limit(1);
    if (!error) redirect("/dashboard");
    etat = "devises";
  }
  const m = MESSAGES[etat];
  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center p-6">
      <div className="carte w-full p-6 text-center">
        <h1 className="text-xl font-bold text-slate-900">{m.titre}</h1>
        <p className="my-4 text-sm text-slate-600">{m.texte}</p>
        <Deconnexion />
      </div>
    </main>
  );
}
