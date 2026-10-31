# La teva veu — Pla mestre v2

**Versió:** 2.0 · 31 d'octubre de 2026
**Projecte:** Escola Ramon Pont
**Substitueix:** `Pla_mestre_Veu_alumnat_autoavaluacions_v1.md`, que es conserva com a històric.
**Integra:** `La_teva_veu_especificacio_i_identitat_v2.md` (especificació v2.0), les decisions preses en la conversa de disseny del 31 d'octubre de 2026 i l'estat del prototip.

> **Resum.** «La teva veu» és una sola aplicació amb dos apartats que l'administració pot activar o desactivar quan convingui:
>
> - **Em miro:** l'alumne s'autoavalua en cada avaluació. Genera l'informe individual **Així em veig**.
> - **Et veig:** l'alumne valora, una sola vegada per recollida, cada docent que li fa classe. El docent també s'autoavalua, una vegada per etapa. Genera l'informe agregat **Així et veiem** per a cada docent i un informe de conjunt per a l'Equip Directiu.
>
> Per entrar cal un compte `@ramonpont.cat`, les dades es desen a Neon PostgreSQL i les preguntes es poden editar sense programar.

## Com llegir aquest document

| Marca | Significat |
| --- | --- |
| **Acordat** | Decisió presa per Felip Sarroca. No s'ha de reinterpretar. |
| **Requisit** | Necessitat expressada; la manera de resoldre-la es pot ajustar. |
| **Proposta** | Recomanació de disseny pendent de validar. |
| **Pendent** | Decisió oberta (vegeu l'apartat 13). |

Quan aquest pla i l'especificació v2.0 no coincideixen, mana aquest pla. Els canvis respecte de l'especificació són a l'apartat 1.3. Per als detalls d'«Em miro» que aquí només es resumeixen, l'especificació v2.0 (part I) continua sent la referència.

---

## 1. Decisions acordades

### 1.1 Identitat i noms (acordat)

| Element | Nom | Què és |
| --- | --- | --- |
| Plataforma | **La teva veu** | Una sola aplicació web amb dos apartats |
| Apartat d'autoavaluació | **Em miro** | L'alumne reflexiona sobre el seu aprenentatge |
| Apartat de valoració del professorat | **Et veig** | L'alumne explica com viu les classes de cada docent |
| Informe d'«Em miro» | **Així em veig** | PDF individual i identificat d'un alumne |
| Informe d'«Et veig» | **Així et veiem** | PDF agregat i confidencial d'un docent |

- El pas de «jo» (Em miro, Et veig) a «nosaltres» (Així et veiem) és intencionat: cada alumne parla individualment, però el docent rep una veu conjunta.
- Els noms s'escriuen exactament així, sense punts suspensius.
- **Lema (proposta):** «La teva mirada ens ajuda a millorar».
- «M'avaluo», «VeuAlumnat» i «La veu de l'alumnat» queden com a noms interns o de projectes anteriors, no com a títols públics. Els noms descartats durant la pluja d'idees són a `Propostes_de_noms.md` i no s'han de fer servir.
- **To:** proper, clar i constructiu. «Et veig» no s'ha de presentar mai com un mecanisme de vigilància, sanció o qualificació del professorat.

### 1.2 Decisions sobre «Et veig» (acordat)

| # | Decisió |
| --- | --- |
| 1 | Una sola app amb dos apartats activables per separat. |
| 2 | A primària, l'alumnat valora el tutor **i també els especialistes**. |
| 3 | L'alumne valora **cada docent una sola vegada** per recollida, no una vegada per matèria. Si un docent li fa diverses matèries, és una sola valoració. |
| 4 | Com que hi ha una sola valoració per docent, té més preguntes. A ESO, **com a mínim 15 afirmacions per docent**. |
| 5 | **L'Equip Directiu ho pot veure tot:** tots els informes individuals de tots els docents i el conjunt del centre. No veu, però, quin alumne ha respost què (apartat 6). |
| 6 | **Mínim de 15 respostes** per mostrar qualsevol resultat agregat. |
| 7 | L'autoavaluació del docent és **obligatòria**, però el procés ha de funcionar igualment si un docent no la fa. |
| 8 | El docent s'autoavalua **una vegada per etapa** on fa classe (CM, CS i/o ESO), no per grup ni per matèria. |
| 9 | Recollides d'«Et veig» **1 o 2 cops l'any**, independents de les avaluacions. Més endavant, potser una sola recollida cap al mes de maig. |

### 1.3 Canvis respecte de l'especificació v2.0

| Especificació v2.0 | Aquest pla |
| --- | --- |
| §20: seqüència guiada «per professor o matèria» | Una valoració **per docent** (decisió 3). Les matèries només apareixen a la targeta perquè l'alumne reconegui el docent. |
| §22 i §26: llindar mínim pendent | **15 respostes** (decisió 6). |
| §24: «si cal desglossar per matèria o només per docent» | Per docent i etapa; per grup només si el grup arriba a 15 (apartat 5.6). |
| §22 i §24: rols que veuen resultats pendents | Docent: només el seu informe. Equip Directiu: tot (decisió 5). |
| §24: periodicitat pendent | 1-2 recollides l'any, independents de les avaluacions (decisió 9). |
| §26: eines separades o web única | **Web única** amb dos apartats (decisió 1). |
| No hi constava | Autoavaluació del docent per etapa i contrast amb la mirada de l'alumnat (apartat 5.5). |

---

## 2. Estat actual

| Peça | Estat |
| --- | --- |
| Prototip «M'avaluo» (futur «Em miro») | Funcional en **mode de demostració** a `util-apps/LaTevaVeu`. Publicat a <https://felipsarroca.github.io/util-apps/LaTevaVeu/>. Les dades són fictícies, es desen al navegador i no hi ha servidor. |
| Què fa el prototip | Entrada restringida a `@ramonpont.cat` (amb Google si hi ha un identificador de client), tres experiències per etapa, desat automàtic, seguiment docent, informe A4 paginat amb impressió per lots i doble cara, editor de qüestionaris versionat, recollides, matèries per curs, cens CSV i registre d'operacions. Té 17 proves automàtiques. |
| «Et veig» | Només disseny (aquest document). |
| Backend, Neon, correu | No construïts. Hi ha un esquema orientatiu a `db/schema.sql`, que no s'ha executat. |
| Marca | El prototip encara es diu «M'avaluo». Cal canviar-ho a «La teva veu · Em miro» i titular l'informe «Així em veig» (fase 1). |

---

## 3. Arquitectura de producte

### 3.1 Una app, dos apartats

```text
LA TEVA VEU                              (entrada única amb Google @ramonpont.cat)
├── Em miro              [activable]     alumnat: autoavaluació de l'avaluació en curs
│   └── Així em veig                     PDF individual, lliurable a la família
└── Et veig              [activable]     alumnat: valoració de cada docent
    ├── Autoavaluació docent             professorat: una per etapa
    ├── Així et veiem                    PDF agregat per a cada docent
    └── Visió de centre                  informe de conjunt per a l'Equip Directiu

ESPAI DE PROFESSORAT I ADMINISTRACIÓ
├── Em miro: seguiment, informes, famílies
├── Et veig: la meva autoavaluació, els meus informes, (direcció) visió de centre
└── Configuració: persones, cursos, matèries, assignacions docents, preguntes, recollides
```

### 3.2 Activació (proposta)

- Hi ha dos nivells:
  - un **interruptor general per apartat** (`em_miro_actiu`, `et_veig_actiu`), que permet amagar un apartat sencer durant mesos;
  - les **recollides**, cadascuna amb les seves dates i el seu cicle d'estats.
- L'alumne només veu a l'inici les targetes dels apartats actius que tinguin una recollida oberta per al seu curs:
  - **Em miro:** «Penso en com aprenc, què faig bé i què puc millorar».
  - **Et veig:** «Explico com visc les classes i què m'ajuda a aprendre».
- Si no n'hi ha cap d'oberta, l'alumne veu un missatge amable i no un error.
- Els dos apartats comparteixen capçalera i llenguatge visual, amb un color d'accent propi per a cadascun. Cap apartat es distingeix només pel color: sempre porta també el nom i la icona.

---

## 4. Nucli compartit

### 4.1 Identitat i accés (requisit)

- Google OAuth/OIDC amb el paràmetre `hd=ramonpont.cat`. El servidor torna a verificar la signatura, el domini exacte i el correu verificat. L'identificador estable és el `sub` de Google, no el correu.
- **Tenir un compte del domini no dona accés a cap dada.** Cada compte s'ha d'enllaçar a una matrícula validada (alumne) o a un usuari autoritzat (personal). Si no, la persona veu la pantalla «Encara no tens accés». Això ja està implementat al prototip.
- Cal validar l'OAuth amb comptes de menors a la consola de Google Workspace, amb comptes reals de 3r, de 6è i d'ESO.
- Els permisos es comproven en cada crida del servidor, mai només a la interfície.

### 4.2 Rols i permisos

| Rol | Em miro | Et veig |
| --- | --- | --- |
| Alumne | La seva autoavaluació | Les seves valoracions, fins que les lliura. No pot veure les d'altres alumnes. |
| Docent | Seguiment i informes dels grups assignats | La seva autoavaluació i els seus informes «Així et veiem». Cap informe d'un altre docent. |
| Equip Directiu (permís `et_veig_direccio`) | Segons els permisos d'Em miro | **Tots** els informes de docent i la visió de centre (decisió 5) |
| Administració | Configuració completa | Configuració, seguiment de la participació i moderació. No pot veure quin alumne ha dit què. |

Proposta: separar el permís de configuració (`admin`) del permís de veure resultats d'«Et veig» (`et_veig_direccio`). Així, qui configura l'app no té accés automàtic als resultats del professorat.

### 4.3 Dades acadèmiques

- Any acadèmic, cursos (`3EP` a `4ESO`), etapes (CM, CS, ESO), grups i matrícules, com a l'especificació v2.0 (§3).
- Catàleg de matèries per curs, amb optatives per alumne. El catàleg d'ESO del prototip és provisional.
- **Peça nova imprescindible: assignacions docents.** Cal saber quin docent fa quina matèria a quin grup i en quin període. D'aquí surt:
  - la llista de docents que valora cada alumne (els que li fan alguna matèria que cursa, optatives incloses);
  - les etapes en què s'autoavalua cada docent;
  - els grups que apareixen al seu informe.

### 4.4 Motor de qüestionaris

- És el mateix motor per als dos apartats: plantilles per etapa, versions immutables un cop publicades, escales configurables, obligatorietat, límits de text, previsualització i prova d'informe amb respostes curtes i llargues. Ja està implementat al prototip per a «Em miro».
- A «Et veig» s'hi afegeixen dues coses:
  - Cada afirmació pertany a una **dimensió**, que és la unitat dels gràfics.
  - Cada afirmació té una **versió en primera persona** per a l'autoavaluació del docent («Les explicacions m'ajuden a entendre» → «Les meves explicacions ajuden a entendre»).

