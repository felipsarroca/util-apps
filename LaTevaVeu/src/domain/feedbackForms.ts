// Qüestionaris inicials d'«Et veig» (esborrany per validar amb alumnat i claustre: pla mestre v2, §5.3).
// Les afirmacions descriuen experiències observables, no trets personals del docent.

import type { FeedbackDimension, FeedbackForm, FeedbackItem, Scale } from './types'

export const FEEDBACK_SCALES: Scale[] = [
  {
    id: 'fb3',
    name: 'Valoració del professorat (cicle mitjà)',
    allowNA: true,
    naLabel: 'No ho sé',
    options: [
      { value: '1', label: 'No gaire', emoji: '😕' },
      { value: '2', label: 'A vegades', emoji: '🙂' },
      { value: '3', label: 'Sí!', emoji: '😀' },
    ],
  },
  {
    id: 'fb4',
    name: 'Valoració del professorat',
    allowNA: true,
    naLabel: 'No ho puc valorar',
    options: [
      { value: '1', label: 'Mai' },
      { value: '2', label: 'De vegades' },
      { value: '3', label: 'Sovint' },
      { value: '4', label: 'Sempre' },
    ],
  },
]

export const DIMENSIONS: FeedbackDimension[] = [
  { id: 'clar', name: 'Claredat i explicacions', emoji: '💡' },
  { id: 'org', name: 'Organització', emoji: '🗂️' },
  { id: 'aval', name: 'Avaluació i retorn', emoji: '📝' },
  { id: 'amb', name: 'Ambient i respecte', emoji: '🤝' },
  { id: 'sup', name: 'Suport', emoji: '🤲' },
  { id: 'mot', name: 'Participació i motivació', emoji: '✨' },
]

const it = (id: string, dimensionId: string, student: string, teacher: string): FeedbackItem => ({ id, dimensionId, student, teacher })

const ESO_ITEMS: FeedbackItem[] = [
  it('clar1', 'clar', 'Entenc què hem d’aprendre i què s’espera de mi.', 'Deixo clar què han d’aprendre i què espero de l’alumnat.'),
  it('clar2', 'clar', 'Les explicacions i els exemples m’ajuden a entendre.', 'Les meves explicacions i exemples ajuden a entendre.'),
  it('clar3', 'clar', 'Quan no ho entenem, ho torna a explicar d’una altra manera.', 'Quan no ho entenen, ho torno a explicar d’una altra manera.'),
  it('org1', 'org', 'Les classes estan ben organitzades i s’aprofita el temps.', 'Les meves classes estan ben organitzades i s’aprofita el temps.'),
  it('org2', 'org', 'Sé quines tasques he de fer i quan les he de lliurar.', 'L’alumnat sap quines tasques ha de fer i quan les ha de lliurar.'),
  it('org3', 'org', 'Les activitats tenen relació amb el que hem d’aprendre.', 'Les activitats tenen relació amb el que han d’aprendre.'),
  it('aval1', 'aval', 'Sé com se’m valorarà abans d’una prova o d’una feina.', 'Explico com valoraré una prova o una feina abans de fer-la.'),
  it('aval2', 'aval', 'Els comentaris que rebo m’ajuden a millorar.', 'Els meus comentaris ajuden l’alumnat a millorar.'),
  it('aval3', 'aval', 'Les correccions arriben a temps perquè em siguin útils.', 'Les meves correccions arriben a temps perquè siguin útils.'),
  it('amb1', 'amb', 'A classe puc aprendre en un ambient respectuós.', 'A les meves classes es pot aprendre en un ambient respectuós.'),
  it('amb2', 'amb', 'Em tracta amb respecte.', 'Tracto l’alumnat amb respecte.'),
  it('amb3', 'amb', 'Les normes són clares i valen igual per a tothom.', 'Les normes són clares i les aplico igual per a tothom.'),
  it('sup1', 'sup', 'Quan tinc dubtes, puc demanar ajuda.', 'Quan tenen dubtes, l’alumnat em pot demanar ajuda.'),
  it('sup2', 'sup', 'Té en compte que no tots aprenem al mateix ritme.', 'Tinc en compte que no tothom aprèn al mateix ritme.'),
  it('sup3', 'sup', 'Noto que li importa que aprengui.', 'L’alumnat nota que m’importa que aprengui.'),
  it('mot1', 'mot', 'Tinc oportunitats de participar i de fer preguntes.', 'L’alumnat té oportunitats de participar i de fer preguntes.'),
  it('mot2', 'mot', 'Les seves classes em desperten interès.', 'Les meves classes desperten interès.'),
  it('mot3', 'mot', 'Em sento capaç d’aprendre a les seves classes.', 'L’alumnat se sent capaç d’aprendre a les meves classes.'),
]

