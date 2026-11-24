"use client";

import { useState, type SubmitEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, Phone, User, Wallet } from "lucide-react";
import { creerTransfert, modifierTransfert } from "@/lib/actions/transferts";
import { apercu, versZone } from "@/lib/calcul";
import { libelleTaux, montant as fmt } from "@/lib/format";
import type { Devise, Taux, Transfert } from "@/lib/types";
import { useAction } from "@/components/useAction";

interface Props {
  taux: Taux[];
  devises: Devise[];
  zone: string;
  patron: boolean;
  transfert?: Transfert;
}

export function TransfertForm({ taux, devises, zone, patron, transfert }: Props) {
  const router = useRouter();
  const { enCours, lancer, addToast } = useAction();

  // Identifiant unique de cette saisie : si le réseau coupe et qu'on renvoie,
  // la base reconnaît le même transfert et ne l'enregistre pas deux fois.
  const [cle, setCle] = useState(() => crypto.randomUUID());
  const [source, setSource] = useState(transfert?.devise_source ?? taux[0]?.devise_source ?? "");
  const [cible, setCible] = useState(transfert?.devise_cible ?? taux[0]?.devise_cible ?? "");
  const [somme, setSomme] = useState(transfert ? String(transfert.montant_envoye) : "");
  // null = frais standard du sens choisi.
  const [frais, setFrais] = useState<string | null>(transfert ? String(transfert.frais_pct) : null);
  const [nomClient, setNomClient] = useState(transfert?.nom_client ?? "");
  const [telClient, setTelClient] = useState(transfert?.telephone_client ?? "");
  const [nomBenef, setNomBenef] = useState(transfert?.nom_beneficiaire ?? "");
  const [telBenef, setTelBenef] = useState(transfert?.telephone_beneficiaire ?? "");
  const [note, setNote] = useState(transfert?.note ?? "");
  const [motif, setMotif] = useState("");

  const decimales = Object.fromEntries(devises.map((d) => [d.code, d.decimales]));
  const memePaire = transfert?.devise_source === source && transfert?.devise_cible === cible;
  // En correction sur le même sens, on garde les conditions d'origine.
  const regle = memePaire
    ? transfert
    : taux.find((t) => t.devise_source === source && t.devise_cible === cible);

  const sens = taux.map((t) => ({ s: t.devise_source, c: t.devise_cible }));
  if (transfert && !sens.some((x) => x.s === transfert.devise_source && x.c === transfert.devise_cible)) {
    sens.unshift({ s: transfert.devise_source, c: transfert.devise_cible });
  }

  const choisir = (s: string, c: string) => {
    setSource(s);
    setCible(c);
    const retour = transfert?.devise_source === s && transfert?.devise_cible === c;
    setFrais(retour ? String(transfert.frais_pct) : null);
  };

  const fraisTexte = frais ?? (regle ? String(regle.frais_pct) : "");
  const montantNum = Number(somme) || 0;
  const fraisPct = Number(fraisTexte) || 0;
  const decSource = decimales[source] ?? 2;
  const decCible = decimales[cible] ?? 2;

  const inchange =
    memePaire && transfert.montant_envoye === montantNum && transfert.frais_pct === fraisPct;
  const resultat = !regle
    ? null
    : inchange
      ? { recu: transfert.montant_recu, benefice: transfert.benefice }
      : apercu({
          montant: montantNum,
          fraisPct,
          inverse: regle.inverse,
          tauxClient: regle.taux_client,
          tauxReel: regle.taux_reel,
          decSource,
          decCible,
        });

  // Le bénéfice est toujours affiché dans la zone.
  const beneficeZone = !regle || !resultat
    ? 0
    : inchange
      ? transfert.benefice_zone
      : versZone(resultat.benefice, {
          source,
          zone,
          inverse: regle.inverse,
          tauxReel: regle.taux_reel,
          decZone: decimales[zone] ?? 2,
        });

  const envoyer = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!regle) return;
    if (!nomClient.trim() || !(montantNum > 0)) {
      addToast("Saisissez le nom du client et un montant valide.", "warning");
      return;
    }
    const saisie = {
      source,
      cible,
      montant: montantNum,
      fraisPct,
      tauxVu: regle.taux_client,
      nomClient,
      telephoneClient: telClient,
      nomBeneficiaire: nomBenef,
      telephoneBeneficiaire: telBenef,
      note,
    };
    lancer(
      () => (transfert ? modifierTransfert(transfert.id, saisie, motif) : creerTransfert(cle, saisie)),
      {
        succes: transfert ? "Transfert corrigé" : "Transfert enregistré",
        apres: (id) => {
          setCle(crypto.randomUUID());
          router.push(`/transferts/${id}`);
        },
        // Le taux a pu changer pendant la saisie : on recharge les taux.
        echec: () => router.refresh(),
      }
    );
  };

  if (sens.length === 0) {
    return <p className="carte text-sm">Aucun taux n&apos;est actif pour la zone {zone}. L&apos;admin doit en régler un.</p>;
  }

  return (
    <form onSubmit={envoyer} className="space-y-4 rounded-2xl bg-white p-3.5 shadow-xl">
      <fieldset>
        <legend className="surtitre">Sens du transfert</legend>
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1">
          {sens.map(({ s, c }) => {
            const actif = s === source && c === cible;
            return (
              <button
                key={`${s}-${c}`}
                type="button"
                aria-pressed={actif}
                onClick={() => choisir(s, c)}
                className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition ${
                  actif ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <ArrowRightLeft size={15} /> {s} → {c}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="surtitre">Client</legend>
        <div className="grid grid-cols-2 gap-2">
          <div className="relative">
            <User size={16} className="absolute top-3.5 left-3 text-gray-400" />
            <input required maxLength={120} aria-label="Nom du client" placeholder="Nom complet" className="champ pl-9" value={nomClient} onChange={(e) => setNomClient(e.target.value)} />
          </div>
          <div className="relative">
            <Phone size={16} className="absolute top-3.5 left-3 text-gray-400" />
            <input type="tel" maxLength={40} aria-label="Téléphone du client" placeholder="Téléphone" className="champ pl-9" value={telClient} onChange={(e) => setTelClient(e.target.value)} />
          </div>
        </div>
      </fieldset>

      <div className="grid grid-cols-3 gap-3">
        <label className="col-span-2">
          <span className="surtitre block">Montant reçu ({source})</span>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            required
            placeholder="Ex: 1000"
            aria-label="Montant reçu"
            className="champ font-bold"
            value={somme}
            onChange={(e) => setSomme(e.target.value)}
          />
        </label>
        <label>
          <span className="surtitre block">% Frais</span>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            max="100"
            step="any"
            required
            disabled={!patron}
            aria-label="Pourcentage de frais"
            className="champ text-center font-bold"
            value={fraisTexte}
            onChange={(e) => setFrais(e.target.value)}
          />
        </label>
      </div>

      {regle && resultat && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-blue-800">
            <span className="flex items-center gap-2 text-xs font-medium">
              <Wallet size={16} /> Reçu du client
            </span>
            <b className="text-sm whitespace-nowrap">{fmt(montantNum, source, decSource)}</b>
          </div>
          <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-800">
            <span className="flex items-center gap-2 text-xs font-medium">
              <Wallet size={16} /> À remettre
            </span>
            <b className="text-lg whitespace-nowrap" data-testid="a-remettre">
              {fmt(resultat.recu, cible, decCible)}
            </b>
          </div>
          <div className="flex items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-800">
            <span className="text-xs font-medium">
              Bénéfice
              <span className="block text-[10px]">
                {libelleTaux({ ...regle, devise_source: source, devise_cible: cible, taux: regle.taux_client })}
              </span>
            </span>
            <b className={`text-sm whitespace-nowrap ${resultat.benefice < 0 ? "text-red-700" : ""}`}>
              {fmt(beneficeZone, zone, decimales[zone])}
            </b>
          </div>
          {resultat.benefice < 0 && montantNum > 0 && (
            <p className="text-xs font-bold text-red-700">Attention : ce transfert est à perte.</p>
          )}
        </div>
      )}

      <details open={Boolean(transfert && (nomBenef || telBenef || note))}>
        <summary className="text-xs font-bold text-blue-600">Bénéficiaire et note (facultatif)</summary>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <input maxLength={120} aria-label="Nom du bénéficiaire" placeholder="Nom" className="champ" value={nomBenef} onChange={(e) => setNomBenef(e.target.value)} />
          <input type="tel" maxLength={40} aria-label="Téléphone du bénéficiaire" placeholder="Téléphone" className="champ" value={telBenef} onChange={(e) => setTelBenef(e.target.value)} />
          <input maxLength={500} aria-label="Note" placeholder="Note" className="champ col-span-2" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </details>

      {transfert && (
        <label className="block">
          <span className="surtitre block">Motif de la correction</span>
          <input required maxLength={300} aria-label="Motif" placeholder="Ex. erreur de montant" className="champ" value={motif} onChange={(e) => setMotif(e.target.value)} />
        </label>
      )}

      <button
        type="submit"
        disabled={enCours || !regle}
        className="w-full rounded-xl bg-blue-600 py-3 font-bold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {enCours ? "Enregistrement…" : transfert ? "Enregistrer la correction" : "Confirmer la transaction"}
      </button>
    </form>
  );
}
