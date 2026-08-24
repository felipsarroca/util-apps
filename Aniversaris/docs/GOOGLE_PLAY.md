# Publicació d’Aniversaris a Google Play

Document de continuïtat per reprendre la publicació quan Google hagi verificat la identitat del compte de Play Console.

Última revisió: 25 d’agost de 2026.

## Estat actual

- Compte de Play Console: identitat verificada.
- Nom públic: **Aniversaris**.
- Identificador definitiu: `cat.felipsarroca.aniversaris`.
- Versió publicada al canal intern: `1.5.0`, `versionCode 6`.
- Actualització preparada al repositori: `1.6.0`, `versionCode 7`.
- Variant de Google Play: `play`.
- SDK objectiu actual: 37. Compleix el requisit actual d’API objectiu de Google Play.
- Permisos declarats: `READ_CONTACTS`, `SCHEDULE_EXACT_ALARM`, `RECEIVE_BOOT_COMPLETED`, `INTERNET` i `ACCESS_NETWORK_STATE`.
- No hi ha cap clau privada al repositori.
- La versió GitHub i la versió Play tenen canals d’actualització diferents: GitHub comprova releases; Play utilitza Google Play In-App Updates.

## Ordre de treball

1. Esperar la verificació de la identitat.
2. Crear la fitxa de l’app a Play Console.
3. Configurar Play App Signing i conservar una clau d’upload protegida.
4. Completar la fitxa, la política de privacitat i els formularis de contingut i seguretat de dades.
5. Compilar i validar el primer Android App Bundle (`.aab`).
6. Publicar-lo al canal de proves internes.
7. Fer una prova tancada amb els testers requerits pel compte.
8. Sol·licitar l’accés a producció.
9. Publicar gradualment la versió de producció.

## Quan arribi la verificació

### 1. Crear l’app

A Play Console:

- **Create app**.
- Nom: `Aniversaris`.
- Idioma predeterminat: català.
- Tipus: aplicació.
- Gratuïta.
- Acceptar les declaracions corresponents.

Comprovar que el paquet sigui exactament `cat.felipsarroca.aniversaris`. No s’ha d’utilitzar el paquet de proves `cat.felipsarroca.aniversaris.debug`.

### 2. Configurar la signatura

La primera publicació ha de ser un `AAB` de producció, no l’APK de depuració de GitHub.

Opció recomanada:

1. Activar **Play App Signing**.
2. Deixar que Google generi la clau de signatura de l’app.
3. Crear una clau separada d’upload per signar localment els `.aab`.
4. Conservar dues còpies xifrades de la clau d’upload fora del repositori.

Mai no s’ha de pujar al repositori cap fitxer `.jks`, `.keystore`, contrasenya o fitxer de secrets.

Fitxer local previst, fora de Git:

```text
keystore.properties
```

Contingut orientatiu, que no s’ha d’emplenar ni compartir en aquest document:

```properties
storeFile=C:/ruta/protegida/aniversaris-upload.jks
storePassword=********
keyAlias=aniversaris-upload
keyPassword=********
```

El projecte ja llegeix automàticament aquest fitxer i aplica la signatura al tipus `release`; no cal escriure cap secret al codi. Si el fitxer no existeix, la compilació de desenvolupament continua funcionant però no s’ha de pujar cap AAB de producció.

Per crear-lo de manera segura, amb entrada oculta, validació de la clau i ACL restringida:

```powershell
.\scripts\configura-signatura-local.ps1
```

### 3. Compilar l’AAB

Des de `I:\Mi unidad\Github\util-apps\Aniversaris`:

```powershell
$env:JAVA_HOME = 'C:\Program Files\Eclipse Adoptium\jdk-17.0.20.8-hotspot'
$env:GRADLE_USER_HOME = 'C:\Users\Public\GradleCache'
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
.\gradlew.bat testGithubDebugUnitTest testPlayDebugUnitTest lintGithubDebug lintPlayDebug bundlePlayRelease --no-daemon --max-workers=2
```

Validacions abans de pujar:

- `versionCode` superior a qualsevol versió Play ja publicada.
- Identificador `cat.felipsarroca.aniversaris`.
- Variant `playRelease`, no `githubRelease`.
- Signatura d’upload correcta.
- Proves i lint sense errors.
- Prova d’instal·lació i actualització en un dispositiu real.
- Contactes, selecció de compte, dates múltiples, fotos, widgets 3×1 i 4×1, mode fosc i actualitzacions Play comprovats.

