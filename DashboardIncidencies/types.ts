export enum IncidentType {
  ABSENCIES = "Absències",
  DEURES = "Deures",
  RETARD = "Retard",
  MOBIL_REQUISAT = "Mòbil requisat",
  FALTA_RESPECTE = "Falta de respecte",
  EXPULSAT_CLASSE = "Expulsat de classe",
  FULL_INCIDENCIA = "Full d'incidència",
}

export enum Curs {
  PRIMER_ESO = "1r ESO",
  SEGON_ESO = "2n ESO",
  TERCER_ESO = "3r.ESO",
  QUART_ESO = "4t.ESO",
}

export interface RawIncidentData {
  Alumne: string;
  Curs: string;
  Tipus: string;
  Quantitat: string;
}

export interface Incident {
  id: string;
  alumne: string;
  curs: Curs;
  tipus: IncidentType;
  quantitat: number;
}

export type StudentSummary = {
  alumne: string;
  total: number;
} & {
  [key in IncidentType]?: number;
};

export interface DataWarning {
  type: 'unknown_type' | 'missing_quantity';
  message: string;
  count: number;
}