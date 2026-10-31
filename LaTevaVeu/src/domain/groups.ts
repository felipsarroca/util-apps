// Noms dels grups. Si un curs només té un grup, es mostra sense lletra («2n ESO»); si en té més,
// amb la lletra o el nom del grup («2n ESO B»). La configuració la fixa l'app en carregar les dades.

import { gradeById, gradeShort, GRADES } from './catalog'
import type { GradeId } from './types'

export type ClassGroups = Record<GradeId, string[]>

let multi = new Set<GradeId>()

export function setGroupConfig(cfg: ClassGroups | undefined) {
  multi = new Set(GRADES.filter((g) => (cfg?.[g.id]?.length ?? 1) > 1).map((g) => g.id))
}

/** «2n ESO» o «2n ESO B». */
export const groupName = (gradeId: GradeId, group: string) => (multi.has(gradeId) ? `${gradeShort(gradeId)} ${group}` : gradeShort(gradeId))

/** El mateix a partir de la clau «2ESO-B». */
export function groupNameOfKey(key: string) {
  const i = key.indexOf('-')
  return groupName(key.slice(0, i) as GradeId, key.slice(i + 1))
}

/** «2n d'ESO» o «2n d'ESO · Grup B». */
export const gradeAndGroup = (gradeId: GradeId, group: string) => (multi.has(gradeId) ? `${gradeById(gradeId).name} · Grup ${group}` : gradeById(gradeId).name)

/** Nom de grup vàlid: curt, sense guions (formen part de la clau) i sense repetir-se dins del curs. */
export function checkGroupLabel(label: string, existing: string[]): string | null {
  const l = label.trim()
  if (!l) return 'Escriu el nom del grup.'
  if (l.length > 12) return 'El nom del grup ha de tenir com a màxim 12 caràcters.'
  if (/[-;,]/.test(l)) return 'El nom del grup no pot contenir guions, comes ni punts i comes.'
  if (existing.some((x) => x.toLowerCase() === l.toLowerCase())) return 'Aquest curs ja té un grup amb aquest nom.'
  return null
}
