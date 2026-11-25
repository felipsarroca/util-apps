# SPDX-License-Identifier: AGPL-3.0-or-later
"""Genera la icona de Traces (SVG + PNG 16, 32, 48 i 128 px) amb Chromium via Playwright.

Disseny: silueta directa d'un document blau (estil Google Docs) amb línies de text,
una traça destacada en ambre i una lupa nítida a la cantonada inferior dreta.
Sense marc exterior superflu perquè a 16–32 px tingui el màxim contrast i claredat.
"""

from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
ICONS_DIR = ROOT / "public" / "icons"
ICONS_DIR.mkdir(parents=True, exist_ok=True)

DEFS = """<defs>
    <linearGradient id="docGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0EA5E9"/>
      <stop offset="1" stop-color="#1D4ED8"/>
    </linearGradient>
    <linearGradient id="lensGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.96"/>
      <stop offset="1" stop-color="#E0F2FE" stop-opacity="0.92"/>
    </linearGradient>
  </defs>"""

FULL_SVG = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <!-- SPDX-License-Identifier: CC-BY-NC-SA-4.0 -->
  {DEFS}
  <!-- Document blau amb cantonada doblegada -->
  <path d="M20 8 H74 L98 32 V108 a10 10 0 0 1 -10 10 H20 a10 10 0 0 1 -10 -10 V18 a10 10 0 0 1 10 -10 Z" fill="url(#docGrad)"/>
  <path d="M74 8 V24 a8 8 0 0 0 8 8 H98 Z" fill="#BAE6FD"/>
  <!-- Línies del document + traça destacada en ambre -->
  <rect x="24" y="38" width="38" height="9" rx="4.5" fill="#FFFFFF" opacity="0.92"/>
  <rect x="24" y="56" width="54" height="10" rx="5" fill="#FBBF24"/>
  <rect x="24" y="75" width="32" height="9" rx="4.5" fill="#FFFFFF" opacity="0.82"/>
  <!-- Lupa nítida inspeccionant la traça -->
  <line x1="97" y1="97" x2="117" y2="117" stroke="#0F172A" stroke-width="14" stroke-linecap="round"/>
  <line x1="97" y1="97" x2="117" y2="117" stroke="#F59E0B" stroke-width="8" stroke-linecap="round"/>
  <circle cx="80" cy="80" r="26" fill="url(#lensGrad)" stroke="#0F172A" stroke-width="10"/>
  <circle cx="80" cy="80" r="24" fill="none" stroke="#FFFFFF" stroke-width="5"/>
  <!-- Traça ampliada dins la lent -->
  <rect x="65" y="75" width="30" height="10" rx="5" fill="#F59E0B"/>
</svg>
"""

SMALL_SVG = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  {DEFS}
  <path d="M16 6 H76 L102 32 V112 a10 10 0 0 1 -10 10 H16 a10 10 0 0 1 -10 -10 V16 a10 10 0 0 1 10 -10 Z" fill="url(#docGrad)"/>
  <path d="M76 6 V24 a8 8 0 0 0 8 8 H102 Z" fill="#BAE6FD"/>
  <rect x="22" y="38" width="42" height="12" rx="6" fill="#FFFFFF"/>
  <rect x="22" y="60" width="46" height="13" rx="6.5" fill="#FBBF24"/>
  <line x1="96" y1="96" x2="118" y2="118" stroke="#0F172A" stroke-width="18" stroke-linecap="round"/>
  <circle cx="78" cy="78" r="28" fill="#FFFFFF" stroke="#0F172A" stroke-width="11"/>
  <rect x="61" y="72" width="34" height="12" rx="6" fill="#F59E0B"/>
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
