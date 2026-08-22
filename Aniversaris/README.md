# Aniversaris

Aplicació Android nativa, privada i sense servidor per consultar els aniversaris dels contactes d’un compte local d’Android i veure’ls en un widget 4×1 o 4×2.

## Estat actual

El projecte és una implementació funcional publicada dins del repositori `felipsarroca/util-apps`. No conté cap clau de signatura definitiva: fins que es prepari Google Play, les versions de prova utilitzen la signatura local de depuració.

Inclou:

- onboarding i explicació prèvia al permís `READ_CONTACTS`;
- selecció del compte de contactes, amb preferència per `felip.sarroca@gmail.com`;
- lectura limitada a nom, data d’aniversari, identificadors i miniatura;
- normalització, deduplicació i detecció de conflictes d’any;
- memòria cau Room reconstruïble i preferències DataStore;
- llista circular de dotze mesos, cerca i salt a una data;
- dos widgets Glance diferenciats, 3×1 i 4×1, amb quatre aniversaris cadascun;
- fotos dels contactes a la llista i al widget, amb inicial com a alternativa;
- actualització a les 00.00.05 amb alarma exacta o alternativa aproximada;
- reprogramació després de reinici, canvi d’hora i canvi de zona;
- variants `github` i `play` amb comprovadors d’actualització separats;
- mode clar/fosc, text escalable i bloc corporatiu a «Quant a»;
- proves unitàries de dates, noms, duplicats, canvi d’any i 29 de febrer.

## Requisits de desenvolupament

- Android Studio compatible amb AGP 9.3.1.
- JDK 17.
- Android SDK 37 i Build Tools corresponents.

L’entorn local ja està preparat i comprovat amb Android Studio 2026.1.3.7, Temurin JDK 17.0.20 i Android SDK 37. El projecte inclou també el *wrapper* de Gradle, de manera que no cal instal·lar Gradle globalment.

> **Nota de Windows:** algunes tasques de Gradle/JDK poden fallar quan el projecte es troba en una ruta amb caràcters accentuats. La ubicació canònica `I:\Mi unidad\Github\util-apps\Aniversaris` s’ha validat correctament.

## Instal·lació de la versió de prova

1. Des de la versió anterior, obre **Actualitzacions** a la pantalla principal o als ajustos i prem **Cerca actualitzacions**.
2. També pots obrir al mòbil la [release Aniversaris 1.1.0](https://github.com/felipsarroca/util-apps/releases/tag/aniversaris-v1.1.0).
3. Descarrega l’APK adjunt `aniversaris-1.1.0-debug.apk`.
4. Si Android ho demana, autoritza temporalment el navegador o el gestor de fitxers a «Instal·lar aplicacions desconegudes».
5. Instal·la l’APK sobre la versió anterior. Les preferències es conservaran, però la versió 1.1.0 demanarà confirmar explícitament el compte de Google.

La versió de prova utilitza l’identificador `cat.felipsarroca.aniversaris.debug`, de manera que no interferirà amb la futura versió signada de Google Play.

## Posada en marxa

1. Obre aquesta carpeta amb Android Studio.
2. Selecciona l’SDK 37 ja instal·lat (o accepta’n la instal·lació si obres el projecte en un altre ordinador).
3. Verifica que el Gradle JDK sigui 17.
4. Sincronitza el projecte.
5. Executa una variant de depuració:

```powershell
.\gradlew.bat :app:assembleGithubDebug
```

6. Executa els tests unitaris:

```powershell
.\gradlew.bat :app:testGithubDebugUnitTest :app:testPlayDebugUnitTest
```

7. Executa lint abans de considerar una release:

```powershell
.\gradlew.bat :app:lintGithubDebug :app:lintPlayDebug
```

## Prova amb contactes reals

1. Instal·la o actualitza `githubDebug` en un dispositiu de prova.
2. Concedeix accés als contactes després de llegir l’explicació.
3. Confirma que apareix el compte correcte i força una actualització.
4. Compara el recompte amb Google Contacts, sobretot duplicats i dates sense any.
5. Afegeix separadament els widgets 3×1 i 4×1; comprova que tots dos mostren quatre files, les fotos i els temes clar/fosc.
6. Revoca `READ_CONTACTS`: la llista i el widget han de passar a l’estat sense permís.
7. Prova el canvi de dia, reinici i zona horària en el Xiaomi/HyperOS real.

## Decisions que s’han de confirmar abans de publicar

- `applicationId`: `cat.felipsarroca.aniversaris`.
- Versió inicial: `1.0.0` / `versionCode 1`.
- Repositori GitHub: `felipsarroca/util-apps`, amb releases d’Aniversaris identificades pel prefix `aniversaris-v`.
- Keystore definitiu: crear-lo i conservar-ne dues còpies xifrades; no afegir-lo al repositori.
- Mateixa clau, identificador i seqüència creixent de `versionCode` per a GitHub i Google Play.

## Privadesa

No s’envien dades de contactes a cap servidor. Les úniques connexions previstes són la comprovació d’actualitzacions de GitHub o Google Play segons la variant. La base local i DataStore queden exclosos de còpies i transferències del sistema.

Vegeu també [PRIVACITAT.md](PRIVACITAT.md) i [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md).
