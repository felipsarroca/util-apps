# La teva veu: dossier de protecció de dades

**Per a:** Equip Directiu i persona delegada de protecció de dades (DPD) de l'Escola Ramon Pont
**Versió:** 1.0, 31 d'octubre de 2026
**Estat:** proposta per revisar. Cap dada real no s'ha de recollir fins que aquest document estigui validat i signat (apartat 12).

> Aquest dossier descriu com funciona l'aplicació i proposa decisions. **No és un dictamen jurídic.** La base jurídica, els terminis de conservació i la necessitat d'una avaluació d'impacte els ha de determinar el centre amb la seva DPD.

---

## 1. Què és «La teva veu»

Aplicació web del centre amb dos apartats, que es poden activar o desactivar per separat:

| Apartat | Què fa | Què genera |
| --- | --- | --- |
| **Em miro** | Cada alumne s'autoavalua en cada avaluació: hàbits, actitud, matèries i un objectiu personal | Informe individual **«Així em veig»**, que pot arribar a la família |
| **Et veig** | Cada alumne valora, una vegada per recollida, cada docent que li fa classe. Cada docent s'autoavalua una vegada per etapa | Informe agregat **«Així et veiem»** per a cada docent i una **visió de centre** per a l'Equip Directiu |

Abast: alumnat de 3r de primària a 4t d'ESO i el seu professorat, inclosos els especialistes.

Finalitats:
- **Em miro:** afavorir l'autoconeixement i l'aprenentatge de l'alumne, i compartir-ho amb la família. És una funció educativa, no una qualificació.
- **Et veig:** millorar la docència a partir de la mirada de l'alumnat. **No és una avaluació del rendiment del docent** ni pot servir per prendre decisions laborals. No genera notes ni rànquings.

---

## 2. Dades que es tracten

### 2.1 Dades comunes

| Dada | De qui | Per a què |
| --- | --- | --- |
| Correu `@ramonpont.cat`, nom i cognoms | Alumnat i personal | Identificar qui entra |
| Curs, grup i optatives | Alumnat | Saber quines preguntes, matèries i docents li corresponen |
| Rol, grups assignats i pertinença a l'Equip Directiu | Personal | Permisos |
| Assignacions docents (docent × matèria × grup) | Personal | Saber quins docents valora cada alumne |
| Registre d'operacions (qui, què, quan) | Personal | Traçabilitat de canvis i consultes d'informes |

No es tracten categories especials de dades (art. 9 RGPD) ni dades de salut. No es demana el número d'identificació ni l'adreça.

### 2.2 Em miro

| Dada | Observacions |
| --- | --- |
| Respostes de l'autoavaluació i observacions lliures | Identificades: estan vinculades a l'alumne |
| Objectiu personal i seguiment de l'objectiu anterior | Identificat |
| Correu de les famílies i autorització d'enviament | Només si s'envia l'informe per correu. Es carrega des del cens del centre, no s'endevina |
| Informe PDF «Així em veig» i registre d'enviament | Identificat |

### 2.3 Et veig

| Dada | Vinculada a l'alumne? | Observacions |
| --- | --- | --- |
| **Esborrany** de la valoració | Sí, temporalment | Permet reprendre-la. S'esborra en lliurar |
| **Participació** (aquest alumne ha lliurat aquest docent en aquesta recollida) | Sí | No conté cap resposta. Serveix per evitar duplicats i per comptar la participació |
| **Respostes lliurades** | **No** | Identificador aleatori, recollida, docent, etapa, grup i data (només el dia) |
| **Comentaris oberts** | No | Passen per moderació abans d'arribar al docent |
| **Autoavaluació del docent** i etiquetes de context per grup | Sí (del docent) | Una per etapa i recollida |
| Informes «Així et veiem» i visió de centre | Agregats | Contenen dades personals **del docent** valorat |

> Les valoracions d'«Et veig» són **dades personals dels docents** (parlen de la seva feina) encara que no ho siguin de l'alumne que respon. Per això també cal informar el claustre i definir-ne la finalitat i l'accés.

---

## 3. Qui hi accedeix

