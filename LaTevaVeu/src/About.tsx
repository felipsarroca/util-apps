// Pàgina «Per què La teva veu?»: sentit del projecte, marc normatiu, funcionament i beneficis.
// S'obre a …/#/projecte, també sense haver entrat a l'app. Les citacions són de textos oficials (vegeu «Fonts»).
import { useEffect, type ReactNode } from 'react'
import { SCHOOL } from './domain/catalog'
import { THRESHOLD } from './domain/feedback'
import { APP_ICON, asset } from './ui/common'

const FONTS = {
  cdi: 'https://www.boe.es/buscar/doc.php?id=BOE-A-1990-31312',
  loe: 'https://www.boe.es/buscar/act.php?id=BOE-A-2006-7899',
  decret: 'https://portaljuridic.gencat.cat/eli/es-ct/d/2022/09/27/175',
}

export function AboutPage({ onClose, onDemo }: { onClose: () => void; onDemo?: () => void }) {
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])
  return (
    <main className="about">
      <header className="ab-hero">
        <div className="ab-wrap">
          <button className="ab-back" onClick={onClose}>
            ← Torna a l’inici
          </button>
          <div className="ab-brand">
            <img src={APP_ICON} alt="" />
            <span>
              La teva <b>veu</b>
            </span>
          </div>
          <h1>
            Quan l’alumnat té veu,
            <br />
            <em>tothom aprèn millor.</em>
          </h1>
          <p className="ab-lead">
            La teva veu és l’eina de l’{SCHOOL.name} perquè cada alumne pensi en com aprèn i pugui explicar, amb respecte i amb seguretat,
            com viu les classes. El professorat, les famílies i l’Equip Directiu en reben informació clara per acompanyar i millorar.
          </p>
          <div className="ab-hero-cards">
            <div className="ab-mod em">
              <span aria-hidden="true">💭</span>
              <b>Em miro</b>
              <small>L’alumne s’autoavalua</small>
            </div>
            <div className="ab-mod ev">
              <span aria-hidden="true">👀</span>
              <b>Et veig…</b>
              <small>L’alumne valora el professorat</small>
            </div>
          </div>
        </div>
      </header>

      <Section kicker="Per què" title="Escoltar l’alumnat no és opcional: és un dret i és bona pedagogia">
        <p className="ab-intro">
          Les lleis educatives demanen que l’alumne sigui part activa del seu aprenentatge, que l’avaluació serveixi per aprendre i que el
          professorat revisi i millori la seva manera d’ensenyar. Donar veu a l’alumnat connecta aquests tres principis.
        </p>
        <div className="ab-quotes">
          <Quote
            src="Convenció sobre els Drets de l’Infant, art. 12.1"
            href={FONTS.cdi}
            text="Els Estats garantiran a l’infant que pugui formar-se un judici propi el dret d’expressar la seva opinió lliurement en tots els assumptes que l’afecten, tenint-la en compte en funció de l’edat i la maduresa."
            note="Traducció al català del text publicat al BOE (31/12/1990)."
          />
          <Quote
            src="LOE modificada per la LOMLOE, art. 1 a)"
            href={FONTS.loe}
            text="El sistema educatiu s’inspira en el compliment efectiu dels drets de la infància segons la Convenció sobre els Drets de l’Infant, inclòs el dret a participar en les decisions que els afecten."
            note="Síntesi del principi recollit a la Llei orgànica d’educació."
          />
          <Quote
            src="Decret 175/2022, art. 22.3"
            href={FONTS.decret}
            text="L’alumne o alumna ha d’esdevenir part activa del seu procés d’aprenentatge. Cal promoure […] instruments d’avaluació que fomentin la implicació i el compromís de l’alumnat, cosa que facilitarà l’autoregulació, la metacognició i el treball col·laboratiu."
          />
          <Quote
            src="Decret 175/2022, art. 23.2"
            href={FONTS.decret}
            text="L’avaluació ha de ser global, contínua i formativa, i ha de tenir en compte el procés de desenvolupament i el grau d’assoliment de les competències."
          />
          <Quote
            src="LOE, art. 91.1 b) i l)"
            href={FONTS.loe}
            text="Són funcions del professorat l’avaluació dels processos d’ensenyament i la investigació, l’experimentació i la millora contínua d’aquests processos."
            note="Síntesi de les funcions del professorat recollides a la Llei orgànica d’educació."
          />
          <Quote
            src="Decret 175/2022, art. 24.18"
            href={FONTS.decret}
            text="El centre ha d’informar el pare, mare o tutor o tutora legal de l’alumne o alumna de la seva evolució escolar després de cada sessió d’avaluació per mitjà d’informes qualitatius escrits, entrevistes individuals […]."
          />
        </div>
      </Section>

      <Section kicker="Què fa" title="Dues mirades complementàries i un sol lloc per al centre" tone="soft">
        <div className="ab-grid3">
          <Card emoji="💭" title="Em miro · m’autoavaluo" cls="em">
            <ul>
              <li>
                Qüestionaris adaptats a cada etapa: 3r i 4t, 5è i 6è i ESO, amb cares, lectura en veu alta, lletra gran i lectura fàcil.
              </li>
              <li>
                L’alumne pensa en com treballa i aprèn, en com es relaciona amb els altres i en cada matèria, i revisa l’objectiu que
                s’havia proposat.
              </li>
              <li>La tutoria en fa el seguiment i genera l’informe «Així em veig» per parlar-ne amb la família.</li>
            </ul>
          </Card>
          <Card emoji="👀" title="Et veig… · valoro el professorat" cls="ev">
            <ul>
              <li>
                L’alumne explica com viu les classes de cada docent: explicacions, organització, avaluació, ambient, suport i motivació.
              </li>
              <li>Les respostes són anònimes i només s’hi mostren resultats agregats a partir de {THRESHOLD} respostes.</li>
              <li>Cada docent rep l’informe «Així et veiem» i el pot comparar amb la seva pròpia autoavaluació.</li>
            </ul>
          </Card>
          <Card emoji="🏫" title="Centre · dades comunes" cls="ce">
            <ul>
              <li>Alumnat, grups, matèries i correus de les famílies en un sol lloc.</li>
              <li>Cada persona hi veu només el que li correspon: alumnat, tutoria, docents, Equip Directiu.</li>
              <li>Registre de les operacions importants i visió de centre per decidir on posar l’esforç.</li>
            </ul>
          </Card>
        </div>
      </Section>

      <Section kicker="Com funciona" title="Un cicle senzill, cada avaluació">
        <ol className="ab-steps">
          <li>
            <b>L’escola obre la recollida</b>
            <span>Per curs i per un període concret, amb el qüestionari de cada etapa.</span>
          </li>
          <li>
            <b>L’alumnat respon</b>
            <span>Amb el compte de l’escola, des de qualsevol dispositiu, en uns 5-12 minuts. Es desa sol.</span>
          </li>
          <li>
            <b>Es generen els informes</b>
            <span>«Així em veig» per a cada alumne i «Així et veiem» per a cada docent, en PDF A4.</span>
          </li>
          <li>
            <b>Es conversa i es millora</b>
            <span>Tutories individuals, entrevistes amb les famílies i propostes de millora a l’aula i al centre.</span>
          </li>
        </ol>
      </Section>

      <Section kicker="Què permetrà" title="Beneficis per a tota la comunitat educativa" tone="soft">
        <div className="ab-grid4">
          <Benefit emoji="🧒" who="Alumnat">
            Aprendre a mirar-se amb honestedat, posar paraules al que li passa i sentir que la seva opinió compta.
          </Benefit>
          <Benefit emoji="📚" who="Professorat">
            Retorn real i respectuós sobre la pròpia pràctica, per ajustar explicacions, ritme i acompanyament.
          </Benefit>
          <Benefit emoji="👨‍👩‍👧" who="Famílies">
            Un informe clar i positiu de com es veu el seu fill o filla, per conversar-hi a casa i amb la tutoria.
          </Benefit>
          <Benefit emoji="🧭" who="Equip Directiu">
            Una visió global i anònima del centre per prioritzar la formació, l’acció tutorial i els projectes.
          </Benefit>
        </div>
      </Section>

      <Section kicker="Confiança" title="Privacitat des del disseny">
        <div className="ab-trust">
          <p>🔐 Només s’hi entra amb el compte de l’escola (@{SCHOOL.domain}), i qui no és al cens no veu cap dada.</p>
          <p>🕶️ A «Et veig…» les respostes es guarden sense el nom de l’alumne i els comentaris es revisen abans de publicar-los.</p>
          <p>👁️ Cada persona només veu el que li toca: la tutoria, el seu grup; cada docent, el seu informe.</p>
          <p>📜 Les operacions importants queden en un registre que ningú no pot modificar ni esborrar.</p>
        </div>
        <p className="ab-status">
          <b>Estat actual:</b> l’app es pot provar en mode de demostració amb dades fictícies. L’ús amb dades reals queda pendent de la
          revisió de l’Equip Directiu i de la persona delegada de protecció de dades.
        </p>
      </Section>

      <Section kicker="Fonts" title="Marc normatiu consultat" tone="soft">
        <ul className="ab-sources">
          <li>
            <a href={FONTS.cdi} target="_blank" rel="noopener noreferrer">
              Convenció sobre els Drets de l’Infant
            </a>{' '}
            (instrument de ratificació, BOE núm. 313, de 31 de desembre de 1990), art. 12.
          </li>
          <li>
            <a href={FONTS.loe} target="_blank" rel="noopener noreferrer">
              Llei orgànica 2/2006, d’educació, modificada per la Llei orgànica 3/2020 (LOMLOE)
            </a>
            , text consolidat del BOE, art. 1 i 91.
          </li>
          <li>
            <a href={FONTS.decret} target="_blank" rel="noopener noreferrer">
              Decret 175/2022, de 27 de setembre, d’ordenació dels ensenyaments de l’educació bàsica
            </a>{' '}
            (DOGC núm. 8762, de 29 de setembre de 2022), art. 22, 23 i 24.
          </li>
        </ul>
      </Section>

      <section className="ab-cta">
        <div className="ab-wrap">
          <h2>Vols veure com funciona?</h2>
          <div className="ab-cta-row">
            {onDemo && (
              <button className="btn primary large" onClick={onDemo}>
                <span aria-hidden="true">🧪</span> Prova la demostració
              </button>
            )}
            <button className="btn large" onClick={onClose}>
              Torna a l’inici
            </button>
          </div>
          <p className="ab-school">
            <img src={asset('logo-escola-ramon-pont.png')} alt="" /> {SCHOOL.name}
          </p>
        </div>
      </section>
    </main>
  )
}

