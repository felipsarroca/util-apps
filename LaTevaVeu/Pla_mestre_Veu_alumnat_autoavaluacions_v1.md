# Pla mestre de «Veu de l’alumnat»: autoavaluacions

**Versió:** 1.0 — Proposta funcional i tècnica, 30 d’octubre de 2026  
**Estat:** document de planificació, sense desenvolupament ni desplegament executats  
**Àmbit:** 3r-6è de primària i 1r-4t d’ESO — Escola Ramon Pont (estructura inicial adaptable)

## 1. Finalitat i principis

Plataforma escolar que permet identificar l’alumnat amb Google, recollir autoavaluacions adaptades a l’edat i a cada període, gestionar-les amb permisos, generar PDFs individuals ben maquetats i preparar-ne la impressió i el lliurament familiar.

**Principis:** (1) el menor nombre de clics possible; (2) lectura accessible segons l’edat; (3) dades privades i segregades; (4) configuració sense programar; (5) qüestionaris versionats; (6) reproducció fidel dels informes històrics; (7) enviaments amb validació prèvia i traçabilitat; (8) manteniment sostenible al llarg dels anys.

**Criteris d’èxit:** un alumne validat pot identificar-se, contestar només el qüestionari i les matèries que li corresponen, interrompre la sessió i reprendre-la; un administrador pot canviar preguntes i matèries sense tocar codi; cap canvi posterior no altera una recollida publicada; cada informe PDF reflecteix les respostes exactes; els enviaments no es dupliquen; l’escola pot auditar cada operació.

## 2. Què es reaprofita de l’aplicació existent

**Repositori verificat:** `felipsarroca/util-apps/VeuAlumnat` a https://github.com/felipsarroca/util-apps/tree/main/VeuAlumnat. És una aplicació Google Apps Script orientada sobretot al professorat i les autoavaluacions d’ESO mitjançant Google Forms.

**Fitxers analitzats:** `GUIA.md`, `apps-script/Core.gs`, `Forms.gs`, `Data.gs`, `Reports.gs`, `Pdf.gs`, `Mail.gs` i `App.gs`. Existeixen proves locals en `tests/local.test.mjs`.

**Capacitats que ja existeixen i que han de servir de referència o ser adaptades:**
- Cens per curs importat des de Google Sheets, amb identificador d’alumne, nom i correu escolar; control de duplicats i de registres incomplets.
- Directori familiar importat de CSV; detecció de capçaleres, associació al cens i revisió manual de noms ambigus.
- Permisos per correu institucional i curs; tutors amb accés per curs i rols de coordinació.
- Cicle de recollida `preparar → obrir → tancar → revisar → generar → aprovar i enviar`.
- Lectura dinàmica de les seccions i preguntes de Google Forms per construir l’informe; omissió de preguntes sense resposta.
- PDF A4 propi, paginat, amb divisió de blocs llargs, colors imprimibles i acusament de lectura.
- Preparació d’un PDF únic per imprimir tots els informes o només els dels alumnes sense correu familiar, amb inici de cada informe en cara nova.
- Previsualització, enviament de prova, lots, comprovació de quota i registre d’estats d’enviament.

**Límits de la versió existent:** les preguntes i matèries reals depenen dels Google Forms vinculats i no es poden inferir íntegrament dels fitxers del repositori; el catàleg de cursos del codi és `1r.ESO` a `4t.ESO`; els usuaris alumnes no emplenen un formulari web propi de l’aplicació; la persistència es fa principalment amb Google Sheets, Forms i Drive, no amb Neon. La nova aplicació conserva els fluxos i pot portar-ne els algoritmes, però no pot reutilitzar sense adaptació les crides de Google Apps Script en un backend Node. Cal comparar el PDF antic i el nou amb casos de regressió.

## 3. Cursos, usuaris i permisos

### 3.1 Organització

Cursos independents: `3r EP`, `4t EP`, `5è EP`, `6è EP`, `1r ESO`, `2n ESO`, `3r ESO`, `4t ESO`; cada curs pertany a una etapa/cicle. Grups opcionals (`A`, `B`...), configurables. L’**any acadèmic** i la **matrícula** de l’alumne en el curs/grup són entitats separades de la identitat. El pas de curs crea una nova matrícula; les dades de cursos anteriors es conserven d’acord amb la política de retenció del centre.

