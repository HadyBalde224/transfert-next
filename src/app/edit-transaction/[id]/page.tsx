"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, User, Phone, Wallet, ArrowRightLeft } from "lucide-react";
import { getTransaction, updateTransaction } from "@/lib/actions/transactions";
import { useToast } from "@/components/Toast";
import type { Direction } from "@/lib/types";

const TAUX_FIXE = 1000;

export default function EditTransactionPage() {
  return (
    <Suspense fallback={null}>
      <EditTransactionForm />
    </Suspense>
  );
}

function EditTransactionForm() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const periodeParam = searchParams.get("periode");
  const dashboardHref = periodeParam ? `/dashboard?periode=${periodeParam}` : "/dashboard";
  const { addToast } = useToast();

  const [nomClient, setNomClient] = useState("");
  const [telephoneClient, setTelephoneClient] = useState("");
  const [direction, setDirection] = useState<Direction>("MAD_TO_GNF");
  const [montantBase, setMontantBase] = useState("");
  const [frais, setFrais] = useState("3");
  const [loading, setLoading] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);

  const montantNum = Number(montantBase) || 0;
  const fraisNum = Number(frais) || 0;
  const montantRecuClient = montantNum;
  const montantNetSource = montantRecuClient * (1 - fraisNum / 100);
  const montantFrais = montantRecuClient - montantNetSource;
  const montantNetTarget =
    direction === "MAD_TO_GNF" ? montantNetSource * TAUX_FIXE : montantNetSource / TAUX_FIXE;

  const operationMeta =
    direction === "MAD_TO_GNF"
      ? {
          sourceCurrency: "MAD",
          targetCurrency: "GNF",
          sourceLabel: "Montant reçu du client",
          targetLabel: "Montant à envoyer là-bas",
        }
      : {
          sourceCurrency: "GNF",
          targetCurrency: "MAD",
          sourceLabel: "Montant reçu du client",
          targetLabel: "À remettre au client (Net)",
        };

  const deviseMontantNet = operationMeta.sourceCurrency;

  useEffect(() => {
    const numericId = Number(id);
    if (!numericId) return;

    (async () => {
      const result = await getTransaction(numericId);
      if ("error" in result) {
        addToast("Transaction introuvable", "warning");
        router.push(dashboardHref);
        return;
      }
      const tx = result.data;
      setNomClient(tx.nomClient);
      setTelephoneClient(tx.telephoneClient);
      setDirection(tx.direction);
      setMontantBase(String(tx.montantEnvoye));
      // Reconstruit le % de frais d'origine à partir du montant stocké
      // (le backend ne conserve que le montant, pas le pourcentage saisi).
      const pct = tx.montantEnvoye > 0 ? (tx.frais / tx.montantEnvoye) * 100 : 3;
      setFrais(String(Math.round(pct * 100) / 100));
      setLoadingInitial(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, addToast]);

  const boxHaut = {
    titre: `${operationMeta.sourceLabel} :`,
    montant: montantRecuClient,
    devise: operationMeta.sourceCurrency,
    couleur:
      direction === "MAD_TO_GNF"
        ? "bg-blue-50 border-blue-200 text-blue-700"
        : "bg-slate-50 border-slate-200 text-slate-700",
  };
  const boxBas = {
    titre: `${operationMeta.targetLabel} :`,
    montant: montantNetTarget,
    devise: operationMeta.targetCurrency,
    couleur:
      direction === "MAD_TO_GNF"
        ? "bg-slate-50 border-slate-200 text-slate-700"
        : "bg-emerald-50 border-emerald-200 text-emerald-700",
  };

  const handleUpdate = async (e: FormEvent) => {
    e.preventDefault();

    if (!nomClient.trim() || montantNum <= 0) {
      addToast("Veuillez saisir au moins le nom et un montant valide", "warning");
      return;
    }

    setLoading(true);
    const result = await updateTransaction(Number(id), {
      nomClient: nomClient.trim(),
      telephoneClient: telephoneClient.trim(),
      direction,
      montantEnvoye: montantRecuClient,
      frais: montantFrais,
    });
    setLoading(false);

    if ("error" in result) {
      addToast("Échec de la mise à jour. Réessayez.", "error");
      return;
    }

    addToast("Transaction mise à jour avec succès", "success");
    router.push(dashboardHref);
  };

  if (loadingInitial) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 py-4 px-3 flex justify-center font-sans">
      <div className="max-w-md w-full">
        <div className="bg-orange-600 rounded-t-2xl p-4 text-white shadow-lg flex items-center gap-3">
          <Link href={dashboardHref} className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-lg font-bold tracking-wide">Modifier Transaction</h1>
        </div>

        <form onSubmit={handleUpdate} className="bg-white rounded-b-2xl shadow-xl p-3 -mt-1 space-y-3">
          <div>
            <p className="text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">
              Informations Client
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <User size={16} className="absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Nom complet"
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-9 pr-3 text-base outline-none focus:ring-2 focus:ring-orange-500 transition"
                  value={nomClient}
                  onChange={(e) => setNomClient(e.target.value)}
                />
              </div>
              <div className="relative">
                <Phone size={16} className="absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="+212 / +224"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-9 pr-3 text-base outline-none focus:ring-2 focus:ring-orange-500 transition"
                  value={telephoneClient}
                  onChange={(e) => setTelephoneClient(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">
              Type d&apos;opération
            </p>
            <div className="flex p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                className={`flex-1 flex justify-center items-center gap-2 py-2 text-sm font-semibold rounded-lg transition ${direction === "MAD_TO_GNF" ? "bg-white shadow-sm text-orange-600" : "text-slate-500 hover:text-slate-700"}`}
                onClick={() => setDirection("MAD_TO_GNF")}
              >
                <ArrowRightLeft size={16} className="rotate-45" />
                MAD → GNF
              </button>
              <button
                type="button"
                className={`flex-1 flex justify-center items-center gap-2 py-2 text-sm font-semibold rounded-lg transition ${direction === "GNF_TO_MAD" ? "bg-white shadow-sm text-emerald-600" : "text-slate-500 hover:text-slate-700"}`}
                onClick={() => setDirection("GNF_TO_MAD")}
              >
                <ArrowRightLeft size={16} className="-rotate-45" />
                GNF → MAD
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <p className="text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider">
                Montant reçu du client ({deviseMontantNet})
              </p>
              <input
                type="number"
                placeholder="Ex: 1000"
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-lg font-bold text-slate-800 outline-none focus:ring-2 focus:ring-orange-500 transition placeholder:text-slate-300"
                value={montantBase}
                onChange={(e) => setMontantBase(e.target.value)}
              />
            </div>
            <div className="col-span-1">
              <p className="text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider">% Frais</p>
              <input
                type="number"
                step="0.1"
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-base font-bold text-center text-slate-700 outline-none focus:ring-2 focus:ring-orange-500 transition"
                value={frais}
                onChange={(e) => setFrais(e.target.value)}
              />
            </div>
          </div>

          <hr className="border-slate-100" />

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-2.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Bénéfice estimé</div>
            <div className="text-sm font-semibold text-amber-800">
              {montantFrais.toLocaleString("fr-FR")} {operationMeta.sourceCurrency}
            </div>
          </div>

          <div className="space-y-2">
            <div className={`border rounded-xl p-2.5 flex justify-between items-center transition-colors ${boxHaut.couleur}`}>
              <div className="flex items-center gap-2 font-medium text-xs">
                <Wallet size={16} /> {boxHaut.titre}
              </div>
              <div className="text-sm font-semibold">
                {boxHaut.montant.toLocaleString("fr-FR")} <span className="text-[11px]">{boxHaut.devise}</span>
              </div>
            </div>

            <div className={`border rounded-xl p-2.5 flex justify-between items-center transition-colors ${boxBas.couleur}`}>
              <div className="flex items-center gap-2 font-medium text-xs">
                <Wallet size={16} /> {boxBas.titre}
              </div>
              <div className="text-sm font-semibold">
                {boxBas.montant.toLocaleString("fr-FR")} <span className="text-[11px]">{boxBas.devise}</span>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full text-white font-bold py-2.5 rounded-xl shadow-lg mt-1 transition active:scale-[0.98] ${direction === "MAD_TO_GNF" ? "bg-orange-600 hover:bg-orange-700 shadow-orange-200" : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200"} ${loading ? "opacity-70 cursor-not-allowed" : ""}`}
          >
            {loading ? "Mise à jour..." : "Mettre à jour"}
          </button>
        </form>
      </div>
    </div>
  );
}
