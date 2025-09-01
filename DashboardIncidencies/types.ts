
export enum Course {
  PR1 = '1r ESO',
  PR2 = '2n ESO',
  PR3 = '3r ESO',
  PR4 = '4t ESO',
}

export enum IncidentType {
  ABSENCIES = 'Absències',
  DEURES = 'Deures',
  RETARD = 'Retard',
  MOBIL = 'Mòbil requisat',
  FALTA_RESPECTE = 'Falta de respecte',
  EXPULSAT = 'Expulsat de classe',
  FULL_INCIDENCIA = 'Full d’incidència',
}

export interface Incident {
  alumne: string;
  curs: Course;
  tipus: IncidentType;
  quantitat: number;
}

export interface UnknownTypeInfo {
  value: string;
  count: number;
}

export interface Filters {
  curs: Course[];
  tipus: IncidentType[];
  alumne: string[];
}