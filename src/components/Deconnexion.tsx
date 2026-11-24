"use client";

import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function Deconnexion({ icone = false }: { icone?: boolean }) {
  const sortir = async () => {
    await createClient().auth.signOut({ scope: "local" });
    // Chargement complet voulu : rien de ce compte ne reste en mémoire.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/");
  };
  return icone ? (
    <button
      onClick={sortir}
      aria-label="Déconnexion"
      title="Déconnexion"
      className="rounded-full bg-white/10 p-2 backdrop-blur-sm transition hover:bg-red-500"
    >
      <LogOut size={18} />
    </button>
  ) : (
    <button className="btn-secondaire" onClick={sortir}>
      Se déconnecter
    </button>
  );
}