### 4.5 Recollides

| Apartat | Àmbit | Cicle d'estats |
| --- | --- | --- |
| Em miro | Curs (i grup opcional) × avaluació | `ESBORRANY → PROGRAMADA → OBERTA → TANCADA → EN_REVISIÓ → INFORMES_GENERATS → VALIDADA → DISTRIBUÏDA → ARXIVADA` |
| Et veig | Etapes o cursos × període lliure | `ESBORRANY → PROGRAMADA → OBERTA → TANCADA → MODERACIÓ → INFORMES_GENERATS → PUBLICADA → ARXIVADA` |

Cada recollida guarda una còpia congelada de la versió de preguntes que fa servir. A «Et veig», guarda també les assignacions docents vigents en el moment d'obrir-la.

---

## 5. Et veig

### 5.1 Finalitat

L'objectiu és donar a cada docent un **retorn útil per millorar la seva pràctica** i a l'Equip Directiu una visió del conjunt. No pretén posar notes, fer classificacions públiques ni substituir l'avaluació professional formal.

Criteri pedagògic: les afirmacions descriuen **experiències observables** de l'alumne, no trets personals del docent. Una mala experiència no mesura per si sola la qualitat d'un docent, i l'informe ho ha de dir.

### 5.2 Recorregut de l'alumne

