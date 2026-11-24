// Aperçu affiché pendant la saisie. Le calcul qui fait foi est celui de la
// base (fonction SQL calculer_transfert) ; les deux suivent la même formule.
interface Entree {
  montant: number;
  fraisPct: number;
  inverse: boolean;
  tauxClient: number;
  tauxReel: number;
  decSource: number;
  decCible: number;
}

const arrondir = (v: number, dec: number) => Math.round((v + Number.EPSILON) * 10 ** dec) / 10 ** dec;

export function apercu(e: Entree) {
  const frais = arrondir((e.montant * e.fraisPct) / 100, e.decSource);
  const net = e.montant - frais;
  const recu = arrondir(e.inverse ? net / e.tauxClient : net * e.tauxClient, e.decCible);
  const marge = arrondir(
    net * (1 - (e.inverse ? e.tauxReel / e.tauxClient : e.tauxClient / e.tauxReel)),
    e.decSource
  );
  return { frais, recu, marge, benefice: arrondir(frais + marge, e.decSource) };
}

// Même règle que la fonction SQL vers_zone.
export function versZone(
  benefice: number,
  t: { source: string; zone: string; inverse: boolean; tauxReel: number; decZone: number }
) {
  const v =
    t.source === t.zone ? benefice : t.inverse ? benefice / t.tauxReel : benefice * t.tauxReel;
  return arrondir(v, t.decZone);
}