### 4. Primera prova

Començar pel canal **Internal testing**. Pujar l’AAB i afegir-hi el compte de prova. Instal·lar-lo des de Google Play en un dispositiu que tingui contactes reals i comprovar especialment:

- que el permís de contactes es demana amb explicació clara;
- que es pot seleccionar el compte de Google;
- que el widget mostra quatre dates i les fotos;
- que la variant Play no ofereix descàrregues d’APK de GitHub;
- que l’actualització es gestiona mitjançant Google Play.

## Requisit de prova tancada

Si el compte és personal i es va crear després del 13 de novembre de 2023, Google exigeix una prova tancada amb almenys 12 testers que hi estiguin inscrits contínuament durant 14 dies abans de sol·licitar l’accés a producció.

Cal conservar una llista dels testers, la data d’inscripció i les incidències detectades i resoltes.

## Formularis de Play Console

### Seguretat de les dades

Esborrany que cal revisar dins del formulari oficial:

- L’app accedeix als contactes del dispositiu per mostrar noms, dates especials, etiquetes i miniatures.
- El tractament es fa localment al dispositiu.
- No es venen ni es comparteixen dades amb tercers.
- No hi ha anuncis ni analítica pròpia.
- Les connexions de xarxa només serveixen per comprovar actualitzacions segons el canal instal·lat.
- La memòria cau local és reconstruïble i s’elimina quan es revoca el permís o s’esborren les dades de l’app.

No s’ha de marcar cap opció automàticament: cal revisar la definició exacta de Google sobre dades recollides, compartides i tractades només al dispositiu.

### Accés a l’app

Si Play Console ho demana, proporcionar instruccions per arribar a la pantalla principal:

1. Instal·lar Aniversaris.
2. Acceptar l’explicació i concedir `READ_CONTACTS`.
3. Seleccionar un compte de Google amb dates de contacte.
4. Prémer **Actualitza**.

No hi ha usuari, contrasenya ni compte propi.

### Anuncis

Indicar que l’app no conté anuncis.

### Classificació de contingut

Respondre que és una utilitat personal per consultar dates de contactes, sense violència, contingut sexual, apostes, compres ni contingut generat per usuaris.

### Públic objectiu

Proposta inicial: públic general, sense disseny específic per a infants.

## Política de privacitat

Fitxer local preparat: `docs/play-store/privacitat.html`.

Abans de publicar-lo cal:

1. Afegir un correu de contacte real del responsable.
2. Revisar el text legalment.
3. Publicar l’HTML en una URL HTTPS accessible sense iniciar sessió.
4. Introduir aquesta URL a Play Console.

No s’ha d’utilitzar una URL local ni una pàgina que requereixi permisos de GitHub.

## Fitxa de la botiga

El text preparat és a `docs/play-store/fitxa.md`.

Materials preparats:

- icona de l’app: `icona1024.png`;
- cinc captures de mòbil anonimitzades a `docs/play-store/assets/phone-screenshots/`;
- gràfic promocional de 1.024 × 500 a `docs/play-store/assets/`;
- correu de contacte i URL HTTPS de privacitat publicats.

Les captures de la pantalla principal i d'actualitzacions s'han de renovar amb la 1.6.0 abans de substituir-les a la fitxa, perquè reflecteixin la disposició corregida i no mostrin el nom del canal de distribució.

## Enllaços oficials

- [Crear i configurar un compte de Play Console](https://support.google.com/googleplay/android-developer/answer/6112435)
- [Requisits de proves per a comptes personals nous](https://support.google.com/googleplay/android-developer/answer/14151465)
- [Pujar un Android App Bundle](https://developer.android.com/studio/publish/upload-bundle)
- [Requisit de l’API objectiu](https://developer.android.com/google/play/requirements/target-sdk)

## Registre de continuïtat

- 23/08/2026: compte de Play Console creat; verificació d’identitat pendent.
- 23/08/2026: projecte revisat; variant `play` preparada, però encara falta configurar la signatura de producció.
- 24/08/2026: identitat verificada, fitxa creada i `1.5.0` (`versionCode 6`) publicada a prova interna.
- 25/08/2026: `1.6.0` (`versionCode 7`) compilada, amb tests i lint superats; pendent de signar l'AAB amb la clau d'upload i pujar-lo a Play.
