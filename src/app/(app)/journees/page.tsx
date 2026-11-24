import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Badge, CarteBenefice, EnTete, Onglets, Section, Vide } from "@/components/ui";
import { CloturerForm, RouvrirBouton } from "@/components/Cloture";
import { createClient } from "@/lib/supabase/server";
import { exigerProfil, lireNoms, lireReglages } from "@/lib/session";
import { ajouterJours, aujourdhui, jourValide, un } from "@/lib/periode";
import { nomZone } from "@/lib/zones";
import { dateCourte, dateLongue, horodatage, montant } from "@/lib/format";
import type { Cloture, Rapport } from "@/lib/types";

export const metadata = { title: "Journées" };

export default async function Journees({ searchParams }: PageProps<"/journees">) {
  const profil = await exigerProfil();
  const patron = profil.role === "PATRON";
  const { parametres, decimales } = await lireReglages();
  const { profils, noms } = await lireNoms();
  const today = aujourdhui(parametres.fuseau);
  const demande = un((await searchParams).jour);
  const jour = patron && jourValide(demande) && demande <= today ? demande : today;
  const base = parametres.devise_base;
  const fmt = (v: number) => montant(v, base, decimales[base]);

  const supabase = await createClient();
  const [rap, clo, hist] = await Promise.all([
    supabase.rpc("rapport", { p_debut: jour, p_fin: jour, p_employe: patron ? null : profil.id }),
    supabase.from("clotures").select("*").eq("jour", jour).overrideTypes<Cloture[], { merge: false }>(),
    supabase
      .from("clotures")
      .select("*")
      .order("jour", { ascending: false })
      .order("id", { ascending: false })
      .limit(30)
      .overrideTypes<Cloture[], { merge: false }>(),
  ]);
  const erreur = rap.error ?? clo.error ?? hist.error;
  if (erreur) throw new Error(erreur.message);
  const r = rap.data as Rapport;
  const clotures = new Map(clo.data!.map((c) => [c.employe_id, c]));
  const historique = hist.data!;
  const enZone = (v: number, z: string) => montant(v, z, decimales[z]);
  const casesZone = r.par_zone.map((z) => ({ label: nomZone(z.zone), valeur: enZone(z.benefice, z.zone) }));
  // L'employé lit son bénéfice dans sa zone ; l'admin, dans la devise de base.
  const maZone = profil.zone;
  const totalZone = enZone(r.par_zone.find((z) => z.zone === maZone)?.benefice ?? 0, maZone ?? base);
  const autresZones = r.par_zone.some((z) => z.zone !== maZone);
  const carte = (
    <CarteBenefice
      titre="Bénéfice du jour"
      total={patron ? fmt(r.total.benefice) : totalZone}
      detail={`${r.total.nb} transfert${r.total.nb > 1 ? "s" : ""}`}
      cases={patron || autresZones ? casesZone : []}
    />
  );

  if (!patron) {
    const maCloture = clotures.get(profil.id);
    return (
      <>
        <EnTete titre="Ma journée" sous={dateLongue(today)}>
          {carte}
        </EnTete>
        <div className="space-y-5 p-4">
          <div className="carte">
            {maCloture ? (
              <div className="text-xs text-gray-600">
                <Badge ton="vert">Journée clôturée</Badge> le{" "}
                {horodatage(maCloture.cloture_le, parametres.fuseau)}
                {maCloture.rapport && (
                  <p className="mt-2 text-sm whitespace-pre-line text-gray-800">{maCloture.rapport}</p>
                )}
              </div>
            ) : (
              <CloturerForm nb={r.total.nb} benefice={casesZone.map((c) => c.valeur).join(" + ") || totalZone} />
            )}
          </div>
          <Section titre="Mes journées précédentes">
            <Historique clotures={historique.filter((c) => c.jour !== today)} fmt={fmt} enZone={enZone} />
          </Section>
        </div>
      </>
    );
  }

  const parEmploye = new Map(r.par_employe.map((e) => [e.employe_id, e]));
  // Les employés actifs, plus quiconque a travaillé ou clôturé ce jour-là.
  const lignes = profils.filter(
    (p) => p.role === "EMPLOYE" && (p.actif || parEmploye.has(p.id) || clotures.has(p.id))
  );

  return (
    <>
      <EnTete titre="Équipe" sous={dateLongue(jour)}>
        <div className="space-y-2.5">
          <Onglets
            onglets={[
              { href: "/journees", label: "Journées", actif: true },
              { href: "/employes", label: "Comptes", actif: false },
              { href: "/releves", label: "Relevés", actif: false },
            ]}
          />
          {carte}
        </div>
      </EnTete>
      <div className="space-y-5 p-4">
        <div className="flex items-center gap-2">
          <Link href={`/journees?jour=${ajouterJours(jour, -1)}`} aria-label="Veille" className="pilule">
            <ChevronLeft size={18} />
          </Link>
          <form action="/journees" key={jour} className="flex flex-1 gap-2">
            <input
              type="date"
              name="jour"
              aria-label="Jour"
              max={today}
              defaultValue={jour}
              className="champ bg-white shadow-sm"
            />
            <button className="pilule">Voir</button>
          </form>
          {jour < today && (
            <Link href={`/journees?jour=${ajouterJours(jour, 1)}`} aria-label="Lendemain" className="pilule">
              <ChevronRight size={18} />
            </Link>
          )}
        </div>

        <div className="space-y-3">
          {lignes.length === 0 && <Vide>Aucune activité ce jour-là.</Vide>}
          {lignes.map((p) => {
            const c = clotures.get(p.id);
            const e = parEmploye.get(p.id);
            const nb = e?.nb ?? 0;
            return (
              <article key={p.id} className="carte">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-bold text-gray-800">{p.nom}</div>
                    <div className="text-[11px] text-gray-500">
                      {nb} transfert{nb > 1 ? "s" : ""}
                      {p.zone && ` · zone ${nomZone(p.zone)}`}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-gray-800">
                      {r.par_employe_zone
                        .filter((z) => z.employe_id === p.id)
                        .map((z) => enZone(z.benefice, z.zone))
                        .join(" + ") || enZone(0, p.zone ?? base)}
                    </div>
                    {nb > 0 && <div className="text-[10px] text-gray-500">{fmt(e?.benefice ?? 0)}</div>}
                    {c ? <Badge ton="vert">Clôturée</Badge> : <Badge ton="ambre">Non clôturée</Badge>}
                  </div>
                </div>
                {c?.rapport && (
                  <p className="mt-2 rounded-lg bg-gray-50 p-2 text-xs whitespace-pre-line text-gray-700">
                    {c.rapport}
                  </p>
                )}
                {c && (c.nb_transferts !== nb || c.benefice_base !== (e?.benefice ?? 0)) && (
                  <p className="mt-2 text-[11px] font-medium text-amber-800">
                    Modifié depuis la clôture : elle indiquait {c.nb_transferts} transfert(s) et{" "}
                    {fmt(c.benefice_base)}.
                  </p>
                )}
                {(nb > 0 || c) && (
                  <div className="mt-2.5 flex items-center justify-end gap-5 border-t border-gray-100 pt-2.5">
                    <Link
                      href={`/transferts?${new URLSearchParams({ v: "date", d: jour, m: jour.slice(0, 7), employe: p.id })}`}
                      className="text-xs font-bold text-blue-600"
                    >
                      Ses transferts
                    </Link>
                    {c && <RouvrirBouton id={c.id} nom={p.nom} />}
                  </div>
                )}
              </article>
            );
          })}
        </div>

        <Section titre="Dernières clôtures">
          <Historique clotures={historique} fmt={fmt} enZone={enZone} noms={noms} />
        </Section>
      </div>
    </>
  );
}

function Historique({
  clotures,
  fmt,
  enZone,
  noms,
}: {
  clotures: Cloture[];
  fmt: (v: number) => string;
  enZone: (v: number, z: string) => string;
  noms?: Record<string, string>;
}) {
  if (clotures.length === 0) return <Vide>Aucune journée clôturée.</Vide>;
  return (
    <ul className="carte divide-y divide-gray-100 py-1">
      {clotures.map((c) => (
        <li key={c.id} className="py-2.5">
          <div className="flex justify-between gap-2 text-sm">
            <span className="font-bold text-gray-800">
              {dateCourte(c.jour)}
              {noms && <span className="font-medium text-gray-500"> · {noms[c.employe_id]}</span>}
            </span>
            <b className="text-right">
              {c.par_zone.map((z) => enZone(z.benefice, z.zone)).join(" + ") || fmt(c.benefice_base)}
            </b>
          </div>
          <div className="text-[11px] text-gray-500">
            {c.nb_transferts} transfert{c.nb_transferts > 1 ? "s" : ""}
            {c.rapport && ` · ${c.rapport}`}
          </div>
        </li>
      ))}
    </ul>
  );
}
