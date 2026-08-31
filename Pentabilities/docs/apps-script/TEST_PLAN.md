# Pla de prova

## Autenticació de l'aplicació canònica

- [ ] La pantalla només ofereix «Inicia la sessió amb Google» quan Supabase està configurat.
- [ ] Un alumne vinculat entra amb el rol i el grup correctes.
- [ ] Un professor vinculat entra amb el rol correcte.
- [ ] Un administrador vinculat entra amb el rol correcte.
- [ ] Un compte `@ramonpont.cat` no inclòs a la llista és rebutjat.
- [ ] Un compte autoritzat però amb `app_users.active = false` és rebutjat.
- [ ] Dos usuaris interns no poden compartir el mateix compte Google.
- [ ] En recarregar la pàgina es conserva la sessió.
- [ ] La sessió es conserva en mode PWA.
- [ ] «Sortir» elimina la sessió i torna a la pantalla d'accés.
- [ ] Després de canviar `provider_email`, el compte anterior perd l'accés.
- [ ] Cap RPC de negoci amb signatura antiga és executable pel rol `anon`.

## Prova mínima

1. Entrar com a professor.
2. Crear un cicle per a `4 ESO`.
3. Crear una sessió oberta amb 3-6 comportaments.
4. Copiar el codi de sessió.
5. Entrar amb un compte d'alumne de la classe.
6. Fer una autoavaluació.
7. Fer alguna coavaluació.
8. Entrar com a professor a `Heteroavaluar`.
9. Enviar algunes valoracions.
10. Obrir el dashboard de sessió.
11. Comprovar que `Avaluacions` conté una fila per valoració.

## Riscos a revisar en entorn real

- Els comptes d'alumne de `1 ESO` no tenen correu en l'Excel inicial.
- Cal provar l'accés amb comptes reals del domini `ramonpont.cat`.
- El primer accés ha d'autoritzar permisos de Google Apps Script.
