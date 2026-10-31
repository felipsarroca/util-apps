// Tots els fragments que pot demanar un botó «Escolta» amb els qüestionaris inicials.
// Els fa servir npm run audios per generar-ne els MP3 i la prova que comprova que hi són.
import { SUBJECTS } from './catalog'
import { FEEDBACK_SCALES, INITIAL_FEEDBACK_FORMS } from './feedbackForms'
import { optionsText, speechText } from './speech'
import { INITIAL_SCALES, INITIAL_TEMPLATES } from './templates'

export function defaultSpeechTexts(): string[] {
  const texts = new Set<string>()
  const add = (t?: string) => {
    if (t && speechText(t)) texts.add(speechText(t))
  }
  for (const s of [...INITIAL_SCALES, ...FEEDBACK_SCALES]) add(optionsText(s))
  for (const s of SUBJECTS) add(s.long)
  for (const t of INITIAL_TEMPLATES)
    for (const sec of t.sections)
      for (const q of sec.questions) {
        add(q.text)
        add(q.help)
        q.criteria?.forEach((c) => add(c.prompt))
      }
  for (const f of INITIAL_FEEDBACK_FORMS) {
    f.items.forEach((i) => add(i.student))
    f.open.forEach((o) => add(o.text))
  }
  return [...texts]
}
