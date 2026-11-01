# Lector QR per a Android

Aplicació gratuïta i de codi obert per llegir QR de manera immediata. En obrir-la, apunta la càmera al codi; decideix què vols fer amb el resultat. També pots llegir una fotografia. Els QR es processen al mòbil, sense historial, anuncis ni analítica.

## Instal·lació

Accedeix a les descàrregues des de **[ja.cat/QR-cat](https://ja.cat/QR-cat)**. Ara hi trobaràs un APK signat de prova. Encara cal validar-lo en mòbils reals abans de publicar la primera versió estable. Obre l'APK al mòbil i confirma la instal·lació quan Android ho demani. Per actualitzar, instal·la l'APK nou sobre l'anterior: totes les versions han de conservar el mateix identificador i certificat. L'app també permet comprovar versions des del menú `⋮` quan existeixi una Release estable.

## Compilació

Obre aquest directori amb Android Studio (JDK 17, SDK 36) o executa `./gradlew testDebugUnitTest assembleDebug`. El projecte utilitza Kotlin, CameraX i ZXing-C++ 3.1.1. El lector funciona sense connexió; l'única consulta de xarxa de l'app és l'API pública de GitHub per cercar actualitzacions.

La versió mínima és Android 8 (API 26). La versió 1.0.0 té `versionCode = 1` i `applicationId = cat.felipsarroca.lectorqr`.

## Publicació de versions

Les instruccions per al mantenidor són a [PUBLICACIO.md](PUBLICACIO.md). El workflow prova el projecte en cada canvi a `main` i només utilitza els secrets de signatura en etiquetes `vX.Y.Z`. Una etiqueta estable crea una Release amb l'APK i el SHA-256.

## Privacitat i llicències

Consulta la [política de privacitat](PRIVACITAT.md), la [llicència MIT del codi](LICENSE) i la [llicència CC BY-NC-SA 4.0 de la icona](ICONA-LLICENCIA.md). El [fitxer vectorial original](icona/lector-qr.svg) es pot reutilitzar segons aquesta llicència. ZXing-C++ i AndroidX CameraX tenen llicència Apache 2.0; la seva documentació i llicències són als repositoris dels projectes: [ZXing-C++](https://github.com/zxing-cpp/zxing-cpp) i [AndroidX](https://github.com/androidx/androidx).

## Estat de les proves

Les proves unitàries cobreixen els tipus de contingut i la comparació de versions. La [llista de proves manuals](PROVES.md) recull càmera, permisos, accessibilitat i actualització. Cal executar-la en mòbils reals abans de donar la publicació per validada.