| Perfil | Em miro | Et veig |
| --- | --- | --- |
| **Alumne** | Només la seva autoavaluació i el seu informe | Només els docents que li fan classe i les seves valoracions en curs. Un cop lliurades, ja no les veu ni les pot canviar |
| **Docent o tutor/a** | Les autoavaluacions dels grups que té assignats | La seva autoavaluació i el seu informe, **només quan es publica** |
| **Equip Directiu** | Com l'administració | Tots els informes i la visió de centre. Modera els comentaris. **Mai sap quin alumne ha dit què** |
| **Administració** (sense ser de l'Equip Directiu) | Tot, amb registre | Configura recollides, preguntes i assignacions. **No veu cap resultat** |
| **Família** | Rep l'informe del seu fill o filla, si el centre ho decideix | Cap accés |

Regles que aplica l'aplicació:
- Només un membre de l'Equip Directiu pot afegir-hi o treure'n persones. L'administració no s'hi pot afegir pel seu compte.
- Cada consulta o descàrrega d'un informe «Així et veiem» per part d'una persona diferent del docent queda registrada.
- Ningú, ni tan sols l'Equip Directiu, pot consultar la taula de participació alumne per alumne des de l'aplicació. La participació només es mostra en recomptes per grup.

---

## 4. Model de confidencialitat d'«Et veig»

1. **Mentre respon:** l'esborrany va lligat a l'alumne perquè el pugui reprendre. Cap pantalla no el mostra a ningú més.
2. **En lliurar**, el servidor fa dues operacions en una sola transacció:
   - anota a *participació* que l'alumne ha lliurat aquell docent, sense cap resposta;
   - desa les respostes a *respostes lliurades* **sense cap identificador d'alumne**, amb un identificador aleatori i només la data del dia.
   Després esborra l'esborrany. Des d'aquest moment no hi ha cap camí a la base de dades entre l'alumne i el que ha respost.
3. **Llindar de 15:** no es mostra cap resultat d'un docent, d'un grup ni cap comentari si hi ha menys de 15 respostes. El llindar s'aplica **al servidor**, no només a la pantalla.
4. **Comentaris:** un filtre automàtic marca insults, noms propis, dades de contacte i frases que poden identificar qui escriu. Una persona de l'Equip Directiu els accepta, els edita (per exemple, treu un nom) o els descarta. Al docent no li arriba mai l'original d'un comentari editat.
5. **Sense rànquings:** la visió de centre ordena els docents alfabèticament i no calcula cap nota única.
6. Les respostes **no s'envien a cap servei extern ni a cap intel·ligència artificial**.

### Riscos residuals de reidentificació (per valorar amb la DPD)

| Risc | Mesura actual | Mesura addicional possible |
| --- | --- | --- |
| Un grup petit (12-18 alumnes) amb un sol docent: el resultat del grup coincideix amb el del docent | Llindar de 15 | Acumular dues recollides abans de mostrar un grup petit |
| La data del lliurament combinada amb qui ha faltat o qui ha respost un dia concret | Només es desa el dia | No desar cap data a les respostes; fer servir només la recollida |
| Un comentari amb una manera d'escriure reconeixible | Moderació humana | Publicar els comentaris resumits o reescrits per la persona moderadora |
| L'ordre d'inserció a la base de dades permet relacionar respostes i participació | Inserció en posició aleatòria (prototip) | Al servidor: inserir les respostes en lots i en ordre aleatori, i no fer servir identificadors seqüencials |
| Còpies de seguretat que contenen esborranys | Els esborranys s'esborren en lliurar | Xifrar els esborranys i tancar les recollides en un termini curt |

> Mentre la DPD no hagi validat aquest model, a l'alumnat i al professorat es parlarà de **«resultats agregats i confidencials»**, no de respostes «anònimes».

---

## 5. Base jurídica (per decidir)

L'ha de determinar el centre amb la DPD. Opcions que convé valorar:

| Tractament | Opció a valorar | Comentari |
| --- | --- | --- |
| Em miro (alumnat) | Funció educativa del centre: art. 6.1.e RGPD i disposició addicional 23a de la LOE | És una activitat d'aprenentatge integrada a l'avaluació formativa |
| Enviament de l'informe a les famílies | La mateixa funció educativa i la relació del centre amb les famílies | Cal informar-ne i respectar les restriccions de comunicació registrades |
| Et veig (respostes de l'alumnat) | Funció educativa o interès legítim del centre en la millora docent | Respostes no vinculades a l'alumne |
| Et veig (dades del professorat) | Interès legítim (art. 6.1.f) o compliment de la relació laboral, segons la titularitat del centre i el conveni aplicable | Requereix informació prèvia al claustre i, si escau, consulta a la representació dels treballadors |

No s'ha d'afirmar que cal el consentiment de les famílies per a tot, ni que no cal mai. En qualsevol cas, cal **informar** (art. 13 RGPD); els textos són a `02_Textos_informatius.md`.

---

## 6. Avaluació d'impacte (AIPD)

Recomanació: **fer una AIPD abreujada abans del pilot** (art. 35 RGPD). Motius:
- es tracten dades de menors, un col·lectiu vulnerable;
- «Et veig» genera valoracions sobre persones treballadores;
- la llista de tractaments que requereixen AIPD de l'APDCAT inclou els tractaments que avaluen persones i els que afecten col·lectius vulnerables.

Aquest dossier ja conté la majoria d'elements: descripció, necessitat i proporcionalitat (apartats 1-3), riscos i mesures (apartats 4, 8 i 9). La DPD ha de confirmar si cal i completar-la.

---

## 7. Conservació (proposta)

| Dada | Termini proposat | Després |
| --- | --- | --- |
| Esborranys d'«Et veig» | Fins al lliurament o, com a màxim, fins al tancament de la recollida | S'esborren |
| Participació d'«Et veig» | Fins a la publicació dels informes | S'esborra; es conserven només els recomptes per grup |
| Respostes i comentaris d'«Et veig» | 3 cursos, per veure l'evolució | Només els agregats per docent i etapa |
| Autoavaluacions docents | 3 cursos | S'esborren |
| Respostes i informes d'«Em miro» | Fins al final de l'etapa de l'alumne i un curs més | S'esborren |
| Registre d'operacions | 2 cursos | S'esborra |
| Comptes d'alumnat i de personal | Mentre siguin al centre | Baixa en sortir del cens |

---

## 8. Proveïdors i ubicació de les dades

| Proveïdor | Funció | Dades | Què cal revisar |
| --- | --- | --- | --- |
| Google Workspace for Education | Inici de sessió amb el compte de l'escola i, si escau, correu institucional | Correu i nom (inici de sessió). Informes «Així em veig» (correu) | Ja és encarregat del centre. Cal autoritzar l'app (vegeu `03_Google_Workspace.md`) |
| Neon (PostgreSQL) | Base de dades | Totes les dades dels apartats 2.2 i 2.3 | Contracte d'encàrrec (art. 28), regió a la UE, subencarregats i còpies de seguretat |
| Servidor de l'API (per triar) | Lògica, permisos, PDF i correu | Totes, en trànsit | Contracte d'encàrrec, regió a la UE i secrets de servidor |
| GitHub Pages | Allotja la interfície (fitxers estàtics) | Cap dada personal | Cap |

Un pla gratuït o un servidor a Europa **no garanteix per si sol** el compliment: cal revisar els contractes de cada proveïdor.

---

## 9. Mesures de seguretat

**Ja implementades al prototip:**
- Accés només amb comptes `@ramonpont.cat` i, a més, només per a persones del cens. Tenir un compte de l'escola no dona accés a cap dada.
- Permisos comprovats a cada operació, no només a la pantalla.
- Llindar de 15 i moderació obligatòria dels comentaris.
- Registre d'operacions i de consultes d'informes.
- Tancament automàtic de la sessió de l'alumnat després de 20 minuts d'inactivitat.
- Validació dels CSV importats abans d'aplicar-los.

**Pendents per a la versió real** (fase 5 del pla):
- Verificació al servidor del testimoni de Google a cada sessió.
- Xifratge en trànsit (HTTPS) i, per als esborranys, també en repòs.
- Mínim privilegi a la base de dades: el procés que agrega no pot llegir la participació, i el que registra la participació no pot llegir les respostes.
- Còpies de seguretat amb restauració provada i procediment de baixa.
- Registres del servidor sense contingut de respostes.
- Cap còpia de dades reals en entorns de proves.

---

## 10. Drets de les persones

- **Em miro:** l'alumnat i les famílies poden exercir els drets d'accés, rectificació, supressió, oposició i limitació davant del centre. L'informe es pot regenerar si es rectifica una dada.
- **Et veig (alumnat):** un cop lliurada, la valoració no es pot vincular a l'alumne. El centre no pot localitzar-la per esborrar-la, perquè no sap quina és (art. 11 RGPD). Cal explicar-ho **abans** que l'alumne lliuri; l'aplicació ja ho avisa.
- **Et veig (professorat):** el docent pot accedir al seu informe i pot demanar al centre el registre de qui l'ha consultat. També pot afegir-hi propostes privades (pendent de decidir, pla mestre §13).

---

## 11. Calendari proposat

1. Revisió d'aquest dossier amb la DPD. Decidir la base jurídica, la conservació i si cal AIPD.
2. Informació al claustre (presentació a `04_Presentacio_claustre.md`) i, si escau, a la representació dels treballadors.
3. Autorització de l'app a Google Workspace.
4. Informació a les famílies i a l'alumnat (`02_Textos_informatius.md`).
5. Prova pilot amb dades fictícies i alumnat real (`06_Guio_prova_pilot.md`).
6. Només després: primera recollida real controlada.

---

## 12. Validació

| Punt | Decisió | Responsable | Data |
| --- | --- | --- | --- |
| Base jurídica d'«Em miro» | | | |
| Base jurídica d'«Et veig» | | | |
| Model de confidencialitat (apartat 4) | | | |
| Llindar de 15 i acumulació de recollides | | | |
| Terminis de conservació (apartat 7) | | | |
| Cal AIPD? | | | |
| Proveïdors i contractes (apartat 8) | | | |
| Textos informatius | | | |
| Qui modera els comentaris | | | |

Signatura de la direcció: ____________________ Signatura de la DPD: ____________________

---

### Fonts

- Reglament (UE) 2016/679 (RGPD): art. 5, 6, 11, 13, 25, 28, 32 i 35.
- Llei orgànica 3/2018 (LOPDGDD).
- Llei orgànica 2/2006 d'educació (LOE), disposició addicional 23a, modificada per la LOMLOE.
- APDCAT, *Preguntes freqüents sobre protecció de dades als centres educatius*.
- Google, *Gestionar l'accés a apps de tercers no configurades per a usuaris designats com a menors de 18 anys*.
- Pla mestre v2 de La teva veu, apartats 5.7, 7 i 9.
