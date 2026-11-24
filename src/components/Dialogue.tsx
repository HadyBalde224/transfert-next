"use client";

import { useEffect, useRef, type ReactNode } from "react";

// Fenêtre au-dessus de la page. À n'afficher que lorsqu'elle est ouverte.
export function Dialogue({
  titre,
  fermer,
  children,
}: {
  titre: string;
  fermer: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-label={titre}
      onClose={fermer}
      onClick={(e) => e.target === e.currentTarget && fermer()}
      className="no-print m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl bg-white p-0 text-left text-gray-800 shadow-2xl backdrop:bg-black/50"
    >
      <div className="space-y-3 p-4">
        <h2 className="text-base font-black text-gray-900">{titre}</h2>
        {children}
      </div>
    </dialog>
  );
}