1. Entra a La teva veu i obre **Et veig**.
2. Veu la llista dels seus docents, cadascun en una targeta amb el nom, la foto o les inicials i les matèries que li fa, perquè el reconegui sense dubte. No hi ha cap cercador per triar altres docents del centre.
3. Valora cada docent en una seqüència guiada:
   - a primària, una afirmació per pantalla;
   - a ESO, blocs per dimensió.
4. Cada afirmació té l'opció **«No ho puc valorar»**.
5. Es desa per docent i es pot continuar en diverses sessions (per exemple, en dues tutories). Una barra de progrés indica quants docents li queden («3 de 8 fets»).
6. Revisa el que ha fet, ho lliura i rep una confirmació clara.

**L'ordre dels docents és aleatori per a cada alumne (proposta).** Amb 8 o 9 docents i 15 o més afirmacions per docent, un alumne d'ESO respon unes 130-150 afirmacions, que són uns 25-30 minuts. Si l'ordre fos sempre el mateix, el cansament perjudicaria sempre els últims docents de la llista.

### 5.3 Preguntes per etapa (esborrany per validar)

| Etapa | Afirmacions per docent | Escala | Preguntes obertes |
| --- | --- | --- | --- |
| CM (3r-4t) | 6, amb emojis i lectura en veu alta | 😕 No gaire · 🙂 A vegades · 😀 Sí | 1, opcional |
| CS (5è-6è) | 12 | Mai · De vegades · Sovint · Sempre | 2, opcionals |
| ESO | 18 (mínim acordat: 15) | Mai · De vegades · Sovint · Sempre | 2, opcionals |

