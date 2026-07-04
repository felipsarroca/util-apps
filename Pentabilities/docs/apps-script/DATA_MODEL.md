# Model de dades

## Criteri actual

Google Sheets és la base de dades principal de l'app.

El full combina dues funcions:

- pestanyes editables per mantenir alumnat, correus i professorat;
- pestanyes internes per registrar cicles, sessions i valoracions.

## Pestanyes editables

- `1r dESO`: alumnat de 1r d'ESO.
- `2n dESO`: alumnat de 2n d'ESO.
- `3r dESO`: alumnat de 3r d'ESO.
- `4t dESO`: alumnat de 4t d'ESO.
- `Professorat`: professorat autoritzat.

Aquestes pestanyes són les que s'han de tocar manualment quan canviïn alumnes o correus.

## Pestanyes internes

- `Cursos_Escolars`: cursos escolars i curs actiu.
- `Alumnes`: alumnat normalitzat que fa servir l'app.
- `Professorat_App`: professorat normalitzat amb rol `professor` o `admin`.
- `Habilitats`: les cinc habilitats Pentabilities.
- `Comportaments`: els 35 comportaments.
- `Cicles`: períodes o seqüències d'avaluació.
- `Sessions`: activitats concretes amb codi d'accés.
- `Sessio_Comportaments`: comportaments triats a cada sessió.
- `Sessio_Heteroalumnes`: alumnat seleccionat per a heteroavaluació docent.
- `Avaluacions`: registre central de valoracions.

## Criteri clau

Cada valoració és una fila independent a `Avaluacions`. No hi ha una columna per comportament.

Això permet calcular resultats per sessió, cicle, classe, alumne, comportament, habilitat i tipus d'avaluació.
