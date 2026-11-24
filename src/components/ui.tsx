import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, PlusCircle, TrendingUp } from "lucide-react";

const ICONE = "rounded-full bg-white/10 p-2 backdrop-blur-sm transition hover:bg-white/20";

export function IconeLien({ href, label, children }: { href: string; label: string; children: ReactNode }) {
  return (
    <Link href={href} aria-label={label} title={label} className={ICONE}>
      {children}
    </Link>
  );
}

// En-tête de l'accueil : grand dégradé bleu, icônes rondes à droite.
export function EnTeteAccueil({
  accent,
  icones,
  children,
}: {
  accent: string;
  icones: ReactNode;
  children: ReactNode;
}) {
  return (
    <header className="no-print rounded-b-3xl bg-gradient-to-br from-blue-700 to-blue-900 p-4 text-white shadow-lg">
      <div className="mb-2 flex items-center justify-between">
        <h1 className="text-lg font-bold tracking-wide">
          Espace <span className="text-blue-300">{accent}</span>
        </h1>
        <div className="flex items-center gap-2">{icones}</div>
      </div>
      {children}
    </header>
  );
}

// En-tête des autres pages : flèche de retour, titre, contenu facultatif.
export function EnTete({
  titre,
  sous,
  retour = "/dashboard",
  actions,
  children,
}: {
  titre: ReactNode;
  sous?: ReactNode;
  retour?: string;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="rounded-b-2xl bg-gradient-to-br from-blue-700 to-blue-900 p-3 text-white shadow-lg print:rounded-none print:bg-none print:p-0 print:text-black print:shadow-none">
      <div className="flex items-center gap-2.5">
        <Link href={retour} aria-label="Retour" className={`${ICONE} no-print`}>
          <ArrowLeft size={18} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-bold tracking-wide">{titre}</h1>
          {sous && <p className="text-[11px] text-blue-200 print:text-gray-600">{sous}</p>}
        </div>
        {actions && <div className="no-print flex items-center gap-2">{actions}</div>}
      </div>
      {children && <div className="mt-2.5">{children}</div>}
    </header>
  );
}

// Onglets blancs dans l'en-tête (comme "On me doit / Je dois").
export function Onglets({ onglets }: { onglets: { href: string; label: string; actif: boolean }[] }) {
  return (
    <nav className="flex gap-2">
      {onglets.map((o) => (
        <Link
          key={o.href}
          href={o.href}
          aria-current={o.actif ? "page" : undefined}
          className={`flex-1 rounded-lg py-2 text-center text-xs font-bold transition ${
            o.actif ? "bg-white text-blue-800 shadow-md" : "bg-white/10 text-blue-100"
          }`}
        >
          {o.label}
        </Link>
      ))}
    </nav>
  );
}

// Carte orange des bénéfices.
export function CarteBenefice({
  titre,
  total,
  detail,
  cases = [],
}: {
  titre: string;
  total: string;
  detail: string;
  cases?: { label: string; valeur: string }[];
}) {
  return (
    <div className="rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 p-3 text-white shadow-sm">
      <div className="flex items-center text-[10px] font-black tracking-widest uppercase">
        <TrendingUp size={13} className="mr-1" /> {titre}
      </div>
      <div className="mt-1 flex items-end justify-between gap-2">
        <div className="text-2xl leading-none font-black">{total}</div>
        <div className="text-xs font-semibold">{detail}</div>
      </div>
      {cases.length > 0 && (
        <div className="sans-barre mt-2.5 flex gap-2 overflow-x-auto">
          {cases.map((c) => (
            <div key={c.label} className="min-w-24 flex-1 rounded-md bg-black/10 p-1.5">
              <div className="text-[10px] tracking-[0.2em] uppercase">{c.label}</div>
              <div className="mt-0.5 text-sm leading-tight font-black whitespace-nowrap">{c.valeur}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Section({ titre, lien, children }: { titre: string; lien?: ReactNode; children: ReactNode }) {
  return (
    <section>
      <div className="flex items-baseline justify-between">
        <h2 className="surtitre">{titre}</h2>
        {lien}
      </div>
      {children}
    </section>
  );
}

export function Vide({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-xs font-medium text-gray-500">{children}</p>;
}

const TONS = {
  vert: "bg-emerald-50 text-emerald-700",
  rouge: "bg-red-50 text-red-700",
  ambre: "bg-amber-50 text-amber-800",
  bleu: "bg-blue-50 text-blue-700",
  gris: "bg-gray-100 text-gray-600",
};

export function Badge({ ton, children }: { ton: keyof typeof TONS; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold whitespace-nowrap ${TONS[ton]}`}>
      {children}
    </span>
  );
}

export function Alerte({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-medium text-amber-900">
      {children}
    </div>
  );
}

// Bouton vert flottant.
export function BoutonNouveau() {
  return (
    <div className="no-print pointer-events-none fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <Link
        href="/transferts/nouveau"
        className="pointer-events-auto flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-green-600 to-emerald-700 py-3.5 text-base font-black text-white shadow-[0_8px_20px_rgb(34,197,94,0.3)] transition hover:shadow-[0_8px_25px_rgb(34,197,94,0.5)] active:scale-95"
      >
        <PlusCircle className="mr-2" size={20} />
        Nouveau Transfert
      </Link>
    </div>
  );
}
