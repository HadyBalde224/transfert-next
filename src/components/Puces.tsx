import Link from "next/link";
import { Filter } from "lucide-react";
import { Attente } from "@/components/Attente";

// Rangée de filtres arrondis, défilable au doigt.
export function Puces({
  base,
  nom,
  valeur,
  tous,
  options,
  garder,
}: {
  base: string;
  nom: string;
  valeur?: string;
  tous: string;
  options: { valeur: string; label: string }[];
  garder: Record<string, string>;
}) {
  const lien = (v?: string) => `${base}?${new URLSearchParams(v ? { ...garder, [nom]: v } : garder)}`;
  return (
    <div className="sans-barre -mx-4 flex items-center gap-2 overflow-x-auto px-4">
      <Filter size={14} className="shrink-0 text-gray-400" />
      <Link href={lien()} className={`puce ${valeur ? "" : "puce-active"}`}>
        <Attente>{tous}</Attente>
      </Link>
      {options.map((o) => (
        <Link
          key={o.valeur}
          href={lien(o.valeur)}
          className={`puce ${valeur === o.valeur ? "puce-active" : ""}`}
        >
          <Attente>{o.label}</Attente>
        </Link>
      ))}
    </div>
  );
}
