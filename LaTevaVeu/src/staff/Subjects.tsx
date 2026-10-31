import { useState } from 'react'
import { moveGradeSubject, setGradeSubject, useDemoState } from '../data/api'
import { GRADES } from '../domain/catalog'
import type { GradeId, Session } from '../domain/types'
import { Icon } from '../ui/common'
import { PageHead } from './StaffApp'

export function SubjectsScreen({ session }: { session: Session }) {
  const s = useDemoState()
  const [grade, setGrade] = useState<GradeId>('1ESO')
  const list = s.gradeSubjects.filter((g) => g.gradeId === grade).sort((a, b) => a.order - b.order)
  const missing = s.subjects.filter((sub) => sub.active && !list.some((g) => g.subjectId === sub.id))
  const enrolled = (subjectId: string, optional: boolean) => {
    const st = s.students.filter((x) => x.gradeId === grade)
    return optional ? st.filter((x) => x.electives.includes(subjectId)).length : st.length
  }
  const stage = GRADES.find((g) => g.id === grade)!.stage

  return (
    <>
      <PageHead title="Matèries" sub="Matèries de cada curs, ordre de presentació i optatives. Els canvis s’apliquen a les recollides noves; les ja creades conserven la seva llista.">
        <label className="field">
          <span>Curs</span>
          <select className="select" value={grade} onChange={(e) => setGrade(e.target.value as GradeId)}>
            {GRADES.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </label>
      </PageHead>
      {stage !== 'ESO' ? (
        <div className="notice"><Icon name="info" /><div>Àrees de primària segons el Decret 175/2022. Religió és optativa: només apareix a l’alumnat que la cursa.</div></div>
      ) : (
        <div className="notice warn"><Icon name="alert" /><div>Catàleg d’ESO provisional: cal contrastar-lo amb les matèries reals que imparteix l’escola a cada curs.</div></div>
      )}
      <div className="table-wrap">
        <table className="t">
          <thead>
            <tr><th>Ordre</th><th>Matèria</th><th>Nom a l’informe</th><th>Tipus</th><th className="num">Alumnat</th><th>Activa</th></tr>
          </thead>
          <tbody>
            {list.map((gs, i) => {
              const sub = s.subjects.find((x) => x.id === gs.subjectId)!
              return (
                <tr key={gs.subjectId} style={gs.active ? undefined : { opacity: 0.55 }}>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn icon small ghost" disabled={i === 0} onClick={() => moveGradeSubject(session, grade, gs.subjectId, -1)} aria-label={`Puja ${sub.short}`}><Icon name="up" /></button>
                    <button className="btn icon small ghost" disabled={i === list.length - 1} onClick={() => moveGradeSubject(session, grade, gs.subjectId, 1)} aria-label={`Baixa ${sub.short}`}><Icon name="down" /></button>
                  </td>
                  <td>
                    <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 4, background: `hsl(${sub.hue} 55% 40%)`, marginRight: 8, verticalAlign: -1 }} aria-hidden="true" />
                    <b>{sub.short}</b>
                  </td>
                  <td className="muted">{sub.long}</td>
                  <td>
                    <label className="toggle" style={{ fontSize: '.88rem' }}>
                      <input type="checkbox" checked={gs.optional} onChange={(e) => setGradeSubject(session, { ...gs, optional: e.target.checked })} />
                      {gs.optional ? 'Optativa' : 'Comuna'}
                    </label>
                  </td>
                  <td className="num">{enrolled(gs.subjectId, gs.optional)}</td>
                  <td>
                    <label className="toggle"><input type="checkbox" checked={gs.active} onChange={(e) => setGradeSubject(session, { ...gs, active: e.target.checked })} /><span className="sr-only">Activa</span></label>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {missing.length > 0 && (
        <div className="card panel">
          <h2>Afegeix una matèria del catàleg</h2>
          <div className="row">
            {missing.map((m) => (
              <button key={m.id} className="btn small" onClick={() => setGradeSubject(session, { gradeId: grade, subjectId: m.id, order: (list.at(-1)?.order ?? 0) + 1, optional: true, active: true })}>
                <Icon name="plus" /> {m.short}
              </button>
            ))}
          </div>
          <p className="muted" style={{ fontSize: '.85rem' }}>Les matèries no s’esborren mai si tenen respostes: es desactiven, i així els informes antics es continuen generant igual.</p>
        </div>
      )}
    </>
  )
}
