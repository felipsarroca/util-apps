# Guia de publicació

## Primera versió

1. Genera una clau privada de producció fora del repositori i desa'n una còpia de seguretat segura. Conserva-la per a totes les versions. No la publiquis mai.
2. Configura els secrets de GitHub Actions: `QR_KEYSTORE_BASE64` (contingut de la clau codificat en Base64), `QR_KEYSTORE_PASSWORD`, `QR_KEY_ALIAS` i `QR_KEY_PASSWORD`.
3. Verifica que `versionName`, `versionCode` i `NOTES.md` coincideixen amb la versió. Executa les proves i comprova la càmera en dispositius reals.
4. Crea i publica una etiqueta `v1.0.0`. El workflow signa l'APK, comprova la signatura i publica `app-release.apk` i `SHA256SUMS.txt`.
5. Descarrega l'APK publicat i comprova el SHA-256 i el certificat amb `apksigner verify --print-certs app-release.apk`.

## Exemple: de 1.0.0 a 1.0.1

1. Canvia `versionName` a `1.0.1` i incrementa `versionCode` a `2` a `app/build.gradle.kts`. Mantén l'`applicationId` i la clau de signatura.
2. Actualitza `NOTES.md`, executa `./gradlew testDebugUnitTest assembleDebug` i les proves manuals. Instal·la una compilació de producció de 1.0.1 sobre la de 1.0.0 i comprova que no cal desinstal·lar.
3. Fes commit i push a `main`. Quan el workflow sigui verd, crea i publica l'etiqueta `v1.0.1` sobre aquell commit.
4. Comprova la Release, la signatura, el SHA-256 i la detecció de la nova versió dins l'app.

No publiquis una etiqueta si manquen secrets o si la bateria de proves reals no ha passat. Abans de distribuir públicament, revisa les normes vigents de verificació de desenvolupadors d'Android.
