# Aplicació de gestió d'ordinadors de préstec (RPPO)

## Objectiu del document

Aquest document defineix la base funcional i tècnica de l'aplicació de gestió d'ordinadors de préstec del centre. Ha de servir com a punt de partida compartit per a qualsevol programador que hagi de desenvolupar, mantenir o ampliar l'eina.

L'objectiu principal és garantir una traçabilitat completa i fiable de cada ordinador RPPO: qui el té, quan l'ha tingut, quines incidències ha patit i en quin estat es troba en cada moment.

## Finalitat de l'aplicació

L'aplicació ha de permetre:

- Saber a quin alumne o usuari genèric està assignat cada ordinador.
- Consultar l'historial complet d'assignacions, retorns, incidències i reparacions.
- Registrar accions de manera ràpida, especialment des del mòbil.
- Mantenir un sistema fiable basat en esdeveniments, de manera que qualsevol canvi quedi registrat.

## Perfils d'accés

L'aplicació ha de funcionar amb dos nivells d'accés mitjançant codi:

- `consulta`: només permet veure la informació.
- `edició`: permet veure i modificar dades.

En una primera fase es pot implementar amb codis simples. En una segona fase es pot evolucionar a autenticació real amb Supabase Auth si convé.

## Plataformes previstes

L'aplicació ha de funcionar correctament en:

- Ordinador, des del navegador.
- Telèfon mòbil, des del navegador.
- Instal·lació tipus PWA, si més endavant es considera convenient.

La interfície ha d'estar clarament optimitzada per a pantalles petites.

## Entitats principals

### 1. Ordinadors

Cada ordinador RPPO ha de tenir com a mínim:

- `id`
- `codi_rppo`
- `estat_actual`
- `usuari_actual_id` opcional
- `observacions_generals` opcionals
- `created_at`
- `updated_at`

### 2. Usuaris

Els usuaris poden ser:

- Alumnes identificats per nom i cognoms.
- Un usuari genèric `PFI`.

Camps mínims recomanats:

- `id`
- `nom`
- `cognoms`
- `nom_complet`
- `tipus_usuari` (`alumne`, `generic`)
- `actiu`
- `created_at`
- `updated_at`

### 3. Esdeveniments

El sistema s'ha de basar en esdeveniments. Cada acció rellevant ha de generar un registre.

Tipus mínims previstos:

- `assignacio`
- `retorn`
- `canvi_propietari`
- `incidencia`
- `reparacio_interna`
- `servei_tecnic_extern`
- `reparat`
- `observacio`

Camps mínims recomanats:

- `id`
- `ordinador_id`
- `usuari_id` opcional
- `tipus`
- `data_event`
- `descripcio`
- `estat_resultant`
- `curs_academic` opcional
- `created_at`
- `created_by` opcional

### 4. Assignacions

Tot i que les assignacions es poden reconstruir a partir dels esdeveniments, és recomanable disposar d'una taula específica per facilitar consultes i informes.

Camps mínims recomanats:

- `id`
- `ordinador_id`
- `usuari_id`
- `data_inici`
- `data_final` opcional
- `curs_academic`
- `motiu` opcional
- `created_at`

## Principis funcionals

### Tot queda registrat

No s'ha de permetre modificar l'estat d'un ordinador sense generar un esdeveniment associat.

### Historial complet

S'ha de poder reconstruir la vida completa de qualsevol equip:

- usuaris que l'han tingut
- incidències
- reparacions
- períodes lliures
- canvis d'estat

### Simplicitat d'ús

L'aplicació ha d'estar pensada per registrar informació amb molt pocs clics.

## Fluxos principals

### Cerca ràpida

La pantalla principal ha d'incloure:

- Cerca d'ordinadors per codi RPPO o número.
- Cerca d'usuaris per nom o cognoms.

La cerca ha de ser immediata i usable des de mòbil.

### Fitxa d'un ordinador

Ha de mostrar:

- Codi RPPO.
- Estat actual.
- Usuari actual, si n'hi ha.
- Historial cronològic d'esdeveniments.
- Historial d'assignacions amb inici i final.

### Accions ràpides sobre un ordinador

