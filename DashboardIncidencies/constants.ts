
import { Curs, IncidentType } from './types.ts';

export const OFFICIAL_TYPES = Object.values(IncidentType);
export const OFFICIAL_CURSOS = Object.values(Curs);

export const CURS_NORMALIZATION_MAP: { [key: string]: Curs } = {
  "1reso": Curs.PRIMER_ESO, "1r eso": Curs.PRIMER_ESO, "1r d'eso": Curs.PRIMER_ESO, "1r": Curs.PRIMER_ESO,
  "2neso": Curs.SEGON_ESO, "2n eso": Curs.SEGON_ESO, "2n d'eso": Curs.SEGON_ESO, "2n": Curs.SEGON_ESO,
  "3reso": Curs.TERCER_ESO, "3r eso": Curs.TERCER_ESO, "3r d'eso": Curs.TERCER_ESO, "3r": Curs.TERCER_ESO, "tercer eso": Curs.TERCER_ESO, "tercer d'eso": Curs.TERCER_ESO,
  "4teso": Curs.QUART_ESO, "4t eso": Curs.QUART_ESO, "4t d'eso": Curs.QUART_ESO, "4t": Curs.QUART_ESO, "quart eso": Curs.QUART_ESO, "quart d'eso": Curs.QUART_ESO,
};

export const TIPUS_NORMALIZATION_MAP: { [key: string]: IncidentType } = {
  "absencia": IncidentType.ABSENCIES, "absències": IncidentType.ABSENCIES,
  "deures": IncidentType.DEURES,
  "retard": IncidentType.RETARD,
  "mobil requisat": IncidentType.MOBIL_REQUISAT, "mòbil requisat": IncidentType.MOBIL_REQUISAT,
  "falta de respecte": IncidentType.FALTA_RESPECTE, "faltes respecte": IncidentType.FALTA_RESPECTE,
  "expulsat de classe": IncidentType.EXPULSAT_CLASSE, "expulsió": IncidentType.EXPULSAT_CLASSE,
  "full d'incidència": IncidentType.FULL_INCIDENCIA, "full incidencia": IncidentType.FULL_INCIDENCIA,
};

export const TYPES_DEFAULT_QUANTITY_1 = [IncidentType.ABSENCIES, IncidentType.RETARD, IncidentType.DEURES];