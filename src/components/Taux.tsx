"use client";

import { useState, type SubmitEvent } from "react";
import { Trash2 } from "lucide-react";
import { enregistrerDevise, supprimerDevise, type SensTaux } from "@/lib/actions/taux";
import { CATALOGUE, nomZone } from "@/lib/zones";
import { Badge } from "@/components/ui";
import { useAction } from "@/components/useAction";

export interface ZoneTaux {
  code: string;
  nom: string;
  aller: SensTaux | null;
  retour: SensTaux | null;
}

interface Saisie {
  client: string;
  reel: string;
  frais: string;
}

const VIDE: Saisie = { client: "", reel: "", frais: "3" };
const versSaisie = (t: SensTaux | null): Saisie =>
  t ? { client: String(t.client), reel: String(t.reel), frais: String(t.frais) } : VIDE;
const versNombres = (s: Saisie): SensTaux => ({
  client: Number(s.client),
  reel: Number(s.reel),
  frais: Number(s.frais),
});

// Marge en % du montant net ; même formule que calculer_transfert.
function Marge({ inverse, client, reel }: { inverse: boolean; client: number; reel: number }) {
  if (!(client > 0) || !(reel > 0)) return null;
  const m = (1 - (inverse ? reel / client : client / reel)) * 100;
  return (
    <span className={`text-[11px] font-bold ${m < 0 ? "text-red-700" : "text-amber-700"}`}>
      Marge {m.toFixed(2).replace(".", ",")} %{m < 0 && " : à perte"}
    </span>
  );
}

function Sens({
  source,
  cible,
  inverse,
  valeur,
  onChange,
}: {
  source: string;
  cible: string;
  inverse: boolean;
  valeur: Saisie;
  onChange: (s: Saisie) => void;
}) {
  const champ = (cle: keyof Saisie, label: string, max?: string) => (
    <label>
      <span className="etiquette">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        min="0"
        max={max}
        step="any"
        required
        aria-label={`${label} ${source} vers ${cible}`}
        className="champ"
        value={valeur[cle]}
        onChange={(e) => onChange({ ...valeur, [cle]: e.target.value })}
      />
    </label>
  );
  return (
    <fieldset className="rounded-xl bg-gray-50 p-2.5">
      <legend className="sr-only">
        {source} vers {cible}
      </legend>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-black text-gray-800">
          {source} → {cible}
        </span>
        <Marge inverse={inverse} client={Number(valeur.client)} reel={Number(valeur.reel)} />
      </div>
      <p className="mb-1.5 text-[11px] text-gray-500">
        {inverse ? `1 ${cible} = combien de ${source} ?` : `1 ${source} = combien de ${cible} ?`}
      </p>
      <div className="grid grid-cols-[1fr_1fr_4.5rem] gap-2">
        {champ("client", "Taux client")}
        {champ("reel", "Taux réel")}
        {champ("frais", "Frais %", "100")}
      </div>
    </fieldset>
  );
}

// Les deux sens d'une devise. Tant que le retour n'est pas touché, il suit
// l'aller : il s'écrit de la même façon.
function useDeuxSens(zone: { aller: SensTaux | null; retour: SensTaux | null }) {
  const [aller, setAller] = useState(versSaisie(zone.aller));
  const [retourSaisi, setRetour] = useState<Saisie | null>(zone.retour ? versSaisie(zone.retour) : null);
  return { aller, setAller, retour: retourSaisi ?? aller, setRetour };
}

function ChampsZone({
  code,
  base,
  sens,
}: {
  code: string;
  base: string;
  sens: ReturnType<typeof useDeuxSens>;
}) {
  const forte = CATALOGUE[code]?.forte ?? false;
  return (
    <>
      <Sens source={base} cible={code} inverse={forte} valeur={sens.aller} onChange={sens.setAller} />
      <Sens source={code} cible={base} inverse={!forte} valeur={sens.retour} onChange={sens.setRetour} />
    </>
  );
}

export function ZoneCarte({ zone, base }: { zone: ZoneTaux; base: string }) {
  const { enCours, lancer } = useAction();
  const sens = useDeuxSens(zone);

  const enregistrer = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    lancer(
      () =>
        enregistrerDevise({
          code: zone.code,
          aller: versNombres(sens.aller),
          retour: versNombres(sens.retour),
        }),
      { succes: `Zone ${nomZone(zone.code)} enregistrée` }
    );
  };

  return (
    <form className="carte space-y-2.5" onSubmit={enregistrer}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-black text-gray-800">Zone {nomZone(zone.code)}</div>
          <div className="text-[11px] text-gray-500">{zone.nom}</div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {!zone.aller && <Badge ton="ambre">À régler</Badge>}
          <button
            type="button"
            disabled={enCours}
            className="flex items-center text-xs font-bold text-red-600 disabled:opacity-50"
            onClick={() => {
              if (
                window.confirm(
                  `Supprimer la zone ${nomZone(zone.code)} ? Elle disparaît du site. Les transferts déjà faits sont conservés, et vous pourrez la rajouter.`
                )
              ) {
                lancer(() => supprimerDevise(zone.code), { succes: `Zone ${nomZone(zone.code)} supprimée` });
              }
            }}
          >
            <Trash2 size={14} className="mr-1" /> Supprimer
          </button>
        </div>
      </div>
      <ChampsZone code={zone.code} base={base} sens={sens} />
      <button disabled={enCours} className="btn-primaire w-full">
        {enCours ? "Enregistrement…" : "Enregistrer"}
      </button>
    </form>
  );
}

export function AjouterZone({ codes, base }: { codes: string[]; base: string }) {
  const [code, setCode] = useState("");
  return (
    <div className="carte space-y-2.5">
      <label className="block">
        <span className="etiquette">Ajouter une devise</span>
        <select className="champ" value={code} onChange={(e) => setCode(e.target.value)}>
          <option value="">Choisir dans la liste…</option>
          {codes.map((c) => (
            <option key={c} value={c}>
              {c} – {CATALOGUE[c].nom}
            </option>
          ))}
        </select>
      </label>
      {code && <FormulaireAjout key={code} code={code} base={base} fini={() => setCode("")} />}
    </div>
  );
}

function FormulaireAjout({ code, base, fini }: { code: string; base: string; fini: () => void }) {
  const { enCours, lancer } = useAction();
  const sens = useDeuxSens({ aller: null, retour: null });

  const ajouter = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    lancer(
      () => enregistrerDevise({ code, aller: versNombres(sens.aller), retour: versNombres(sens.retour) }),
      { succes: `Zone ${nomZone(code)} ajoutée`, apres: fini }
    );
  };

  return (
    <form className="space-y-2.5" onSubmit={ajouter}>
      <ChampsZone code={code} base={base} sens={sens} />
      <button disabled={enCours} className="btn-primaire w-full">
        {enCours ? "Ajout…" : `Ajouter la zone ${nomZone(code)}`}
      </button>
    </form>
  );
}
