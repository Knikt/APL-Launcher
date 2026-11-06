with open('app/index.html', 'r', encoding='utf-8') as f:
    text = f.read()

old_boot_css = '#boot{position:fixed;left:0;top:0;right:0;bottom:0;background:#0d0d0d;z-index:9999;display:flex;align-items:center;justify-content:center;transition:opacity 260ms linear}'
new_boot_css = '#boot{position:fixed;left:0;top:0;right:0;bottom:0;background:#0d0d0d;z-index:9999;display:flex;align-items:center;justify-content:center;transition:opacity 120ms ease;pointer-events:none}'

assert old_boot_css in text, "old_boot_css not found in index.html"
text = text.replace(old_boot_css, new_boot_css)

with open('app/index.html', 'w', encoding='utf-8') as f:
    f.write(text)

print("Successfully updated app/index.html")
