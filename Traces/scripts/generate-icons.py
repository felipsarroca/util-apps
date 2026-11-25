# SPDX-License-Identifier: AGPL-3.0-or-later
"""Genera la icona de Traces (SVG + PNG 16, 32, 48 i 128 px) amb Chromium via Playwright.

Disseny: full de document blanc sobre fons blau, amb una línia de traçat ascendent
que acaba en un punt taronja (la «traça» de l'escriptura). La versió de 16 px
simplifica el dibuix (sense línies de text i traços més gruixuts) perquè es llegeixi bé.
"""

from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
ICONS_DIR = ROOT / "public" / "icons"
ICONS_DIR.mkdir(parents=True, exist_ok=True)

DEFS = """<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="#38BDF8"/><stop offset="1" stop-color="#0369A1"/></linearGradient></defs>"""

FULL_SVG = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <!-- SPDX-License-Identifier: CC-BY-NC-SA-4.0 -->
  {DEFS}
  <rect x="4" y="4" width="120" height="120" rx="28" fill="url(#g)"/>
  <path d="M38 18 H78 L96 36 V104 a6 6 0 0 1 -6 6 H38 a6 6 0 0 1 -6 -6 V24 a6 6 0 0 1 6 -6 Z" fill="#FFFFFF"/>
  <path d="M78 18 V30 a6 6 0 0 0 6 6 H96 Z" fill="#BAE6FD"/>
  <line x1="44" y1="40" x2="66" y2="40" stroke="#CBD5E1" stroke-width="6" stroke-linecap="round"/>
  <line x1="44" y1="54" x2="76" y2="54" stroke="#CBD5E1" stroke-width="6" stroke-linecap="round"/>
  <polyline points="44,94 57,81 67,86 82,66" fill="none" stroke="#0284C7" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="83" cy="65" r="10" fill="#F59E0B" stroke="#FFFFFF" stroke-width="3.5"/>
</svg>
"""

SMALL_SVG = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  {DEFS}
  <rect x="0" y="0" width="128" height="128" rx="26" fill="url(#g)"/>
  <path d="M30 12 H80 L100 32 V110 a6 6 0 0 1 -6 6 H30 a6 6 0 0 1 -6 -6 V18 a6 6 0 0 1 6 -6 Z" fill="#FFFFFF"/>
  <polyline points="38,96 58,74 84,52" fill="none" stroke="#0284C7" stroke-width="15" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="84" cy="50" r="15" fill="#F59E0B"/>
</svg>
"""

(ROOT / "public" / "favicon.svg").write_text(FULL_SVG, encoding="utf-8")
(ROOT / "favicon.svg").write_text(FULL_SVG, encoding="utf-8")

with sync_playwright() as p:
    browser = p.chromium.launch()
    for size in (16, 32, 48, 128):
        svg = SMALL_SVG if size <= 16 else FULL_SVG
        svg_sized = svg.replace("<svg ", f'<svg width="{size}" height="{size}" ', 1)
        page = browser.new_page(viewport={"width": size, "height": size}, device_scale_factor=1)
        page.set_content(
            f'<html><body style="margin:0;background:transparent;overflow:hidden">{svg_sized}</body></html>'
        )
        page.screenshot(path=str(ICONS_DIR / f"icon{size}.png"), omit_background=True)
        page.close()
    browser.close()

print("Icones generades correctament.")
