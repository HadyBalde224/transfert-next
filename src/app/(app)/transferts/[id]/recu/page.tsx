import { notFound } from "next/navigation";
import { Alerte, EnTete } from "@/components/ui";
import { Recu } from "@/components/Recu";
import { exigerProfil, lireNoms, lireReglages, tot } from "@/lib/session";
import { lireTransfert } from "@/lib/transfert";
import { numeroRecu } from "@/lib/recu";
import { construireRecu } from "@/lib/donneesRecu";

export const metadata = { title: "Reçu" };

export default async function PageRecu({ params }: PageProps<"/transferts/[id]/recu">) {
  const { id } = await params;
  const transfert = tot(lireTransfert(id));
  await exigerProfil();
  const t = await transfert;
  if (!t) notFound();
  const { parametres, decimales } = await lireReglages();
  const { noms } = await lireNoms();
  const donnees = construireRecu(t, parametres, decimales, noms[t.employe_id] ?? "");

  if (!donnees) {
    return (
      <>
        <EnTete titre="Reçu" retour={`/transferts/${t.id}`} />
        <div className="p-4">
          <Alerte>
            Les reçus ne sont pas encore activés. Exécutez le script
            supabase/migrations/20261124240000_recus.sql dans Supabase.
          </Alerte>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="no-print">
        <EnTete titre={`Reçu ${numeroRecu(t.id, t.jour)}`} retour={`/transferts/${t.id}`} />
      </div>
      <div className="p-4 print:p-0">
        <Recu donnees={donnees} />
      </div>
    </>
  );
}