const CS_ITEMS: FeedbackItem[] = [
  it('clar1', 'clar', 'Entenc el que ens explica.', 'L’alumnat entén el que explico.'),
  it('clar2', 'clar', 'Si no ho entenc, m’ho torna a explicar.', 'Si no ho entenen, ho torno a explicar.'),
  it('org1', 'org', 'Sé què he de fer a cada activitat.', 'L’alumnat sap què ha de fer a cada activitat.'),
  it('org2', 'org', 'Les classes estan ben preparades.', 'Les meves classes estan ben preparades.'),
  it('aval1', 'aval', 'Sé com corregirà les feines.', 'Explico com corregiré les feines.'),
  it('aval2', 'aval', 'Els seus comentaris m’ajuden a fer-ho millor.', 'Els meus comentaris ajuden a fer-ho millor.'),
  it('amb1', 'amb', 'A la seva classe ens respectem.', 'A la meva classe ens respectem.'),
  it('amb2', 'amb', 'Em tracta bé.', 'Tracto bé cada alumne.'),
  it('sup1', 'sup', 'Puc demanar ajuda quan la necessito.', 'L’alumnat pot demanar-me ajuda quan la necessita.'),
  it('sup2', 'sup', 'M’ajuda quan alguna cosa em costa.', 'Ajudo quan alguna cosa costa.'),
  it('mot1', 'mot', 'Puc participar i dir el que penso.', 'L’alumnat pot participar i dir el que pensa.'),
  it('mot2', 'mot', 'M’agrada aprendre a la seva classe.', 'A l’alumnat li agrada aprendre a la meva classe.'),
]

const CM_ITEMS: FeedbackItem[] = [
  it('clar1', 'clar', 'M’explica les coses perquè les entengui.', 'Explico les coses perquè les entenguin.'),
  it('sup1', 'sup', 'Quan no ho entenc, m’ajuda.', 'Quan no ho entenen, els ajudo.'),
  it('amb1', 'amb', 'M’escolta quan parlo.', 'Escolto l’alumnat quan parla.'),
  it('amb2', 'amb', 'Em sento bé a la seva classe.', 'L’alumnat se sent bé a la meva classe.'),
  it('org1', 'org', 'Sé què he de fer.', 'L’alumnat sap què ha de fer.'),
  it('mot1', 'mot', 'M’agrada aprendre a la seva classe.', 'A l’alumnat li agrada aprendre a la meva classe.'),
]

const base = { version: 1, status: 'published' as const, publishedAt: '2026-01-15T09:00:00Z', changeNote: 'Versió inicial' }

export const INITIAL_FEEDBACK_FORMS: FeedbackForm[] = [
  {
    ...base, id: 'fb-cm-v1', templateId: 'fb-cm', stage: 'CM', scaleId: 'fb3',
    dimensions: DIMENSIONS.filter((d) => CM_ITEMS.some((x) => x.dimensionId === d.id)), items: CM_ITEMS,
    open: [{ id: 'mantenir', text: 'Què t’agrada més de les seves classes?', maxLength: 200 }],
  },
  {
    ...base, id: 'fb-cs-v1', templateId: 'fb-cs', stage: 'CS', scaleId: 'fb4', dimensions: DIMENSIONS, items: CS_ITEMS,
    open: [
      { id: 'mantenir', text: 'Què t’agrada de com ens ensenya?', maxLength: 250 },
      { id: 'millorar', text: 'Què t’ajudaria a aprendre millor?', maxLength: 250 },
    ],
  },
  {
    ...base, id: 'fb-eso-v1', templateId: 'fb-eso', stage: 'ESO', scaleId: 'fb4', dimensions: DIMENSIONS, items: ESO_ITEMS,
    open: [
      { id: 'mantenir', text: 'Què hauria de mantenir a les seves classes?', maxLength: 300 },
      { id: 'millorar', text: 'Què m’ajudaria a aprendre millor a les seves classes?', maxLength: 300 },
    ],
  },
]

/** Comprovacions abans de publicar una versió d'un qüestionari d'«Et veig». */
export function validateFeedbackForm(f: FeedbackForm): string[] {
  const issues: string[] = []
  const ids = new Set<string>()
  if (!f.items.length) issues.push('El qüestionari no té cap afirmació.')
  if (f.stage === 'ESO' && f.items.length < 15) issues.push('A ESO hi ha d’haver com a mínim 15 afirmacions per docent.')
  for (const i of f.items) {
    if (ids.has(i.id)) issues.push(`L’identificador ${i.id} està repetit.`)
    ids.add(i.id)
    if (!i.student.trim()) issues.push('Hi ha una afirmació sense text per a l’alumnat.')
    if (!i.teacher.trim()) issues.push(`«${i.student}» no té la versió per a l’autoavaluació del docent.`)
    if (!f.dimensions.some((d) => d.id === i.dimensionId)) issues.push(`«${i.student}» no té una dimensió vàlida.`)
  }
  for (const d of f.dimensions) if (!f.items.some((i) => i.dimensionId === d.id)) issues.push(`La dimensió «${d.name}» no té cap afirmació.`)
  for (const o of f.open) if (!o.text.trim() || o.maxLength < 20) issues.push('Hi ha una pregunta oberta sense text o amb un límit massa curt.')
  return issues
}
