with open('app/style.css', 'r', encoding='utf-8') as f:
    text = f.read()

import re
matches = re.finditer(r'([^{}\n]*?(?:\.top-pill|\.status-pill|\.pill-glass)[^{}\n]*?\{[^}]*\})', text)
for m in matches:
    print(m.group(0))
