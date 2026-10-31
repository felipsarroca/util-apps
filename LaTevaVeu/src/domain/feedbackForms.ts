// Qüestionaris inicials d'«Et veig…» (esborrany per validar amb alumnat i claustre: pla mestre v2, §5.3).
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

// ESO: els 20 ítems proposats per Felip Sarroca (2026), agrupats en cinc dimensions.
export const ESO_DIMENSIONS: FeedbackDimension[] = [
  { id: 'clar', name: 'Explicacions i domini', emoji: '💡' },
  { id: 'mot', name: 'Interès i motivació', emoji: '✨' },
  { id: 'amb', name: 'Respecte i ambient', emoji: '🤝' },
  { id: 'aval', name: 'Avaluació i progrés', emoji: '📝' },
  { id: 'act', name: 'Actitud i exemple', emoji: '🌟' },
]

const ESO_ITEMS: FeedbackItem[] = [
  it('e01', 'clar', 'Les seves explicacions són entenedores.', 'Les meves explicacions són entenedores.'),
  it('e03', 'clar', 'Es preocupa perquè s’entenguin els conceptes.', 'Em preocupo perquè s’entenguin els conceptes.'),
  it('e04', 'clar', 'Procura resoldre tots els dubtes.', 'Procuro resoldre tots els dubtes.'),
  it('e09', 'clar', 'Sembla dominar la matèria que imparteix.', 'Domino la matèria que imparteixo.'),
  it('e02', 'mot', 'Les seves classes són entretingudes.', 'Les meves classes són entretingudes.'),
  it('e05', 'mot', 'Sap captar l’atenció de la classe.', 'Sé captar l’atenció de la classe.'),
  it('e11', 'mot', 'Motiva a estudiar.', 'Motivo a estudiar.'),
  it('e14', 'mot', 'Els seus comentaris fan pensar.', 'Els meus comentaris fan pensar.'),
  it('e08', 'amb', 'Es mostra pacient.', 'Em mostro pacient.'),
  it('e15', 'amb', 'Tracta els alumnes amb respecte.', 'Tracto els alumnes amb respecte.'),
  it('e18', 'amb', 'Escolta els alumnes.', 'Escolto els alumnes.'),
  it('e20', 'amb', 'A les seves classes hi ha un ambient ordenat que permet escoltar i treballar.', 'A les meves classes hi ha un ambient ordenat que permet escoltar i treballar.'),
  it('e06', 'aval', 'Retorna corregits els treballs i els exàmens en poc temps.', 'Retorno corregits els treballs i els exàmens en poc temps.'),
  it('e13', 'aval', 'Té en compte el progrés de cadascú.', 'Tinc en compte el progrés de cadascú.'),
  it('e19', 'aval', 'Deixa clars els criteris d’avaluació.', 'Deixo clars els criteris d’avaluació.'),
  it('e07', 'act', 'Es veu que li agrada el que fa.', 'Es veu que m’agrada el que faig.'),
  it('e10', 'act', 'Admet els seus errors.', 'Admeto els meus errors.'),
  it('e12', 'act', 'Deixa clar quan el que diu és la seva opinió.', 'Deixo clar quan el que dic és la meva opinió.'),
  it('e16', 'act', 'Somriu freqüentment.', 'Somric freqüentment.'),
  it('e17', 'act', 'Arriba a classe amb energia i actitud positiva.', 'Arribo a classe amb energia i actitud positiva.'),
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
    ...base, id: 'fb-eso-v2', templateId: 'fb-eso', stage: 'ESO', scaleId: 'fb4', dimensions: ESO_DIMENSIONS, items: ESO_ITEMS,
    version: 2, changeNote: 'Els 20 ítems de Felip Sarroca',
    open: [
      { id: 'mantenir', text: 'Què hauria de mantenir a les seves classes?', maxLength: 300 },
      { id: 'millorar', text: 'Què m’ajudaria a aprendre millor a les seves classes?', maxLength: 300 },
    ],
  },
]

/** Comprovacions abans de publicar una versió d'un qüestionari d'«Et veig…». */
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
