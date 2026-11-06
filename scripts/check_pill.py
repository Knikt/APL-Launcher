with open('app/main.js', 'r', encoding='utf-8') as f:
    text = f.read()

import re
matches = re.finditer(r'[^\n]*?(?:statusPill|topPill|renderStatusPill|syncPillGlass|status-pill)[^\n]*', text)
for m in matches:
    print(m.group(0))
