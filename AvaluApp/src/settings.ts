export interface StudentNotes {
  /** Acords interns de la junta (no surten a l'informe de la família). */
  acords: string
  /** Missatge del tutor o tutora per a la família. */
  familia: string
}

export type NotesMap = Record<string, StudentNotes>

export const emptyNotes: StudentNotes = { acords: '', familia: '' }

export interface ReportSettings {
  centre: string
  grup: string
  tutor: string
  curs: string
  showGroupMean: boolean
  showSignatures: boolean
}

const SETTINGS_KEY = 'avaluapp:report-settings'

const currentSchoolYear = () => {
  const today = new Date()
  const start = today.getMonth() >= 8 ? today.getFullYear() : today.getFullYear() - 1
  return `${start}-${start + 1}`
}

export const defaultSettings = (): ReportSettings => ({
  centre: '',
  grup: '',
  tutor: '',
  curs: currentSchoolYear(),
  showGroupMean: true,
  showSignatures: true,
})

/** Només es desen les dades de capçalera (cap nom d'alumne ni qualificació). */
export function loadSettings(): ReportSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) return { ...defaultSettings(), ...(JSON.parse(raw) as Partial<ReportSettings>) }
  } catch {
    /* emmagatzematge no disponible */
  }
  return defaultSettings()
}

export function saveSettings(settings: ReportSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    /* emmagatzematge no disponible */
  }
}

export const hasNotes = (notes: NotesMap) =>
  Object.values(notes).some((item) => item.acords.trim() || item.familia.trim())
