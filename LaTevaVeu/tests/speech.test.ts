import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { audioKey, speechText } from '../src/domain/speech'
import { defaultSpeechTexts } from '../src/domain/speechTexts'

describe('lectura en veu alta', () => {
  it('la clau depèn només del text net', () => {
    expect(speechText('  «Hola»   👋 món ')).toBe('Hola món')
    expect(audioKey('«Hola» món')).toBe(audioKey('Hola   món'))
    expect(audioKey('Hola món')).not.toBe(audioKey('Hola món!'))
    expect(audioKey('Hola')).toMatch(/^[0-9a-f]{8}$/)
  })

  it('cada text dels qüestionaris inicials té el seu àudio (si no: npm run audios)', () => {
    const keys = new Set<string>(JSON.parse(readFileSync('public/audio/index.json', 'utf8')))
    const missing = defaultSpeechTexts().filter((t) => !keys.has(audioKey(t)) || !existsSync(`public/audio/${audioKey(t)}.mp3`))
    expect(missing).toEqual([])
  })
})
