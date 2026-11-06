import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
icons_dir = ROOT / 'app/assets/icons'

# 1. Moonlight SVG
moonlight_svg = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#ffffff">
  <title>Moonlight</title>
  <path fill-rule="evenodd" clip-rule="evenodd" d="M12 1.5C6.2 1.5 1.5 6.2 1.5 12S6.2 22.5 12 22.5 22.5 17.8 22.5 12 17.8 1.5 12 1.5zm0 2.2c4.6 0 8.3 3.7 8.3 8.3s-3.7 8.3-8.3 8.3-8.3-3.7-8.3-8.3 3.7-8.3 8.3-8.3zm.8 7.5h6.2v1.6h-6.2l4.4 4.4-1.1 1.1-4.4-4.4v6.2h-1.6v-6.2l-4.4 4.4-1.1-1.1 4.4-4.4H2.5v-1.6h6.2L4.3 6.8l1.1-1.1 4.4 4.4V3.9h1.6v6.2l4.4-4.4 1.1 1.1-4.1 4.4z"/>
</svg>
'''
(icons_dir / 'moonlight.svg').write_text(moonlight_svg, encoding='utf-8')

# 2. Nuvio TV SVG
nuviotv_svg = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#ffffff">
  <title>Nuvio TV</title>
  <path fill-rule="evenodd" clip-rule="evenodd" d="M6.2 3.4C4.8 2.5 3 3.5 3 5.2v13.6c0 1.7 1.8 2.7 3.2 1.8l12.4-6.8c1.5-.8 1.5-3 0-3.8L6.2 3.4zm1.8 4.2L15.3 12 8 16.4V7.6z"/>
  <path d="M9.8 9.2c-.4-.2-.8.1-.8.5v4.6c0 .4.4.7.8.5l4-2.3c.4-.2.4-.8 0-1l-4-2.3z"/>
</svg>
'''
(icons_dir / 'nuviotv.svg').write_text(nuviotv_svg, encoding='utf-8')

# 3. Hotstar / JioHotstar SVG (5-blade pinwheel)
# Generating 5 blades at 72-deg intervals
def make_hotstar():
    blades = []
    r_out = 9.8
    r_mid = 7.0
    r_in = 1.6
    for i in range(5):
        a0 = math.radians(-90 + i * 72)
        a1 = math.radians(-90 + i * 72 + 36)
        a2 = math.radians(-90 + i * 72 + 65)
        
        # Tip
        x0, y0 = 12 + r_out * math.cos(a0), 12 + r_out * math.sin(a0)
        # Outer shoulder
        x1, y1 = 12 + r_mid * math.cos(a1), 12 + r_mid * math.sin(a1)
        # Center hub
        x2, y2 = 12 + r_in * math.cos(a2), 12 + r_in * math.sin(a2)
        
        blades.append(f"M 12 12 L {x0:.2f} {y0:.2f} Q {x1:.2f} {y1:.2f} {x2:.2f} {y2:.2f} Z")
    
    path_d = " ".join(blades)
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#ffffff">
  <title>Hotstar</title>
  <path fill-rule="evenodd" clip-rule="evenodd" d="{path_d}"/>
</svg>
'''

(icons_dir / 'hotstar.svg').write_text(make_hotstar(), encoding='utf-8')

# 4. SonyLIV SVG (SONY at top, liv with checkmark V at bottom)
sonyliv_svg = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#ffffff">
  <title>Sony LIV</title>
  <!-- SONY wordmark -->
  <path d="M3.2 4.2h3.4c.3 0 .5.2.5.5v.4c0 .3-.2.5-.5.5H4.8v1.1h1.5c.3 0 .5.2.5.5v.4c0 .3-.2.5-.5.5H4.8v1.3h1.8c.3 0 .5.2.5.5v.4c0 .3-.2.5-.5.5H3.2V4.2zm5.2 0h2.6c1.1 0 1.9.8 1.9 1.9v1.9c0 1.1-.8 1.9-1.9 1.9H8.4V4.2zm1.6 1.4v2.9h1c.3 0 .5-.2.5-.5v-1.9c0-.3-.2-.5-.5-.5h-1zm5 0h1.5l1.6 3.1V4.2h1.5v5.7h-1.4l-1.7-3.2v3.2H15V4.2zm6.2 0h1.6l1.2 2.3 1.2-2.3h1.6l-2.1 3.4v2.3h-1.5V7.6l-2-3.4z" opacity="0.9"/>
  <!-- LIV with iconic checkmark V -->
  <path d="M4 12.5h2.4v8.5H4v-8.5zm4.2 0h2.4v8.5H8.2v-8.5zm5.5 0h2.5l2.4 5.2 4.4-8.7H22L16.2 21h-2.1l-4.6-8.5z"/>
  <circle cx="9.4" cy="11.2" r="1.1"/>
</svg>
'''
(icons_dir / 'sonyliv.svg').write_text(sonyliv_svg, encoding='utf-8')

print("Created 4 SVGs in app/assets/icons/")