### 3.2 Rols

- **Administrador:** gestió completa; configuració global; accés auditat; dades sensibles només quan la funció ho justifica.
- **Professor:** només grups i alumnes assignats; consulta del progrés, revisió, visualització i exportació individual o de grup segons els permisos rebuts.
- **Alumne:** només matrícula pròpia, qüestionaris oberts, esborranys i enviaments propis; cap cens general.
- **Permisos futurs opcionals:** coordinació pedagògica, tutoria, revisor d’informes, operador d’enviaments, sense necessitat de crear més rols bàsics d’entrada.

**Alta i identificació:** Google OAuth/OIDC amb identificador estable `sub`, no només el correu, que pot canviar. Es recomana limitar el domini institucional, però el domini no atorga automàticament accés a dades: cada compte s’ha d’enllaçar a un registre de matrícula validat. Un correu institucional no reconegut queda pendent de verificació, sense accés a altres alumnes. Els administradors inicials es provisionen de forma segura al servidor, i els posteriors s’atorguen per una acció d’administració auditada. Permisos contrastats a cada endpoint del backend; mai únicament amb condicions visuals del frontend.

**Pantalla inicial alumne:** el nom i el curs es mostren automàticament. En el primer accés o en cas de discrepància: confirmació i petició de correcció a l’administrador, no assignació lliure d’un altre curs. Tancament de sessió visible per a dispositius compartits.

## 4. Matèries configurables

### 4.1 Base de primària

D’acord amb el Decret 175/2022 (i tenint presents les modificacions posteriors), la base d’àrees és: Llengua Catalana i Literatura; Llengua Castellana i Literatura; Llengua Estrangera; Matemàtiques; Coneixement del Medi Natural, Social i Cultural; Educació Artística; Educació Física. Religió és ofertada i s’inclou només per als alumnes que la cursin. Educació en Valors Cívics i Ètics s’incorpora en algun dels cursos de 5è/6è i pot aparèixer en altres cursos segons el centre. A l’Aran, aranès segons el currículum aplicable.

El centre pot presentar àrees integrades («Medi»), separar visualment Música/Plàstica o afegir projectes i tallers, sense confondre la divisió didàctica amb les àrees normatives.

### 4.2 ESO

El catàleg inicial definitiu s’haurà d’importar de les plantilles reals de Google Forms associades a l’aplicació existent o de la configuració del centre. El codi GitHub conté cursos d’ESO, però **no** un inventari complet i estàtic de les assignatures impartides per cada nivell. Com a base provisional: Català, Castellà, Anglès/llengua estrangera, Matemàtiques, Ciències Socials, Educació Física; més Biologia i Geologia, Física i Química, Tecnologia i Digitalització, Música, Educació Plàstica, Visual i Audiovisual, Religió, Educació en Valors, optatives i projectes segons curs, oferta i matrícula. Evitar assignar la mateixa combinació a tots quatre cursos.

**Model necessari:** catàleg central de matèries; vincle matèria-curs-any; matèries optatives assignades a alumnes; ordre de presentació; nom curt i llarg; vigència; exclusió motivada; id immutable. Desactivar en comptes d’esborrar si hi ha respostes històriques.

## 5. Qüestionaris inicials

### 5.1 Cicle mitjà (3r i 4t)

Basat en `Autoavaluacio_3r_4t_primaria.pdf`: quatre afirmacions («He intentat acabar les feines», «Quan no entenia una cosa, he preguntat o he buscat ajuda», «He revisat una feina després de rebre un consell», «He escoltat i he col·laborat amb els companys»); escales senzilles, valoració per àrea de l’autonomia i dues reflexions: «Aquest trimestre he après a…» i «El trimestre vinent vull practicar…». Targetes de pantalla gran, vocabulari directe, poc text lliure.

### 5.2 Cicle superior (5è i 6è)

Basat en `Autoavaluacio_5e_6e_primaria.pdf`: cinc afirmacions generals; valoració de cada àrea segons domini/autonomia; evidència d’una feina, dificultat i resposta, objectiu concret per al trimestre següent, més seguiment de l’objectiu anterior (`Assolit / Hi avanço / Canviaré el pla`). No exigir una observació llarga per cada assignatura.

