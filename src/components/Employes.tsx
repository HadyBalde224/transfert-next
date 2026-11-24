"use client";

import Link from "next/link";
import { useState, type SubmitEvent } from "react";
import { creerEmploye, modifierEmploye, reinitialiserMotDePasse } from "@/lib/actions/employes";
import { MOT_DE_PASSE_MIN } from "@/lib/identifiant";
import { nomZone } from "@/lib/zones";
import type { Profil } from "@/lib/types";
import { Badge, Section } from "@/components/ui";
import { useAction } from "@/components/useAction";

// Boutons de choix de zone, comme les sens de transfert.
function ChoixZone({
  zones,
  valeur,
  onChange,
}: {
  zones: string[];
  valeur: string;
  onChange: (z: string) => void;
}) {
  return (
    <div>
      <span className="etiquette">Zone de travail</span>
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-gray-100 p-1">
        {zones.map((z) => (
          <button
            key={z}
            type="button"
            aria-pressed={valeur === z}
            onClick={() => onChange(z)}
            className={`rounded-lg py-2.5 text-sm font-semibold transition ${
              valeur === z ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {nomZone(z)}
          </button>
        ))}
      </div>
    </div>
  );
}

export function NouvelEmploye({ desactive, zones }: { desactive: boolean; zones: string[] }) {
  const { enCours, lancer, addToast } = useAction();
  const [nom, setNom] = useState("");
  const [identifiant, setIdentifiant] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [zone, setZone] = useState("");

  const envoyer = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!zone) {
      addToast("Choisissez la zone de l'employé.", "warning");
      return;
    }
    lancer(() => creerEmploye({ nom, identifiant, motDePasse, zone }), {
      succes: `Compte créé pour ${nom}`,
      apres: () => {
        setNom("");
        setIdentifiant("");
        setMotDePasse("");
        setZone("");
      },
    });
  };

  return (
    <Section titre="Nouvel employé">
      <form onSubmit={envoyer} className="carte space-y-2.5">
        <label className="block">
          <span className="etiquette">Nom complet</span>
          <input id="e-nom" required maxLength={80} className="champ" value={nom} onChange={(e) => setNom(e.target.value)} />
        </label>
        <label className="block">
          <span className="etiquette">Identifiant</span>
          <input id="e-id" required maxLength={30} autoCapitalize="none" autoComplete="off" placeholder="awa.diallo" className="champ" value={identifiant} onChange={(e) => setIdentifiant(e.target.value)} />
        </label>
        <label className="block">
          <span className="etiquette">Mot de passe ({MOT_DE_PASSE_MIN} caractères minimum)</span>
          <input id="e-mdp" type="text" required minLength={MOT_DE_PASSE_MIN} autoComplete="off" className="champ" value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} />
        </label>
        <ChoixZone zones={zones} valeur={zone} onChange={setZone} />
        <button disabled={enCours || desactive} className="btn-primaire w-full py-3 text-sm">
          {enCours ? "Création…" : "Créer le compte"}
        </button>
        {desactive && (
          <p className="text-xs font-medium text-amber-800">
            Bouton désactivé : la clé SUPABASE_SECRET_KEY manque sur le serveur.
          </p>
        )}
      </form>
    </Section>
  );
}

export function EmployeCarte({
  employe,
  zones,
  historique,
  motDePasseModifiable,
}: {
  employe: Profil;
  zones: string[];
  historique: { id: number; texte: string; quand: string }[];
  motDePasseModifiable: boolean;
}) {
  const { enCours, lancer } = useAction();
  const [mode, setMode] = useState<"" | "infos" | "mdp">("");
  const [nom, setNom] = useState(employe.nom);
  const [zone, setZone] = useState(employe.zone ?? "");
  const [motDePasse, setMotDePasse] = useState("");

  const enregistrer = (actif: boolean, succes: string) =>
    lancer(() => modifierEmploye({ id: employe.id, nom, actif, zone: zone || null }), {
      succes,
      apres: () => setMode(""),
    });

  return (
    <article className="carte">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-bold text-gray-800">{employe.nom}</div>
          <div className="text-[11px] text-gray-500">{employe.identifiant}</div>
        </div>
        <div className="flex shrink-0 gap-1.5">
          {employe.zone ? (
            <Badge ton="bleu">Zone {nomZone(employe.zone)}</Badge>
          ) : (
            <Badge ton="ambre">Sans zone</Badge>
          )}
          {employe.actif ? <Badge ton="vert">Actif</Badge> : <Badge ton="gris">Désactivé</Badge>}
        </div>
      </div>

      {mode === "" && (
        <>
          <div className="mt-2.5 flex flex-wrap items-center justify-end gap-x-4 gap-y-2 border-t border-gray-100 pt-2.5 text-xs font-bold">
            <Link href={`/dashboard?v=mois&employe=${employe.id}`} className="text-gray-600">Chiffres</Link>
            <Link href={`/releves?employe=${employe.id}`} className="text-emerald-700">Relevé</Link>
            <button className="text-blue-600" onClick={() => setMode("infos")}>Modifier</button>
            {motDePasseModifiable && (
              <button className="text-blue-600" onClick={() => setMode("mdp")}>Mot de passe</button>
            )}
            <button
              className={employe.actif ? "text-red-600" : "text-emerald-700"}
              disabled={enCours}
              onClick={() => {
                if (employe.actif && !window.confirm(`Désactiver ${employe.nom} ? Son accès est coupé immédiatement, son historique est conservé.`)) return;
                enregistrer(!employe.actif, employe.actif ? "Accès désactivé" : "Accès réactivé");
              }}
            >
              {employe.actif ? "Désactiver" : "Réactiver"}
            </button>
          </div>
          {historique.length > 0 && (
            <details className="mt-2">
              <summary className="text-[11px] font-bold text-gray-500">
                Historique des zones ({historique.length})
              </summary>
              <ul className="mt-1 space-y-1 text-[11px] text-gray-600">
                {historique.map((h) => (
                  <li key={h.id} className="flex justify-between gap-2">
                    <b>{h.texte}</b>
                    <span className="text-gray-500">{h.quand}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}

      {mode === "infos" && (
        <form
          className="mt-3 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            enregistrer(employe.actif, "Employé mis à jour");
          }}
        >
          <label className="block">
            <span className="etiquette">Nom</span>
            <input required maxLength={80} className="champ" value={nom} onChange={(e) => setNom(e.target.value)} />
          </label>
          <ChoixZone zones={zones} valeur={zone} onChange={setZone} />
          <p className="text-[11px] text-gray-500">
            La nouvelle zone s&apos;applique aux prochains transferts. Les anciens gardent la leur.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="btn-secondaire" onClick={() => setMode("")}>Retour</button>
            <button disabled={enCours} className="btn-primaire">Enregistrer</button>
          </div>
        </form>
      )}

      {mode === "mdp" && (
        <form
          className="mt-3 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            lancer(() => reinitialiserMotDePasse(employe.id, motDePasse), {
              succes: "Mot de passe changé",
              apres: () => {
                setMode("");
                setMotDePasse("");
              },
            });
          }}
        >
          <label className="block">
            <span className="etiquette">Nouveau mot de passe de {employe.nom}</span>
            <input type="text" required minLength={MOT_DE_PASSE_MIN} autoComplete="off" className="champ" value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="btn-secondaire" onClick={() => setMode("")}>Retour</button>
            <button disabled={enCours} className="btn-primaire">Changer</button>
          </div>
        </form>
      )}
    </article>
  );
}
