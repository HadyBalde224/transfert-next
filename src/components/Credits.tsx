"use client";

import { useState, type SubmitEvent } from "react";
import Link from "next/link";
import { ArrowLeft, HandCoins, Plus, Search, Trash2 } from "lucide-react";
import { createCredit, deleteCredit, rembourserCredit, supprimerRemboursement } from "@/lib/actions/credits";
import { dateCourte, montant as fmt } from "@/lib/format";
import type { Credit, CreditType } from "@/lib/types";
import { useAction } from "@/components/useAction";

const solde = (c: Credit) => c.montantInitial - c.montantRembourse;
const jour = (iso: string) => dateCourte(iso.slice(0, 10));

const THEMES: Record<
  CreditType,
  { label: string; total: string; actif: string; resume: string; accent: string; bouton: string }
> = {
  ON_ME_DOIT: {
    label: "On me doit",
    total: "Total restant à recevoir",
    actif: "bg-emerald-600 text-white shadow-md",
    resume: "from-emerald-500 to-emerald-600",
    accent: "text-emerald-600",
    bouton: "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200",
  },
  JE_DOIS: {
    label: "Je dois",
    total: "Total restant à payer",
    actif: "bg-red-500 text-white shadow-md",
    resume: "from-red-500 to-orange-600",
    accent: "text-red-500",
    bouton: "bg-red-500 hover:bg-red-600 shadow-red-200",
  },
};

const CHAMP =
  "w-full min-w-0 bg-gray-50 border border-gray-200 px-3 py-2.5 rounded-xl text-base font-medium outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white";

