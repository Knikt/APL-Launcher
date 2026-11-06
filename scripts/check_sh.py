with open('app/main.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, l in enumerate(lines):
    if "group === 'smarthome'" in l:
        for j in range(i, min(len(lines), i+30)):
            print(f'{j+1}: {lines[j]}', end='')
        break
