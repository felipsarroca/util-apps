# Propostes de millora de Ruleta App

Les propostes següents són una evolució possible; no es presenten com a funcions ja implementades. Prioritat basada en utilitat a l’aula, esforç i risc de complicar la interfície.

| Prioritat | Proposta | Benefici i criteri de verificació |
| --- | --- | --- |
| Alta | Llistes guardades i activitats favorites | Canviar de grup sense importar cada vegada. Cal poder anomenar, exportar i eliminar cada llista; desament local per defecte. |
| Alta | Marcar absències i recuperar una sola opció | Distingir una persona absent d’una persona que ja ha participat. Els dos estats han de ser visibles i reversibles sense reiniciar la sessió. |
| Alta | Temps opcional per pensar | Afegir 15–60 segons després del resultat, sense iniciar-los automàticament. El docent ha de poder pausar o ometre el temporitzador. |
| Alta | Verificació en panells tàctils reals | Comprovar precisió del toc, pantalla completa, àudio i tancament del resultat al dispositiu del centre. Incloure iPad/Safari si s’hi farà servir. |
| Mitjana | Dues ruletes coordinades | Separar «qui participa» i «quin repte toca». Les dues llistes necessiten historial, recuperació i política de repeticions independents. |
| Mitjana | Opcions de resposta | Incorporar a cada activitat alternatives per parlar, escriure o dibuixar, i permetre passar torn. Han de ser suggeriments breus, mai un tràmit obligatori. |
| Mitjana | Lectura del resultat en veu alta | Útil per a visibilitat limitada o alumnat nouvingut. Activació expressa, veu catalana disponible, volum independent i cancel·lació immediata. |
| Mitjana | Instal·lació com a PWA | Accés des de l’escriptori amb biblioteca disponible sense xarxa. Cal provar actualitzacions, invalidació de memòria cau i recuperació de versions. |
| Mitjana | Fitxa imprimible d’una activitat | Exportar consigna, opcions i variants per continuar sense pantalla. Comprovar impressió A4, contrast i salts de pàgina. |
| Baixa | Ajust de textos llargs als sectors | Explorar dues línies o abreviacions més clares. Mantenir sempre el nom complet a la llista i al resultat; no reduir indefinidament la lletra. |
| Tècnica | Proves automàtiques a GitHub | Executar validació JSON i regressions en cada canvi. Comprovar especialment selecció, persistència i importació de dades antigues. |
| Tècnica | Separar estat, dibuix i biblioteca | Facilitar manteniment quan s’afegeixin funcions. Conservar el format de còpies i l’obertura local sense servidor. |

## Orientació pedagògica

La ruleta pot distribuir torns, però el valor de l’activitat depèn de les preguntes, el temps de preparació i l’acompanyament. L’EEF destaca el diàleg estructurat, les preguntes i el feedback en les intervencions de llenguatge oral: això inspira les propostes de temps per pensar i de justificar la resposta. No implica que utilitzar una ruleta produeixi per si mateix els resultats de les intervencions estudiades. [EEF: Oral language interventions](https://educationendowmentfoundation.org.uk/education-evidence/teaching-learning-toolkit/oral-language-interventions).

CAST proposa oferir diferents mitjans d’acció i expressió. Aplicat aquí, convé permetre respondre oralment, per escrit o amb un dibuix i preparar variants de les consignes. [CAST: Action & expression](https://udlguidelines.cast.org/action-expression/).

Evitaria classificacions públiques d’alumnes, penalitzacions per passar torn i probabilitats amagades. La selecció ha de continuar sent comprensible; una necessitat educativa no s’hauria de gestionar alterant secretament l’atzar.

## Criteris estètics i d’accessibilitat

Mantenir el resultat com a protagonista, reservar els ajustos avançats al panell i incorporar funcions només quan tinguin un ús clar. Les animacions i els sons han de continuar sent opcionals.

Els controls principals apunten als 44 píxels; cal revisar també separació, navegació per teclat, lector de pantalla, contrast i zoom. WCAG 2.2 fixa un mínim de 24 × 24 píxels amb excepcions, i el criteri reforçat fixa 44 × 44. Una comprovació automatitzada no acredita tota l’accessibilitat. [W3C: Target size minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum) · [W3C: Target size enhanced](https://www.w3.org/WAI/WCAG21/Understanding/target-size).

## Seqüència recomanada

1. Fer una sessió real a l’aula i anotar friccions observades.
2. Prioritzar llistes guardades i absències si el canvi de grup és freqüent.
3. Afegir temps de preparació i variants de resposta segons les activitats utilitzades.
4. Valorar PWA, lectura de veu i doble ruleta després de validar-ne la necessitat.
