# La teva veu: autoritzar l'inici de sessió a Google Workspace

**Per a:** la persona administradora de Google Workspace de l'Escola Ramon Pont.

L'aplicació només demana a Google qui és l'usuari. **No llegeix el correu, el Drive ni el calendari.**

## 1. Què demana l'aplicació

| Permís (abast OAuth) | Per a què |
| --- | --- |
| `openid` | Identificar l'usuari |
| `email` | Saber el correu `@ramonpont.cat` |
| `profile` | Mostrar el nom i la foto a la capçalera |

L'aplicació també demana a Google que només mostri comptes del domini de l'escola (`hd=ramonpont.cat`). El servidor torna a comprovar el domini i que el correu estigui verificat.

## 2. Crear el client OAuth

Al projecte de Google Cloud de l'escola (o en un de nou):

1. **API i serveis › Pantalla de consentiment d'OAuth**
   - Tipus d'usuari: **Intern**, perquè només hi puguin entrar comptes de l'organització.
   - Nom de l'app: `La teva veu`. Correu d'assistència: un correu institucional.
   - Abasts: només `openid`, `email` i `profile`.
2. **API i serveis › Credencials › Crea les credencials › ID de client d'OAuth**
   - Tipus: **Aplicació web**.
   - Orígens de JavaScript autoritzats: l'adreça on es publicarà l'app (per exemple, `https://felipsarroca.github.io`) i, per a proves, `http://localhost:5173`.
3. Copia l'**ID de client**, que acaba en `.apps.googleusercontent.com`. No és secret: es posa a la configuració de l'app (`VITE_GOOGLE_CLIENT_ID`) i al servidor.

## 3. Permetre l'app als comptes de l'alumnat

Google bloqueja, per als usuaris designats com a menors de 18 anys, les apps de tercers que l'administració no ha configurat.

1. Consola d'administració › **Seguretat › Control d'accés i de dades › Controls d'API**.
2. **Gestiona l'accés a les aplicacions de tercers › Configura una aplicació nova › ID de client d'OAuth**.
3. Enganxa l'ID de client i selecciona l'app `La teva veu`.
4. Abast: les unitats organitzatives de l'alumnat de 3r de primària a 4t d'ESO i la del professorat.
5. Accés: **De confiança** (o **Limitat** si només demana els abasts bàsics; totes dues opcions permeten l'inici de sessió).
6. Desa.

Els canvis poden trigar unes hores a aplicar-se.

## 4. Comprovació

Abans de la prova pilot, entreu amb aquests comptes i comproveu que arriben a la pantalla d'inici sense errors:

| Compte | Resultat esperat |
| --- | --- |
| Un alumne de 3r de primària | Pantalla d'inici de l'alumne |
| Un alumne de 6è | Pantalla d'inici de l'alumne |
| Un alumne d'ESO | Pantalla d'inici de l'alumne |
| Un docent | Pantalla del professorat |
| Un compte de l'escola que no és al cens | «Encara no tens accés», sense cap dada |
| Un compte de fora de l'escola | Rebutjat abans d'entrar |

Si un alumne veu «Accés bloquejat: l'administrador no ha configurat aquesta app», revisa el pas 3 i la unitat organitzativa d'aquell compte.

## Referència

Google, *Manage access to unconfigured third-party apps for users designated as under 18*:
https://knowledge.workspace.google.com/admin/getting-started/editions/manage-access-to-unconfigured-third-party-apps-for-users-designated-as-under-18
