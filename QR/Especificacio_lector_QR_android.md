# Especificació funcional i tècnica — Lector QR per a Android

**Estat:** document d'encàrrec per al desenvolupador, versió 1.0
**Data:** 1 de novembre de 2026
**Producte final:** aplicació Android nativa distribuïda en APK signat, amb codi font públic a GitHub.
**Principi rector:** *apuntar, escanejar, veure el resultat i decidir què fer-ne*, sense distraccions.

## 1. Objectiu del projecte

Crear una aplicació per a telèfons Android que llegeixi codis QR de manera ràpida, visual, intuïtiva i segura. L'aplicació ha d'estar íntegrament en català, ser gratuïta, de codi obert, sense publicitat, sense registre i sense recollir dades de l'usuari. Ha de funcionar sense Internet per a la lectura i interpretació dels QR. L'única connexió pròpia a Internet serà per comprovar actualitzacions a GitHub, quan pertoqui o quan l'usuari ho demani.

**No és una aplicació multifuncional.** No afegir característiques que compliquin l'experiència si no estan especificades en aquest document.

## 2. Abast de la versió 1.0

### Funcions obligatòries

1. Obrir directament la vista de càmera en iniciar l'aplicació (després de concedir el permís la primera vegada).
2. Detectar automàticament un QR sense disparador ni fotografia manual.
3. Admetre QR convencionals i les variants compatibles amb el motor escollit (com ara Micro QR i rMQR) sense requerir cap configuració de l'usuari.
4. Llegir un QR que aparegui en una imatge de la galeria, seleccionada mitjançant el selector de fotos d'Android.
5. Mostrar el contingut llegit en una pantalla de resultat neta, amb una tipologia comprensible i accions contextuals.
6. Permetre **copiar** el contingut i **compartir-lo** mitjançant el menú natiu d'Android. Oferir **obrir** o una acció específica només quan el tipus de contingut ho permeti.
7. Tornar a la càmera immediatament amb un botó clar «Escaneja un altre QR» i també amb la navegació enrere.
8. Oferir llanterna per a condicions de poca llum i enfocament automàtic; si és fiable en el dispositiu, permetre tocar per enfocar i fer zoom amb els dits.
9. Comprovar si existeixen versions noves publicades a GitHub Releases i conduir l'usuari a la pàgina oficial de descàrrega.
10. Mostrar tots els textos propis en català; respectar els ajustaments d'accessibilitat del dispositiu (mida del text, contrast, lector de pantalla).

### Funcions expressament excloses

- Historial d'escanejos, favorits o base de dades d'usuaris.
- Generador de QR.
- Publicitat, pagaments, compres integrades, subscripcions, analítica, telemetria o notificacions comercials.
- Creació de comptes, inici de sessió, servidor propi i sincronització al núvol.
- Pantalla de configuració, temes elegibles, personalització de colors i opcions avançades.
- Cerca de preus, informació de productes, previsualitzacions web o verificadors remots de URL.
- Instal·lació silenciosa d'actualitzacions o descàrregues forçades.
- Escaneig generalista de codis de barres lineals: l'objectiu de la primera versió és **el QR**. Es pot reutilitzar el motor per ampliar-ho més endavant, però no s'ha d'activar per defecte.

## 3. Disseny de la interfície: només dues pantalles principals

### Pantalla A. Escàner

- **En obrir l'app:** mostrar directament la previsualització de la càmera del darrere, a pantalla gairebé completa.
- Barra superior discreta: «Lector QR» i un menú de tres punts `⋮`.
- Zona central: marcador visual sobri de lectura (quatre cantonades o requadre fi), sense animacions contínues ni elements ornamentals.
- Instrucció breu: «Apunta la càmera a un codi QR». No repetir missatges ni ensenyar tutorials.
- A la part inferior: icona de **llanterna** i icona de **fotografia**; totes dues amb descripció accessible.
- El botó de fotografia obre el selector de fotos del sistema, no una galeria desenvolupada per nosaltres.
- El menú `⋮` conté únicament «Comprova si hi ha actualitzacions» i «Quant a l'aplicació» (versió, llicència, enllaç al repositori i reconeixements legals).
- Sense botó «Escaneja», sense registre i sense altres pestanyes.
- Si la càmera no té permís, mostrar una explicació breu i el botó «Permet accedir a la càmera». Si l'usuari el denega definitivament, oferir anar als ajustaments d'Android.
- Si un dispositiu no disposa de càmera o no la pot obrir, mostrar un error entenedor i conservar l'opció de llegir una fotografia.

