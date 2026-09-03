"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, HandCoins, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  createCredit,
  deleteCredit,
  rembourserCredit,
  supprimerRemboursement,
} from "@/lib/actions/credits";
import { useToast } from "@/components/Toast";
import { toCredit, type Credit, type CreditRow, type CreditType, type Remboursement } from "@/lib/types";

const formatDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date non renseignée" : date.toLocaleDateString("fr-FR");
};

const solde = (item: Credit) => item.montantInitial - item.montantRembourse;

const THEMES: Record<
  CreditType,
  { label: string; actif: string; inactif: string; resume: string; accent: string; bouton: string }
> = {
  ON_ME_DOIT: {
    label: "On me doit",
    actif: "bg-emerald-600 text-white shadow-md",
    inactif: "bg-white text-gray-500 shadow-sm",
    resume: "from-emerald-500 to-emerald-600",
    accent: "text-emerald-600",
    bouton: "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200",
  },
  JE_DOIS: {
    label: "Je dois",
    actif: "bg-red-500 text-white shadow-md",
    inactif: "bg-white text-gray-500 shadow-sm",
    resume: "from-red-500 to-orange-600",
    accent: "text-red-500",
    bouton: "bg-red-500 hover:bg-red-600 shadow-red-200",
  },
};

export default function CreditsPage() {
  const { addToast } = useToast();

  const [type, setType] = useState<CreditType>("ON_ME_DOIT");
  const [credits, setCredits] = useState<Credit[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [recherche, setRecherche] = useState("");
  const [nomPersonne, setNomPersonne] = useState("");
  const [motif, setMotif] = useState("");
  const [montant, setMontant] = useState("");
  const [remboursementId, setRemboursementId] = useState<number | null>(null);
  const [montantRemboursement, setMontantRemboursement] = useState("");

  const theme = THEMES[type];

  useEffect(() => {
    const supabase = createClient();
    const charger = async () => {
      setIsFetching(true);
      const { data, error } = await supabase
        .from("credits")
        .select("*, remboursements(*)")
        .order("date_creation", { ascending: false })
        .returns<CreditRow[]>();

      if (error) {
        addToast("Impossible de récupérer les crédits/dettes.", "error");
      } else {
        setCredits((data ?? []).map(toCredit));
      }
      setIsFetching(false);
    };
    charger();
  }, [addToast]);

  const items = useMemo(() => {
    const terme = recherche.trim().toLowerCase();
    return credits.filter((c) => c.type === type && c.nomPersonne.toLowerCase().includes(terme));
  }, [credits, type, recherche]);

  const enCours = items.filter((c) => solde(c) > 0);
  const totalRestant = enCours.reduce((sum, c) => sum + solde(c), 0);

  const remboursementsRecents = items
    .flatMap((c) => c.remboursements.map((r) => ({ ...r, nomPersonne: c.nomPersonne })))
    .sort((a, b) => new Date(b.dateRemboursement).getTime() - new Date(a.dateRemboursement).getTime());

  const handleAjouter = async (e: FormEvent) => {
    e.preventDefault();
    const montantNum = Number(montant);
    if (!nomPersonne.trim() || !(montantNum > 0)) {
      addToast("Nom et montant valide requis", "warning");
      return;
    }

    const result = await createCredit({
      type,
      nomPersonne: nomPersonne.trim(),
      motif: motif.trim() || null,
      montantInitial: montantNum,
    });

    if ("error" in result) {
      addToast("Échec de l'enregistrement. Réessayez.", "error");
      return;
    }

    setCredits((prev) => [result.data, ...prev]);
    setNomPersonne("");
    setMotif("");
    setMontant("");
    addToast("Enregistré avec succès", "success");
  };

  const handleRembourser = async (id: number) => {
    const montantNum = Number(montantRemboursement);
    if (!(montantNum > 0)) {
      addToast("Montant de remboursement invalide", "warning");
      return;
    }

    const result = await rembourserCredit(id, montantNum);
    if ("error" in result) {
      addToast("Échec du remboursement. Réessayez.", "error");
      return;
    }

    setCredits((prev) => prev.map((c) => (c.id === id ? result.data : c)));
    setRemboursementId(null);
    setMontantRemboursement("");
    addToast(solde(result.data) <= 0 ? "Entièrement remboursé" : "Remboursement enregistré", "success");
  };

  const handleSupprimer = async (id: number) => {
    if (!window.confirm("Supprimer cette entrée ?")) return;
    const result = await deleteCredit(id);
    if ("error" in result) {
      addToast("Échec de la suppression. Réessayez.", "error");
      return;
    }
    setCredits((prev) => prev.filter((c) => c.id !== id));
  };

  const handleSupprimerRemboursement = async (r: Remboursement) => {
    if (!window.confirm("Supprimer ce remboursement ? Le solde correspondant sera recrédité.")) return;
    const result = await supprimerRemboursement(r.id, r.creditId);
    if ("error" in result) {
      addToast("Échec de la suppression. Réessayez.", "error");
      return;
    }
    setCredits((prev) => prev.map((c) => (c.id === result.data.id ? result.data : c)));
    addToast("Remboursement supprimé", "success");
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <div className="bg-gradient-to-br from-blue-700 to-blue-900 text-white p-3 shadow-lg rounded-b-2xl">
        <div className="flex items-center gap-2 mb-2.5">
          <Link href="/dashboard" className="p-1.5 bg-white/10 hover:bg-white/20 rounded-full backdrop-blur-sm transition">
            <ArrowLeft size={16} />
          </Link>
          <h1 className="text-sm font-bold tracking-wide">Crédits &amp; Dettes</h1>
        </div>

        <div className="flex space-x-2 mb-2.5">
          {(Object.entries(THEMES) as [CreditType, (typeof THEMES)[CreditType]][]).map(([key, t]) => (
            <button
              key={key}
              onClick={() => setType(key)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${type === key ? t.actif : t.inactif}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className={`rounded-lg px-2.5 py-2 shadow-sm text-white bg-gradient-to-r ${theme.resume}`}>
          <div className="text-[8px] font-black uppercase tracking-widest text-white/90">
            {type === "ON_ME_DOIT" ? "Total restant à recevoir" : "Total restant à payer"}
          </div>
          <div className="text-base font-black leading-none mt-0.5">
            {totalRestant.toLocaleString("fr-FR")} MAD
          </div>
        </div>
      </div>

      <div className="px-4 mt-3 space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 text-gray-400" size={14} />
          <input
            type="text"
            placeholder="Rechercher un nom..."
            className="w-full bg-white border border-gray-100 pl-8 pr-3 py-2 rounded-xl text-base font-medium shadow-sm outline-none focus:ring-2 focus:ring-blue-500"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
          />
        </div>

        <form onSubmit={handleAjouter} className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 space-y-2">
          <input
            type="text"
            placeholder="Nom de la personne"
            className="w-full bg-gray-50 border border-gray-200 px-3 py-2.5 rounded-xl text-base font-medium outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            value={nomPersonne}
            onChange={(e) => setNomPersonne(e.target.value)}
          />
          <input
            type="text"
            placeholder="Motif (optionnel)"
            className="w-full bg-gray-50 border border-gray-200 px-3 py-2.5 rounded-xl text-base font-medium outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
          />
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="Montant en MAD"
              className="flex-1 min-w-0 bg-gray-50 border border-gray-200 px-3 py-2.5 rounded-xl text-base font-medium outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
              value={montant}
              onChange={(e) => setMontant(e.target.value)}
            />
            <button
              type="submit"
              className={`flex items-center gap-1 px-4 rounded-xl text-white text-sm font-bold shadow-md transition active:scale-95 ${theme.bouton}`}
            >
              <Plus size={16} /> Ajouter
            </button>
          </div>
        </form>
      </div>

      <div className="flex-1 overflow-y-auto px-4 mt-3 pb-8 space-y-4">
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1.5">En cours</p>
          {isFetching ? (
            <p className="text-center text-xs text-gray-400 py-3">Chargement...</p>
          ) : enCours.length === 0 ? (
            <p className="text-center text-xs text-gray-400 py-3">Rien en cours.</p>
          ) : (
            <div className="space-y-2">
              {enCours.map((c) => (
                <div key={c.id} className="bg-white p-2.5 rounded-xl shadow-sm border border-gray-100">
                  <div className="flex justify-between items-start">
                    <div className="min-w-0 pr-2">
                      <div className="font-bold text-gray-800 text-xs truncate">{c.nomPersonne}</div>
                      {c.motif && <div className="text-[10px] text-gray-400 truncate italic">{c.motif}</div>}
                      <div className="text-[9px] text-gray-400 mt-0.5">{formatDate(c.dateCreation)}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`font-black text-sm ${theme.accent}`}>
                        {solde(c).toLocaleString("fr-FR")} MAD
                      </div>
                      {c.montantRembourse > 0 && (
                        <div className="text-[9px] text-gray-400">
                          sur {c.montantInitial.toLocaleString("fr-FR")}
                        </div>
                      )}
                    </div>
                  </div>

                  {remboursementId === c.id ? (
                    <div className="flex gap-1.5 mt-2 pt-2 border-t border-gray-100">
                      <input
                        type="number"
                        autoFocus
                        placeholder={`Max ${solde(c)}`}
                        className="flex-1 bg-gray-50 border border-gray-200 px-2 py-1 rounded-lg text-base outline-none focus:ring-2 focus:ring-blue-500"
                        value={montantRemboursement}
                        onChange={(e) => setMontantRemboursement(e.target.value)}
                      />
                      <button
                        onClick={() => handleRembourser(c.id)}
                        className="px-2.5 bg-blue-600 text-white rounded-lg text-[11px] font-bold active:scale-95 transition"
                      >
                        Valider
                      </button>
                      <button
                        onClick={() => {
                          setRemboursementId(null);
                          setMontantRemboursement("");
                        }}
                        className="px-1.5 text-gray-400 text-[11px]"
                      >
                        Annuler
                      </button>
                    </div>
                  ) : (
                    <div className="flex justify-end items-center gap-3 pt-2 mt-2 border-t border-gray-100">
                      <button
                        onClick={() => handleSupprimer(c.id)}
                        className="text-red-400 flex items-center text-[10px] font-bold active:scale-90 transition"
                      >
                        <Trash2 size={12} className="mr-1" /> Supprimer
                      </button>
                      <button
                        onClick={() => {
                          setRemboursementId(c.id);
                          setMontantRemboursement(String(solde(c)));
                        }}
                        className={`flex items-center text-[10px] font-bold active:scale-90 transition ${theme.accent}`}
                      >
                        <HandCoins size={12} className="mr-1" /> Remboursement
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1.5">
            Historique des remboursements
          </p>
          {remboursementsRecents.length === 0 ? (
            <p className="text-center text-xs text-gray-400 py-3">Aucun remboursement pour l&apos;instant.</p>
          ) : (
            <div className="space-y-1.5">
              {remboursementsRecents.map((r) => (
                <div key={r.id} className="bg-gray-100 px-2.5 py-2 rounded-lg flex justify-between items-center">
                  <div className="min-w-0 pr-2">
                    <div className="font-bold text-gray-600 text-xs truncate">{r.nomPersonne}</div>
                    <div className="text-[9px] text-gray-400">{formatDate(r.dateRemboursement)}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="font-bold text-emerald-600 text-xs">
                      +{r.montant.toLocaleString("fr-FR")} MAD
                    </div>
                    <button
                      onClick={() => handleSupprimerRemboursement(r)}
                      className="text-gray-400 hover:text-red-500 transition"
                    >
                      <Trash2 size={13} />
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
