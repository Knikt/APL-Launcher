with open('app/main.js', 'r', encoding='utf-8') as f:
    text = f.read()

# Check PRIMARY_APPS
print("Checking PRIMARY_APPS...")
import re
m = re.search(r'var PRIMARY_APPS = \[.*?\];', text, re.S)
if m:
    print(m.group(0))