### 5.3 ESO

Basat en `Autoavaluacio_ESO_model_mostra.pdf`: catorze afirmacions agrupades en «Temps, preparació i constància», «Participació i manera d’aprendre» i «Treball amb els altres i compromís». Escala `Mai / De vegades / Sovint / Sempre / No escau`. Matèries: `resultat que preveig`, `esforç que he fet`, `comprensió del que hem fet` i camp de text «Què puc fer o què em cal?». Les escales i la seva interpretació han de ser administrables i específiques del tipus de pregunta. Incloure una acció personal prioritària de millora al final.

**Optimització d’ús:** no mostrar una taula gegant ni obligar a escriure un text llarg en totes les matèries. Es presenten les valoracions en una targeta per matèria; les observacions poden ser opcionals o prioritzades, segons configuració, sense perdre la possibilitat del PDF complet. L’administrador pot definir obligatorietat, màxim de caràcters i text d’ajuda.

## 6. Motor de qüestionaris sense programació

Entitats: `question_bank`, `questionnaire_templates`, `template_versions`, `sections`, `question_items`, `answer_scales`, `answer_options`, `applicability_rules`, `campaigns`, `campaign_questions_snapshot`.

**Tipus de pregunta a suportar:** resposta única, escala de freqüència, escala d’aprenentatge, nivell previst, resposta curta, resposta llarga, camp per matèria, objectiu recuperat de l’avaluació anterior, text informatiu i, si cal més endavant, resposta múltiple.

Per cada pregunta es configura: id estable, text, instrucció, etapa/cursos, bloc, tipus, opcions o escala, obligatorietat, `No escau`, longitud, ordre, dependències visibles, activació/desactivació, etiqueta de PDF i resum opcional.

**Important:** el formulari és una **versió publicada immutable**. Les modificacions només afecten un esborrany o una nova versió; mai canvien la definició de preguntes amb respostes recollides. Si s’ha de modificar una recollida activa, fer una versió nova amb política explícita de migració o mantenir les respostes ja enviades vinculades a la seva versió original.

L’editor administratiu ha de tenir: llista ordenable d’apartats, biblioteca de preguntes, duplicar, reordenar, preview d’alumne, preview d’informe, comprovació automàtica de validesa, publicació amb resum de canvis i test de PDF sobre respostes fictícies curtes/llargues.

## 7. Experiència d’alumnat

**Flux recomanat:** 1) entrar amb Google; 2) veure nom i curs assignats; 3) veure l’avaluació activa; 4) contestar hàbits per grups; 5) valorar les àrees/matèries cursades; 6) escriure una reflexió prioritària; 7) revisar omissions; 8) enviar i rebre confirmació.

**Característiques:** disseny responsiu (mòbil, tauleta, ordinador i pantalla de classe), botons i àrees tàctils generoses, contrast AA, navegació amb teclat, text llegible i sense colors com a únic codi de significat. Una pregunta o bloc curt per pantalla a primària; blocs compactes i navegables a ESO. Barra de progrés i nombre de matèries pendents. Desa automàticament l’esborrany al servidor i recupera’l al reingrés. Avisos discrets per camps obligatoris; no penalitzar temps ni mostrar puntuacions competitives.

**Durada de referència a provar, no promesa:** 3r/4t aproximadament 4–7 minuts; 5è/6è 6–10; ESO 10–15, condicionat al nombre real de matèries i camps oberts. Fer prova amb alumnat real abans de fixar preguntes i camps obligatoris.

**Modes opcionals a estudi:** lectura facilitada (frases simplificades sense canviar significat), explicació contextual dels nivells, dispositiu compartit amb tancament automàtic de sessió, mode de resposta assistida supervisat. No enviar les respostes a cap IA externa per defecte.

## 8. Avaluacions i estats

Cada recollida està associada a `(any acadèmic, curs, grup opcional, avaluació/període, versió del qüestionari, inici, fi, data de tancament, responsable)`. Els terminis es defineixen al centre amb zona `Europe/Madrid`; configurar per curs, amb opció d’heretar dates del trimestre.

**Estats:** `ESBORRANY → PROGRAMADA → OBERTA → TANCADA → EN_REVISIÓ → INFORMES_GENERATS → VALIDADA → DISTRIBUÏDA → ARXIVADA`.

