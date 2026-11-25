# Publicació de Traces

Dues vies per evitar el «Mode de desenvolupador» i que les actualitzacions arribin soles.

## 1. Chrome Web Store, en mode «No llistat»

L'extensió no surt a les cerques: només qui té l'enllaç la pot instal·lar. Chrome l'actualitza automàticament.

### Una sola vegada

1. Entreu a <https://chrome.google.com/webstore/devconsole> amb el compte que vulgueu fer servir com a desenvolupador.
2. Accepteu les condicions i pagueu la quota única de registre (5 USD).
3. A **Account**, verifiqueu el correu de contacte.

### Pujar la versió

1. Premeu **New item** i pugeu `Traces-Chrome.zip` (conté directament el `manifest.json`).
2. Ompliu la fitxa amb els textos i les imatges de [store/FITXA.md](./store/FITXA.md) (captures de 1280 × 800, mosaic de 440 × 280, finalitat única, justificació dels permisos i URL de la política de privadesa).
3. Nota: si l'extensió s'ha instal·lat des de la botiga, Chrome l'actualitza sol i Traces no mostra l'avís de versió nova.
4. **Distribution**: visibilitat **Unlisted** (No llistat).
5. **Submit for review**. La revisió sol trigar d'un a pocs dies.

### Actualitzacions posteriors

1. Pugeu la versió a `version` de `public/manifest.json` i de `package.json`.
2. `npm run build` i regenereu `Traces-Chrome.zip`.
3. A la consola: **Package › Upload new package** i **Submit for review**.

## 2. Instal·lació forçada per a tot el claustre (Google Workspace)

Requereix el rol d'administrador del domini del centre.

1. Obriu <https://admin.google.com> › **Dispositius › Chrome › Aplicacions i extensions › Usuaris i navegadors**.
2. A l'esquerra, trieu la unitat organitzativa del professorat (no la de l'alumnat).
3. Premeu el botó groc **+** › **Afegeix des de Chrome Web Store** i enganxeu l'identificador de Traces (és a l'adreça de la fitxa de la botiga, després de `/detail/…/`).
4. Política d'instal·lació: **Força la instal·lació** (o **Força la instal·lació i fixa a la barra d'eines**).
5. Deseu. En unes hores, l'extensió apareix sola a tots els navegadors del professorat on hagin iniciat sessió amb el compte del centre.

### Recomanacions

- Apliqueu-la només a la unitat del professorat.
- Comuniqueu-ho al claustre amb l'enllaç de la pàgina de privadesa i el full per a famílies.
- Si cal, a **Configuració › Usuaris i navegadors** podeu impedir que es desactivi.
