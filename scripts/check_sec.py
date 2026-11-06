with open('app/main.js', 'r', encoding='utf-8') as f:
    text = f.read()

import re
m = re.search(r'if \(t\.group === \'smarthome\'\) \{.*?return \[(.*?)\];\s*\}', text, re.S)
if m:
    print(m.group(0))
