# Arquitectura

## Flux de dades

```text
Contacts Provider → AndroidContactsDataSource → BirthdayDeduplicator
                  → DefaultBirthdayRepository → Room
                  → Compose UI / Glance widget
```

Google Contacts continua sent la font original. Room només conserva la memòria cau mínima necessària i mai no és un editor paral·lel de l’agenda.

## Paquets

- `data.contacts`: lectura per compte, en blocs de fins a 800 identificadors.
- `data.local`: entitat, DAO, convertidors i base Room.
- `data.preferences`: compte i configuració reconstruïble.
- `domain.birthdays`: models, normalització, deduplicació i pròxima ocurrència.
- `scheduling`: alarma de mitjanit, receptors i WorkManager de seguretat.
- `widget`: render Glance 4×1/4×2.
- `updates`: contracte comú i implementacions separades per flavor.

## Privadesa per disseny

La consulta de contactes es fa fora del fil principal i només projecta les columnes estrictament necessàries. Un error transitori conserva l’última memòria cau vàlida; una revocació del permís l’esborra. `allowBackup=false` i les regles d’extracció exclouen base i preferències.

## Canvi de dia

L’alarma es programa a les 00.00.05 locals. El receptor primer torna a dibuixar el widget des de la memòria cau —per canviar immediatament «Demà» a «Avui»— i després intenta rellegir els contactes. Sense accés a alarmes exactes s’usa una finestra de quinze minuts i una tasca periòdica de seguretat.

## Canals de distribució

`github` i `play` mantenen el mateix `applicationId`, esquema i `versionCode`. El canal GitHub consulta només l’API pública i obre l’APK o la release al navegador. El canal Play consulta Play In-App Updates i no declara `REQUEST_INSTALL_PACKAGES`.
