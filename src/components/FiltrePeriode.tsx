"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { TOUT, type Periode, type Vue } from "@/lib/periode";
import { moisLong } from "@/lib/format";

interface Props {
  base: string;
  periode: Periode;
  // Autres filtres à conserver dans l'URL.
  garder?: Record<string, string>;
}

const url = (base: string, p: Record<string, string>) => `${base}?${new URLSearchParams(p)}`;

const majuscule = (t: string) => t[0].toUpperCase() + t.slice(1);

// Sélecteur de mois dans l'en-tête bleu.
export function SelecteurMois({ base, periode, garder = {}, mois }: Props & { mois: string[] }) {
  const router = useRouter();
  return (
    <div className="relative mb-3 inline-block">
      <select
        aria-label="Mois"
        value={periode.mois}
        onChange={(e) => router.push(url(base, { ...garder, v: "mois", m: e.target.value }))}
        className="cursor-pointer appearance-none rounded-lg bg-white/10 py-1 pr-8 pl-3 font-bold text-blue-100 transition outline-none hover:bg-white/20"
      >
        {mois.map((m) => (
          <option key={m} value={m} className="text-gray-800">
            {majuscule(moisLong(m))}
          </option>
        ))}
        <option value={TOUT} className="text-gray-800">
          Tout l&apos;historique
        </option>
      </select>
      <ChevronDown
        size={14}
        className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-blue-100"
      />
    </div>
  );
}

// Pastilles Mois / Aujourd'hui / Date.
export function PilulesPeriode({ base, periode, garder = {}, today }: Props & { today: string }) {
  const router = useRouter();
  const vues: { vue: Vue; label: string }[] = [
    { vue: "mois", label: periode.mois === TOUT ? "Tout" : "Mois" },
    { vue: "jour", label: "Aujourd'hui" },
    { vue: "date", label: "Date" },
  ];
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        {vues.map(({ vue, label }) => (
          <Link
            key={vue}
            href={url(base, { ...garder, m: periode.mois, v: vue })}
            aria-current={periode.vue === vue ? "true" : undefined}
            className={`pilule flex-1 ${periode.vue === vue ? "pilule-active" : ""}`}
          >
            {label}
          </Link>
        ))}
      </div>
      {periode.vue === "date" && (
        <input
          type="date"
          aria-label="Choisir une date"
          max={today}
          value={periode.debut}
          onChange={(e) =>
            e.target.value &&
            router.push(url(base, { ...garder, m: periode.mois, v: "date", d: e.target.value }))
          }
          className="champ bg-white shadow-sm"
        />
      )}
    </div>
  );
}
