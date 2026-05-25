# Configuració de Google Sheets amb clasp

L'aplicació funciona ara amb dades locals del navegador. Per activar Google Sheets com a emmagatzematge, utilitzarem `clasp` per pujar i mantenir el codi de Google Apps Script des d'aquest projecte.

## Què pot fer clasp

`clasp` permet editar localment, pujar i versionar un projecte de Google Apps Script. En aquest projecte, el primer desplegament públic de tipus `Aplicació web` es confirma des de la interfície de Google, perquè cal seleccionar-ne l'execució i l'accés públic.

En el nostre cas hi ha un pas inicial que s'ha de fer manualment: `clasp` no pot crear un Apps Script vinculat a un Google Sheets existent. El script vinculat s'ha de crear una vegada des del mateix full de càlcul.

## Passos que ha de fer Felip

### 1. Crear el Google Sheets

1. Crea un full de càlcul nou a Google Sheets.
2. Posa-li el nom `Biblioteca de prompts`.
3. Conserva l'enllaç del full.

No cal crear manualment pestanyes ni columnes.

### 2. Crear l'Apps Script vinculat

1. Dins del full, obre `Extensions > Apps Script`.
2. S'obrirà un projecte d'Apps Script ja vinculat al full.
3. Posa-li un nom reconeixible, per exemple `BiblioPrompt API`.
4. A `Configuració del projecte`, copia l'`ID de l'script`.

No cal enganxar-hi cap codi: el codi es pujarà amb `clasp`.

### 3. Activar l'API d'Apps Script per a clasp

1. Ves a [Configuració de Google Apps Script](https://script.google.com/home/usersettings).
2. Activa `Google Apps Script API`.

### 4. Enviar la informació necessària

Cal enviar en aquesta conversa:

- L'enllaç del Google Sheets `Biblioteca de prompts`.
- L'`ID de l'script` del projecte vinculat.

No enviïs contrasenyes ni codis de verificació.

## Passos que farà Codex

Quan disposi de l'enllaç i l'ID de l'script:

1. Iniciarà la vinculació local amb el projecte remot mitjançant `clasp`.
2. Et demanarà completar l'autorització de Google al navegador si `clasp login` encara no està autoritzat.
3. Pujarà `apps-script/Code.gs` a l'Apps Script vinculat al full.
4. Configurarà el manifest perquè l'app web s'executi com a propietari i permeti accés anònim.
5. Tu confirmaràs el primer desplegament públic des de l'editor d'Apps Script i facilitaràs l'URL acabada en `/exec`.
6. Incorporarà l'URL pública a `js/config.js`.
7. Activarà `useGoogleSheets: true`.
8. Provarà la lectura, creació i edició de prompts des de l'aplicació.

## Primer desplegament públic de l'aplicació web

Quan el codi ja estigui pujat amb `clasp`, cal fer una vegada:

1. Obre el projecte `BiblioPrompt API` des del Google Sheets, amb `Extensions > Apps Script`.
2. Prem `Implementa > Implementació nova`.
3. A `Selecciona tipus`, tria `Aplicació web`.
4. A `Executa com a`, selecciona `Jo` o el teu compte.
5. A `Qui hi té accés`, selecciona `Qualsevol`, incloent usuaris anònims, si l'opció apareix amb aquesta redacció.
6. Prem `Implementa` i accepta els permisos que Google demani.
7. Copia l'URL de l'aplicació web, acabada en `/exec`, i envia-la en aquesta conversa.

## Pestanyes que crearà l'script

- `Prompts`.
- `Programes`.
- `Historial`.

La inicialització també incorporarà els programes inicials: ChatGPT, Gemini, NotebookLM i Canva.

## Funcionament tècnic

La funció `setupBiblioprompt()` s'executarà una primera vegada vinculada al document i guardarà internament l'identificador del full. Després, l'aplicació web obrirà explícitament aquest Google Sheets quan rebi peticions.

Això és necessari perquè una aplicació web d'Apps Script no pot confiar que hi hagi un full de càlcul actiu durant l'execució.

## Consideracions

- En mode local (`useGoogleSheets: false`), les dades es desen al navegador on s'utilitza l'aplicació.
- En mode Google Sheets (`useGoogleSheets: true`), el full és la font de dades principal.
- Com que no s'ha configurat autenticació pròpia, qui conegui l'URL pública d'Apps Script pot operar sobre les dades.
- Convé descarregar periòdicament l'exportació JSON de l'aplicació com a còpia de seguretat.

## Configuració activa del projecte

El connector públic actual és:

```text
https://script.google.com/macros/s/AKfycbwCeK3eAXCxQz6uReSSbMquI_mTeCvt2vP9RJvi65IFfxcjTRhdoQB5ZH_8jnQqXxE9jQ/exec
```

La configuració de `js/config.js` ja utilitza Google Sheets com a font de dades principal.
