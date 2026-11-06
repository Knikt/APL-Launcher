with open('app/assets/icons/metrics.js', 'r', encoding='utf-8') as f:
    text = f.read()

import json
marker = 'window.FrameIconMetrics = '
if marker in text:
    obj_str = text[text.index(marker)+len(marker):].rstrip().rstrip(';')
    metrics = json.loads(obj_str)
    print('home in metrics?', 'home' in metrics)
    if 'home' in metrics:
        print('home metrics:', metrics['home'])
    print('homecontrol in metrics?', 'homecontrol' in metrics)
