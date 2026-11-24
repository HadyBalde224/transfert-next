"use client";

import { useState } from "react";
import { montant, nombre } from "@/lib/format";

export interface Barre {
  cle: string;
  label: string;
  court: string;
  valeur: number;
  nb: number;
}

// Graduation "ronde" : 1, 2 ou 5 x 10^n.
function pasRond(max: number) {
  if (max <= 0) return 1;
  const brut = max / 2;
  const p = 10 ** Math.floor(Math.log10(brut));
  return [1, 2, 5, 10].map((m) => m * p).find((s) => s >= brut) ?? 10 * p;
}

// Une seule série (le titre la nomme) : colonnes sur une ligne de base
// commune ; une perte descend sous la ligne.
export function GraphiqueBenefice({ barres, devise }: { barres: Barre[]; devise: string }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(0, ...barres.map((b) => b.valeur));
  const min = Math.min(0, ...barres.map((b) => b.valeur));
  const pas = pasRond(Math.max(max, -min));
  const haut = Math.max(pas, Math.ceil(max / pas) * pas);
  const bas = Math.floor(min / pas) * pas;
  const etendue = haut - bas;
  const ticks: number[] = [];
  for (let v = bas; v <= haut + pas / 2; v += pas) ticks.push(v);
  const y = (v: number) => ((haut - v) / etendue) * 100;
  const intervalle = Math.ceil(barres.length / 7);

  return (
    <div className="flex gap-2 pt-2" onPointerLeave={() => setActive(null)}>
      <div className="relative h-36 w-9 shrink-0 text-right text-[10px] text-gray-500 tabular-nums">
        {ticks.map((t) => (
          <span key={t} className="absolute right-0 -translate-y-1/2" style={{ top: `${y(t)}%` }}>
            {Math.abs(t) >= 10_000 ? `${nombre(t / 1000, 1)}k` : nombre(t, pas < 1 ? 2 : 0)}
          </span>
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <div className="relative h-36">
          {ticks.map((t) => (
            <div
              key={t}
              className={`absolute inset-x-0 border-t ${t === 0 ? "border-gray-300" : "border-gray-100"}`}
              style={{ top: `${y(t)}%` }}
            />
          ))}
          <div className="absolute inset-0 flex">
            {barres.map((b, i) => (
              <button
                key={b.cle}
                type="button"
                aria-label={`${b.label} : ${montant(b.valeur, devise)}, ${b.nb} transfert(s)`}
                onPointerEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                className="relative h-full min-w-0 flex-1"
              >
                {b.valeur !== 0 && (
                  <span
                    className={`absolute left-1/2 w-[calc(100%-2px)] max-w-5 -translate-x-1/2 ${
                      active === i ? "bg-blue-400" : "bg-blue-600"
                    } ${b.valeur > 0 ? "rounded-t-[4px]" : "rounded-b-[4px]"}`}
                    style={{
                      top: `${b.valeur > 0 ? y(b.valeur) : y(0)}%`,
                      height: `max(2px, ${(Math.abs(b.valeur) / etendue) * 100}%)`,
                    }}
                  />
                )}
              </button>
            ))}
          </div>
          {active !== null && barres[active] && (
            <div
              role="status"
              className="pointer-events-none absolute top-0 z-10 rounded-lg border border-gray-100 bg-white px-2.5 py-1.5 text-[11px] whitespace-nowrap shadow-lg"
              style={
                active < barres.length / 2
                  ? { left: `${((active + 1) / barres.length) * 100}%` }
                  : { right: `${((barres.length - active) / barres.length) * 100}%` }
              }
            >
              <div className="text-sm font-black text-gray-900">{montant(barres[active].valeur, devise)}</div>
              <div className="text-gray-600">{barres[active].label}</div>
              <div className="text-gray-500">{barres[active].nb} transfert(s)</div>
            </div>
          )}
        </div>
        <div className="mt-1 flex text-[10px] text-gray-500">
          {barres.map((b, i) => (
            <div key={b.cle} className="min-w-0 flex-1">
              <span className="flex justify-center whitespace-nowrap">{i % intervalle === 0 ? b.court : ""}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