### Pantalla B. Resultat

- Tan bon punt es confirma una lectura vàlida, **aturar la detecció**, donar una confirmació visual discreta (i, si escau, vibració lleu) i obrir el resultat. No llegir repetidament el mateix QR.
- Mostrar una icona senzilla i un títol contextual: «Enllaç», «Text», «Xarxa Wi-Fi», «Contacte», «Telèfon», «Correu», «Ubicació», «Esdeveniment» o «Contingut del QR».
- Mostrar el contingut llegible sense truncar-lo silenciosament. Per a enllaços, destacar el **domini real** i permetre consultar l'URL completa.
- Mostrar un màxim de **dues accions principals destacades**, segons el context, i una acció secundària de còpia quan correspongui.
- Disposar d'un botó clar «Escaneja un altre QR» que retorni a l'escàner amb la càmera preparada.
- No obrir automàticament cap web, aplicació, contacte, SMS, calendari o xarxa Wi-Fi.

### Exemples exactes del comportament

| Tipus identificat | Informació que es mostra | Accions |
|---|---|---|
| URL web `https://...` | Domini destacat i URL completa | «Obre l'enllaç», «Comparteix», «Copia» |
| Text lliure | Text íntegre, seleccionable o desplaçable | «Copia», «Comparteix» |
| Wi-Fi | Nom de xarxa; contrasenya oculta per defecte | «Connecta a la Wi-Fi» si el sistema ho admet; alternativa d'ajustaments, «Copia» sota demanda |
| Contacte (vCard/MECARD) | Nom i dades ordenades | «Afegeix a contactes», «Comparteix», «Copia» |
| Telèfon | Número | «Truca» (obre el marcador, **no fa la trucada**), «Copia» |
| Correu/SMS | Destinatari i contingut, si n'hi ha | «Prepara un correu»/«Prepara un SMS», «Copia» |
| Ubicació `geo:` | Coordenades | «Obre al mapa», «Copia» |
| Esdeveniment | Nom, data i lloc, si consten | «Afegeix al calendari», «Copia» |
| Dades desconegudes | Valor original, sense inventar interpretacions | «Copia», «Comparteix» |

**Nota sobre seguretat:** un QR pot contenir dades mal formades o malicioses. L'app només interpreta patrons coneguts i no executa ordres. No ha de llançar automàticament esquemes com `javascript:`, `intent:`, `file:`, `content:` o altres protocols potencialment perillosos. Si una URL és insegura o poc habitual, mostrar-la com a text i demanar una acció explícita; mai inferir que és segura només perquè és HTTPS. Cap previsualització remota ni petició a l'adreça escanejada.

## 4. Comportament de la càmera

1. Utilitzar **CameraX** (`Preview` + `ImageAnalysis`) i **ZXing-C++** com a motor local de descodificació.
2. Prioritzar la càmera del darrere. Gestionar correctament rotació, focus i disposició vertical.
3. Analitzar fotogrames en un fil de treball, mantenint fluida la previsualització. Utilitzar una estratègia de backpressure que descarti fotogrames antics en lloc de generar cua.
4. Tancar sempre cada `ImageProxy` després de l'anàlisi, encara que es produeixi una excepció.
5. No enviar fotogrames ni resultats a servidors. No guardar fotografies ni continguts en cap arxiu d'historial.
6. En cas de múltiples QR visibles, preferir el QR més proper al centre del marcador; confirmar-ne un sol resultat i impedir duplicacions.
7. Suspendre l'anàlisi quan es mostra un resultat, quan l'aplicació deixa d'estar activa o quan s'obre el selector d'imatges. Reprendre-la correctament en tornar.
8. Evitar sons i efectes intrusius. La rapidesa i la claredat importen més que l'animació.

## 5. Arquitectura tècnica recomanada

