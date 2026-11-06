import re

with open('app/style.css', 'r', encoding='utf-8') as f:
    css = f.read()

# 1. bd-img transitions
css = css.replace(
    'transition:opacity 600ms var(--ease-apple-out)',
    'transition:opacity 320ms var(--ease-apple-out)'
)
css = css.replace(
    '.bd-img.is-slide-in{transform:translate3d(0,0,0);transition:transform 900ms var(--ease-apple)}',
    '.bd-img.is-slide-in{transform:translate3d(0,0,0);transition:transform 380ms var(--ease-apple)}'
)
css = css.replace(
    '.bd-img.is-slide-out{transform:translate3d(-100%,0,0);transition:transform 900ms var(--ease-apple)}',
    '.bd-img.is-slide-out{transform:translate3d(-100%,0,0);transition:transform 380ms var(--ease-apple)}'
)

# 2. top-pill clipping mask to prevent rectangle artifacts
top_pill_target = """.top-pill {
  position: relative;
  height: 80px;
  padding: 6px;
  border-radius: 40px;"""
top_pill_repl = """.top-pill {
  position: relative;
  height: 80px;
  padding: 6px;
  border-radius: 40px;
  -webkit-mask-image: -webkit-radial-gradient(white, black);
  mask-image: radial-gradient(circle, #fff 100%, transparent 100%);"""
css = css.replace(top_pill_target, top_pill_repl)

# 3. pill-glass-stack bounds matching capsule instead of fixed 520px
css = re.sub(
    r'\.pill-glass-stack\s*\{[^}]+width:\s*520px;',
    r""".pill-glass-stack {
  position: absolute;
  left: -1.5px;
  top: -1.5px;
  right: -1.5px;
  bottom: -1.5px;
  width: auto;""",
    css
)

# 4. pill-glass transition
css = css.replace(
    'transition: opacity 600ms var(--ease-apple-out);',
    'transition: opacity 280ms var(--ease-apple-out);'
)

# 5. Dock and cards animation speed
css = css.replace(
    'transition: transform 420ms var(--ease-apple);',
    'transition: transform 280ms var(--ease-apple);'
)
css = css.replace(
    'transition: transform 320ms var(--ease-apple);',
    'transition: transform 260ms var(--ease-apple);'
)
css = css.replace(
    'transition: transform 400ms var(--ease-apple);',
    'transition: transform 260ms var(--ease-apple);'
)
css = css.replace(
    'transition: transform 400ms var(--ease-apple), opacity 400ms var(--ease-apple);',
    'transition: transform 260ms var(--ease-apple), opacity 260ms var(--ease-apple);'
)

# 6. ask-sheet transition
css = css.replace(
    'transition:transform 460ms cubic-bezier(.16,1.22,.32,1),width 300ms var(--ease-apple),',
    'transition:transform 320ms cubic-bezier(.16,1.22,.32,1),width 260ms var(--ease-apple),'
)

# 7. ask-head and ask-heard centering in keys mode
keys_head_target = """.ask[data-mode="keys"] .ask-orb,
.ask[data-mode="keys"] .ask-state{display:none}
.ask[data-mode="keys"] .ask-head{min-height:0;padding-bottom:6px}
/* The typed question sits in the middle of the card, over keys that are
   centred too; a left-aligned line over centred keys read as a stray label. */
.ask[data-mode="keys"] .ask-heard{font-size:34px;line-height:44px;font-weight:400;text-align:center}
.ask[data-mode="keys"] .ask-heard{margin-top:2px}"""

keys_head_repl = """.ask[data-mode="keys"] .ask-orb,
.ask[data-mode="keys"] .ask-state{display:none}
.ask[data-mode="keys"] .ask-head{min-height:0;padding-bottom:12px;display:flex;justify-content:center;align-items:center;text-align:center}
.ask[data-mode="keys"] .ask-copy{flex:none;width:100%;display:flex;justify-content:center;align-items:center;text-align:center}
.ask[data-mode="keys"] .ask-heard{font-size:34px;line-height:44px;font-weight:400;text-align:center;margin:0 auto;width:100%}"""
css = css.replace(keys_head_target, keys_head_repl)

# 8. ask-orb masking and ask-sheet non-keys background
orb_target = """.ask-orb{width:132px;height:132px;flex:none;margin:-18px 0 -8px -12px;display:block;
  border-radius:50%;overflow:hidden;background:transparent}"""
orb_repl = """.ask-orb{width:132px;height:132px;flex:none;margin:-18px 0 -8px -12px;display:block;
  border-radius:50%;overflow:hidden;background:transparent;
  -webkit-mask-image:-webkit-radial-gradient(white,black);
  mask-image:radial-gradient(circle,#fff 100%,transparent 100%)}
.ask[data-mode="listen"] .ask-sheet,
.ask[data-mode="thinking"] .ask-sheet,
.ask[data-mode="idle"] .ask-sheet{background:transparent!important;box-shadow:none!important;border:none!important}"""
css = css.replace(orb_target, orb_repl)

with open('app/style.css', 'w', encoding='utf-8') as f:
    f.write(css)

print('app/style.css patched!')
