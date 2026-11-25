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
2. **Store listing**
   - Idioma: català.
   - Nom: `Traces — Com s'ha elaborat un treball de Google`.
   - Resum (132 caràcters com a màxim): `Mostra al professorat com s'ha elaborat un treball de Google Docs, Presentacions o Sheets, també des de Classroom.`
   - Descripció: copieu la secció «Què mostra» del `README.md`.
   - Categoria: **Educació**.
   - Icona 128 px: `extension/icons/icon128.png`.
   - Captures (1280 × 800): les de la carpeta `captures/`.
3. **Privacy**
   - Finalitat única: «Analitzar l'historial de versions d'un fitxer de Google per mostrar al docent com s'ha elaborat».
   - Justificació dels permisos:
     - `sidePanel`: mostrar l'anàlisi al panell lateral.
     - `activeTab` i `scripting`: llegir l'historial del fitxer obert quan el docent ho demana.
     - `storage`: desar preferències i els resums numèrics de la taula de la classe.
     - Accés a `docs.google.com`: botó dins dels fitxers i lectura de l'historial.
     - Accés a `classroom.google.com`: botó «Analitza la classe», data de lliurament i comentari privat.
     - Accés a `felipsarroca.github.io`: comprovar si hi ha una versió nova.
   - Codi remot: **No**.
   - Dades: marqueu «Contingut del lloc web» i «Informació d'identificació personal» (noms d'autor del fitxer), i les tres certificacions (no es venen, no s'usen per a altres finalitats, no es fan servir per a crèdit).
   - URL de la política de privadesa: `https://felipsarroca.github.io/util-apps/Traces/privadesa.html`.
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