Totes les escales inclouen «No ho puc valorar», que no compta en els percentatges.

**ESO: 6 dimensions de 3 afirmacions** (el «fa» es refereix al docent valorat):

| Dimensió | Afirmacions de l'alumne |
| --- | --- |
| Claredat i explicacions | Entenc què hem d'aprendre i què s'espera de mi · Les explicacions i els exemples m'ajuden a entendre · Quan no ho entenem, ho torna a explicar d'una altra manera |
| Organització | Les classes estan ben organitzades i s'aprofita el temps · Sé quines tasques he de fer i quan les he de lliurar · Les activitats tenen relació amb el que hem d'aprendre |
| Avaluació i retorn | Sé com se'm valorarà abans d'una prova o d'una feina · Els comentaris que rebo m'ajuden a millorar · Les correccions arriben a temps perquè em siguin útils |
| Ambient i respecte | A classe puc aprendre en un ambient respectuós · Em tracta amb respecte · Les normes són clares i valen igual per a tothom |
| Suport | Quan tinc dubtes, puc demanar ajuda · Té en compte que no tots aprenem al mateix ritme · Noto que li importa que aprengui |
| Participació i motivació | Tinc oportunitats de participar i de fer preguntes · Les seves classes em desperten interès · Em sento capaç d'aprendre a les seves classes |

Preguntes obertes: «Què hauria de mantenir a les seves classes?» i «Què m'ajudaria a aprendre millor a les seves classes?».

**CS:** les mateixes 6 dimensions, amb 2 afirmacions per dimensió i un vocabulari més senzill.

**CM:**
- M'explica les coses perquè les entengui.
- Quan no ho entenc, m'ajuda.
- M'escolta quan parlo.
- Em sento bé a la seva classe.
- Sé què he de fer.
- M'agrada aprendre amb ell o amb ella.

A CM, la pregunta oberta és «Què t'agrada més de les seves classes?».

Abans de fixar-les, cal provar les preguntes amb alumnat real de cada etapa i passar-les pel claustre.

### 5.4 Respostes d'un docent que fa classe en diverses etapes

Cada alumne respon el qüestionari de la seva etapa. Per això, un docent que fa classe a CS i a ESO té dos blocs de resultats, un per etapa, que no es barregen. Com que les dimensions es diuen igual a totes les etapes, l'informe pot posar-los l'un al costat de l'altre, però no en fa una mitjana conjunta.