Des de la fitxa s'han de poder executar amb rapidesa:

- Assignar ordinador.
- Canviar propietari.
- Deixar-lo lliure.
- Registrar incidència.
- Enviar a reparació interna.
- Enviar a servei tècnic extern.
- Marcar com reparat.
- Afegir observació.

Totes aquestes accions han d'obrir formularis molt curts amb la data editable abans de desar.

### Fitxa d'un usuari

Ha de mostrar:

- Ordinador actual, si en té.
- Historial d'ordinadors assignats.
- Incidències relacionades.
- Períodes d'ús.

## Estats dels ordinadors

Estats mínims previstos:

- `lliure`
- `assignat`
- `incidencia_menor`
- `pendent_reparacio_interna`
- `pendent_servei_tecnic_extern`
- `fora_servei`

L'estat actual s'ha de derivar de l'últim esdeveniment vàlid o actualitzar-se de manera controlada a la taula d'ordinadors.

## Curs acadèmic

Cal registrar el curs acadèmic a les assignacions i, quan convingui, també als esdeveniments.

Objectius:

- Filtrar informació per any acadèmic.
- Fer seguiment històric.
- Evitar haver de reescriure manualment dades d'alumnes cada curs.

Format recomanat inicial:

- `2024-2025`
- `2025-2026`

## Requisits d'interfície

### Mòbil

- Botons grans.
- Accions visibles.
- Formularis simples.
- Poc text manual.
- Navegació molt directa.

### Ordinador

- Millor visió global.
- Historial més ampli.
- Útil per revisió, control i seguiment.

## Requisits tècnics recomanats

### Frontend

- HTML, CSS i JavaScript simples.
- Estructura plana i fàcil de publicar a Github Pages.
- Codi clar, sense dependències innecessàries.
- Disseny responsive des del primer dia.

### Backend i dades

- Supabase com a base de dades i API.
- Taules principals: `usuaris`, `ordinadors`, `assignacions`, `esdeveniments`.
- RLS a definir quan es connecti Supabase.

### Fases recomanades

#### Fase 1

- Interfície funcional.
- Dades simulades locals.
- Validació del flux de treball real del centre.

#### Fase 2

- Connexió amb Supabase.
- Creació de taules.
- Inserció i lectura reals.
- Definició de permisos.

#### Fase 3

- PWA.
- Informes.
- Filtres avançats.
- Exportacions.

## Regles funcionals importants

- Tots els esdeveniments han de tenir data obligatòria.
- La data s'ha d'omplir automàticament amb el dia actual, però ha de ser editable.
- No s'ha de perdre l'historial encara que canviï l'usuari actual.
- Les descripcions han de ser lliures però breus i clares.
- Quan un ordinador canvia de propietari, s'ha de tancar l'assignació anterior i crear-ne una de nova.

## Casos d'ús clau

### Exemple 1

Un alumne rep l'ordinador `RPPO 14`.

Resultat esperat:

- Es crea un esdeveniment `assignacio`.
- Es crea o s'actualitza una assignació activa.
- L'estat de l'ordinador passa a `assignat`.

### Exemple 2

L'ordinador pateix una incidència.

Resultat esperat:

- Es crea un esdeveniment `incidencia`.
- L'estat passa a `incidencia_menor` o al que correspongui.

### Exemple 3

L'ordinador passa a servei tècnic extern.

Resultat esperat:

- Es crea l'esdeveniment corresponent.
- L'estat s'actualitza.
- L'historial manté la seqüència completa.

## Criteris de qualitat del desenvolupament

- Codi clar i mantenible.
- Noms consistents en català o bé model tècnic coherent en anglès, però sense barreja arbitrària.
- Mòduls simples i fàcils de localitzar.
- Validacions bàsiques de formulari.
- Preparació per créixer sense haver de redissenyar tota la base.

## Següent pas recomanat

El següent pas de desenvolupament és:

1. Crear l'esquelet estàtic de l'aplicació.
2. Definir el model de dades local.
3. Construir la pantalla principal, la llista d'ordinadors i la fitxa detallada.
4. Preparar el pas posterior de connexió amb Supabase.
