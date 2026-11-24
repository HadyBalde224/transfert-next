import { redirect } from "next/navigation";
import { Alerte, EnTete } from "@/components/ui";
import { TransfertForm } from "@/components/TransfertForm";
import { createClient } from "@/lib/supabase/server";
import { exigerProfil, lireReglages, tot } from "@/lib/session";
import { lireTaux, tauxActifs } from "@/lib/taux";
import { aujourdhui } from "@/lib/periode";
import { nomZone } from "@/lib/zones";

export const metadata = { title: "Nouveau transfert" };

export default async function NouveauTransfert() {
  const tousTaux = tot(lireTaux());
  const profil = await exigerProfil();
  // L'admin supervise : seuls les employés enregistrent (règle aussi en base).
  if (profil.role === "PATRON") redirect("/dashboard");
  const { parametres, devises } = await lireReglages();
  const zone = profil.zone;
  const taux = tauxActifs(await tousTaux, devises).filter(
    (t) => t.devise_source === zone || t.devise_cible === zone
  );

  const supabase = await createClient();
  const { data: cloture } = await supabase
    .from("clotures")
    .select("id")
    .eq("employe_id", profil.id)
    .eq("jour", aujourdhui(parametres.fuseau))
    .maybeSingle();

  return (
    <>
      <EnTete titre="Nouveau Transfert" sous={zone ? `Zone ${nomZone(zone)}` : undefined} />
      <div className="p-4">
        {!zone ? (
          <Alerte>Vous n&apos;avez pas encore de zone. Demandez à l&apos;admin de vous en donner une.</Alerte>
        ) : cloture ? (
          <Alerte>
            Votre journée est clôturée. Demandez à l&apos;admin de la rouvrir pour ajouter un transfert.
          </Alerte>
        ) : (
          <TransfertForm taux={taux} devises={devises} zone={zone} patron={false} />
        )}
      </div>
    </>
  );
}
