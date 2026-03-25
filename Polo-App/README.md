# Registre de polo ESO

Aplicacio web senzilla per registrar des del mobil quins alumnes no porten el polo.

## Estructura actual

- `index.html`: interfície principal
- `css/styles.css`: estils mobile-first
- `js/app.js`: logica del frontend i connexio amb el backend
- `assets/favicon.svg`: favicon inicial

## Backend

El backend esta fet amb Google Apps Script i treballa sobre un Google Sheets amb dues pestanyes:

- `Alumnat`
- `Registres`

Funcions principals del backend:

- obtenir alumnat per curs
- registrar un alumne
- evitar duplicats el mateix dia

## Estat del projecte

Actualment ja funciona el flux basic:

1. seleccionar curs
2. carregar alumnat
3. marcar un alumne
4. evitar duplicats del mateix dia

## Pendent

- publicar el frontend a GitHub
- desplegar-lo a GitHub Pages
- afegir millor poliment visual
- estudiar opcions practiques per afegir-lo a la pantalla d inici del mobil