**Per alumne:** `NO_INICIADA / EN_CURS / LLIURADA / VALIDADA / INCIDÈNCIA`. Un alumne pot tenir només una autoavaluació activa per recollida, però se’n conserven les versions de resposta si es permet modificar fins al tancament. Els canvis extraordinaris posteriors són una rectificació auditada, mai una edició silenciosa.

**Regles:** no enviar informes d’una recollida oberta; no duplicar versions publicades amb dades; cap informe pot tenir una referència incorrecta d’alumne, curs o any; l’administrador pot ampliar un termini amb registre de motiu; possibilitat de tancar per grup si el centre ho necessita.

## 9. Professors i administració: pantalles

### 9.1 Tauler

Indicadors: avaluacions actives, percentatge de participació, esborranys pendents, incidències d’identitat, PDFs pendents, correus pendents/fallits i casos de lliurament en paper. Comparatives entre grups només agregades i sense exposar informació individual fora dels permisos.

### 9.2 Usuaris i cens

Alta/baixa de professors, assignació de cursos/grups, importació CSV, comprovacions d’IDs i adreces, canvi anual de matrícula, comptes pendents d’enllaçar. Previsualització abans de guardar. No barrejar `user` amb `student_enrollment`.

### 9.3 Matèries

Graella per curs amb ordre, activació, optativitat, alumnat inscrit i període de vigència. Vista prèvia de com apareixeran a l’alumne i al PDF. Import inicial de catàleg i modificació posterior sense codi.

### 9.4 Preguntes

Editor visual de plantilla i versions, preguntes per etapa/curs, escales, obligatorietat, ajuda, preview i publicació controlada. Test de paginació per text llarg.

### 9.5 Períodes

Calendari de trimestres, dates per curs, publicació i tancament, recordatoris configurables només si el centre els aprova, duplicació de configuració de l’avaluació anterior.

### 9.6 Seguiment

Cercador per curs/grup/estat, alumnes sense resposta, amb esborrany, completats; incidències; visualització individual conforme a permisos. No donar per «absent» qui encara és dins del termini.

### 9.7 Informes i distribució

Taula de selecció múltiple amb `Alumne | Curs | Estat de resposta | PDF | Correu familiar validat | Canal | Estat d’enviament`. Filtres i accions: veure un PDF, regenerar abans de la distribució, descarregar individualment, generar PDF únic seleccionats, generar PDF només sense correu, marcar «no enviar», preparar destinataris, enviar prova, validar, enviar lots, veure incidències, reintentar només fallits. Botó d’impressió amb salts a cara nova i comprovació de pàgines en blanc quan sigui necessari per doble cara.

## 10. Generació d’informes PDF

**Plantilles independents dels continguts:** una versió gràfica per etapa i un esquema de components comunes: capçalera, metadades, escala, graella de respostes, fitxes de matèria, comentaris, objectius i peu. L’administrador edita contingut i ordre, no CSS arbitrari ni HTML executable.

**Per cada informe es congelen:** qui respon, avaluació, versió de formulari, respostes, dades d’identificació aprovades, plantilla PDF i versió del generador. Una regeneració explícita crea nova versió i manté la traçabilitat.

**Regles de maquetació:** A4, tipografia catalana amb caràcters Unicode, marges coherents, blocs sense sobreimpressió, continuació de preguntes llargues, salt de pàgina controlat, escales llegibles en blanc i negre, indicació «No escau», omissions explicites quan cal, i com a mínim un test amb text llarg i matèries opcionals. Prohibida la retallada silenciosa de respostes; limitar el text lliure només si l’alumne coneix clarament el límit. Plantilla identificable i sense qualificacions automàtiques no sol·licitades.

**Motor recomanat:** PDF a partir de components de servidor renderitzats com HTML/CSS amb Playwright/Chromium en un treballador de backend, o motor PDF dedicat si la primera prova demostra millor robustesa. Es poden reaprofitar la paginació i l’algoritme de blocs de `Pdf.gs`, però cal millorar tipografia Unicode i provar l’escala real. Els PDF amb dades personals no es publicaran en URLs obertes.

## 11. Famílies, correus i impressió

