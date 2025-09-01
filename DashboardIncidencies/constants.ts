import { IncidentType, Course } from './types';

export const OFFICIAL_INCIDENT_TYPES: string[] = Object.values(IncidentType);
export const OFFICIAL_COURSES: string[] = Object.values(Course);

export const COURSE_NORMALIZATION_MAP: { [key: string]: Course } = {
  '1r eso': Course.PR1,
  '1reso': Course.PR1,
  '1r de eso': Course.PR1,
  'primer d\'eso': Course.PR1,
  'primer eso': Course.PR1,
  '1r': Course.PR1,
  '1r d\'eso': Course.PR1,
  '2n eso': Course.PR2,
  '2neso': Course.PR2,
  '2n de eso': Course.PR2,
  'segon d\'eso': Course.PR2,
  'segon eso': Course.PR2,
  '2n': Course.PR2,
  '2n d\'eso': Course.PR2,
  '3r eso': Course.PR3,
  '3r de eso': Course.PR3,
  'tercer d\'eso': Course.PR3,
  'tercer eso': Course.PR3,
  '3r': Course.PR3,
  '3r d\'eso': Course.PR3,
  '4t eso': Course.PR4,
  '4t de eso': Course.PR4,
  'quart d\'eso': Course.PR4,
  'quart eso': Course.PR4,
  '4t': Course.PR4,
  '4t d\'eso': Course.PR4,
};

export const INCIDENT_TYPE_NORMALIZATION_MAP: { [key: string]: IncidentType } = {
  'absencia': IncidentType.ABSENCIES,
  'absència': IncidentType.ABSENCIES,
  'absències': IncidentType.ABSENCIES,
  'absencies': IncidentType.ABSENCIES,
  'deure': IncidentType.DEURES,
  'deures': IncidentType.DEURES,
  'retard': IncidentType.RETARD,
  'retards': IncidentType.RETARD,
  'mobil': IncidentType.MOBIL,
  'mòbil': IncidentType.MOBIL,
  'mobil requisat': IncidentType.MOBIL,
  'mòbil requisat': IncidentType.MOBIL,
  'falta respecte': IncidentType.FALTA_RESPECTE,
  'faltes respecte': IncidentType.FALTA_RESPECTE,
  'falta de respecte': IncidentType.FALTA_RESPECTE,
  'faltes de respecte': IncidentType.FALTA_RESPECTE,
  'expulsat': IncidentType.EXPULSAT,
  'expulsió': IncidentType.EXPULSAT,
  'expulsió de classe': IncidentType.EXPULSAT,
  'expulsat de classe': IncidentType.EXPULSAT,
  'full incidencia': IncidentType.FULL_INCIDENCIA,
  'full d\'incidència': IncidentType.FULL_INCIDENCIA,
};

export const TYPES_REQUIRING_QUANTITY = [IncidentType.ABSENCIES, IncidentType.RETARD, IncidentType.DEURES];