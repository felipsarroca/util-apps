# Aniversaris

Aplicació Android nativa, privada i sense servidor per consultar les dates especials dels contactes d’un compte de Google i veure-les en un widget 3×1 o 4×1.

## Estat actual

El projecte és una implementació funcional publicada dins del repositori `felipsarroca/util-apps`. No conté cap clau de signatura definitiva: fins que es prepari Google Play, les versions de prova utilitzen la signatura local de depuració.

Inclou:

- onboarding i explicació prèvia al permís `READ_CONTACTS`;
- selecció del compte de contactes, amb preferència per `felip.sarroca@gmail.com`;
- lectura limitada a nom, dates especials, etiquetes, identificadors i miniatura;
- compatibilitat amb diverses dates del mateix contacte, com aniversari, sant o defunció, amb càlcul dels anys quan consta l’any d’origen;
- normalització, deduplicació i detecció de conflictes d’any;
- memòria cau Room reconstruïble i preferències DataStore;
- llista circular de dotze mesos, cerca i salt a una data;
- dos widgets Glance diferenciats, 3×1 i 4×1, amb quatre aniversaris cadascun, columnes compactes i fila d’avui ressaltada;
- fotos dels contactes a la llista i al widget, amb inicial com a alternativa;
- actualització a les 00.00.05 amb alarma exacta o alternativa aproximada;
- reprogramació després de reinici, canvi d’hora i canvi de zona;
- variants `github` i `play` amb comprovadors d’actualització separats i comprovació automàtica en iniciar;
- mode clar/fosc, text escalable i bloc corporatiu a «Quant a»;
- proves unitàries de dates, noms, duplicats, canvi d’any i 29 de febrer.

## Requisits de desenvolupament

- Android Studio compatible amb AGP 9.3.1.
- JDK 17.
- Android SDK 37 i Build Tools corresponents.

L’entorn local ja està preparat i comprovat amb Android Studio 2026.1.3.7, Temurin JDK 17.0.20 i Android SDK 37. El projecte inclou també el *wrapper* de Gradle, de manera que no cal instal·lar Gradle globalment.

> **Nota de Windows:** algunes tasques de Gradle/JDK poden fallar quan el projecte es troba en una ruta amb caràcters accentuats. La ubicació canònica `I:\Mi unidad\Github\util-apps\Aniversaris` s’ha validat correctament.

## Instal·lació de la versió de prova

1. Des de la versió anterior, obre **Ajustos**. L’app ja haurà comprovat automàticament si hi ha una actualització.
2. També pots obrir al mòbil [ja.cat/app-aniversaris](https://ja.cat/app-aniversaris), que apunta sempre a l’APK de la darrera release.
3. Alternativament, pots obrir la [release Aniversaris 1.5.0](https://github.com/felipsarroca/util-apps/releases/tag/aniversaris-v1.5.0).
4. Descarrega l’APK adjunt `aniversaris-1.5.0-debug.apk`.
5. Si Android ho demana, autoritza temporalment el navegador o el gestor de fitxers a «Instal·lar aplicacions desconegudes».
6. Instal·la l’APK sobre la versió anterior. Les preferències i les dades locals es conservaran.

L’àlies estable [ja.cat/app-aniversaris](https://ja.cat/app-aniversaris) es manté actualitzat amb la darrera release d’Aniversaris.

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
5. Elimina els widgets antics i afegeix separadament els widgets 3×1 i 4×1 perquè el llançador recalculi la mida; comprova que tots dos mostren quatre files, les fotos i els temes clar/fosc.
6. Prova un contacte amb dues dates etiquetades i comprova que apareixen separadament al dia corresponent.
7. Revoca `READ_CONTACTS`: la llista i el widget han de passar a l’estat sense permís.
8. Prova el canvi de dia, reinici i zona horària en el Xiaomi/HyperOS real.

## Decisions que s’han de confirmar abans de publicar

- `applicationId`: `cat.felipsarroca.aniversaris`.
- Versió inicial: `1.0.0` / `versionCode 1`.
- Repositori GitHub: `felipsarroca/util-apps`, amb releases d’Aniversaris identificades pel prefix `aniversaris-v`.
- Keystore definitiu: crear-lo i conservar-ne dues còpies xifrades; no afegir-lo al repositori.
- Mateixa clau, identificador i seqüència creixent de `versionCode` per a GitHub i Google Play.

## Privadesa

No s’envien dades de contactes a cap servidor. Les úniques connexions previstes són la comprovació d’actualitzacions de GitHub o Google Play segons la variant. La base local i DataStore queden exclosos de còpies i transferències del sistema.

Vegeu també [PRIVACITAT.md](PRIVACITAT.md) i [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md).

## Publicació a Google Play

La guia de continuïtat, els textos de la fitxa i la plantilla de política de privacitat es troben a [docs/GOOGLE_PLAY.md](docs/GOOGLE_PLAY.md) i [docs/play-store/](docs/play-store/).
