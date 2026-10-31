import type { Question, Scale, Section, TemplateVersion } from './types'

/** Escales administrables. Cada tipus de pregunta en té una de pròpia. */
export const INITIAL_SCALES: Scale[] = [
  {
    id: 'cm3',
    name: 'Hàbits (cicle mitjà)',
    allowNA: false,
    options: [
      { value: '1', label: 'Encara no', emoji: '🌧️' },
      { value: '2', label: 'A vegades', emoji: '⛅' },
      { value: '3', label: 'Sí, molt!', emoji: '☀️' },
    ],
  },
  {
    id: 'auto3',
    name: 'Autonomia',
    allowNA: false,
    options: [
      { value: '1', label: 'Encara necessito ajuda', short: 'Amb ajuda', emoji: '🌱' },
      { value: '2', label: 'Amb una mica d’ajuda', short: 'Poca ajuda', emoji: '🌿' },
      { value: '3', label: 'Ho faig tot sol o sola', short: 'Autònom', emoji: '🌳' },
    ],
  },
  {
    id: 'freq4',
    name: 'Freqüència',
    allowNA: false,
    options: [
      { value: '1', label: 'Mai' },
      { value: '2', label: 'De vegades' },
      { value: '3', label: 'Sovint' },
      { value: '4', label: 'Sempre' },
    ],
  },
  {
    id: 'freq4na',
    name: 'Freqüència amb «No escau»',
    allowNA: true,
    options: [
      { value: '1', label: 'Mai' },
      { value: '2', label: 'De vegades' },
      { value: '3', label: 'Sovint' },
      { value: '4', label: 'Sempre' },
    ],
  },
  {
    id: 'dom4',
    name: 'Domini dels aprenentatges',
    allowNA: false,
    options: [
      { value: '1', label: 'Encara em costa', short: 'Em costa' },
      { value: '2', label: 'Ho entenc amb ajuda', short: 'Amb ajuda' },
      { value: '3', label: 'Ho entenc bé', short: 'Bé' },
      { value: '4', label: 'Ho domino', short: 'Ho domino' },
    ],
  },
  {
    id: 'result4',
    name: 'Resultat que preveig',
    allowNA: false,
    options: [
      { value: '1', label: 'No assoliment', short: 'NA' },
      { value: '2', label: 'Assoliment satisfactori', short: 'AS' },
      { value: '3', label: 'Assoliment notable', short: 'AN' },
      { value: '4', label: 'Assoliment excel·lent', short: 'AE' },
    ],
  },
  {
    id: 'effort4',
    name: 'Esforç',
    allowNA: false,
    options: [
      { value: '1', label: 'Poc' },
      { value: '2', label: 'Una mica' },
      { value: '3', label: 'Bastant' },
      { value: '4', label: 'Molt' },
    ],
  },
  {
    id: 'underst4',
    name: 'Comprensió',
    allowNA: false,
    options: [
      { value: '1', label: 'Poc' },
      { value: '2', label: 'En part' },
      { value: '3', label: 'Bastant' },
      { value: '4', label: 'Del tot' },
    ],
  },
  {
    id: 'goal3',
    name: 'Seguiment de l’objectiu',
    allowNA: false,
    options: [
      { value: '1', label: 'Canviaré el pla', emoji: '🔄' },
      { value: '2', label: 'Hi avanço', emoji: '🚶' },
      { value: '3', label: 'Assolit', emoji: '🏁' },
    ],
  },
]

const q = (id: string, text: string, scaleId: string, extra: Partial<Question> = {}): Question => ({
  id,
  type: 'scale',
  text,
  scaleId,
  required: true,
  active: true,
  ...extra,
})

const text = (id: string, type: 'shortText' | 'longText', label: string, maxLength: number, extra: Partial<Question> = {}): Question => ({
  id,
  type,
  text: label,
  required: true,
  maxLength,
  active: true,
  ...extra,
})

