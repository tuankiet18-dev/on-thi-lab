"""Render <name>.svg (default onthilab) to ../<name>-diagrams.png (needs the playwright Python package and its Chromium)."""
import re
from playwright.sync_api import sync_playwright

import sys
name = sys.argv[1] if len(sys.argv) > 1 else "onthilab"
svg = open(f"{name}.svg").read()
w, h = (int(v) for v in re.search(r'width="(\d+)" height="(\d+)"', svg).groups())
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": w, "height": h}, device_scale_factor=1.5)
    pg.set_content(f'<body style="margin:0">{svg}</body>')
    pg.screenshot(path=f"../{name}-diagrams.png")
    b.close()