### 5.5 Autoavaluació del docent (acordat: una per etapa)

- El docent respon les **mateixes afirmacions** que l'alumnat de l'etapa, en primera persona, **abans de veure** les respostes de l'alumnat. Un cop tancada la recollida, l'autoavaluació queda bloquejada.
- **Context per grup (proposta, opcional).** Un docent no és igual a totes les classes: pot ser més exigent amb un grup que ho necessita, o preparar-se més una matèria que imparteix per primera vegada. En lloc de fer una autoavaluació per grup, pot marcar etiquetes de context en un sol clic:
  - Primer any que imparteixo aquesta matèria.
  - Grup amb necessitats elevades de gestió de l'aula.
  - Grup amb molta diversitat o NESE.
  - Poques hores setmanals amb el grup.

  Les etiquetes no valoren res. Apareixen a l'informe al costat dels resultats del grup, per explicar les diferències.
- **Si el docent no s'autoavalua,** l'informe es genera igualment, sense la secció de contrast i amb la nota «Sense autoavaluació en aquesta recollida». L'Equip Directiu veu qui l'ha completada i el sistema envia recordatoris, però l'absència d'autoavaluació no bloqueja res (decisió 7).
- **Simplificació acceptada:** amb una autoavaluació per etapa, la variació entre grups d'una mateixa etapa no surt de l'autoavaluació, sinó de les dades de l'alumnat (desglossament per grup) i de les etiquetes de context.

### 5.6 Llindar de 15 respostes (acordat)

| Nivell | Es mostra si… | Si no hi arriba |
| --- | --- | --- |
| Docent × etapa | ≥ 15 respostes vàlides | No es mostren resultats de l'alumnat d'aquella etapa. L'informe diu «Mostra insuficient» i, si n'hi ha, mostra l'autoavaluació. |
| Grup dins de l'etapa | ≥ 15 respostes del grup | El grup només compta dins del total de l'etapa. No hi ha desglossament per grup. |
| Comentaris oberts | El docent × etapa arriba a 15 | No es mostren. |

Els recomptes de 15 es fan sobre els lliuraments; una resposta «No ho puc valorar» no treu l'alumne del recompte.

**Pendent:** si un docent no arriba mai a 15 en una etapa (per exemple, un especialista amb un sol grup petit), cal decidir si s'acumulen dues recollides consecutives o si es dona per no avaluable.

### 5.7 Confidencialitat de les respostes (proposta tècnica)

L'objectiu és que **ningú, tampoc l'administració ni l'Equip Directiu, pugui saber quin alumne ha dit què**. Mentre aquest disseny no s'hagi implementat i auditat, a l'alumnat i al professorat se'ls parla de **«resultats agregats i confidencials»**, no de respostes «anònimes» (especificació §22).

1. **Esborrany:** mentre l'alumne respon, l'esborrany va lligat al seu usuari perquè el pugui reprendre. Es desa xifrat al servidor i cap pantalla de l'app el mostra.
2. **Lliurament:** quan l'alumne lliura un docent, el servidor fa dues coses dins una mateixa transacció:
   - A `participation`, anota que aquell alumne ha lliurat aquell docent en aquella recollida. Serveix per evitar duplicats i per seguir la participació.
   - A `feedback_answers`, desa les respostes amb un identificador aleatori i només amb recollida, docent, etapa i grup. No hi consta cap identificador d'alumne, i la data només hi consta arrodonida al dia.

   Tot seguit esborra l'esborrany.
3. Un cop lliurat, l'alumne ja no pot modificar aquella valoració, perquè l'enllaç amb ell ja no existeix.
4. Els registres del servidor no inclouen mai el contingut de les respostes.
5. **Comentaris oberts:** abans de publicar els informes es fa una moderació (estat `MODERACIÓ`):
   - un filtre automàtic marca insults, noms propis i referències a fets identificables;
   - una persona de direcció revisa els comentaris marcats i els accepta, els edita (per exemple, treu un nom) o els descarta.

   Al docent no li arriba mai l'original d'un comentari editat.

Aquest model l'han de revisar la direcció i la persona delegada de protecció de dades abans de recollir cap resposta real. També s'ha d'informar el claustre de qui veu què.

