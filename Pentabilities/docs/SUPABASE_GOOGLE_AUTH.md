# Autenticació amb Google

## Arquitectura

L'aplicació publicada a GitHub Pages utilitza Supabase Auth com a única sessió d'usuari.

```text
Google → Supabase Auth → app_user_identities → app_users → RPC de Pentabilities
```

- Google verifica la identitat.
- `app_user_identities` vincula el compte Google amb un usuari intern.
- `app_users` conserva el rol, el grup, l'estat i l'identificador intern.
- Les RPC només es poden executar amb el rol `authenticated`.
- No hi ha registre obert per correu i contrasenya.

El domini `ramonpont.cat` que envia el frontend és només una ajuda per seleccionar el compte. L'autorització real sempre comprova el correu concret de la taula de vinculacions.

## Ordre de desplegament

1. Aplicar la migració `20260830205204_add_google_oauth_authentication.sql` al projecte Supabase correcte.
2. Configurar el hook **Before User Created** amb la funció Postgres `private.hook_allow_authorized_google_user`.
3. Crear o revisar el client OAuth web a Google Auth Platform.
4. Activar el proveïdor Google a Supabase Auth.
5. Configurar les URL de l'aplicació i de retorn.
6. Publicar el frontend.
7. Executar el pla de proves abans de retirar definitivament l'accés anterior.

No s'ha de publicar el frontend abans d'haver aplicat la migració: la versió nova crida signatures RPC autenticades que no existeixen a l'esquema anterior.

## Configuració de Google

Al client OAuth de tipus **Web application**:

- Origen JavaScript de producció: `https://felipsarroca.github.io`
- Origen local: `http://127.0.0.1:8000`
- URI de retorn: `https://PROJECT_REF.supabase.co/auth/v1/callback`

Els únics àmbits necessaris són `openid`, correu i perfil. No cal demanar accés a Drive, Classroom ni altres dades de Google.

El `client secret` de Google s'ha de configurar a Supabase o en una variable d'entorn local. No s'ha de posar mai a `config.js`, al repositori o al navegador.

## Configuració de Supabase Auth

URL de l'aplicació:

```text
https://felipsarroca.github.io/util-apps/Pentabilities/
```

URL de retorn addicional per a desenvolupament:

```text
http://127.0.0.1:8000/Pentabilities/
```

Cal comprovar també:

- Google activat com a proveïdor.
- Registre per correu i contrasenya desactivat.
- Registre anònim desactivat.
- Enllaç manual d'identitats desactivat.
- Hook `Before User Created` activat.

## Gestió de comptes autoritzats

La migració prepara una vinculació Google per a cada usuari existent utilitzant inicialment el seu correu actual. A partir d'aquell moment, `provider_email` és independent del correu intern d'`app_users`.

Per canviar el compte Google vinculat s'ha d'actualitzar la vinculació i deixar que el compte nou es vinculi en el primer accés:

```sql
update public.app_user_identities identity_link
set provider_email = lower('nou.compte@ramonpont.cat'),
    auth_user_id = null,
    linked_at = null,
    updated_at = now()
from public.app_users app_user
where app_user.id = identity_link.app_user_id
  and app_user.email = 'correu.intern@example.cat';
```

No s'ha d'escriure manualment cap `auth_user_id`. El backend el vincula de manera atòmica després que Google hagi autenticat el compte correcte.

Per denegar l'accés immediatament es pot marcar l'usuari intern com a inactiu. Totes les resolucions d'identitat comproven `app_users.active`.

## Compatibilitat temporal

Les funcions de negoci existents encara tenen signatures internes amb `p_token`. La migració incorpora adaptadors autenticats que:

1. resolen l'usuari amb `auth.uid()`;
2. creen un token intern amb cinc minuts de validesa;
3. executen la funció existent;
4. eliminen el token dins de la mateixa transacció.

Aquest token no es desa al navegador ni forma part de la sessió. És una capa temporal per desplegar Google Auth sense reescriure de cop tota la lògica de negoci. Es podrà retirar quan totes les funcions hagin migrat directament a `private.current_app_user()`.

## Retorn enrere

Abans de desplegar cal conservar una còpia de l'esquema i verificar el projecte vinculat. Si la prova falla, es pot tornar a publicar el frontend anterior mentre s'investiga, però no s'han de reobrir les RPC antigues al rol `anon` sense una revisió de seguretat.
