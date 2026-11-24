"use client";

import { useRef, useState } from "react";
import { useToast } from "@/components/Toast";
import type { Resultat } from "@/lib/actions/resultat";

// Exécute une action serveur en bloquant les doubles clics et en gérant la
// coupure réseau (sinon le bouton resterait bloqué sur "en cours").
export function useAction() {
  const [enCours, setEnCours] = useState(false);
  const verrou = useRef(false);
  const { addToast } = useToast();

  async function lancer<T>(
    action: () => Promise<Resultat<T>>,
    opts: { succes?: string; apres?: (data: T) => void; echec?: () => void } = {}
  ) {
    if (verrou.current) return;
    verrou.current = true;
    setEnCours(true);
    try {
      const r = await action();
      if (r.ok) {
        if (opts.succes) addToast(opts.succes, "success");
        opts.apres?.(r.data);
      } else {
        addToast(r.error, "error", 6000);
        opts.echec?.();
      }
    } catch {
      addToast("Connexion perdue. Vérifiez le réseau puis réessayez.", "error", 6000);
    } finally {
      verrou.current = false;
      setEnCours(false);
    }
  }

  return { enCours, lancer, addToast };
}