### 5.8 Informe «Així et veiem» (un per docent i recollida)

Capçalera:

```text
LA TEVA VEU · ET VEIG
Així et veiem
La mirada conjunta de l'alumnat sobre les classes de [Docent]
[Etapes i grups inclosos] · [Període] · [Curs acadèmic]
```

Contingut, per a cada etapa on fa classe:

1. **Participació:** respostes vàlides sobre l'alumnat que el podia valorar. No es dona cap dada per sota del llindar.
2. **Dimensions:** barres apilades amb la distribució de respostes (Mai, De vegades, Sovint, Sempre). Prioritza percentatges i comptes, **no hi ha cap nota única del docent**.
3. **Contrast amb la seva autoavaluació:** per a cada dimensió, la seva valoració al costat de la de l'alumnat. Les dimensions es classifiquen en quatre zones:

   | | L'alumnat ho valora alt | L'alumnat ho valora baix |
   | --- | --- | --- |
   | **El docent es valora alt** | Fortaleses confirmades | Punts cecs |
   | **El docent es valora baix** | Fortaleses ocultes | Reptes reconeguts |

4. **Per grup:** només els grups que arribin a 15, amb les etiquetes de context al costat.
5. **Evolució:** comparació amb les seves recollides anteriors. No hi ha comparació amb altres docents identificats.
6. **Comentaris moderats:** «Què hauria de mantenir» i «Què m'ajudaria a aprendre millor».
7. **Tancament:** un espai perquè el docent anoti una o dues propostes de millora (opcional i privat).

El docent consulta l'informe a l'app i el pot descarregar en PDF A4. Per defecte no s'envia per correu.

### 5.9 Visió de centre per a l'Equip Directiu

- **Participació** per etapa, curs i grup, i estat de les autoavaluacions docents.
- **Mapa de calor** de docents × dimensions, per etapa, ordenat alfabèticament. No es mostra cap rànquing ni ordenació per puntuació (proposta).
- **Dimensions del centre**: distribució per etapa i evolució entre recollides.
- **Fortaleses i reptes del centre**: les dimensions més i menys valorades, útils per planificar la formació.
- **Accés a tots els informes «Així et veiem»** (decisió 5).
- Cada consulta i cada descàrrega queden registrades (`feedback_publication_log`).

### 5.10 Administració d'«Et veig»

- Importar o editar les assignacions docents i detectar docents absents, duplicats o sense grup.
- Crear, editar, versionar i publicar els qüestionaris de cada etapa amb les dimensions, les afirmacions per a l'alumnat i la versió en primera persona.
- Crear recollides per a una o diverses etapes, decidir quins docents hi participen i fixar-ne les dates.
- Seguir la participació (per grup i per docent) sense veure cap resposta.
- Moderar els comentaris, generar els informes i publicar-los als docents.
- Previsualitzar «Així et veiem» amb dades fictícies i comprovar que els llindars s'apliquen.

---

## 6. Em miro (resum)

Està implementat al prototip i especificat en detall a l'especificació v2.0 (part I, §1-18). Els punts clau són:

- **Qüestionaris per etapa:**
  - CM: una pregunta per pantalla, emojis, avanç automàtic i lectura en veu alta.
  - CS: blocs curts i seguiment de l'objectiu de l'avaluació anterior.
  - ESO: 14 afirmacions en 3 blocs i una pantalla per matèria amb resultat previst, esforç i comprensió, més una acció de millora.
- **Recorregut de l'alumne:** desat automàtic, revisió de les respostes pendents, lliurament, i possibilitat de modificar-lo fins al tancament.
- **Informe «Així em veig»:** PDF A4 individual, paginat per blocs. Permet un PDF únic dels alumnes seleccionats o només dels que no tenen correu familiar, amb l'opció de doble cara (cada informe comença en cara nova) i un acusament de lectura retallable.
- **Famílies:** importació CSV amb verificació humana, diversos responsables, cua de correu idempotent i prova abans d'enviar.

