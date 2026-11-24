import { notFound, redirect } from "next/navigation";
import { EnTete } from "@/components/ui";
import { TransfertForm } from "@/components/TransfertForm";
import { exigerProfil, lireReglages, tot } from "@/lib/session";
import { lireDroits } from "@/lib/droits";
import { lireTaux, tauxActifs } from "@/lib/taux";
import { lireTransfert } from "@/lib/transfert";

export const metadata = { title: "Modifier un transfert" };

export default async function ModifierTransfert({ params }: PageProps<"/transferts/[id]/modifier">) {
  const { id } = await params;
  const transfert = tot(lireTransfert(id));
  const tousTaux = tot(lireTaux());
  const profil = await exigerProfil();
  const t = await transfert;
  if (!t) notFound();
  const { parametres, devises } = await lireReglages();
  const { modifiable, explication } = await lireDroits(profil, parametres.fuseau);
  if (!modifiable(t)) redirect(`/transferts/${t.id}`);
  // Un transfert reste dans sa zone d'origine.
  const taux = tauxActifs(await tousTaux, devises).filter(
    (x) => x.devise_source === t.zone || x.devise_cible === t.zone
  );

  return (
    <>
      <EnTete
        titre={`Modifier le transfert n° ${t.id}`}
        sous={explication(t) || "Le taux d'origine est conservé si les devises ne changent pas."}
        retour={`/transferts/${t.id}`}
      />
      <div className="p-4">
        <TransfertForm
          taux={taux}
          devises={devises}
          zone={t.zone}
          patron={profil.role === "PATRON"}
          transfert={t}
        />
      </div>
    </>
  );
}
