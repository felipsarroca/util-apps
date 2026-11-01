// Ajuda: com s'autoritza el servidor a enviar correus des dels comptes de l'escola (Gmail API amb un
// compte de servei i delegació a tot el domini). Ho fa una sola vegada una persona administradora de
// Google Workspace. Les il·lustracions són esquemes fets amb HTML, no captures de Google.

import { TEACHER_SENDER } from '../domain/mail'
import { Modal } from '../ui/common'

const SCOPE = 'https://www.googleapis.com/auth/gmail.send'

export function MailAuthHelp({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Com s’autoritza l’enviament de correus" onClose={onClose} wide>
      <div className="ck-help">
        <p>
          Perquè La teva veu pugui enviar correus (recordatoris i, més endavant, informes), Google ha de donar permís al servidor de l’escola. Ho fa <b>una sola vegada</b> una persona
          administradora de Google Workspace i serveix per a <b>tots els comptes de l’escola</b>: {TEACHER_SENDER.email} i qualsevol altre que es vulgui fer servir, com el de les famílies.
        </p>
        <div className="notice">
          <div>
            El permís és només per <b>enviar</b> (<span className="ck-file">gmail.send</span>): el servidor no pot llegir, esborrar ni moure cap correu de ningú.
          </div>
        </div>

        <h3>1. Activar l’API de Gmail</h3>
        <figure>
          <div className="ck-path" aria-label="Camí a Google Cloud">
            <b>console.cloud.google.com</b><i>›</i><b>Projecte «La teva veu»</b><i>›</i><b>API i serveis</b><i>›</i><b>Biblioteca</b>
          </div>
        </figure>
        <ol className="ck-steps">
          <li>Entra a <span className="ck-ui">console.cloud.google.com</span> amb el compte d’administració de l’escola.</li>
          <li>A dalt, tria el projecte <b>La teva veu</b> (és el mateix del botó «Entra amb Google»).</li>
          <li>Ves a <span className="ck-ui">API i serveis</span> › <span className="ck-ui">Biblioteca</span>, cerca <b>Gmail API</b> i clica <span className="ck-ui">Habilita</span>.</li>
        </ol>

        <h3>2. Crear el compte de servei</h3>
        <ol className="ck-steps">
          <li>Ves a <span className="ck-ui">IAM i administració</span> › <span className="ck-ui">Comptes de servei</span> › <span className="ck-ui">Crea un compte de servei</span>.</li>
          <li>Nom: <span className="ck-file">latevaveu-correu</span>. No li donis cap rol ni accés: clica <span className="ck-ui">Fet</span>.</li>
          <li>Obre’l i copia l’<b>ID únic</b>: és un número llarg, de 21 xifres. El necessitaràs al pas 4.</li>
        </ol>
        <figure>
          <div className="ck-screen" role="img" aria-label="Il·lustració dels detalls d’un compte de servei">
            <div className="ck-bar"><div className="ck-dots"><i /><i /><i /></div><div className="ck-url">Google Cloud · Comptes de servei · latevaveu-correu</div></div>
            <div className="ck-body">
              <div className="ck-label">Detalls</div>
              <div className="ck-row"><span className="ck-stat">Correu</span> <span className="ck-file">latevaveu-correu@…iam.gserviceaccount.com</span></div>
              <div className="ck-row"><span className="ck-stat">ID únic</span> <span className="ck-btn hl">1234567890123456789012</span> <span className="ck-stat">← copia aquest número</span></div>
            </div>
          </div>
          <figcaption>Esquema (no és una captura de Google). El número és inventat.</figcaption>
        </figure>

        <h3>3. Descarregar la clau</h3>
        <ol className="ck-steps">
          <li>Al compte de servei, pestanya <span className="ck-ui">Claus</span> › <span className="ck-ui">Afegeix una clau</span> › <span className="ck-ui">Crea una clau nova</span> › <b>JSON</b>.</li>
          <li>
            Es baixa un fitxer <span className="ck-file">.json</span>. És <b>secret</b>: desa’l a l’ordinador que desplega el servidor, <b>fora de Google Drive</b>, per exemple a{' '}
            <span className="ck-file">C:\Users\&lt;usuari&gt;\claus\latevaveu-correu.json</span>. No l’enviïs per correu ni el pugis a cap lloc.
          </li>
          <li>Si Google diu que no es poden crear claus, a <span className="ck-ui">IAM i administració</span> › <span className="ck-ui">Polítiques de l’organització</span> desactiva per a aquest projecte la política <span className="ck-file">iam.disableServiceAccountKeyCreation</span>, crea la clau i torna-la a activar.</li>
        </ol>

        <h3>4. Donar el permís a la consola d’administració</h3>
        <figure>
          <div className="ck-path" aria-label="Camí a la consola d’administració de Google">
            <b>admin.google.com</b><i>›</i><b>Seguretat</b><i>›</i><b>Accés i control de dades</b><i>›</i><b>Controls de l’API</b><i>›</i><b>Delegació a tot el domini</b>
          </div>
        </figure>
        <ol className="ck-steps">
          <li>Clica <span className="ck-ui">Afegeix-ne un de nou</span>.</li>
          <li><b>ID de client</b>: l’ID únic del pas 2.</li>
          <li><b>Àmbits d’OAuth</b>: <span className="ck-file">{SCOPE}</span> (només aquest).</li>
          <li>Clica <span className="ck-ui">Autoritza</span>. Pot trigar uns minuts a fer efecte.</li>
        </ol>
        <figure>
          <div className="ck-screen" role="img" aria-label="Il·lustració del formulari de delegació a tot el domini">
            <div className="ck-bar"><div className="ck-dots"><i /><i /><i /></div><div className="ck-url">Consola d’administració · Delegació a tot el domini</div></div>
            <div className="ck-body">
              <div className="ck-label">ID de client</div>
              <div className="ck-sheet"><table><tbody><tr><td>1234567890123456789012</td></tr></tbody></table></div>
              <div className="ck-label">Àmbits d’OAuth (separats per comes)</div>
              <div className="ck-sheet"><table><tbody><tr><td>{SCOPE}</td></tr></tbody></table></div>
              <div className="ck-row"><span className="ck-btn hl">Autoritza</span></div>
            </div>
          </div>
          <figcaption>Esquema del formulari (no és una captura de Google).</figcaption>
        </figure>

        <h3>5. Passar la clau al servidor</h3>
        <ol className="ck-steps">
          <li>
            A l’ordinador que desplega, obre PowerShell i desa on és el fitxer (canvia el camí pel teu):
            <div className="ck-sheet"><table><tbody><tr><td className="ck-file">[Environment]::SetEnvironmentVariable('LATEVAVEU_GMAIL_SA_FILE', 'C:\Users\&lt;usuari&gt;\claus\latevaveu-correu.json', 'User')</td></tr></tbody></table></div>
          </li>
          <li>Obre un terminal nou i torna a desplegar el servidor (<span className="ck-file">bash scripts/desplega-servidor.sh</span>). La clau passa al servidor sense mostrar-se.</li>
        </ol>

        <h3>6. Provar-ho</h3>
        <ol className="ck-steps">
          <li>A <span className="ck-ui">Centre › Correu</span>, clica <span className="ck-ui">Envia’m una prova</span>. Rebràs un correu de prova de <b>cada compte</b> que envia, i la pantalla dirà si cadascun ha funcionat.</li>
          <li>Si tot va bé, activa els recordatoris automàtics i desa.</li>
        </ol>

        <h3>Fer servir un altre compte</h3>
        <ul>
          <li>
            <b>No cal repetir res a Google.</b> El permís és per a tot el domini: només cal escriure el compte a <span className="ck-ui">Compte que envia</span> (famílies), desar i fer
            <span className="ck-ui">Envia’m una prova</span>.
          </li>
          <li>Ha de ser un <b>usuari amb bústia de Gmail</b> (per exemple, <span className="ck-file">latevaveu@ramonpont.cat</span>), no un grup ni un àlies.</li>
          <li>Els correus al professorat i els recordatoris surten sempre de {TEACHER_SENDER.email}.</li>
          <li>Per retirar el permís a tots els comptes: a la mateixa pantalla de <b>Delegació a tot el domini</b>, esborra l’ID de client.</li>
        </ul>

        <h3>Si la prova falla</h3>
        <ul>
          <li><b>«Google no ha donat permís» (unauthorized_client)</b>: l’ID de client o l’àmbit del pas 4 no són exactes, o encara no ha fet efecte. Revisa’ls i espera uns minuts.</li>
          <li><b>«Gmail no ha acceptat el missatge»</b>: el compte no té bústia de Gmail o és un grup.</li>
          <li><b>«L’enviament encara no està configurat»</b>: el servidor no té la clau. Revisa el pas 5 i torna a desplegar.</li>
        </ul>
      </div>
    </Modal>
  )
}
