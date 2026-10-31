// Genera la lectura en veu alta de les preguntes amb una veu neuronal catalana,
// com a VoltaMon. Cada fragment (pregunta, ajuda, matèria, opcions d'una escala)
// és un MP3 a public/audio/<clau>.mp3, i public/audio/index.json en llista les claus.
//
// Requisits: edge-tts (pip install edge-tts).
// Ús: npm run audios            → només els àudios que falten
//     npm run audios -- --tots  → els regenera tots (si es canvia la veu o la velocitat)
// Els àudios que ja no corresponen a cap text s'esborren.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { audioKey } from '../src/domain/speech'
import { defaultSpeechTexts } from '../src/domain/speechTexts'

const VEU = 'ca-ES-JoanaNeural'
const VELOCITAT = '-5%'
const CARPETA = 'public/audio'

const forca = process.argv.includes('--tots')
mkdirSync(CARPETA, { recursive: true })
const claus = new Map(defaultSpeechTexts().map((t) => [audioKey(t), t]))
let nous = 0
for (const [clau, text] of claus) {
  const desti = join(CARPETA, `${clau}.mp3`)
  if (!forca && existsSync(desti)) continue
  const temporal = join(tmpdir(), `latevaveu-${clau}.txt`)
  writeFileSync(temporal, text, 'utf8')
  execFileSync('edge-tts', ['--voice', VEU, `--rate=${VELOCITAT}`, '-f', temporal, '--write-media', desti], { stdio: 'inherit' })
  rmSync(temporal)
  nous++
  console.log(`✓ ${clau} ${text.slice(0, 60)}`)
}
for (const f of readdirSync(CARPETA))
  if (f.endsWith('.mp3') && !claus.has(f.slice(0, -4))) {
    rmSync(join(CARPETA, f))
    console.log(`✗ ${f} (ja no s'usa)`)
  }
writeFileSync(join(CARPETA, 'index.json'), JSON.stringify([...claus.keys()].sort()) + '\n')
console.log(`${claus.size} àudios (${nous} de nous) a ${CARPETA}`)