function Section({ kicker, title, tone, children }: { kicker: string; title: string; tone?: 'soft'; children: ReactNode }) {
  return (
    <section className={`ab-sec${tone ? ` ${tone}` : ''}`}>
      <div className="ab-wrap">
        <p className="ab-kicker">{kicker}</p>
        <h2>{title}</h2>
        {children}
      </div>
    </section>
  )
}

function Quote({ src, href, text, note }: { src: string; href: string; text: string; note?: string }) {
  return (
    <figure className="ab-quote">
      <blockquote>{text}</blockquote>
      <figcaption>
        <a href={href} target="_blank" rel="noopener noreferrer">
          {src}
        </a>
        {note && <small>{note}</small>}
      </figcaption>
    </figure>
  )
}

function Card({ emoji, title, cls, children }: { emoji: string; title: string; cls: string; children: ReactNode }) {
  return (
    <article className={`ab-card ${cls}`}>
      <h3>
        <span aria-hidden="true">{emoji}</span> {title}
      </h3>
      {children}
    </article>
  )
}

function Benefit({ emoji, who, children }: { emoji: string; who: string; children: ReactNode }) {
  return (
    <article className="ab-benefit">
      <span aria-hidden="true">{emoji}</span>
      <h3>{who}</h3>
      <p>{children}</p>
    </article>
  )
}
