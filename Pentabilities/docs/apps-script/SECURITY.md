# Seguretat

- El frontend només mostra o amaga opcions; els permisos importants es validen al backend.
- L'alumnat només pot entrar a sessions obertes de la seva classe.
- El professorat només veu els seus cicles i sessions, excepte usuaris amb rol `admin`.
- Cada valoració es desa com una fila independent.
- No s'ha d'exposar l'ID del Google Sheets ni l'ID del projecte Apps Script en documentació pública.
- La contrasenya del professorat no ha d'estar escrita al codi ni desada al navegador.
- La contrasenya del professorat s'ha de configurar amb la propietat `PENTABILITIES_TEACHER_PASSWORD`.
- Les escriptures crítiques usen `LockService` per reduir riscos d'enviaments simultanis.
- Si el desplegament queda amb accés ampli, el backend rebutja qualsevol correu que no consti a les llistes autoritzades.
- L'app ja no necessita permisos d'accés extern (`UrlFetchApp`) perquè no sincronitza amb Supabase.
