with open('app/style.css', 'r', encoding='utf-8') as f:
    text = f.read()

# Update tvos-settings and appearance backgrounds
text = text.replace(
    "background: radial-gradient(ellipse 1200px 800px at 50% 25%, #1c2a36, #0a0e14);",
    "background: radial-gradient(ellipse 1400px 1000px at 50% 18%, #26384a 0%, #16222e 55%, #0c141d 100%);"
)

# Update tvos-title color
text = text.replace(
    "color: rgba(255, 255, 255, 0.40);",
    "color: rgba(255, 255, 255, 0.85);"
)

# Update tvos-back-btn
old_back = """.tvos-back-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 48px;
  padding: 0 18px 0 12px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.85);"""

new_back = """.tvos-back-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 48px;
  padding: 0 18px 0 12px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.14);
  border: 1px solid rgba(255, 255, 255, 0.14);
  color: #ffffff;"""

assert old_back in text, "old_back not in style.css"
text = text.replace(old_back, new_back)

# Update hero card and description
old_hero_card = """.tvos-hero-card {
  width: 340px;
  height: 340px;
  border-radius: 76px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45), inset 0 1px 1px rgba(255, 255, 255, 0.15);"""

new_hero_card = """.tvos-hero-card {
  width: 340px;
  height: 340px;
  border-radius: 76px;
  background: rgba(255, 255, 255, 0.13);
  border: 1.5px solid rgba(255, 255, 255, 0.20);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45), inset 0 1px 1px rgba(255, 255, 255, 0.25);"""

assert old_hero_card in text, "old_hero_card not in style.css"
text = text.replace(old_hero_card, new_hero_card)

# Update hero icon
old_hero_ico = """.tvos-hero-icon .ico {
  width: 140px;
  height: 140px;
  stroke-width: 1.5;
  color: rgba(255, 255, 255, 0.88);
}"""

new_hero_ico = """.tvos-hero-icon .ico {
  width: 140px;
  height: 140px;
  stroke-width: 1.5;
  color: #ffffff;
}"""

assert old_hero_ico in text, "old_hero_ico not in style.css"
text = text.replace(old_hero_ico, new_hero_ico)

# Update hero desc
old_hero_desc = """.tvos-hero-desc {
  margin-top: 36px;
  max-width: 480px;
  min-height: 72px;
  font-size: 24px;
  line-height: 36px;
  font-weight: 400;
  color: rgba(255, 255, 255, 0.50);"""

new_hero_desc = """.tvos-hero-desc {
  margin-top: 36px;
  max-width: 480px;
  min-height: 72px;
  font-size: 24px;
  line-height: 36px;
  font-weight: 400;
  color: rgba(255, 255, 255, 0.78);"""

assert old_hero_desc in text, "old_hero_desc not in style.css"
text = text.replace(old_hero_desc, new_hero_desc)

# Update section headers
old_sec_header = """.tvos-section-header {
  font-size: 19px;
  line-height: 24px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(255, 255, 255, 0.38);"""

new_sec_header = """.tvos-section-header {
  font-size: 19px;
  line-height: 24px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(255, 255, 255, 0.65);"""

assert old_sec_header in text, "old_sec_header not in style.css"
text = text.replace(old_sec_header, new_sec_header)

# Update tvos-row / setting-choice
old_row = """.tvos-row, .setting-choice {
  position: relative;
  width: 100%;
  height: 64px;
  min-height: 64px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.10);
  border: 1px solid rgba(255, 255, 255, 0.05);
  padding: 0 24px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  color: rgba(255, 255, 255, 0.92);"""

new_row = """.tvos-row, .setting-choice {
  position: relative;
  width: 100%;
  height: 64px;
  min-height: 64px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.14);
  border: 1px solid rgba(255, 255, 255, 0.10);
  padding: 0 24px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  color: #ffffff;"""

assert old_row in text, "old_row not in style.css"
text = text.replace(old_row, new_row)

# Update tvos-row-value and chevron
old_vals = """.tvos-row-value {
  font-size: 24px;
  line-height: 30px;
  font-weight: 400;
  color: rgba(255, 255, 255, 0.42);
  white-space: nowrap;
}

.tvos-row-chevron {
  width: 20px;
  height: 20px;
  color: rgba(255, 255, 255, 0.30);"""

new_vals = """.tvos-row-value {
  font-size: 24px;
  line-height: 30px;
  font-weight: 400;
  color: rgba(255, 255, 255, 0.72);
  white-space: nowrap;
}

.tvos-row-chevron {
  width: 20px;
  height: 20px;
  color: rgba(255, 255, 255, 0.55);"""

assert old_vals in text, "old_vals not in style.css"
text = text.replace(old_vals, new_vals)

with open('app/style.css', 'w', encoding='utf-8') as f:
    f.write(text)

print("Successfully brightened settings styles in app/style.css")