// Les listes viennent du serveur : chaque action revalide la page, il n'y a
// donc pas de copie locale à tenir à jour.
export function Credits({
  credits,
  decimales,
}: {
  credits: Credit[];
  decimales: Record<string, number>;
}) {
  const { enCours, lancer, addToast } = useAction();
  const [type, setType] = useState<CreditType>("ON_ME_DOIT");
  const [recherche, setRecherche] = useState("");
  const [nom, setNom] = useState("");
  const [motif, setMotif] = useState("");
  const [somme, setSomme] = useState("");
  const [remboursement, setRemboursement] = useState<number | null>(null);
  const [sommeRemb, setSommeRemb] = useState("");

  const theme = THEMES[type];
  const m = (v: number, d: string) => fmt(v, d, decimales[d]);
  const items = credits.filter(
    (c) => c.type === type && c.nomPersonne.toLowerCase().includes(recherche.trim().toLowerCase())
  );
  const liste = items.filter((c) => solde(c) > 0);
  const totaux = new Map<string, number>();
  for (const c of liste) totaux.set(c.devise, (totaux.get(c.devise) ?? 0) + solde(c));
  const remboursements = items
    .flatMap((c) => c.remboursements.map((r) => ({ ...r, credit: c })))
    .sort((a, b) => b.dateRemboursement.localeCompare(a.dateRemboursement));

  const ajouter = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!nom.trim() || !(Number(somme) > 0)) {
      addToast("Nom et montant valide requis.", "warning");
      return;
    }
    lancer(
      () =>
        createCredit({
          type,
          nomPersonne: nom.trim(),
          motif: motif.trim() || null,
          montantInitial: Number(somme),
        }),
      {
        succes: "Enregistré",
        apres: () => {
          setNom("");
          setMotif("");
          setSomme("");
        },
      }
    );
  };

  const rembourser = (e: SubmitEvent<HTMLFormElement>, c: Credit) => {
    e.preventDefault();
    lancer(() => rembourserCredit(c.id, Number(sommeRemb)), {
      succes: "Remboursement enregistré",
      apres: () => setRemboursement(null),
    });
  };

  return (
    // Seule la liste défile ; sur un écran très bas, toute la page défile.
    <div className="-mb-28 flex h-dvh flex-col bg-gray-50 [@media(max-height:560px)]:mb-0 [@media(max-height:560px)]:h-auto">
      <div className="bg-gradient-to-br from-blue-700 to-blue-900 text-white p-3 shadow-lg rounded-b-2xl">
        <div className="flex items-center gap-2 mb-2.5">
          <Link
            href="/dashboard"
            aria-label="Retour"
            className="p-1.5 bg-white/10 hover:bg-white/20 rounded-full backdrop-blur-sm transition"
          >
            <ArrowLeft size={16} />
          </Link>
          <h1 className="text-sm font-bold tracking-wide">Crédits &amp; Dettes</h1>
        </div>

        <div className="flex space-x-2 mb-2.5">
          {(Object.keys(THEMES) as CreditType[]).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              aria-pressed={type === t}
              className={`flex-1 py-1.5 rounded-lg text-base font-bold transition ${
                type === t ? THEMES[t].actif : "bg-white text-gray-500 shadow-sm"
              }`}
            >
              {THEMES[t].label}
            </button>
          ))}
        </div>

        <div className={`rounded-lg px-2.5 py-2 shadow-sm text-white bg-gradient-to-r ${theme.resume}`}>
          <div className="text-[8px] font-black uppercase tracking-widest text-white/90">{theme.total}</div>
          <div className="text-base font-black leading-tight mt-0.5">
            {totaux.size === 0 ? "0" : [...totaux].map(([d, v]) => m(v, d)).join(" + ")}
          </div>
        </div>
      </div>

      <div className="px-4 mt-3 space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-3 text-gray-400" size={14} />
          <input
            placeholder="Rechercher un nom..."
            aria-label="Rechercher un nom"
            className="w-full bg-white border border-gray-100 pl-8 pr-3 py-2 rounded-xl text-base font-medium shadow-sm outline-none focus:ring-2 focus:ring-blue-500"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
          />
        </div>

        <form onSubmit={ajouter} className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 space-y-2">
          <input
            id="c-nom"
            required
            maxLength={120}
            aria-label="Nom de la personne"
            placeholder="Nom de la personne"
            className={CHAMP}
            value={nom}
            onChange={(e) => setNom(e.target.value)}
          />
          <input
            id="c-motif"
            maxLength={300}
            aria-label="Motif"
            placeholder="Motif (optionnel)"
            className={CHAMP}
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
          />
          <div className="flex gap-2">
            <input
              id="c-somme"
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              required
              aria-label="Montant en MAD"
              placeholder="Montant en MAD"
              className={`${CHAMP} flex-1`}
              value={somme}
              onChange={(e) => setSomme(e.target.value)}
            />
            <button
              type="submit"
              disabled={enCours}
              className={`flex items-center gap-1 px-4 rounded-xl text-white text-base font-bold shadow-md transition active:scale-95 disabled:opacity-60 ${theme.bouton}`}
            >
              <Plus size={16} /> Ajouter
            </button>
          </div>
        </form>
      </div>

      <div className="flex-1 overflow-y-auto px-4 mt-3 pb-8 space-y-4">
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1.5">En cours</p>
          {liste.length === 0 ? (
            <p className="text-center text-xs text-gray-500 py-3">Rien en cours.</p>
          ) : (
            <div className="space-y-2">
              {liste.map((c) => (
                <article key={c.id} className="bg-white p-2.5 rounded-xl shadow-sm border border-gray-100">
                  <div className="flex justify-between items-start">
                    <div className="min-w-0 pr-2">
                      <div className="font-bold text-gray-800 text-xs truncate">{c.nomPersonne}</div>
                      {c.motif && <div className="text-[10px] text-gray-400 truncate italic">{c.motif}</div>}
                      <div className="text-[9px] text-gray-400 mt-0.5">{jour(c.dateCreation)}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`font-black text-sm ${theme.accent}`}>{m(solde(c), c.devise)}</div>
                      {c.montantRembourse > 0 && (
                        <div className="text-[9px] text-gray-400">sur {m(c.montantInitial, c.devise)}</div>
                      )}
                    </div>
                  </div>

                  {remboursement === c.id ? (
                    <form
                      onSubmit={(e) => rembourser(e, c)}
                      className="flex gap-1.5 mt-2 pt-2 border-t border-gray-100"
                    >
                      <input
                        type="number"
                        inputMode="decimal"
                        autoFocus
                        required
                        min="0"
                        max={solde(c)}
                        step="any"
                        aria-label="Montant remboursé"
                        placeholder={`Max ${solde(c)}`}
                        className="flex-1 min-w-0 bg-gray-50 border border-gray-200 px-2 py-1 rounded-lg text-base outline-none focus:ring-2 focus:ring-blue-500"
                        value={sommeRemb}
                        onChange={(e) => setSommeRemb(e.target.value)}
                      />
                      <button
                        disabled={enCours}
                        className="px-2.5 bg-blue-600 text-white rounded-lg text-base font-bold active:scale-95 transition disabled:opacity-60"
                      >
                        Valider
                      </button>
                      <button
                        type="button"
                        onClick={() => setRemboursement(null)}
                        className="px-1.5 text-gray-400 text-base"
                      >
                        Annuler
                      </button>
                    </form>
                  ) : (
                    <div className="flex justify-end items-center gap-3 pt-2 mt-2 border-t border-gray-100">
                      <button
                        disabled={enCours}
                        onClick={() => {
                          if (window.confirm("Supprimer cette entrée ?")) {
                            lancer(() => deleteCredit(c.id), { succes: "Supprimé" });
                          }
                        }}
                        className="text-red-400 flex items-center text-base font-bold active:scale-90 transition"
                      >
                        <Trash2 size={12} className="mr-1" /> Supprimer
                      </button>
                      <button
                        onClick={() => {
                          setRemboursement(c.id);
                          setSommeRemb(String(solde(c)));
                        }}
                        className={`flex items-center text-base font-bold active:scale-90 transition ${theme.accent}`}
                      >
                        <HandCoins size={12} className="mr-1" /> Remboursement
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>

        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1.5">
            Historique des remboursements
          </p>
          {remboursements.length === 0 ? (
            <p className="text-center text-xs text-gray-500 py-3">Aucun remboursement pour l&apos;instant.</p>
          ) : (
            <div className="space-y-1.5">
              {remboursements.map((r) => (
                <div key={r.id} className="bg-gray-100 px-2.5 py-2 rounded-lg flex justify-between items-center">
                  <div className="min-w-0 pr-2">
                    <div className="font-bold text-gray-600 text-xs truncate">{r.credit.nomPersonne}</div>
                    <div className="text-[9px] text-gray-400">{jour(r.dateRemboursement)}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="font-bold text-emerald-600 text-xs">+{m(r.montant, r.credit.devise)}</div>
                    <button
                      aria-label="Supprimer ce remboursement"
                      disabled={enCours}
                      onClick={() => {
                        if (window.confirm("Supprimer ce remboursement ? Le solde correspondant sera recrédité.")) {
                          lancer(() => supprimerRemboursement(r.id), { succes: "Remboursement supprimé" });
                        }
                      }}
                      className="text-gray-400 hover:text-red-500 transition"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
