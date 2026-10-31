// Textos que es poden escoltar i nom del seu àudio pregenerat (public/audio/<clau>.mp3).
// La clau depèn només del text: si l'escola edita una pregunta, el seu àudio deixa de
// coincidir i l'app torna a la veu del navegador fins que es regeneren els àudios.
import type { Scale } from './types'

/** Text net per llegir: sense emojis ni cometes i amb els espais normalitzats. */
export const speechText = (t: string) =>
  t
    .replace(/\p{Extended_Pictographic}|️|‍/gu, '')
    .replace(/[«»"]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

/** FNV-1a de 32 bits del text net, en hexadecimal. */
export function audioKey(t: string) {
  const s = speechText(t)
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

/** Les opcions d'una escala, tal com es llegeixen després de la pregunta. */
export const optionsText = (scale: Scale) => `${scale.options.map((o) => o.label).join(', ')}.`