**Canvis pendents al prototip:** canviar la marca a «La teva veu · Em miro», titular l'informe «Així em veig», fer servir la ruta `/em-miro` i anomenar els fitxers `Aixi_em_veig_<any>_<avaluació>_<id>.pdf` (especificació §0.5).

---

## 7. Dades a Neon PostgreSQL

Es parteix de l'esquema actual (`db/schema.sql`) i de les taules de l'especificació v2.0 (§12 i §23). Per a «Et veig» cal afegir-hi:

| Taula | Responsabilitat |
| --- | --- |
| `teaching_assignments` | Docent × matèria × grup × període |
| `feedback_campaigns` | Recollides d'«Et veig»: etapes, dates, estat i versió de qüestionari congelada |
| `feedback_campaign_teachers` | Docents que participen en cada recollida |
| `feedback_drafts` | Esborranys xifrats per alumne × docent. S'esborren en lliurar. |
| `participation` | Alumne × docent × recollida: lliurat sí o no. Accés molt restringit. |
| `feedback_answers` | Respostes sense identificador d'alumne: id aleatori, recollida, docent, etapa, grup i data al dia |
| `feedback_comments` | Text original, estat de moderació i text publicable |
| `teacher_self_assessments` | Docent × etapa × recollida: respostes i etiquetes de context per grup |
| `feedback_reports` | Informes generats, versió i supressions aplicades pel llindar |
| `feedback_publication_log` | Qui genera, publica, consulta o descarrega cada informe |

**Restriccions:**
- Unicitat de (alumne, docent, recollida) a `participation`.
- Cap clau forana de `feedback_answers` cap a `students` ni cap a `users`.
- Els permisos de lectura de `feedback_answers` estan limitats al procés que agrega les dades.
- El llindar de 15 s'aplica al servidor, no a la interfície.

---

## 8. Arquitectura tecnològica

Es manté la de l'especificació v2.0 (§13):

- Frontend React + TypeScript + Vite, que és el prototip actual.
- API Node/Fastify amb autorització.
- Neon PostgreSQL a la UE.
- Cua de treballs.
- Generador de PDF al servidor.
- Correu institucional.
- Emmagatzematge privat dels PDF.

GitHub Pages només pot allotjar el frontend; per a la resta cal un backend amb secrets de servidor. La capa `src/data/api.ts` del prototip ja té la forma de la futura API i s'ha de substituir per crides al servidor sense canviar les pantalles.

---

## 9. Seguretat i protecció de dades

S'apliquen els controls de l'especificació v2.0 (§14). «Et veig» hi afegeix:

