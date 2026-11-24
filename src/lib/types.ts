// Formes retournées par Supabase. Les noms de colonnes sont conservés tels
// quels pour les nouvelles tables.
export type Role = "PATRON" | "EMPLOYE";
export type Statut = "VALIDE" | "ANNULE";

export interface Profil {
  id: string;
  identifiant: string;
  nom: string;
  role: Role;
  actif: boolean;
  zone: string | null;
  cree_le: string;
}

export interface Devise {
  code: string;
  nom: string;
  decimales: number;
  unites_par_base: number | null;
  forte: boolean;
  actif: boolean;
  ordre: number;
}

export interface Parametres {
  devise_base: string;
  fuseau: string;
  employe_modifie_frais: boolean;
  // Absents tant que le script "recus" n'a pas été exécuté.
  entreprise_nom?: string;
  entreprise_telephone: string;
  entreprise_adresse: string;
  recu_message: string;
}

export interface Taux {
  id: number;
  devise_source: string;
  devise_cible: string;
  inverse: boolean;
  taux_client: number;
  taux_reel: number;
  frais_pct: number;
  actif: boolean;
  maj_le: string;
}

export interface TauxHistorique extends Omit<Taux, "maj_le"> {
  auteur_id: string | null;
  le: string;
}

export interface Transfert {
  id: number;
  employe_id: string;
  jour: string;
  cree_le: string;
  modifie_le: string | null;
  statut: Statut;
  nom_client: string;
  telephone_client: string;
  nom_beneficiaire: string;
  telephone_beneficiaire: string;
  note: string;
  devise_source: string;
  devise_cible: string;
  montant_envoye: number;
  frais_pct: number;
  frais: number;
  inverse: boolean;
  taux_client: number;
  taux_reel: number;
  montant_recu: number;
  marge_taux: number;
  benefice: number;
  benefice_base: number;
  zone: string;
  benefice_zone: number;
  ancien_id: number | null;
  code_recu?: string;
}

export interface JournalEntree {
  id: number;
  transfert_id: number;
  auteur_id: string;
  action: "MODIFICATION" | "ANNULATION" | "RETABLISSEMENT";
  motif: string;
  avant: Transfert;
  apres: Transfert;
  le: string;
}

export interface Cloture {
  id: number;
  employe_id: string;
  jour: string;
  rapport: string;
  nb_transferts: number;
  benefice_base: number;
  par_zone: { zone: string; nb: number; benefice: number }[];
  cloture_le: string;
}

export interface ZoneHistorique {
  id: number;
  employe_id: string;
  ancienne: string | null;
  nouvelle: string | null;
  le: string;
}

export interface Rapport {
  // Bénéfices en devise de base, sauf "par_zone" et "par_employe_zone".
  total: { nb: number; benefice: number };
  par_jour: { jour: string; nb: number; benefice: number }[];
  par_zone: { zone: string; nb: number; benefice: number; benefice_base: number }[];
  par_employe: { employe_id: string; nom: string; nb: number; benefice: number }[];
  par_employe_zone: { employe_id: string; zone: string; nb: number; benefice: number }[];
  par_corridor: {
    source: string;
    cible: string;
    nb: number;
    volume: number;
    remis: number;
    benefice_base: number;
  }[];
}

// Crédits et dettes (tables d'origine)
export type CreditType = "ON_ME_DOIT" | "JE_DOIS";

export interface RemboursementRow {
  id: number;
  credit_id: number;
  montant: number;
  date_remboursement: string;
}

export interface CreditRow {
  id: number;
  type: CreditType;
  nom_personne: string;
  motif: string | null;
  devise: string;
  montant_initial: number;
  montant_rembourse: number;
  date_creation: string;
  remboursements?: RemboursementRow[];
}

export interface Remboursement {
  id: number;
  creditId: number;
  montant: number;
  dateRemboursement: string;
}

export interface Credit {
  id: number;
  type: CreditType;
  nomPersonne: string;
  motif: string | null;
  devise: string;
  montantInitial: number;
  montantRembourse: number;
  dateCreation: string;
  remboursements: Remboursement[];
}

export function toCredit(row: CreditRow): Credit {
  return {
    id: row.id,
    type: row.type,
    nomPersonne: row.nom_personne,
    motif: row.motif,
    devise: row.devise,
    montantInitial: Number(row.montant_initial),
    montantRembourse: Number(row.montant_rembourse),
    dateCreation: row.date_creation,
    remboursements: (row.remboursements ?? []).map((r) => ({
      id: r.id,
      creditId: r.credit_id,
      montant: Number(r.montant),
      dateRemboursement: r.date_remboursement,
    })),
  };
}