- **Plataforma:** Android natiu.
- **Llenguatge:** Kotlin.
- **Interfície:** Jetpack Compose, o vistes Android natives si el desenvolupador justifica que això redueix complexitat; no incorporar frameworks híbrids només per aquesta app.
- **Càmera:** AndroidX CameraX.
- **Descodificació:** `io.github.zxing-cpp:android:3.1.1` (versió estable disponible i documentada a 01/11/2026; confirmar la versió estable en implementar).
- **Galeria:** `ActivityResultContracts.PickVisualMedia`, sense permís d'emmagatzematge ampli.
- **Android mínim suggerit:** API 26 (Android 8), subjecte a les compatibilitats reals de les dependències.
- **`targetSdk`:** el nivell estable recomanat/exigit en el moment de la compilació. Evitar fixar-lo obsolet.
- **Arquitectura lògica:** `ScannerScreen`, `ScannerController`, `QrDecoder`, `QrContentParser`, `ResultScreen`, `UpdateChecker` i `AboutScreen` (estructura orientativa, no obliga a sobrearquitectura).
- **Persistència local:** només preferències tècniques estrictes, com la data de l'última comprovació d'actualitzacions, la versió d'actualització descartada i la versió instal·lada. No persistir resultats escanejats.
- **Permisos:** `CAMERA`; `INTERNET` exclusivament per consultar GitHub. Evitar `READ_EXTERNAL_STORAGE`, `READ_MEDIA_IMAGES`, `READ_CONTACTS`, `WRITE_CONTACTS`, `CALL_PHONE`, `SEND_SMS`, ubicació i `REQUEST_INSTALL_PACKAGES` si no són imprescindibles.
- **Llicència del projecte:** MIT (proposada), mantenint reconeixements i llicències corresponents a les dependències; ZXing-C++ és Apache-2.0.
- **Idioma:** textos propis en català, també els de fallback; la interfície de compartir, el selector de fotos o els diàlegs del sistema depenen de la llengua configurada a Android.

## 6. Actualitzacions des de GitHub: requisit especial

### Experiència d'usuari

- L'aplicació funciona amb normalitat sense Internet. No sol·licita connexió per escanejar.
- Quan l'usuari obre l'app, efectuar una comprovació **asíncrona** si han passat com a mínim set dies des de l'última comprovació automàtica reeixida. No fer-la cada vegada ni bloquejar la càmera.
- L'usuari pot prémer en qualsevol moment `⋮ → Comprova si hi ha actualitzacions` per fer una comprovació manual.
- Si no hi ha una versió més recent, mostrar «Ja tens la versió més recent» només en comprovació manual; les comprovacions automàtiques han de ser silencioses.
- Si n'hi ha una de nova, mostrar un avís discret i no modal: «Hi ha una versió nova disponible (vX.Y.Z)» amb «Veure actualització» i possibilitat de descartar-lo. No interrompre l'escaneig i no insistir de nou en la mateixa versió descartada.
- En prémer «Veure actualització», **obrir la pàgina oficial de GitHub Release al navegador**. L'usuari decideix si descarrega l'APK i si l'instal·la.
- En absència d'Internet, si l'acció és manual, mostrar «No s'ha pogut comprovar. Revisa la connexió i torna-ho a provar». Si l'acció és automàtica, no mostrar cap error.
- Sense actualitzacions silencioses, sense serveis permanents, sense notificacions push i sense instal·lador personalitzat.

### Contracte tècnic de versions

1. Repositori públic: `https://github.com/PROPIETARI/REPOSITORI` (substituir les dades en crear-lo).
2. Consultar amb HTTPS l'API pública: `https://api.github.com/repos/PROPIETARI/REPOSITORI/releases/latest`.
3. Interpretar `tag_name` (`qr-v1.0.0`, `qr-v1.0.1`, `qr-v1.1.0`...) i `html_url` de la resposta. Només les versions de Lector QR publicades com a estables han d'activar el sistema d'actualització.
4. Validar que la resposta correspon al repositori configurat i que `html_url` pertany al destí oficial esperat. No obrir adreces arbitràries ni executar contingut retornat per l'API.
5. Comparar versions semàntiques correctament, **no alfabèticament** (per exemple, 1.10.0 és més nova que 1.9.0). Ignorar respostes sense versió vàlida i tractar els errors d'API sense bloquejar l'app.
6. Fer coincidir `versionName` de l'app amb l'etiqueta de la Release. Incrementar `versionCode` numèricament en cada publicació. Mantenir el `applicationId` idèntic.
7. Evitar dependre de claus API, tokens o autenticacions: per a un repositori públic i consultes ocasionals, emprar l'endpoint públic sense credencials. Gestionar límits de consulta i errors HTTP.
8. La Release ha de contenir un APK Android **de producció i signat**, notes breus en català i, preferiblement, la suma SHA-256 de l'APK.
9. No confondre GitHub `main` ni una pre-release amb una Release estable. El mantenidor ha de publicar les Releases estables en ordre coherent.
10. Important: l'app només **comprova i redirigeix**, no instal·la APK ni necessita el permís per instal·lar paquets desconeguts. El navegador i Android gestionen la descàrrega/instal·lació amb les confirmacions corresponents.