- **Dades del professorat:** les valoracions són dades personals dels docents. Cal documentar-ne la finalitat (millora de la docència), qui hi accedeix (el docent i l'Equip Directiu), quant de temps es conserven i quina informació es dona al claustre abans de la primera recollida.
- **Dades de l'alumnat:** el model de confidencialitat (apartat 5.7) l'ha de validar la persona delegada de protecció de dades.
- Les respostes no s'envien mai a cap servei extern ni a cap IA. El filtre de comentaris funciona al servidor.
- No hi ha cap rànquing ni comparació pública entre docents.

---

## 10. Criteris d'acceptació

Es mantenen els 15 criteris de l'especificació v2.0 (§15) per a «Em miro». «Et veig» n'hi afegeix aquests:

1. Un alumne només veu els docents que li fan alguna matèria que cursa, especialistes inclosos, i cadascun una sola vegada encara que li faci diverses matèries.
2. Un alumne no pot lliurar dues vegades el mateix docent en una recollida.
3. A partir de la base de dades, ningú pot relacionar una resposta lliurada amb l'alumne que l'ha feta.
4. Cap resultat agregat, desglossament per grup o comentari es mostra per sota de 15 respostes.
5. Un docent només veu els seus informes. L'Equip Directiu els veu tots. L'administració sense el permís `et_veig_direccio` no en veu cap.
6. L'informe es genera correctament quan el docent no s'ha autoavaluat.
7. Un docent que fa classe en dues etapes té dues autoavaluacions i dos blocs de resultats separats.
8. Desactivar «Et veig» amaga l'apartat a l'alumnat sense afectar «Em miro», i a l'inrevés.
9. Una pausa o desconnexió no fa perdre cap valoració desada.
10. Cap comentari arriba al docent sense haver passat la moderació.

---

## 11. Fases

| Fase | Resultat | Estat |
| --- | --- | --- |
| 0. Prototip «Em miro» | Recorregut complet en mode de demostració | **Fet** |
| 1. Marca i estructura | Canvi a «La teva veu», dos apartats activables, rutes `/em-miro` i `/et-veig`, informe «Així em veig» | **Fet** (rutes `#/em-miro` i `#/et-veig`) |
| 2. Prototip «Et veig» | Assignacions docents, recorregut de l'alumne, autoavaluació docent, llindars, «Així et veiem» i visió de centre amb dades fictícies | **Fet** |
| 3. Validació pedagògica | Preguntes d'«Et veig» provades amb alumnat i revisades al claustre; inventari real de matèries d'ESO | **Material preparat** (`docs/04` a `07`, importació CSV d'assignacions); falta fer-la |
| 4. Validació de privacitat | Revisió amb direcció i la persona delegada de protecció de dades; OAuth aprovat a Google Workspace | **Material preparat** (`docs/01` a `03`); falten les decisions |
| 5. Backend i Neon | API, sessions, esquema, model de confidencialitat i proves de permisos | **Base feta** a `server/` (API d'«Et veig» amb proves); falta allotjament, Neon i connexió del frontend |
| 6. Documents i correu | PDF al servidor, emmagatzematge privat, cua de correu per a «Em miro» | Pendent |
| 7. Pilot | Una recollida real controlada de cada apartat | Pendent |

Les fases 1 i 2 es poden fer al prototip actual sense dades reals. Les fases 3 i 4 han d'estar completes abans de recollir dades reals de qualsevol dels dos apartats.

---

## 12. Riscos i mesures

| Risc | Mesura |
| --- | --- |
| Rebuig o desconfiança del claustre | Informar abans de començar, to de millora i no de judici, sense notes úniques ni rànquings, contrast amb l'autoavaluació, i documentar qui veu què |
| Respostes poc sinceres de l'alumnat | Confidencialitat real i ben explicada, i resultats agregats a partir de 15 respostes |
| Cansament a ESO (130-150 afirmacions) | Desat per docent, diverses sessions, ordre aleatori i barra de progrés |
| Comentaris ofensius o identificables | Filtre automàtic i moderació humana abans de publicar |
| Docents amb mostres petites | Llindar de 15 i decisió pendent sobre acumular recollides |
| Llegir les diferències entre grups com a inconsistències | Etiquetes de context per grup i text interpretatiu a l'informe |

---

## 13. Decisions pendents

| Qüestió | Proposta per defecte |
| --- | --- |
| Text definitiu de les preguntes d'«Et veig» | L'esborrany de l'apartat 5.3, provat amb alumnat i revisat al claustre |
| Docents que no arriben a 15 en una etapa | Acumular dues recollides consecutives; si encara no hi arriben, «mostra insuficient» |
| Qui modera els comentaris | Una persona de l'Equip Directiu |
| Si el docent pot respondre l'informe o afegir-hi propostes que vegi la direcció | Notes privades per defecte; compartir-les és opcional |
| Retenció de les dades d'«Et veig» | Conservar 3 cursos per poder veure l'evolució; després, només els agregats |
| Lema | «La teva mirada ens ajuda a millorar» |
| Marca gràfica i colors de cada apartat | Pendent de dissenyar en la fase 1 |
| Decisions pendents d'«Em miro» | Les de l'especificació v2.0 (§17) |

---

## 14. Referències

- `La_teva_veu_especificacio_i_identitat_v2.md`: especificació funcional i d'identitat v2.0.
- `Pla_mestre_Veu_alumnat_autoavaluacions_v1.md`: pla mestre v1 (històric).
- `Propostes_de_noms.md`: pluja d'idees de noms (els noms descartats no s'han de fer servir).
- Prototip: <https://felipsarroca.github.io/util-apps/LaTevaVeu/> · codi a `util-apps/LaTevaVeu`.
- App anterior: <https://github.com/felipsarroca/util-apps/tree/main/VeuAlumnat>.