**Importació CSV:** admet `id_alumne`, `curs`, `nom_alumne`, `nom_responsable`, `email_responsable`, `autoritzat_envio`, `actiu`, amb mapatge de columnes flexible. Prioritzar vincle per ID estable; si només hi ha nom, resoldre coincidències amb verificació humana. Suport per diversos responsables per alumne i restriccions de comunicació quan les tingui registrades i validades el centre. No inferir destinataris per cognoms compartits. Validar email, duplicats, absències i autorització/aptitud per rebre aquest tipus d’informe. No publicar els CSV ni incloure’ls al repositori.

**Enviament:** previsualitzar informe i text del correu, enviar una prova a professor/a, validar destinataris i fer una aprovació final inequívoca. Enviament des del servidor amb cua i clau idempotent per `(avaluació, alumne, responsable, versió_pdf)`; registrar `pendent / en_curs / enviat / fallit / confirmat`, data, operació i error sense dades sensibles en logs. Un reintent no ha de duplicar un enviament ja completat. El compte remitent ha de ser institucional i amb resposta a una bústia autoritzada.

**Dos canals avaluables:** PDF adjunt, com es fa ara, o enllaç privat autenticat/caducable, segons decisió de centre i delegat de protecció de dades. Evitar enllaços públics de Drive. Permetre imprimir només els seleccionats i llistar els no enviats. L’acusament de lectura retallable de la versió antiga és una funcionalitat opcional que convé conservar.

**Missatge:** presentar-lo com a autoavaluació personal de l’alumne, no com a qualificació oficial. Contingut adaptat a l’etapa, amb oportunitats d’acompanyament positiu i sense reproduir dades d’altres alumnes.

## 12. Disseny de dades a Neon PostgreSQL

Esquema orientatiu de taules amb IDs UUID, claus foranes, dates, estat i auditoria:

| Domini | Taules | Objectiu |
|---|---|---|
| Identitat | `users`, `user_roles`, `teacher_group_assignments` | Google `sub`, usuari actiu, permisos i grups assignats |
| Acadèmic | `academic_years`, `grades`, `class_groups`, `students`, `enrollments` | Any acadèmic, cursos, alumnes i matrícules històriques |
| Famílies | `guardians`, `student_guardians`, `contact_imports`, `import_issues` | Destinataris validats i importacions traçables |
| Matèries | `subjects`, `grade_subjects`, `student_subjects` | Catàleg i matèries efectivament cursades |
| Formularis | `question_banks`, `questionnaire_templates`, `template_versions`, `sections`, `questions`, `scale_options` | Preguntes configurables i versionades |
| Recollida | `campaigns`, `campaign_assignments`, `responses`, `answer_items`, `response_revisions` | Períodes, esborranys, lliuraments i versions |
| Documents | `pdf_templates`, `generated_reports`, `report_bundles`, `report_assets` | Versions de plantilla, PDF i paquets per imprimir |
| Comunicació | `delivery_batches`, `delivery_recipients`, `delivery_attempts` | Cua, enviaments, errors i confirmacions |
| Governança | `app_settings`, `audit_log`, `export_jobs` | Configuració, traça i exportació |

**Restriccions clau:** unicitat de `google_sub`; matrícula activa coherent amb curs i any; un lliurament principal per alumne i campanya; opció de vincular cada matèria cursada; claus idempotents de comunicació; integritat entre resposta, qüestionari publicat i campanya; esborrats lògics per a preguntes/assignatures usades; restriccions i polítiques d’accés al servidor i, si escau, RLS.

**Dades personals:** el correu familiar no és el login de l’alumne. No reutilitzar un email com a identificador històric únic. Mantenir separades la identitat Google, la persona alumna i la matrícula acadèmica. Les dates de naixement, salut, notes oficials i dades familiars addicionals no s’han de recollir si no són necessàries.

## 13. Arquitectura tecnològica proposada

```mermaid
flowchart TD
    A[Google OAuth / Neon Auth] --> B[Frontend React + TypeScript, Vite]
    B --> C[API Node.js / Fastify amb autorització]
    C --> D[(Neon PostgreSQL, regió UE)]
    C --> E[Cua de treballs]
    E --> F[Generador PDF de servidor]
    E --> G[Servei de correu institucional]
    F --> H[Emmagatzematge privat de fitxers]
    C --> H
```

