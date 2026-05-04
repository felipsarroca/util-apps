# Seguretat amb Supabase Auth i RLS

L'app ja no valida l'acces amb codis guardats al repositori. Ara fa servir Supabase Auth i les dades nomes es carreguen quan l'usuari ha iniciat sessio.

## 1. Crear usuaris a Supabase

Ves a **Authentication > Users** i crea els usuaris que hagin d'entrar a l'app.

Cada usuari ha de tenir un rol a `app_metadata`:

```json
{
  "role": "consulta"
}
```

o be:

```json
{
  "role": "edicio"
}
```

Si no ho pots editar des de la pantalla de l'usuari, pots fer-ho des del **SQL Editor** canviant el correu:

```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"edicio"}'::jsonb
where email = 'usuari@centre.cat';
```

Important: no posis el rol a `user_metadata`. Ha d'anar a `app_metadata`, perque `user_metadata` no serveix com a base segura de permisos.

## 2. Permisos

| Rol | Permis |
| --- | --- |
| `consulta` | Pot llegir ordinadors, usuaris, assignacions i esdeveniments |
| `edicio` | Pot llegir, crear i editar; tambe pot eliminar esdeveniments |

## 3. Activar RLS

Obre el fitxer [`supabase-rls.sql`](./supabase-rls.sql), copia'n el contingut i executa'l al **SQL Editor** de Supabase.

Aixo activa Row Level Security a:

- `usuaris`
- `ordinadors`
- `assignacions`
- `esdeveniments`

## 4. Comprovar l'app

1. Entra a l'app amb un usuari `consulta`.
2. Comprova que pots veure dades pero no editar.
3. Tanca sessio.
4. Entra amb un usuari `edicio`.
5. Comprova que pots crear, editar i registrar accions.

## 5. Activar l'administracio d'usuaris des de l'app

L'app inclou una pantalla **Usuaris** per crear, canviar rol, desactivar o eliminar accessos. Perque funcioni cal desplegar la funcio segura de Supabase.

Des de la carpeta del projecte:

```bash
supabase login
supabase link --project-ref ssfzvrwlugxuflxxwaws
supabase secrets set GESTIO_SERVICE_ROLE_KEY=LA_TEVA_SERVICE_ROLE_KEY
supabase functions deploy manage-users
```

La clau secreta s'ha de copiar des de **Supabase > Project Settings > API keys**. Pot ser una `service_role` legacy o una `secret key` actual. No l'escriguis a cap fitxer del repositori ni la pengis a GitHub.

Despres d'aixo, entra a l'app amb un usuari `edicio` i veuras el boto **Usuaris** a la barra superior.

## Nota important

La clau `sb_publishable_...` pot continuar al frontend. La seguretat no depen d'amagar aquesta clau, sino de tenir RLS activat i politiques correctes a Supabase.
