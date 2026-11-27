# SPDX-License-Identifier: AGPL-3.0-or-later
"""Renderitza animacio.html fotograma a fotograma i en desa els esdeveniments d'àudio.

Ús:
  python renderitza.py proves 1.5 9 14.8 19.5 26 30 34   -> captures soltes a sortida/proves
  python renderitza.py video                              -> sortida/fotogrames + sortida/esdeveniments.json
"""
import functools, http.server, json, sys, threading
from pathlib import Path
from playwright.sync_api import sync_playwright

DIR = Path(__file__).resolve().parent
OUT = DIR / "sortida"
FPS = 30


def main():
    mode = sys.argv[1]
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(DIR))
    handler.log_message = lambda *a: None
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 8766), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={"width": 1920, "height": 1080})
        pg.goto("http://127.0.0.1:8766/animacio.html")
        pg.wait_for_load_state("networkidle")
        pg.evaluate("document.fonts.ready")
        ev = pg.evaluate("window.EVENTS")
        if mode == "proves":
            d = OUT / "proves"; d.mkdir(parents=True, exist_ok=True)
            for s in sys.argv[2:]:
                pg.evaluate(f"window.render({float(s)})")
                pg.screenshot(path=str(d / f"t{float(s):05.1f}.png"))
        else:
            d = OUT / "fotogrames"; d.mkdir(parents=True, exist_ok=True)
            for f in d.glob("*.png"): f.unlink()
            n = int(ev["total"] * FPS)
            for i in range(n):
                pg.evaluate(f"window.render({i / FPS})")
                pg.screenshot(path=str(d / f"{i:05d}.png"))
                if i % 150 == 0: print(f"{i}/{n}", flush=True)
            (OUT / "esdeveniments.json").write_text(json.dumps(ev), encoding="utf-8")
        b.close()
    srv.shutdown()


if __name__ == "__main__":
    main()