const CM_SECTIONS: Section[] = [
  {
    id: 'cm-habits',
    title: 'Com he treballat',
    emoji: '🎒',
    intro: 'Pensa en aquestes setmanes a l’escola i tria la resposta que més s’assembla al que has fet.',
    questions: [
      q('cm-h1', 'He intentat acabar les feines.', 'cm3'),
      q('cm-h2', 'Quan no entenia una cosa, he preguntat o he buscat ajuda.', 'cm3'),
      q('cm-h3', 'He revisat una feina després de rebre un consell.', 'cm3'),
      q('cm-h4', 'He escoltat i he col·laborat amb els companys.', 'cm3'),
    ],
  },
  {
    id: 'cm-arees',
    title: 'Les meves àrees',
    emoji: '📚',
    intro: 'Per a cada àrea, digues com treballes.',
    questions: [
      {
        id: 'cm-arees-q',
        type: 'subjects',
        text: 'Com treballo a cada àrea',
        required: true,
        active: true,
        criteria: [{ id: 'auto', label: 'Autonomia', prompt: 'Com ho faig?', scaleId: 'auto3' }],
      },
    ],
  },
  {
    id: 'cm-reflexio',
    title: 'Penso i escric',
    emoji: '✏️',
    questions: [
      text('cm-r1', 'shortText', 'Aquest trimestre he après a…', 160, { help: 'Escriu una cosa que ara saps fer i abans no.' }),
      text('cm-r2', 'shortText', 'El trimestre vinent vull practicar…', 160, { help: 'Una cosa que vols fer millor.' }),
    ],
  },
]

const CS_SECTIONS: Section[] = [
  {
    id: 'cs-objectiu-anterior',
    title: 'El meu objectiu anterior',
    emoji: '🎯',
    intro: 'Recordes l’objectiu que et vas posar a l’última autoavaluació?',
    questions: [
      {
        id: 'cs-goal-review',
        type: 'goalReview',
        text: 'Com ha anat el meu objectiu?',
        scaleId: 'goal3',
        sourceQuestionId: 'cs-obj',
        required: true,
        active: true,
      },
    ],
  },
  {
    id: 'cs-habits',
    title: 'Com aprenc',
    emoji: '🧭',
    intro: 'Llegeix cada frase i tria amb quina freqüència ho has fet.',
    questions: [
      q('cs-h1', 'He acabat les feines a temps i amb cura.', 'freq4'),
      q('cs-h2', 'Quan alguna cosa m’ha costat, he buscat una manera de resoldre-la.', 'freq4'),
      q('cs-h3', 'He fet servir els consells del mestre o la mestra per millorar.', 'freq4'),
      q('cs-h4', 'He participat a classe i he compartit les meves idees.', 'freq4'),
      q('cs-h5', 'He treballat bé en equip i he respectat els companys.', 'freq4'),
    ],
  },
  {
    id: 'cs-arees',
    title: 'Les meves àrees',
    emoji: '📚',
    intro: 'Valora cada àrea: què n’has après i com hi treballes.',
    questions: [
      {
        id: 'cs-arees-q',
        type: 'subjects',
        text: 'Valoració de les àrees',
        required: true,
        active: true,
        criteria: [
          { id: 'dom', label: 'Domini', prompt: 'Què n’he après?', scaleId: 'dom4' },
          { id: 'auto', label: 'Autonomia', prompt: 'Com hi treballo?', scaleId: 'auto3' },
        ],
      },
    ],
  },
  {
    id: 'cs-reflexio',
    title: 'Reflexiono',
    emoji: '💭',
    questions: [
      text('cs-evid', 'shortText', 'Una feina de la qual estic orgullós o orgullosa, i per què', 220, {
        pdfLabel: 'Una feina de la qual estic orgullós/osa',
      }),
      text('cs-dif', 'longText', 'Una dificultat que he tingut i com l’he afrontada', 300, { pdfLabel: 'Una dificultat i com l’he afrontada' }),
      text('cs-obj', 'shortText', 'El meu objectiu per al trimestre vinent', 200, {
        help: 'Ha de ser concret: què faràs i quan ho faràs.',
      }),
    ],
  },
]

