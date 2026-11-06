with open('app/main.js', 'r', encoding='utf-8') as f:
    js = f.read()

# 1. Faster slide animations
js = js.replace('var SLIDE_MS = 900;', 'var SLIDE_MS = 380;')
js = js.replace('slide ? SLIDE_MS + 40 : 640', 'slide ? SLIDE_MS + 40 : 360')
js = js.replace('if (!inBackdropSync) setTimeout(render, SLIDE_MS);', 'if (!inBackdropSync) setTimeout(render, SLIDE_MS);')

# 2. Pill glass seamless transition (do not strip has-glass while loading new slice)
old_sync = """    src = pillGlassSrc();
    if (!src) {
      topPill.classList.remove('has-glass');
      pillGlassClear(statusPillGlass);
      if (statusPillGlassNext) pillGlassClear(statusPillGlassNext);
      pillGlassLive = statusPillGlass;
      return;
    }
    topPill.classList.add('has-glass');"""

new_sync = """    src = pillGlassSrc();
    if (!src) {
      if (!pillFrostUrl && S.c && S.c.bg !== 'photo') {
        topPill.classList.remove('has-glass');
        pillGlassClear(statusPillGlass);
        if (statusPillGlassNext) pillGlassClear(statusPillGlassNext);
        pillGlassLive = statusPillGlass;
      }
      return;
    }
    topPill.classList.add('has-glass');"""

js = js.replace(old_sync, new_sync)

js = js.replace(
    'live._retire = setTimeout(function () { pillGlassClear(live); }, 640);',
    'live._retire = setTimeout(function () { pillGlassClear(live); }, 320);'
)

# 3. Defer backdrop row prefetch to 3200ms on startup so cold start is completely smooth
js = js.replace(
    'setTimeout(syncBackdropRow, 600);',
    'setTimeout(syncBackdropRow, 3200);'
)

with open('app/main.js', 'w', encoding='utf-8') as f:
    f.write(js)

print('app/main.js patched!')
