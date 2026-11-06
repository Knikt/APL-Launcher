with open('app/assets/tiles/catalog.js', 'r', encoding='utf-8') as f:
    text = f.read()

print('Length of tiles catalog:', len(text))
for l in text.splitlines()[:50]:
    print(l)