const ESO_SECTIONS: Section[] = [
  {
    id: 'eso-temps',
    title: 'Temps, preparació i constància',
    emoji: '⏱️',
    intro: 'Respon amb sinceritat. No és una nota: és una manera de conèixer-te millor.',
    questions: [
      q('eso-t1', 'Porto el material necessari a classe.', 'freq4na'),
      q('eso-t2', 'Faig els deures i les tasques dins del termini.', 'freq4na'),
      q('eso-t3', 'Planifico el temps d’estudi abans de les proves.', 'freq4na'),
      q('eso-t4', 'Reviso les feines abans de lliurar-les.', 'freq4na'),
      q('eso-t5', 'Mantinc l’esforç encara que una tasca em costi.', 'freq4na'),
    ],
  },
  {
    id: 'eso-aprendre',
    title: 'Participació i manera d’aprendre',
    emoji: '💡',
    questions: [
      q('eso-p1', 'Estic atent o atenta i participo a classe.', 'freq4na'),
      q('eso-p2', 'Pregunto quan tinc un dubte.', 'freq4na'),
      q('eso-p3', 'Aprofito les correccions per millorar.', 'freq4na'),
      q('eso-p4', 'Busco informació i recursos pel meu compte.', 'freq4na'),
      q('eso-p5', 'Faig servir esquemes, resums o altres estratègies d’estudi.', 'freq4na'),
    ],
  },
  {
    id: 'eso-altres',
    title: 'Treball amb els altres i compromís',
    emoji: '🤝',
    questions: [
      q('eso-w1', 'Col·laboro i faig la meva part en els treballs en grup.', 'freq4na'),
      q('eso-w2', 'Respecto les opinions i el torn de paraula dels altres.', 'freq4na'),
      q('eso-w3', 'Faig un ús responsable del mòbil i de l’ordinador.', 'freq4na'),
      q('eso-w4', 'Compleixo els compromisos que prenc.', 'freq4na'),
    ],
  },
  {
    id: 'eso-materies',
    title: 'Les meves matèries',
    emoji: '📚',
    intro: 'Per a cada matèria: el resultat que preveus, l’esforç que hi has fet i com entens el que heu treballat.',
    questions: [
      {
        id: 'eso-mat-q',
        type: 'subjects',
        text: 'Valoració de les matèries',
        required: true,
        active: true,
        criteria: [
          { id: 'res', label: 'Resultat que preveig', prompt: 'Quin resultat preveig?', scaleId: 'result4' },
          { id: 'esf', label: 'Esforç que he fet', prompt: 'Quin esforç hi he fet?', scaleId: 'effort4' },
          { id: 'com', label: 'Comprensió', prompt: 'Entenc el que hem fet?', scaleId: 'underst4' },
        ],
        subjectComment: { prompt: 'Què puc fer o què em cal?', required: false, maxLength: 300 },
      },
    ],
  },
  {
    id: 'eso-compromis',
    title: 'El meu compromís',
    emoji: '🚀',
    questions: [
      text('eso-accio', 'longText', 'La meva acció prioritària de millora', 400, {
        help: 'Tria una sola cosa concreta que començaràs a fer a partir de demà.',
      }),
    ],
  },
]

export const INITIAL_TEMPLATES: TemplateVersion[] = [
  { id: 'tpl-cm-v1', templateId: 'tpl-cm', name: 'Autoavaluació 3r i 4t', stage: 'CM', version: 1, status: 'published', publishedAt: '2026-09-01T08:00:00Z', changeNote: 'Versió inicial basada en el model en paper.', sections: CM_SECTIONS },
  { id: 'tpl-cs-v1', templateId: 'tpl-cs', name: 'Autoavaluació 5è i 6è', stage: 'CS', version: 1, status: 'published', publishedAt: '2026-09-01T08:00:00Z', changeNote: 'Versió inicial basada en el model en paper.', sections: CS_SECTIONS },
  { id: 'tpl-eso-v1', templateId: 'tpl-eso', name: 'Autoavaluació ESO', stage: 'ESO', version: 1, status: 'published', publishedAt: '2026-09-01T08:00:00Z', changeNote: 'Versió inicial basada en el model en paper.', sections: ESO_SECTIONS },
]
