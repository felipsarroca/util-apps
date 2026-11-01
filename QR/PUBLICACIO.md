# Guia de publicació

## Primera versió

1. Genera una clau privada de producció fora del repositori i desa'n una còpia de seguretat segura. Conserva-la per a totes les versions. No la publiquis mai.
2. Configura els secrets de GitHub Actions: `QR_KEYSTORE_BASE64` (contingut de la clau codificat en Base64), `QR_KEYSTORE_PASSWORD`, `QR_KEY_ALIAS` i `QR_KEY_PASSWORD`.
3. Verifica que `versionName`, `versionCode` i `NOTES.md` coincideixen amb la versió. Executa les proves i comprova la càmera en dispositius reals.
4. Crea i publica una etiqueta `qr-v1.0.0` al repositori `util-apps`. El workflow signa l'APK, comprova la signatura i publica `lector-qr.apk` i `SHA256SUMS.txt`.
5. Descarrega l'APK publicat i comprova el SHA-256 i el certificat amb `apksigner verify --print-certs lector-qr.apk`.
6. El workflow substitueix `lector-qr.apk` de la Release tècnica `qr-apk-actual` i comprova el SHA-256 de la descàrrega. L'àlies `ja.cat/QR-Cat` apunta a aquest fitxer fix.

## Exemple: de 1.0.0 a 1.0.1

1. Canvia `versionName` a `1.0.1` i incrementa `versionCode` a `4` o superior a `QR/app/build.gradle.kts`. Mantén l'`applicationId` i la clau de signatura.
2. Actualitza `QR/NOTES.md`, executa `cd QR && ./gradlew testDebugUnitTest assembleDebug` i les proves manuals. Instal·la una compilació de producció de 1.0.1 sobre la de 1.0.0 i comprova que no cal desinstal·lar.
3. Fes commit i push a `main`. Quan el workflow sigui verd, crea i publica l'etiqueta `qr-v1.0.1` sobre aquell commit.
4. Comprova la Release, la signatura, el SHA-256 i la detecció de la nova versió dins l'app.
5. Comprova que `ja.cat/QR-Cat` descarrega l'APK nou i que el SHA-256 coincideix amb el de la Release estable.

No publiquis una etiqueta si manquen secrets o si la bateria de proves reals no ha passat. Abans de distribuir públicament, revisa les normes vigents de verificació de desenvolupadors d'Android.

Empremta SHA-256 del certificat de producció: `24:1D:42:28:B6:30:E4:EF:EE:22:BC:65:F0:4F:07:0A:A6:2F:04:B2:3F:E0:D3:4C:87:B0:E6:27:C2:9B:BC:C7`.
