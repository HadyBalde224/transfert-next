import Link from "next/link";
import { Edit, Receipt, RotateCcw, Trash2 } from "lucide-react";
import { SupprimerTransfert } from "@/components/SupprimerTransfert";
import type { Statut } from "@/lib/types";

export function ActionsTransfert({
  id,
  statut,
  resume,
  patron,
  modifiable,
}: {
  id: number;
  statut: Statut;
  resume: string;
  patron: boolean;
  modifiable: boolean;
}) {
  return (
    <div className="no-print flex flex-wrap gap-2">
      <Link href={`/transferts/${id}/recu`} className="btn-primaire flex-1">
        <Receipt size={14} /> Reçu
      </Link>
      {modifiable && (
        <>
          <Link href={`/transferts/${id}/modifier`} className="btn-secondaire flex-1">
            <Edit size={14} /> Modifier
          </Link>
          <SupprimerTransfert id={id} resume={resume} className="btn-danger flex-1">
            <Trash2 size={14} /> Supprimer
          </SupprimerTransfert>
        </>
      )}
      {patron && statut === "ANNULE" && (
        <SupprimerTransfert id={id} resume={resume} retablir className="btn-secondaire flex-1">
          <RotateCcw size={14} /> Rétablir
        </SupprimerTransfert>
      )}
    </div>
  );
}
