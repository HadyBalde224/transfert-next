const MOIS_FR = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

export function libelleMoisCourant(date = new Date()) {
  return `${MOIS_FR[date.getMonth()]} ${date.getFullYear()}`;
}
