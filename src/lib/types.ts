export type Direction = "MAD_TO_GNF" | "GNF_TO_MAD";
export type CreditType = "ON_ME_DOIT" | "JE_DOIS";

// Formes brutes retournées par Supabase (colonnes snake_case)
export interface TransactionRow {
  id: number;
  user_id: string;
  periode_id: number | null;
  direction: Direction;
  montant_envoye: number;
  nom_client: string | null;
  telephone_client: string | null;
  frais: number;
  taux_echange: number;
  montant_recu: number;
  date_transaction: string;
}

export interface PeriodeRow {
  id: number;
  user_id: string;
  libelle: string;
  date_debut: string;
}

export interface RemboursementRow {
  id: number;
  credit_id: number;
  montant: number;
  date_remboursement: string;
}

export interface CreditRow {
  id: number;
  user_id: string;
  type: CreditType;
  nom_personne: string;
  motif: string | null;
  montant_initial: number;
  montant_rembourse: number;
  date_creation: string;
  remboursements?: RemboursementRow[];
}

// Formes utilisées par les composants (camelCase, identique à l'ancien frontend)
export interface Transaction {
  id: number;
  periodeId: number | null;
  direction: Direction;
  montantEnvoye: number;
  nomClient: string;
  telephoneClient: string;
  frais: number;
  tauxEchange: number;
  montantRecu: number;
  dateTransaction: string;
}

export interface Periode {
  id: number;
  libelle: string;
  dateDebut: string;
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
  montantInitial: number;
  montantRembourse: number;
  dateCreation: string;
  remboursements: Remboursement[];
}

export function toTransaction(row: TransactionRow): Transaction {
  return {
    id: row.id,
    periodeId: row.periode_id,
    direction: row.direction,
    montantEnvoye: Number(row.montant_envoye),
    nomClient: row.nom_client ?? "",
    telephoneClient: row.telephone_client ?? "",
    frais: Number(row.frais),
    tauxEchange: Number(row.taux_echange),
    montantRecu: Number(row.montant_recu),
    dateTransaction: row.date_transaction,
  };
}

export function toPeriode(row: PeriodeRow): Periode {
  return {
    id: row.id,
    libelle: row.libelle,
    dateDebut: row.date_debut,
  };
}

export function toRemboursement(row: RemboursementRow): Remboursement {
  return {
    id: row.id,
    creditId: row.credit_id,
    montant: Number(row.montant),
    dateRemboursement: row.date_remboursement,
  };
}

export function toCredit(row: CreditRow): Credit {
  return {
    id: row.id,
    type: row.type,
    nomPersonne: row.nom_personne,
    motif: row.motif,
    montantInitial: Number(row.montant_initial),
    montantRembourse: Number(row.montant_rembourse),
    dateCreation: row.date_creation,
    remboursements: (row.remboursements ?? []).map(toRemboursement),
  };
}
