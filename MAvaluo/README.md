# M'avaluo · La veu de l'alumnat

Aplicació web d'autoavaluació per a l'alumnat de l'Escola Ramon Pont, de 3r de primària a 4t d'ESO. Implementa el [pla mestre](Pla_mestre_Veu_alumnat_autoavaluacions_v1.md).

**Estat (30 d'octubre de 2026):** prototip funcional complet en **mode de demostració**. Les dades són fictícies i es desen al navegador. Encara no hi ha servidor, base de dades real ni enviament de correus.

## Requisit d'entrada

Només s'hi pot entrar amb un compte **@ramonpont.cat**. Tenir aquest compte no dona accés a cap dada:

| Compte | Què veu |
| --- | --- |
| Alumne al cens | Només la seva autoavaluació, el seu curs i les seves matèries |
| Professorat | Només els grups que té assignats |
| Administració | Tot, amb registre de cada acció |
| Compte de l'escola fora del cens | Pantalla «Encara no tens accés», sense cap dada |
| Compte d'un altre domini | Rebutjat abans d'entrar |

Amb Google real, el botó demana el domini de l'escola (`hd=ramonpont.cat`) i es comproven el domini i el correu verificat. **En producció, el servidor ha de tornar a verificar la signatura del testimoni**: la comprovació del navegador és només la primera barrera.

## Què fa

**Alumnat**
- Pantalla d'inici amb nom, curs i grup ja assignats, i un enllaç per avisar si són incorrectes.
- Tres experiències segons l'edat: 3r-4t (una pregunta per pantalla, targetes grans amb emojis, avanç automàtic i lectura en veu alta), 5è-6è (blocs curts, objectiu de l'avaluació anterior) i ESO (blocs de 4-5 afirmacions, una pantalla per matèria amb tres valoracions i observació opcional).
- Desa automàticament; es pot parar i continuar. Revisió final amb les respostes pendents. Es pot modificar fins al tancament.
- Lletra gran, lletra de lectura fàcil (Atkinson Hyperlegible), navegació amb teclat i tancament automàtic de la sessió després de 20 minuts d'inactivitat.

**Professorat i administració**
- Tauler amb participació per grup i activitat recent.
- Respostes: estat i progrés de cada alumne, amb l'informe.
- Informes i famílies: informe A4 paginat, un sol PDF dels seleccionats o només dels que no tenen correu familiar, opció de doble cara (cada informe comença en cara nova), acusament de lectura retallable i preparació de l'enviament amb els destinataris validats.
- Recollides: cicle `Programada → Oberta → Tancada → … → Arxivada`, canvi de dates amb motiu registrat, creació per a diversos cursos alhora.
- Qüestionaris: editor sense programar (apartats, preguntes, escales, obligatorietat, límits, etiquetes de PDF), previsualització d'alumne, prova de l'informe amb respostes curtes i llargues, versions immutables un cop publicades.
- Matèries per curs: ordre, comunes i optatives, activació.
- Alumnat i accessos: permisos per grup, cens amb optatives, importació CSV amb validació prèvia, incidències d'identitat.
- Registre d'operacions.

## Desenvolupament

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # proves del motor i dels permisos (vitest)
npm run lint
npm run build    # genera dist/
```

> A la unitat de Google Drive (`W:`) `npm install` falla (EBADF). Cal treballar en una còpia local (p. ex. `%LOCALAPPDATA%\mavaluo-nm`) i copiar-hi el codi.

Per activar Google real: copia `.env.example` a `.env.local` i posa-hi `VITE_GOOGLE_CLIENT_ID` (client OAuth «Aplicació web» del Google Cloud de l'escola, amb l'origen autoritzat de l'URL publicada).

## Estructura

| Carpeta | Contingut |
| --- | --- |
| `src/domain` | Model, catàleg de cursos i matèries, plantilles, motor de qüestionaris, CSV |
| `src/data` | Identificació i capa de dades (`api.ts`: simula el servidor amb control de permisos) |
| `src/student` | Flux de l'alumnat i components de pregunta |
| `src/staff` | Pantalles de professorat i administració |
| `src/report` | Informe A4 amb paginació per blocs |
| `db/schema.sql` | Esquema previst per a Neon PostgreSQL |
| `tests` | Proves dels criteris d'acceptació del pla mestre |

## Pendent abans d'utilitzar-la amb dades reals

1. Revisió amb direcció i la persona delegada de protecció de dades.
2. Client OAuth de Google aprovat a la consola de Google Workspace (els comptes de menors poden tenir bloquejades les apps de tercers no configurades).
3. Backend (Node/Fastify o funcions) amb verificació del testimoni, sessions i la mateixa interfície que `api.ts`, connectat a Neon a la UE.
4. Inventari real de les matèries d'ESO per curs (el catàleg actual és provisional).
5. Servei de correu institucional amb cua idempotent; emmagatzematge privat dels PDF.
6. Prova amb alumnat real de cada etapa per ajustar preguntes, durada i obligatorietat.
