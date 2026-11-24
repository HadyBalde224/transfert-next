import { Alerte, EnTete, Onglets, Section, Vide } from "@/components/ui";
import { EmployeCarte, NouvelEmploye } from "@/components/Employes";
import { MotDePasse } from "@/components/MotDePasse";
import { createClient } from "@/lib/supabase/server";
import { adminConfigure } from "@/lib/supabase/admin";
import { exigerPatron, lireNoms, lireReglages, tot } from "@/lib/session";
import { nomZone, zonesPossibles } from "@/lib/zones";
import { horodatage } from "@/lib/format";
import type { ZoneHistorique } from "@/lib/types";

export const metadata = { title: "Équipe" };

async function lireHistorique() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("zones_historique")
    .select("*")
    .order("id", { ascending: false })
    .limit(500)
    .overrideTypes<ZoneHistorique[], { merge: false }>();
  if (error) throw new Error(error.message);
  return data;
}

export default async function Employes() {
  const historique = tot(lireHistorique());
  await exigerPatron();
  const { profils } = await lireNoms();
  const { parametres, devises } = await lireReglages();
  const employes = profils.filter((p) => p.role === "EMPLOYE");
  const zones = zonesPossibles(devises, parametres.devise_base);
  const pret = adminConfigure();

  const data = await historique;

  return (
    <>
      <EnTete titre="Équipe" sous="Vous seul gérez les comptes, les zones et les mots de passe.">
        <Onglets
          onglets={[
            { href: "/journees", label: "Journées", actif: false },
            { href: "/employes", label: "Comptes", actif: true },
            { href: "/releves", label: "Relevés", actif: false },
          ]}
        />
      </EnTete>
      <div className="space-y-5 p-4">
        {!pret && (
          <Alerte>
            Pour créer des comptes, ajoutez <b>SUPABASE_SECRET_KEY</b> sur le serveur, puis redémarrez
            l&apos;application.
          </Alerte>
        )}
        <Section titre="Employés">
          {employes.length === 0 ? (
            <Vide>Aucun employé pour l&apos;instant.</Vide>
          ) : (
            <div className="space-y-3">
              {employes.map((p) => (
                <EmployeCarte
                  key={`${p.id}-${p.nom}-${p.actif}-${p.zone}`}
                  employe={p}
                  zones={zones}
                  historique={data
                    .filter((h) => h.employe_id === p.id)
                    .map((h) => ({
                      id: h.id,
                      texte: h.ancienne
                        ? `${nomZone(h.ancienne)} → ${h.nouvelle ? nomZone(h.nouvelle) : "aucune"}`
                        : `Zone ${h.nouvelle ? nomZone(h.nouvelle) : "aucune"}`,
                      quand: horodatage(h.le, parametres.fuseau),
                    }))}
                  motDePasseModifiable={pret}
                />
              ))}
            </div>
          )}
        </Section>
        <NouvelEmploye desactive={!pret} zones={zones} />
        <Section titre="Mon mot de passe (admin)">
          <MotDePasse />
        </Section>
      </div>
    </>
  );
}
