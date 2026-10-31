// Captures del README: entra a la demostració amb cada perfil i fotografia les pantalles clau.
// Cal l'app servida (npm run build && npx vite preview --port 5180) i un Chrome amb depuració remota:
//   chrome --headless=new --remote-debugging-port=9335 --user-data-dir=<carpeta temporal> about:blank
// Ús: node scripts/captures.mjs [port-de-depuració] [carpeta] [adreça-de-l'app]
import { writeFileSync } from 'fs'
const [port = '9335', outDir = 'docs/captures', APP = 'http://localhost:5180/'] = process.argv.slice(2)
const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json()
const ws = new WebSocket(list.find((t) => t.type === 'page').webSocketDebuggerUrl)
let id = 0
const pend = {}
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend[d.id]) pend[d.id](d.result ?? d) }
const send = (method, params = {}) => new Promise((r) => { pend[++id] = r; ws.send(JSON.stringify({ id, method, params })) })
await new Promise((r) => (ws.onopen = r))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const js = async (expr, wait = 900) => { await send('Runtime.evaluate', { expression: expr }); await sleep(wait) }
// Clica el primer element (selector) que contingui el text.
const click = (sel, text, wait) => js(`[...document.querySelectorAll(${JSON.stringify(sel)})].find(e => e.textContent.replace(/\\s+/g,' ').includes(${JSON.stringify(text)}))?.click()`, wait)

async function fresh(w, h, hash = '') {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: APP }); await sleep(1500)
  await js(`localStorage.clear(); sessionStorage.clear(); location.hash = ${JSON.stringify(hash)}; location.reload()`, 2200)
}
async function login(email) {
  await js(`location.hash = '#/demo'; location.reload()`, 2200)
  await js(`(()=>{const i=document.getElementById('demo-email');const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(i,'${email}');i.dispatchEvent(new Event('input',{bubbles:true}));setTimeout(()=>i.form.requestSubmit(),150)})()`, 2200)
}
async function shot(name, full = false) {
  await js('window.scrollTo(0,0)', 300)
  let clip
  if (full) {
    const { result } = await send('Runtime.evaluate', { expression: 'JSON.stringify([innerWidth, Math.min(document.documentElement.scrollHeight, 2400)])', returnByValue: true })
    const [w, h] = JSON.parse(result.value)
    clip = { x: 0, y: 0, width: w, height: h, scale: 1 }
  }
  const r = await send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip, captureBeyondViewport: true } : {}) })
  writeFileSync(`${outDir}/${name}.png`, Buffer.from(r.data, 'base64'))
  console.log('✓', name)
}

const W = 1366, H = 800

await fresh(W, H); await shot('01-entrada')

await fresh(W, H); await login('pau.serra@ramonpont.cat'); await shot('02-alumnat-primaria')
await click('button', 'Comença', 1500); await shot('03-alumnat-pregunta')

await fresh(W, H); await login('marc.vidal@ramonpont.cat'); await shot('04-alumnat-eso')

await fresh(W, H); await login('tutoria.2eso@ramonpont.cat'); await shot('05-personal-inici')
await click('.space-card', 'Em miro'); await shot('06-tutoria-tauler')
await click('.nav-btn', 'Així em veig i famílies'); await shot('07-tutoria-informes')
await click('button:not([disabled])', 'Veure', 1800); await shot('08-informe-aixi-em-veig')
await js(`document.querySelector('.modal-back')?.click(); document.querySelector('[aria-label="Tanca"]')?.click()`, 600)

await fresh(W, H); await login('tutoria.2eso@ramonpont.cat')
await click('.space-card', 'Et veig'); await click('.nav-btn', 'Així et veiem', 1500); await shot('09-informe-aixi-et-veiem')

await fresh(W, H); await login('direccio.demo@ramonpont.cat')
await click('.space-card', 'Et veig'); await click('.nav-btn', 'Visió de centre', 1500); await shot('10-direccio-visio-centre')

await fresh(W, H); await login('admin.demo@ramonpont.cat')
await click('.space-card', 'Em miro'); await click('.nav-btn', 'Recollides'); await shot('11-admin-recollides')
await click('.nav-btn', 'Inici', 800); await click('.space-card', 'Centre'); await click('.nav-btn', 'Correu'); await shot('12-admin-correu')

await fresh(W, H); await login('tutoria.2eso@ramonpont.cat')
await js(`location.hash = '#/guia'`, 1200); await click('button.guide-card', 'Soc tutor', 1200); await shot('13-guia-tutoria')
process.exit(0)
