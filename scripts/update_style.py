with open('app/style.css', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Update scene transform in at-appearance
old_scene = """.at-appearance .scene,.at-wallpaper .scene{z-index:2;transform:translate3d(858px,288px,0) scale(.48);border-radius:32px;pointer-events:none}
.bg-dark.at-appearance .scene,.bg-light.at-appearance .scene{box-shadow:0 0 0 4px var(--line)}"""

new_scene = """.at-wallpaper .scene{z-index:2;transform:translate3d(858px,288px,0) scale(.48);border-radius:32px;pointer-events:none}
.at-settings .scene,.at-appearance:not(.at-wallpaper) .scene{display:none!important}
.bg-dark.at-wallpaper .scene,.bg-light.at-wallpaper .scene{box-shadow:0 0 0 4px var(--line)}"""

assert old_scene in text, "old_scene not found in style.css"
text = text.replace(old_scene, new_scene)

# 2. Update .sheet and .appearance z-index and background
old_sheet = """  .stage.is-sheet .sheet {
    transform: translateY(0);
    opacity: 1;
  }"""

new_sheet = """  .stage.is-sheet .sheet {
    transform: translateY(0);
    opacity: 1;
    z-index: 100;
  }"""

assert old_sheet in text, "old_sheet not found in style.css"
text = text.replace(old_sheet, new_sheet)

old_app = """.appearance {
  position: absolute;
  z-index: 4;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  background: #090c10;
  pointer-events: auto;
}"""

new_app = """.appearance {
  position: absolute;
  z-index: 100;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  background: radial-gradient(ellipse 1200px 800px at 50% 25%, #1c2a36, #0a0e14);
  pointer-events: auto;
}"""

assert old_app in text, "old_app not found in style.css"
text = text.replace(old_app, new_app)

# 3. Add backdrop-filter to .appletv-fullscreen-blur and .appletv-first-row-glass
old_blur = """.appletv-fullscreen-blur {
  position: absolute;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  width: 1920px;
  height: 1080px;
  background: linear-gradient(
    180deg,
    rgba(225, 235, 245, 0.28) 0%,
    rgba(16, 24, 36, 0.42) 100%
  );
  z-index: 10;
  opacity: 0;
  pointer-events: none;
  background: rgba(10, 15, 24, 0.55);
  transition: opacity 180ms ease;
}"""

new_blur = """.appletv-fullscreen-blur {
  position: absolute;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  width: 1920px;
  height: 1080px;
  background: rgba(10, 15, 24, 0.65);
  -webkit-backdrop-filter: blur(28px) saturate(180%);
  backdrop-filter: blur(28px) saturate(180%);
  z-index: 10;
  opacity: 0;
  pointer-events: none;
  transition: opacity 200ms ease;
}"""

assert old_blur in text, "old_blur not found in style.css"
text = text.replace(old_blur, new_blur)

old_first_row = """.appletv-first-row-glass {
  position: absolute;
  top: -40px;
  bottom: -52px;
  left: -38px;
  right: -38px;
  border-radius: 58px;
  background: rgba(255, 255, 255, 0.20);
  border: 1.5px solid rgba(255, 255, 255, 0.38);"""

new_first_row = """.appletv-first-row-glass {
  position: absolute;
  top: -40px;
  bottom: -52px;
  left: -38px;
  right: -38px;
  border-radius: 58px;
  background: rgba(255, 255, 255, 0.20);
  -webkit-backdrop-filter: blur(24px) saturate(160%);
  backdrop-filter: blur(24px) saturate(160%);
  border: 1.5px solid rgba(255, 255, 255, 0.38);"""

assert old_first_row in text, "old_first_row not found in style.css"
text = text.replace(old_first_row, new_first_row)

# 4. Refine dock scroll timing for buttery smoothness
old_scroll_trans = """.appletv-dock-scroll {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  transition: transform 260ms var(--ease-apple);
  will-change: transform;
  pointer-events: auto;
}"""

new_scroll_trans = """.appletv-dock-scroll {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  transition: transform 180ms cubic-bezier(.16, 1, .3, 1);
  will-change: transform;
  pointer-events: auto;
}"""

assert old_scroll_trans in text, "old_scroll_trans not found in style.css"
text = text.replace(old_scroll_trans, new_scroll_trans)

with open('app/style.css', 'w', encoding='utf-8') as f:
    f.write(text)

print("Successfully updated app/style.css")
