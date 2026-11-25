# SPDX-License-Identifier: AGPL-3.0-or-later
"""Genera les icones oficials de l'extensió Traces (SVG + PNG 16, 32, 48 i 128 px)."""

from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
ICONS_DIR = ROOT / "public" / "icons"
ICONS_DIR.mkdir(parents=True, exist_ok=True)

SVG_CONTENT = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" fill="none">
  <!-- SPDX-License-Identifier: CC-BY-NC-SA-4.0 -->
  <rect x="8" y="8" width="112" height="112" rx="26" fill="#1E293B"/>
  <rect x="12" y="12" width="104" height="104" rx="22" stroke="#334155" stroke-width="2"/>
  <line x1="28" y1="38" x2="72" y2="38" stroke="#64748B" stroke-width="6" stroke-linecap="round"/>
  <line x1="28" y1="54" x2="56" y2="54" stroke="#64748B" stroke-width="6" stroke-linecap="round"/>
  <path d="M26 88 L48 76 L66 80 L84 48 L102 42" stroke="#38BDF8" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="84" cy="48" r="10" fill="#F59E0B" stroke="#1E293B" stroke-width="4"/>
  <circle cx="102" cy="42" r="6.5" fill="#38BDF8"/>
</svg>
"""

(ROOT / "public" / "favicon.svg").write_text(SVG_CONTENT, encoding="utf-8")


def render_png(size: int, out_path: Path) -> None:
    scale = 8
    s = size * scale
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    pad = int(s * 0.0625)
    radius = int(s * 0.22)
    draw.rounded_rectangle(
        [pad, pad, s - pad, s - pad],
        radius=radius,
        fill=(30, 41, 59, 255),
        outline=(51, 65, 85, 255),
        width=max(2, int(s * 0.02)),
    )

    if size >= 32:
        lw_muted = max(2, int(s * 0.052))
        y1 = int(s * 0.29)
        y2 = int(s * 0.43)
        x0 = int(s * 0.22)
        draw.line([(x0, y1), (int(s * 0.56), y1)], fill=(100, 116, 139, 255), width=lw_muted)
        draw.line([(x0, y2), (int(s * 0.44), y2)], fill=(100, 116, 139, 255), width=lw_muted)

    pts = [
        (int(s * 0.20), int(s * 0.72)),
        (int(s * 0.38), int(s * 0.61)),
        (int(s * 0.52), int(s * 0.64)),
        (int(s * 0.67), int(s * 0.37)),
        (int(s * 0.81), int(s * 0.31)),
    ]
    lw_main = max(4, int(s * (0.095 if size <= 16 else 0.078)))
    draw.line(pts, fill=(56, 189, 248, 255), width=lw_main, joint="curve")
    for px, py in pts:
        r_joint = lw_main // 2
        draw.ellipse([px - r_joint, py - r_joint, px + r_joint, py + r_joint], fill=(56, 189, 248, 255))

    ax, ay = pts[3]
    r_amber = int(s * (0.115 if size <= 16 else 0.092))
    r_border = max(2, int(s * 0.03))
    draw.ellipse(
        [ax - r_amber - r_border, ay - r_amber - r_border, ax + r_amber + r_border, ay + r_amber + r_border],
        fill=(30, 41, 59, 255),
    )
    draw.ellipse(
        [ax - r_amber, ay - r_amber, ax + r_amber, ay + r_amber],
        fill=(245, 158, 11, 255),
    )

    ex, ey = pts[4]
    r_end = int(s * 0.055)
    draw.ellipse([ex - r_end, ey - r_end, ex + r_end, ey + r_end], fill=(125, 211, 252, 255))

    final = img.resize((size, size), Image.Resampling.LANCZOS)
    final.save(out_path, format="PNG")


for sz in (16, 32, 48, 128):
    render_png(sz, ICONS_DIR / f"icon{sz}.png")

print("Icones generades correctament.")