**Opció coherent amb l’ecosistema de desenvolupament existent:** frontend React+TypeScript/Vite, backend Node/Fastify, ORM Drizzle o Prisma, Neon PostgreSQL i un proveïdor d’enviament adequat. El frontend estàtic es pot publicar amb GitHub Actions, però GitHub Pages, per si sol, **no** proporciona el backend segur necessari per autenticar, gestionar Neon, generar PDF i enviar correus. El backend i el treballador PDF s’han de desplegar en un entorn amb secrets de servidor i recursos suficients, preferentment a la UE.

**Autenticació:** avaluar Neon Auth actual amb Google OIDC; l’existència d’un compte autenticat no supleix l’autorització escolar. Sessions segures i límits d’accés al servidor. No exposar la cadena de connexió SQL ni les credencials d’enviament a JavaScript públic.

**Cua:** processos grans idempotents, amb reintents limitats, comprovació de resultat, registres de fallada i possibilitat de reprendre. No iniciar enviaments massius en una petició que pugui expirar.

**Emmagatzematge privat:** base Neon per als registres i metadades; fitxers PDF en espai privat per fitxers, amb identificador, checksum, política de retenció i enllaços restringits. És possible guardar PDFs a PostgreSQL, però no és l’opció preferent per documents binaris nombrosos.

## 14. Seguretat i compliment

Cal validar el projecte amb direcció i el delegat/ada de protecció de dades del centre abans d’introduir dades reals de menors. Responsable del tractament: el centre, en el seu àmbit; proveïdors externs: revisar contractes d’encàrrec del tractament (art. 28 RGPD), subencarregats, transferències internacionals, regió efectiva i retenció. No assumir que un pla gratuït o un servidor europeu resol per si sol el compliment.

**Controls mínims:** mínim privilegi, xifrat en trànsit, secret de servidor, protecció de sessió, registre d’auditoria, còpies de seguretat i restauració provada, exportació al centre, procediment de baixa, retenció definida, verificació humana de destinataris, protecció contra CSV maliciós i injecció de contingut, anàlisi de riscos i informació de privacitat adequada. La base jurídica del tractament educatiu l’ha de determinar el centre; no s’ha d’afirmar que tot tractament exigeix consentiment parental, ni que mai no l’exigeix.

**Google Workspace for Education:** les aplicacions de tercers no configurades poden estar bloquejades per a menors de 18 anys; el centre ha d’aprovar l’OAuth que s’utilitzi, amb els permisos mínims d’inici de sessió. Validar el funcionament amb comptes d’alumnat de 3r de primària, 6è i ESO abans del desplegament.

**Evitar especialment:** app pública que mostri noms o respostes; còpies de la BD real en entorns de proves; enviaments a adreces familiars deduïdes automàticament; registrar les respostes personals en analytics externs; aparició de contingut d’un alumne en la sessió compartida del següent.

## 15. Proves i criteris d’acceptació

1. Un usuari no matriculat no pot accedir a cap alumne, encara que tingui email `@ramonpont.cat`.
2. Un alumne de 4t de primària no pot modificar el curs ni consultar cap informació d’un altre.
3. Un professor d’un curs no pot veure PDFs ni respostes d’un altre curs, si no té assignació.
4. Cada recollida conserva versió exacta de preguntes i escales després d’una modificació de plantilla.
5. Una pregunta desactivada amb respostes antigues no trenca la generació de PDFs històrics.
6. Les optatives no cursades no apareixen a l’alumne ni s’imprimeixen com si hagués suspès o faltés respondre.
7. Una pausa o desconnexió no esborra el treball desat.
8. PDF amb observacions llargues, accents, símbols, matèries diverses i més d’una pàgina no talla res.
9. Un lot interromput es pot reprendre sense correus duplicats.
10. CSV amb noms ambigus no produeix correspondència automàtica definitiva.
11. Abans d’enviar es pot veure exactament l’alumne, els destinataris i la versió PDF.
12. Es pot generar un sol PDF d’impressió per a seleccionats, respectant les cares inicials.
13. Els informes són llegibles en blanc i negre i compatibles amb lectura amb teclat i suport assistiu a la web.
14. Es prova una restauració i una baixa/canvi anual de cursos sense pèrdua d’històric.
15. Es valida l’entrada Google amb comptes d’alumnat menors d’edat sota les polítiques del centre.

