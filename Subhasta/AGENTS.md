# Subhasta

- Llegeix `README.md` i `PLANIFICACIO.md` complets abans d'analitzar, dissenyar o implementar l'app. `PLANIFICACIO.md` és l'únic document de disseny.
- És una subhasta anglesa oberta dirigida per l'organitzador: cada unitat es licita en directe i queda adjudicada quan l'organitzador ho decideix.
- L'oferta més alta i el nom de qui la fa han de ser visibles en temps real a tots els dispositius.
- En adjudicar, actualitza conjuntament el saldo, les compres, les unitats disponibles i l'estat de la licitació.
- Arquitectura: app estàtica amb Firebase Firestore des del navegador, autenticació anònima, regles de seguretat estrictes i transaccions. Sense funcions de servidor ni Storage; no PeerJS/WebRTC ni Metered.
- Mantén la primera versió senzilla. No implementis ampliacions abans de tenir complet i verificat el circuit principal.
- Les decisions de l'apartat 2 de `PLANIFICACIO.md` estan confirmades per Felip (16-11-2026); no les reobris. L'app inclou les tres direccions visuals («Mercat» per defecte, «Llotja clara» i «Sala fosca») seleccionables a la capçalera.
- El terminal de l'alumnat es dissenya primer per a portàtil o Chromebook a 1366 × 768; el mòbil és secundari. Adapta també la projecció, el comandament i l'escalat del sistema des del principi.
- Estètica: càlida i neta, sense color crema ni marcs dins de marcs, amb icones de línia.
