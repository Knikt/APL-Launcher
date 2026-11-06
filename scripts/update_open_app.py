with open('app/main.js', 'r', encoding='utf-8') as f:
    text = f.read()

# Check openAppearance
old_open_app = """  function openAppearance(group) {
    resetStageScroll();
    var axis = { background: 'bg', layout: 'layout', typography: 'font', focus: 'focus' }[group];
    var action = S.detailFocus[group] || (axis ? 'choice.' + axis + '.' + S.c[axis] : group === 'rotation' ? 'rotation.' + S.c.mode : 'samsung.home'),
      air = window.CleanFrameAerial;
    /* The screen saver opens on the theme in use rather than on whatever was
       touched last: coming back to a list half way down its videos is not a
       view anyone can read. This is set once, as the view opens - deciding it
       on every render would undo each press of Down. */
    if (group === 'aerial' && air) action = 'choice.aerial.' + air.get('theme');
    push({ id: 'appearance', group: group, f: { action: action } });
  }"""

new_open_app = """  function openAppearance(group) {
    resetStageScroll();
    var t = { id: 'appearance', group: group, f: { action: '' } };
    var rows = detailRows(t);
    var firstAction = '';
    if (rows.length > 1 && rows[1].length && rows[1][0].action) {
      firstAction = rows[1][0].action;
    } else if (rows.length && rows[0].length && rows[0][0].action !== 'settings.back') {
      firstAction = rows[0][0].action;
    }
    var axis = { background: 'bg', layout: 'layout', typography: 'font', focus: 'focus' }[group];
    var action = S.detailFocus[group] || (axis ? 'choice.' + axis + '.' + S.c[axis] : group === 'rotation' ? 'rotation.' + S.c.mode : firstAction);
    var air = window.CleanFrameAerial;
    if (group === 'aerial' && air) action = 'choice.aerial.' + air.get('theme');
    t.f.action = action || firstAction;
    push(t);
  }"""

assert old_open_app in text, "old_open_app not found in main.js"
text = text.replace(old_open_app, new_open_app)

with open('app/main.js', 'w', encoding='utf-8') as f:
    f.write(text)

print("Updated openAppearance focus logic in main.js")