## 16. Fases de construcció recomanades

| Fase | Resultat verificable | Prioritat |
|---|---|---|
| 0. Definició | Congelar criteris d’accés, curs/any, plantilles, origen de cens i regles de privacitat. Inventari real de Google Forms d’ESO. | Crítica |
| 1. Fonaments | Repositori, proves, Google login, rols, esquema Neon, importació de cens, cursos i grups. | Crítica |
| 2. Experiència alumne | Qüestionari d’ESO complet, auto-desa, resum, lliurament, pantalla responsiva i accessibilitat. | Crítica |
| 3. Primària | Perfils diferenciats 3r-4t i 5è-6è, matèries pròpies i objectius de seguiment. | Alta |
| 4. Editor i períodes | Editor de preguntes, versions, assignatures, períodes i previsualització. | Alta |
| 5. Documents | Motor PDF, tres plantilles, test de paginació, informes per lots i impressió selectiva. | Crítica |
| 6. Famílies | CSV, conciliació amb IDs, destinataris, prova, aprovació, cua de correu i reintents. | Crítica |
| 7. Pilot i qualitat | Prova escolar amb dades fictícies primer; després pilot controlat autoritzat. Auditoria i ajustos d’UX. | Crítica |
| 8. Evolució | Historial d’objectius, estadístiques agregades, personalització avançada, millores i exportacions. | Opcional |

**Ordre alternatiu pragmàtic:** fer primer un pilot end-to-end només d’ESO (login → pregunta → Neon → PDF → prova d’enviament fictici) per validar l’arquitectura i tot seguit generalitzar el motor a primària i al catàleg complet. No desplegar correus reals sense la fase de control.

## 17. Decisions pendents que no bloquegen la planificació

- Assignar tots els alumnes per un cens oficial importat (opció recomanada) o permetre una alta guiada pendent d’aprovació.
- Concretar si els professors només revisen o també poden publicar i enviar informes de la seva tutoria.
- Formulari inicial d’ESO: inventari exacte i actual dels Google Forms i matèries dels quatre cursos.
- Obrir de nou una resposta fins al tancament o exigir rectificació del tutor quan ja s’ha lliurat.
- Un destinatari o diversos responsables per alumne, aplicant el directori de comunicacions aprovat del centre.
- PDF adjunt o enllaç privat; conservar la possibilitat d’impressió i acusament en paper.
- Quines preguntes i camps oberts seran realment obligatoris a cada etapa.
- Política de retenció, allotjament dels PDFs, servei de correu i gestor de còpies autoritzats per direcció.

**Proposta per defecte:** importar cens; permetre esborranys i canvis fins al tancament; professorat consulta/valida només grups propis; administració controla plantilles globals; PDF adjunt només després de prova i validació de destinatari, amb opció de lliurament privat en futur; conservar objectius dels trimestres; gestionar el curs amb matrícules històriques.

## 18. Fonts contrastades

- Repositori existent: https://github.com/felipsarroca/util-apps/tree/main/VeuAlumnat
- Guia de l’aplicació: https://github.com/felipsarroca/util-apps/blob/main/VeuAlumnat/GUIA.md
- XTEC, currículum de primària Decret 175/2022: https://xtec.gencat.cat/ca/curriculum/primaria/curriculum-175-2022/
- Departament d’Educació, normativa d’educació i modificacions: https://educacio.gencat.cat/ca/departament/normativa/normativa-educacio/
- Google Workspace for Education, accés a apps de tercers per a menors: https://knowledge.workspace.google.com/admin/getting-started/editions/manage-access-to-unconfigured-third-party-apps-for-users-designated-as-under-18
- APDCAT, preguntes freqüents de protecció de dades als centres educatius: https://apdcat.gencat.cat/web/.content/04-actualitat/menors-i-joves/documents/PAUTES-MENORS-PREGUNTES-FREQUeENTS-ESCOLES.pdf
- Neon Auth, arquitectura actual basada en Better Auth: https://neon.com/blog/neon-auth-branchable-identity-in-your-database
- Models de treball ja elaborats: `Autoavaluacio_3r_4t_primaria.pdf`, `Autoavaluacio_5e_6e_primaria.pdf`, `Autoavaluacio_ESO_model_mostra.pdf`.
