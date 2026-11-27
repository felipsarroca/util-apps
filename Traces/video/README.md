# Vídeo promocional de Traces

Vídeo de 36 s per a la fitxa de Chrome Web Store, pensat per al professorat. Sense veu: s'entén amb el so apagat.

**Idea:** dos treballs que semblen igual de ben fets. Un clic a Traces i es veu com s'han fet: la Laia escriu pas a pas en tres sessions; en Pol enganxa tres blocs en pocs segons. Després, els panells reals de l'extensió, on funciona, el criteri pedagògic («No és un detector d'IA») i la privadesa.

| Temps | Pla |
|---|---|
| 0–5 s | Dos treballs lliurats |
| 5–7 s | Un clic a Traces |
| 7–17 s | Reconstrucció del procés i corbes d'evolució |
| 17–24 s | Panells reals: 100 % pas a pas / 96 % enganxat |
| 24–28 s | Documents, Presentacions, Fulls de càlcul i Classroom |
| 28–32 s | No és un detector d'IA · tot al navegador |
| 32–36 s | Tancament: Traces, ja.cat/app-traces |

## Fitxers

- `animacio.html`: animació controlada per temps (`window.render(t)`).
- `recursos/`: icona i captures del panell real (mode exemple de l'extensió).
- `renderitza.py`: `python renderitza.py proves 3 15 20` (captures soltes) o `python renderitza.py video` (fotogrames i esdeveniments d'àudio).
- `mescla.py`: banda sonora original sintetitzada (piano, pad, pols i efectes sincronitzats amb l'animació). No usa cap música de tercers.
- Resultat: `../store/traces-promocional.mp4` (1920 × 1080, 30 fps, −16 LUFS).

Per tornar-lo a fer: `python renderitza.py video`, `python mescla.py` i:

```
ffmpeg -framerate 30 -i sortida/fotogrames/%05d.png -i sortida/so.wav -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p -tune animation -c:a aac -b:a 192k -shortest -movflags +faststart ../store/traces-promocional.mp4
```

Els noms de l'alumnat són els dels exemples de l'extensió (ficticis).
