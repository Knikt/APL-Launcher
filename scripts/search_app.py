with open('app/main.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, l in enumerate(lines):
    if any(k in l for k in ['openHomeApp', 'home-app', 'CleanFrameHomeApp', 'launchApp', 'FrameDevice.launch', 'apps.open']):
        print(f'{i+1}: {l.strip()}')
