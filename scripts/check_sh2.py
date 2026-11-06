with open('app/main.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i in range(1370, 1430):
    print(f'{i+1}: {lines[i]}', end='')