### Signatura i distribució

- Definir una clau de signatura de producció i conservar-ne una còpia de seguretat fora de GitHub.
- No pujar mai la clau privada ni contrasenyes al repositori.
- Signar totes les versions amb el mateix certificat (o aplicar un procediment de rotació admès per Android).
- A GitHub Actions, desar la clau codificada i les credencials com a **Secrets** i reconstruir-les només durant la compilació protegida; vigilar especialment els workflows de pull requests no fiables.
- Verificar que l'APK publicat instal·la sobre la versió anterior sense haver-la de desinstal·lar.
- Crear el README del repositori, el fitxer LICENSE, la política de privacitat i els crèdits de tercers.
- Publicar un enllaç clar a `Releases/latest` al README, amb instruccions curtes en català per descarregar i instal·lar l'APK.

### Restriccions de distribució a partir de 2027

A data de l'encàrrec, Google està desplegant la verificació de desenvolupadors Android i preveu ampliar-la globalment durant 2027, també per a distribució fora de Google Play en dispositius certificats. **Abans de publicar per al públic general, cal revisar els requisits actualitzats de registre o verificació del desenvolupador.** GitHub Releases allotja l'APK, però per si sol no eximeix de les regles d'instal·lació d'Android.

## 7. Privacitat, seguretat i accessibilitat

- Tot el processament del QR ha de ser local. No registrar els continguts en logs, serveis externs o informes d'errors.
- Les actualitzacions són l'únic motiu perquè l'app es connecti a la xarxa per iniciativa pròpia.
- Les accions amb contingut sensible (contrasenyes Wi-Fi, contactes, números de telèfon) són sempre voluntàries i visibles.
- No previsualitzar webs ni obrir enllaços automàticament. Limitar els Intents a accions segures, comprovant que el sistema té una app capaç de gestionar-los; tractar els errors sense bloquejos.
- Protegir-se contra continguts massa llargs, invàlids, mal codificats i esquemes d'URL desconeguts.
- Utilitzar elements interactius amb àrees de toc suficients, etiquetes per a TalkBack i text escalable. No comunicar informació únicament amb colors.
- No mostrar un avís o permís d'Internet: Android gestiona `INTERNET` com un permís normal. Explicar a «Quant a l'aplicació» que s'utilitza únicament per cercar actualitzacions.

## 8. Proves obligatòries abans de publicar

### Escaneig i continguts

- QR simple, QR dens, inclinat, a diferents distàncies, poca llum, fons invertit i parcialment deteriorat.
- Text català amb `à`, `è`, `í`, `ò`, `ú`, `ç`, `l·l`, emojis i, quan la biblioteca ho permeti, dades ECI.
- URL correctes i malicioses, text lliure, `WIFI:`, vCard, telèfon, correu, SMS, `geo:`, esdeveniment i formats desconeguts.
- Escaneig continuat de 20 codis sense congelacions; lectura d'un codi repetit després de tornar a l'escàner.
- Imatge de la galeria amb un QR vàlid, sense cap QR i amb diversos QR.
- Accions «Obre», «Copia», «Comparteix» i tornada a l'escàner en cada tipus corresponent.

### Sistemes i errors

- Primer inici i concessió/denegació del permís de càmera.
- Canvis d'orientació, passar l'app a segon pla, tornar-hi, blocar pantalla, sortir i tornar a entrar.
- Càmera ocupada, sense autofocus, llanterna no disponible, manca d'Internet, API de GitHub amb errors i Release encara no publicada.
- Comprovació manual i automàtica d'actualitzacions: versió igual, més nova, més antiga, pre-release i versió no vàlida.
- APK de la versió 1.0 que s'actualitza a 1.0.1 sense esborrar dades ni reinstal·lar.
- Provar diversos fabricants i almenys una versió antiga compatible i una versió recent d'Android. Ajustar la matriu real als mòbils disponibles.

### Objectius de qualitat

- La càmera ha de respondre sense esperes innecessàries. En un dispositiu de referència de gamma mitjana i llum adequada, apuntar a una lectura típica en aproximadament 1–2 segons, mesurant el resultat en proves reals.
- La interfície no s'ha de congelar durant la lectura ni durant l'ús de la xarxa per comprovar actualitzacions.
- Els errors s'han de comunicar amb missatges breus en català, mai amb excepcions tècniques.
- Cap permís superflu, cap dependència de servidor per escanejar i cap enviament de dades escanejades.

