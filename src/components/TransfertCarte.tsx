import Link from "next/link";
import { Calendar, Edit, Eye, Trash2, User } from "lucide-react";
import { dateCourte, heure, montant } from "@/lib/format";
import type { Transfert } from "@/lib/types";
import { Badge } from "@/components/ui";
import { SupprimerTransfert } from "@/components/SupprimerTransfert";

export function TransfertCarte({
  t,
  decimales,
  fuseau,
  base,
  employe,
  patron,
  modifiable,
}: {
  t: Transfert;
  decimales: Record<string, number>;
  fuseau: string;
  base: string;
  employe?: string;
  patron: boolean;
  modifiable: boolean;
}) {
  const f = (v: number, d: string) => montant(v, d, decimales[d]);
  // L'employé lit tout dans sa zone : on met en avant ce côté du transfert.
  const principal =
    patron || t.zone === t.devise_source ? f(t.montant_envoye, t.devise_source) : f(t.montant_recu, t.zone);
  return (
    <article className={`carte transition hover:shadow-md ${t.statut === "ANNULE" ? "opacity-60" : ""}`}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-bold text-gray-800">{t.nom_client}</div>
          <div className="mt-0.5 text-[11px] text-gray-500">{t.telephone_client || "-"}</div>
        </div>
        <div className="text-right">
          <div className="text-base font-black whitespace-nowrap text-gray-800">{principal}</div>
          {t.statut === "ANNULE" && <Badge ton="rouge">Supprimé</Badge>}
          {t.statut === "VALIDE" && t.modifie_le && <Badge ton="ambre">Modifié</Badge>}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 p-2">
        <span className="text-[11px] font-bold text-gray-600">
          {t.devise_source} ➔{" "}
          {patron ? (
            <b className="text-emerald-700">{f(t.montant_recu, t.devise_cible)}</b>
          ) : (
            t.devise_cible
          )}
        </span>
        <span className="text-right text-[11px] font-bold text-amber-700">
          Bénéfice {f(t.benefice_zone, t.zone)}
          {patron && <span className="block text-[10px] text-gray-500">{f(t.benefice_base, base)}</span>}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500">
        <span className="flex items-center">
          <Calendar size={12} className="mr-1" />
          {dateCourte(t.jour)} • {heure(t.cree_le, fuseau)}
        </span>
        {employe && (
          <span className="flex items-center">
            <User size={12} className="mr-1" />
            {employe}
          </span>
        )}
      </div>

      <div className="mt-2.5 flex items-center justify-end gap-5 border-t border-gray-100 pt-2.5">
        <Link
          href={`/transferts/${t.id}`}
          // Sinon une liste de 50 cartes lancerait une centaine de préchargements.
          prefetch={false}
          className="flex items-center text-xs font-bold text-gray-600 transition active:scale-90"
        >
          <Eye size={14} className="mr-1" /> Détails
        </Link>
        {modifiable && (
          <>
            <Link
              href={`/transferts/${t.id}/modifier`}
              prefetch={false}
              className="flex items-center text-xs font-bold text-blue-600 transition active:scale-90"
            >
              <Edit size={14} className="mr-1" /> Éditer
            </Link>
            <SupprimerTransfert
              id={t.id}
              resume={`${t.nom_client} · ${f(t.montant_envoye, t.devise_source)}`}
              className="flex items-center text-xs font-bold text-red-600 transition active:scale-90"
            >
              <Trash2 size={14} className="mr-1" /> Supprimer
            </SupprimerTransfert>
          </>
        )}
      </div>
    </article>
  );
}
