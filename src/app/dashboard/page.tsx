"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  PlusCircle,
  LogOut,
  Wallet,
  Calendar,
  Trash2,
  Edit,
  Search,
  Filter,
  TrendingUp,
  CalendarPlus,
  ChevronDown,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { deleteTransaction } from "@/lib/actions/transactions";
import { getActivePeriode, createPeriode, deletePeriode } from "@/lib/actions/periodes";
import { libelleMoisCourant } from "@/lib/mois";
import { useToast } from "@/components/Toast";
import {
  toPeriode,
  toTransaction,
  type Periode,
  type PeriodeRow,
  type Transaction,
  type TransactionRow,
} from "@/lib/types";

type FiltreDate = "all" | "today" | "date";
type FiltreType = "ALL" | "ENVOI" | "RETRAIT";

const getFormattedDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;

const formatDepotDateTime = (tx: Transaction) => {
  const parsed = new Date(tx.dateTransaction);
  if (Number.isNaN(parsed.getTime())) return "Date non renseignée";
  const formattedDate = parsed.toLocaleDateString("fr-FR");
  const formattedTime = parsed.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${formattedDate} • ${formattedTime}`;
};

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const periodeIdParam = searchParams.get("periode");

  const [periodes, setPeriodes] = useState<Periode[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filtreDate, setFiltreDate] = useState<FiltreDate>("all");
  const [dateSelection, setDateSelection] = useState(() => getFormattedDate(new Date()));
  const [filtreType, setFiltreType] = useState<FiltreType>("ALL");
  const [recherche, setRecherche] = useState("");
  const [isFetching, setIsFetching] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [creatingPeriode, setCreatingPeriode] = useState(false);
  const [deletingPeriode, setDeletingPeriode] = useState(false);
  const { addToast } = useToast();

  // Charge la liste des mois une seule fois.
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("periodes")
        .select()
        .order("id", { ascending: false })
        .returns<PeriodeRow[]>();

      if (error) {
        addToast("Impossible de récupérer les mois.", "error");
        return;
      }

      let liste = data.map(toPeriode);
      if (liste.length === 0) {
        const result = await getActivePeriode();
        if (!("error" in result)) liste = [result.data];
      }
      setPeriodes(liste);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Le mois affiché est dérivé de l'URL (sinon le plus récent) — pas besoin
  // de le dupliquer dans un state séparé.
  const periode = useMemo(() => {
    if (periodes.length === 0) return null;
    const idFromUrl = periodeIdParam ? Number(periodeIdParam) : null;
    return periodes.find((p) => p.id === idFromUrl) ?? periodes[0];
  }, [periodes, periodeIdParam]);

  // Canonicalise l'URL si elle ne pointe pas (encore) sur le mois résolu,
  // pour que le mois choisi survive à une navigation (ex: retour depuis
  // "Nouveau Transfert").
  useEffect(() => {
    if (!periode) return;
    const idFromUrl = periodeIdParam ? Number(periodeIdParam) : null;
    if (idFromUrl !== periode.id) {
      router.replace(`/dashboard?periode=${periode.id}`);
    }
  }, [periode, periodeIdParam, router]);

  // Charge les transactions du mois affiché.
  useEffect(() => {
    if (!periode) return;
    (async () => {
      const supabase = createClient();
      setIsFetching(true);
      const { data, error } = await supabase
        .from("transactions")
        .select()
        .eq("periode_id", periode.id)
        .order("date_transaction", { ascending: false })
        .returns<TransactionRow[]>();

      if (error) {
        addToast("Impossible de récupérer les transactions.", "error");
      } else {
        setTransactions(data.map(toTransaction));
      }
      setIsFetching(false);
    })();
  }, [periode, addToast]);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.refresh();
    router.push("/");
  };

  const handleChangerMois = (periodeId: number) => {
    router.push(`/dashboard?periode=${periodeId}`);
  };

  const handleNouveauMois = async () => {
    setCreatingPeriode(true);
    const result = await createPeriode();
    setCreatingPeriode(false);
    if ("error" in result) {
      addToast("Échec de la création du nouveau mois. Réessayez.", "error");
      return;
    }
    setPeriodes((prev) => [result.data, ...prev]);
    router.push(`/dashboard?periode=${result.data.id}`);
    addToast(`Nouveau mois créé : ${result.data.libelle}`, "success");
  };

  const handleSupprimerMois = async () => {
    if (!periode) return;
    if (
      !window.confirm(
        `Supprimer le mois "${periode.libelle}" ? Cette action est possible uniquement si ce mois est vide.`
      )
    )
      return;

    setDeletingPeriode(true);
    const result = await deletePeriode(periode.id);
    setDeletingPeriode(false);

    if ("error" in result) {
      addToast(result.error, "error");
      return;
    }

    const restants = periodes.filter((p) => p.id !== periode.id);
    setPeriodes(restants);
    addToast(`Mois "${periode.libelle}" supprimé`, "success");

    if (restants.length > 0) {
      router.push(`/dashboard?periode=${restants[0].id}`);
    } else {
      const fallback = await getActivePeriode();
      if (!("error" in fallback)) {
        setPeriodes([fallback.data]);
        router.push(`/dashboard?periode=${fallback.data.id}`);
      }
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Supprimer cette transaction ?")) return;
    setDeletingId(id);
    const result = await deleteTransaction(id);
    if ("error" in result) {
      addToast("Échec de la suppression. Réessayez.", "error");
    } else {
      setTransactions((prev) => prev.filter((tx) => tx.id !== id));
      addToast("Transaction supprimée", "success");
    }
    setDeletingId(null);
  };

  const matchesDateFilter = (tx: Transaction) => {
    if (filtreDate === "all") return true;
    const parsedDate = new Date(tx.dateTransaction);
    if (Number.isNaN(parsedDate.getTime())) return false;
    const normalizedDate = getFormattedDate(parsedDate);
    if (filtreDate === "today") return normalizedDate === getFormattedDate(new Date());
    if (filtreDate === "date" && dateSelection) return normalizedDate === dateSelection;
    return true;
  };

  const transactionsAffichees = useMemo(() => {
    const terme = recherche.toLowerCase();
    return transactions.filter((tx) => {
      const matchRecherche =
        tx.nomClient.toLowerCase().includes(terme) ||
        tx.telephoneClient.toLowerCase().includes(terme);
      const matchDate = matchesDateFilter(tx);
      let matchType = true;
      if (filtreType === "ENVOI") matchType = tx.direction === "MAD_TO_GNF";
      if (filtreType === "RETRAIT") matchType = tx.direction === "GNF_TO_MAD";
      return matchRecherche && matchDate && matchType;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, recherche, filtreDate, dateSelection, filtreType]);

  const totalFraisMAD = transactionsAffichees.reduce(
    (sum, t) => (t.direction === "MAD_TO_GNF" ? sum + t.frais : sum),
    0
  );
  const totalFraisGNF = transactionsAffichees.reduce(
    (sum, t) => (t.direction === "GNF_TO_MAD" ? sum + t.frais : sum),
    0
  );

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* EN-TÊTE PREMIUM */}
      <div className="bg-gradient-to-br from-blue-700 to-blue-900 text-white p-4 shadow-lg rounded-b-3xl">
        <div className="flex justify-between items-center mb-1">
          <h1 className="text-lg font-bold tracking-wide">
            Espace <span className="text-blue-300">Patron</span>
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={handleNouveauMois}
              disabled={creatingPeriode}
              title="Démarrer un nouveau mois"
              className="p-1.5 bg-white/10 hover:bg-white/20 rounded-full backdrop-blur-sm transition disabled:opacity-50"
            >
              <CalendarPlus size={16} />
            </button>
            <Link
              href="/credits"
              className="p-1.5 bg-white/10 hover:bg-white/20 rounded-full backdrop-blur-sm transition"
            >
              <Wallet size={16} />
            </Link>
            <button
              onClick={handleLogout}
              className="p-1.5 bg-white/10 hover:bg-red-500 rounded-full backdrop-blur-sm transition"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>

        {periode && (
          <div className="flex items-center gap-2 mb-3">
            <div className="relative inline-block">
              <select
                value={periode.id}
                onChange={(e) => handleChangerMois(Number(e.target.value))}
                className="appearance-none bg-white/10 hover:bg-white/20 text-blue-100 text-[11px] font-black uppercase tracking-wider rounded-lg pl-2.5 pr-7 py-1 outline-none cursor-pointer transition"
              >
                {periodes.map((p) => (
                  <option key={p.id} value={p.id} className="text-gray-800">
                    {p.libelle}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={12}
                className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-blue-100"
              />
            </div>
            {!isFetching &&
              transactions.length === 0 &&
              periode.libelle !== libelleMoisCourant() && (
                <button
                  onClick={handleSupprimerMois}
                  disabled={deletingPeriode}
                  title="Supprimer ce mois (vide)"
                  className="p-1 text-blue-200 hover:text-red-300 transition disabled:opacity-50"
                >
                  <Trash2 size={14} />
                </button>
              )}
          </div>
        )}

        <div className="mb-1">
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-lg p-2.5 shadow-sm text-white">
            <div className="flex items-center text-white/90 text-[9px] font-black mb-1.5 uppercase tracking-widest">
              <TrendingUp size={12} className="mr-1" /> Bénéfices{" "}
              {filtreDate === "today"
                ? "d'Aujourd'hui"
                : filtreDate === "date"
                  ? "du jour sélectionné"
                  : "du mois"}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-md bg-white/15 p-1.5">
                <div className="text-[9px] uppercase tracking-[0.2em] text-amber-100">MAD</div>
                <div className="text-lg font-black leading-none mt-1">
                  {totalFraisMAD.toLocaleString("fr-FR")}
                </div>
              </div>
              <div className="rounded-md bg-black/10 p-1.5 text-right">
                <div className="text-[9px] uppercase tracking-[0.2em] text-amber-100">GNF</div>
                <div className="text-lg font-black leading-none mt-1">
                  {totalFraisGNF.toLocaleString("fr-FR")}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FILTRES & RECHERCHE */}
      <div className="px-4 mt-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Rechercher (Nom, Tél)..."
            className="w-full bg-white border border-gray-100 pl-9 pr-4 py-2.5 rounded-xl text-base font-medium focus:ring-2 focus:ring-blue-500 shadow-sm transition"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
          />
        </div>

        <div className="flex space-x-2">
          <button
            onClick={() => setFiltreDate("all")}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${filtreDate === "all" ? "bg-blue-600 text-white shadow-md" : "bg-white text-gray-500 shadow-sm"}`}
          >
            Tout
          </button>
          <button
            onClick={() => setFiltreDate("today")}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${filtreDate === "today" ? "bg-blue-600 text-white shadow-md" : "bg-white text-gray-500 shadow-sm"}`}
          >
            Aujourd&apos;hui
          </button>
          <button
            onClick={() => setFiltreDate("date")}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${filtreDate === "date" ? "bg-blue-600 text-white shadow-md" : "bg-white text-gray-500 shadow-sm"}`}
          >
            Date
          </button>
        </div>

        {filtreDate === "date" && (
          <div className="rounded-2xl border border-gray-100 bg-white p-2.5 shadow-sm">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
              Sélectionner une date
            </label>
            <input
              type="date"
              value={dateSelection}
              onChange={(e) => setDateSelection(e.target.value)}
              className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-base font-medium text-gray-700 outline-none focus:border-blue-400 focus:bg-white"
            />
          </div>
        )}

        <div className="flex space-x-2 pt-1 pb-1">
          <div className="flex items-center text-gray-400 text-xs mr-1">
            <Filter size={14} />
          </div>
          <button
            onClick={() => setFiltreType("ALL")}
            className={`px-4 py-1.5 rounded-full text-[11px] font-bold transition ${filtreType === "ALL" ? "bg-gray-800 text-white" : "bg-gray-200 text-gray-600"}`}
          >
            Tous
          </button>
          <button
            onClick={() => setFiltreType("ENVOI")}
            className={`px-4 py-1.5 rounded-full text-[11px] font-bold transition ${filtreType === "ENVOI" ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-600"}`}
          >
            Envois 📤
          </button>
          <button
            onClick={() => setFiltreType("RETRAIT")}
            className={`px-4 py-1.5 rounded-full text-[11px] font-bold transition ${filtreType === "RETRAIT" ? "bg-green-600 text-white" : "bg-green-50 text-green-600"}`}
          >
            Retraits 📥
          </button>
        </div>
      </div>

      {/* LISTE DES TRANSACTIONS */}
      <div className="flex-1 overflow-y-auto px-4 pt-1 pb-24">
        {isFetching ? (
          <div className="flex flex-col items-center justify-center mt-10 text-gray-400">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-3"></div>
            <p className="text-xs font-medium">Chargement des transactions...</p>
          </div>
        ) : transactionsAffichees.length === 0 ? (
          <p className="text-center text-xs text-gray-400 mt-8 font-medium">
            Aucune opération trouvée.
          </p>
        ) : (
          <div className="space-y-3">
            {transactionsAffichees.map((tx) => (
              <div
                key={tx.id}
                className="bg-white p-3.5 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-bold text-gray-800 text-sm">{tx.nomClient || "Anonyme"}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5">{tx.telephoneClient || "-"}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-gray-800 text-base">
                      {tx.montantEnvoye.toLocaleString("fr-FR")}{" "}
                      <span className="text-[10px] font-bold text-gray-400">
                        {tx.direction === "MAD_TO_GNF" ? "MAD" : "GNF"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center bg-gray-50 p-2 rounded-lg mt-2">
                  <div className="text-[10px] font-black text-gray-500 tracking-wider">
                    {tx.direction === "MAD_TO_GNF" ? "🇲🇦 ➔ 🇬🇳" : "🇬🇳 ➔ 🇲🇦"}
                  </div>
                  <div className="text-[11px] text-red-500 font-bold">
                    Frais: {tx.frais.toLocaleString("fr-FR")}{" "}
                    {tx.direction === "MAD_TO_GNF" ? "MAD" : "GNF"}
                  </div>
                </div>

                <div className="flex items-center text-[10px] text-gray-500 mt-2">
                  <Calendar size={12} className="mr-1" />
                  Dépôt: {formatDepotDateTime(tx)}
                </div>

                <div className="flex justify-end items-center pt-3 mt-3 space-x-4 border-t border-gray-100">
                  <Link
                    href={`/edit-transaction/${tx.id}${periode ? `?periode=${periode.id}` : ""}`}
                    className="text-blue-500 flex items-center text-[11px] font-bold active:scale-90 transition"
                  >
                    <Edit size={14} className="mr-1" /> Éditer
                  </Link>
                  <button
                    onClick={() => handleDelete(tx.id)}
                    disabled={deletingId === tx.id}
                    className="text-red-500 flex items-center text-[11px] font-bold active:scale-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Trash2 size={14} className="mr-1" />{" "}
                    {deletingId === tx.id ? "Suppression..." : "Supprimer"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* BOUTON NOUVEAU FLOTTANT */}
      <div className="absolute bottom-4 left-4 right-4 max-w-md mx-auto">
        <Link
          href={periode ? `/new-transaction?periode=${periode.id}` : "/new-transaction"}
          className="flex items-center justify-center w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white py-3.5 rounded-xl font-black text-base shadow-[0_8px_20px_rgb(34,197,94,0.3)] hover:shadow-[0_8px_25px_rgb(34,197,94,0.5)] transition active:scale-95"
        >
          <PlusCircle className="mr-2" size={20} />
          Nouveau Transfert
        </Link>
      </div>
    </div>
  );
}