## 9. Fitxers i lliuraments exigits al desenvolupador

1. Projecte d'Android Studio complet, compilable i documentat.
2. Repositori GitHub públic amb historial de commits coherent, `.gitignore` adequat i **sense secrets**.
3. `README.md` en català: què fa l'app, com instal·lar-la, com compilar-la i com publicar versions.
4. `LICENSE` (MIT, llevat de decisió contrària justificada) i avisos de dependències Apache-2.0.
5. Política de privacitat curta i entenedora.
6. GitHub Actions per construir, provar, signar i preparar una Release estable quan es publiqui una etiqueta de versió; amb secrets protegits.
7. `app-release.apk` signat i accessible com a fitxer de descàrrega de GitHub Releases.
8. Notes de publicació en català i `SHA256SUMS.txt`.
9. Tests automatitzats del parser de continguts i de la comparació de versions; llista de proves manuals de càmera.
10. Una breu guia del mantenidor amb els passos per publicar `qr-v1.0.1` a partir de `qr-v1.0.0`, incloent verificació de signatura i actualització.

## 10. Criteris d'acceptació de la versió 1.0

El projecte **només es considerarà acabat** si es compleix tot això:

- [ ] La càmera s'obre directament i detecta un QR sense prémer un botó.
- [ ] La pantalla és visualment neta, està en català i només mostra els controls previstos.
- [ ] Un resultat **no** s'obre automàticament: primer es mostra i l'usuari escull una acció.
- [ ] Els principals tipus de QR es mostren i activen l'acció contextual adequada.
- [ ] Es pot copiar i compartir el contingut i es pot escanejar un altre QR amb un toc.
- [ ] Es poden llegir QR d'una fotografia sense autoritzar tota la galeria.
- [ ] La lectura funciona en mode avió.
- [ ] No hi ha historial, configuracions, anuncis, seguiment, comptes ni servidors propis.
- [ ] Es pot buscar manualment una actualització i també rebre l'avís discret de comprovació periòdica.
- [ ] L'avís d'actualització només dirigeix a una Release oficial, sense instal·lació silenciosa.
- [ ] Es pot actualitzar de la 1.0.0 a la 1.0.1 sobre la instal·lació existent.
- [ ] El projecte compila a partir del codi publicat i conserva la clau de signatura privada fora del repositori.
- [ ] Les proves mínimes de seguretat, permisos, càmera i accessibilitat es compleixen.

## 11. Ordre de desenvolupament suggerit

**Fase 1 — Nucli:** projecte Android, CameraX, ZXing-C++, lectura QR local, permisos i pantalla de càmera.
**Fase 2 — Experiència:** parser de tipus, pantalla de resultat, accions contextuals, còpia i compartició, selector de fotografies.
**Fase 3 — Actualitzacions:** GitHub Releases, comparació de versions, consulta manual i avís no intrusiu.
**Fase 4 — Qualitat:** bateria de proves, seguretat d'enllaços, accessibilitat, optimització, correccions.
**Fase 5 — Publicació:** signatura de producció, GitHub Actions, README, llicència, privacitat i Release `v1.0.0`.

No iniciar noves funcionalitats mentre els criteris d'acceptació de la versió 1.0 no estiguin satisfets.

## 12. Referències tècniques consultades

- ZXing-C++ per a Android: https://github.com/zxing-cpp/zxing-cpp/blob/master/wrappers/android/README.md
- Maven Central, biblioteca Android: https://central.sonatype.com/artifact/io.github.zxing-cpp/android
- CameraX ImageAnalysis: https://developer.android.com/media/camera/camerax/analyze
- Selector de fotos Android: https://developer.android.com/reference/androidx/activity/result/contract/ActivityResultContracts.PickVisualMedia
- GitHub REST API — Releases: https://docs.github.com/en/rest/releases/releases
- Enllaç a la darrera Release: https://docs.github.com/en/repositories/releasing-projects-on-github/linking-to-releases
- Com funcionen les actualitzacions d'Android: https://developer.android.com/google/play/app-updates
- Signatura d'aplicacions: https://developer.android.com/studio/publish/app-signing
- Verificació de desenvolupadors Android: https://developer.android.com/developer-verification

**Decisions pendents de concretar quan s'iniciï el projecte:** nom definitiu, identificador Android (`applicationId`), URL real del repositori, iconografia i accés segur a la clau de signatura. No són obstacles per implementar l'especificació.
