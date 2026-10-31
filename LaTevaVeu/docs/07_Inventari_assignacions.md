# La teva veu: inventari de matèries i docents

Per saber quins docents ha de valorar cada alumne, l'app necessita saber **qui fa cada matèria a cada grup**. Aquest inventari substitueix el catàleg provisional de l'app.

## Com omplir-lo

1. Obre `07_Plantilla_assignacions.csv` amb Google Sheets (**Fitxer › Importa › Puja**) o amb Excel.
2. La plantilla té una fila per matèria i curs, amb el grup **A**. Si un curs té més grups, **duplica les files** i canvia la columna `grup` (B, C...).
3. Omple `correu_docent` amb el correu `@ramonpont.cat` de qui fa la matèria en aquell grup. La columna `nom_docent` és només per ajudar a llegir-la; l'app no la fa servir.
4. Si un grup no fa una matèria, esborra la fila. Si una matèria **no hi és**, afegeix-la amb un codi nou i avisa'm: cal crear-la abans a **Configuració › Matèries**.
5. Desa-ho com a **CSV** (Google Sheets: **Fitxer › Baixa › Valors separats per comes**).

| Columna | Exemple | Notes |
| --- | --- | --- |
| `curs` | `1r d'ESO` | També s'accepta «1r ESO» o «1ESO» |
| `grup` | `A` | |
| `codi_materia` | `MAT` | Si falta, es fa servir el nom de la columna `materia` |
| `materia` | `Matemàtiques` | Informativa |
| `tipus` | `comuna` o `optativa` | Informativa |
| `correu_docent` | `nom.cognom@ramonpont.cat` | Si està buida, la fila no canvia res |
| `nom_docent` | `Nom Cognom` | Informativa |

## Com importar-lo

1. A l'app, **Configuració › Alumnat i accessos**: comprova que tots els docents tenen accés. Si no, dona-los-en (**Dona accés**).
2. **Configuració › Assignacions docents › Importa des de CSV**.
3. Tria el fitxer i prem **Analitza**. L'app mostra quantes files són correctes i quins errors hi ha, fila per fila:
   - curs no reconegut;
   - matèria desconeguda o no activa en aquell curs;
   - docent sense accés a l'app;
   - matèria repetida en un mateix grup.
4. Si és correcte, prem **Aplica**. Les files amb errors no s'apliquen: corregeix-les i torna-les a importar.

Les recollides d'«Et veig» que ja estan obertes conserven les assignacions de quan es van obrir.
