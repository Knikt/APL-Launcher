with open('app/main.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, l in enumerate(lines):
    if "'settings'" in l or "settings" in l.lower():
        if any(w in l for w in ['render', 'sheet', 'push', 'function', 'view', 'FILLS', 'case', 'scroll', 'tvos', 'stage']):
            print(f'{i+1}: {l.strip()}')
