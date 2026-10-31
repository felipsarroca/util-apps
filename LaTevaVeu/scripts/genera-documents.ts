// Genera els documents de treball que depenen del codi (preguntes i matèries),
// perquè coincideixin sempre amb l'aplicació. Ús: npm run docs
import { writeFileSync } from 'node:fs'
import { GRADES, initialGradeSubjects, STAGES, SUBJECTS } from '../src/domain/catalog'
import { FEEDBACK_SCALES, INITIAL_FEEDBACK_FORMS } from '../src/domain/feedbackForms'

const OUT = new URL('../docs/', import.meta.url)
const csvCell = (v: string | number) => (/[",;\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v))
const csv = (rows: (string | number)[][]) => '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n'

// ---------- Revisió de les preguntes d'«Et veig» ----------

const md: string[] = [
  '# Et veig: revisió de les preguntes',
  '',
  'Full de treball per al claustre i per a la prova pilot. Per a cada afirmació, marqueu si s’entén, si cal mantenir-la i, si escau, una proposta de canvi. La versió per omplir en un full de càlcul és `05_Revisio_preguntes.csv` (es pot importar a Google Sheets).',
  '',
  '> Document generat a partir de l’aplicació (`npm run docs`). Si es canvien les preguntes a l’editor, cal tornar-lo a generar.',
  '',
  'Criteris per revisar:',
  '',
  '- **S’entén** a l’edat de l’etapa, sense ajuda.',
  '- Parla d’una **conducta observable** de les classes, no de la persona.',
  '- Diu **una sola cosa**.',
  '- Es pot respondre amb l’escala de l’etapa.',
  '- La versió del docent diu el mateix en primera persona.',
  '',
]
const rows: (string | number)[][] = [['etapa', 'codi', 'dimensio', 'afirmacio_alumnat', 'afirmacio_docent', 's_enten (si/no/dubte)', 'cal_mantenir (si/no)', 'proposta_de_canvi', 'comentaris']]

for (const f of INITIAL_FEEDBACK_FORMS) {
  const scale = FEEDBACK_SCALES.find((s) => s.id === f.scaleId)!
  md.push(`## ${STAGES[f.stage].name} (${STAGES[f.stage].short})`, '')
  md.push(`**Escala:** ${scale.options.map((o) => `${o.emoji ? o.emoji + ' ' : ''}${o.label}`).join(' · ')} · i «${scale.naLabel}».`, '')
  md.push(`**${f.items.length} afirmacions** en ${f.dimensions.length} dimensions.`, '')
  let n = 0
  for (const d of f.dimensions) {
    md.push(`### ${d.emoji} ${d.name}`, '', '| # | Alumnat | Docent (autoavaluació) | S’entén | Mantenir | Proposta |', '| --- | --- | --- | --- | --- | --- |')
    for (const it of f.items.filter((i) => i.dimensionId === d.id)) {
      n++
      md.push(`| ${n} | ${it.student} | ${it.teacher} | ☐ Sí ☐ No | ☐ Sí ☐ No | |`)
      rows.push([STAGES[f.stage].short, it.id, d.name, it.student, it.teacher, '', '', '', ''])
    }
    md.push('')
  }
  md.push('### 💬 Preguntes obertes (opcionals)', '')
  for (const q of f.open) {
    md.push(`- ${q.text} *(màxim ${q.maxLength} caràcters)*`)
    rows.push([STAGES[f.stage].short, q.id, 'Pregunta oberta', q.text, '', '', '', '', ''])
  }
  md.push('', '**Falta alguna cosa important?** ______________________________________________', '')
}
writeFileSync(new URL('05_Revisio_preguntes.md', OUT), md.join('\n'))
writeFileSync(new URL('05_Revisio_preguntes.csv', OUT), csv(rows))

// ---------- Plantilla d'assignacions docents ----------

const gs = initialGradeSubjects()
const plan: (string | number)[][] = [['curs', 'grup', 'codi_materia', 'materia', 'tipus', 'correu_docent', 'nom_docent']]
for (const g of GRADES) {
  for (const x of gs.filter((y) => y.gradeId === g.id)) {
    const s = SUBJECTS.find((y) => y.id === x.subjectId)!
    plan.push([g.name, 'A', s.id, s.long, x.optional ? 'optativa' : 'comuna', '', ''])
  }
}
writeFileSync(new URL('07_Plantilla_assignacions.csv', OUT), csv(plan))
console.log(`Preguntes: ${rows.length - 1} files · Assignacions: ${plan.length - 1} files`)
