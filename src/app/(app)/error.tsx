"use client";

export default function Erreur({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="carte mx-auto mt-10 max-w-md p-6 text-center">
      <h1 className="text-lg font-bold text-slate-900">Impossible de charger cette page</h1>
      <p className="my-3 text-sm text-slate-600">Vérifiez votre connexion internet puis réessayez.</p>
      <button className="btn-primaire" onClick={reset}>
        Réessayer
      </button>
    </div>
  );
}
