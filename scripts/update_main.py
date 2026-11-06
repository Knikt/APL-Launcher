with open('app/main.js', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Update HOME_TILE definition
old_home_tile = """  var HOME_TILE = (function () {
    var ha = window.CleanFrameHA || {};
    if (!ha.enabled) return null;
    return { id: 'homecontrol', name: 'Home', mark: true, builtin: true, home: true, icon: 'assets/icons/home.svg' };
  }());
  if (HOME_TILE) APPS.push(HOME_TILE);"""

new_home_tile = """  var HOME_TILE = { id: 'homecontrol', brand: 'home', name: 'Home', mark: true, builtin: true, home: true, icon: 'assets/icons/home.svg' };
  APPS.push(HOME_TILE);"""

assert old_home_tile in text, "old_home_tile not found in main.js"
text = text.replace(old_home_tile, new_home_tile)

# 2. Update launchApp for a.home
old_launch_home = """      if (a.home) {
        perform(a.name, function (done) {
          done(null);
          hideLaunch();
          openHomeApp();
          render();
        }, { card: appCardHtml(a), el: launchAnchorEl() });
        return;
      }"""

new_launch_home = """      if (a.home) {
        var kioskUrl = (window.CleanFrameHA && CleanFrameHA.dashboard) || 'http://192.168.0.162:8123/dashboard-kiosk/0';
        perform(a.name, function (done) {
          FrameDevice.openUrl(kioskUrl, done);
        }, { card: appCardHtml(a), el: launchAnchorEl() });
        return;
      }"""

assert old_launch_home in text, "old_launch_home not found in main.js"
text = text.replace(old_launch_home, new_launch_home)

# 3. Update appCardHtml to render Apple Home icon
old_card_brand = """    } else if (brand === 'netflix') {"""
new_card_brand = """    } else if (brand === 'home' || brand === 'homecontrol') {
      logoHtml = '<img src="assets/icons/home.svg" class="app-logo" style="width:115px;height:115px;" alt="Home">';
    } else if (brand === 'netflix') {"""

assert old_card_brand in text, "old_card_brand not found in main.js"
text = text.replace(old_card_brand, new_card_brand)

# 4. Update settingsOk to openAppearance instead of popping and freezing
old_settings_ok = """  function settingsOk(id) {
    /* Smart Home is the Home Assistant sheet, not another Settings pane. Close
       Settings first so the small devices pane lands over Home, where its glass
       can sample the wallpaper behind it, and Back returns to Home. */
    if (id === 'smarthome') { pop(); openHAPanel(); return; }
    openAppearance(id);
  }"""

new_settings_ok = """  function settingsOk(id) {
    openAppearance(id);
  }"""

assert old_settings_ok in text, "old_settings_ok not found in main.js"
text = text.replace(old_settings_ok, new_settings_ok)

# 5. Update DETAIL_NAMES
old_detail_names = """  var DETAIL_NAMES = {
    appearance: 'Appearance & Themes',"""

new_detail_names = """  var DETAIL_NAMES = {
    appearance: 'Appearance & Themes',
    smarthome: 'Smart Home & Devices',"""

assert old_detail_names in text, "old_detail_names not found in main.js"
text = text.replace(old_detail_names, new_detail_names)

# 6. Update choice() labels and descriptions
old_choice = """  function choice(axis, value, disabled, desc) {
    var label = axis === 'font' ? (FONTS[value] ? FONTS[value].name : value) :
                axis === 'mode' ? (MODES.filter(function (m) { return m.id === value; })[0] || {}).name :
                axis === 'soundvol' ? (value === 'subtle' ? 'Subtle (15%)' : value === 'high' ? 'High (55%)' : 'Standard (30%)') :
                axis === 'soundtheme' ? 'Google Material UI' :
                value === 'both' ? 'Icons and text' :
                value === 'icons' ? 'Icons only' :
                value === 'text' ? 'Text only' :
                value === 'glass' ? 'Glass Capsule' :
                value === 'type' ? 'Minimal Type' :
                value === 'soft' ? 'Soft Frosted' :
                value === 'frost' ? 'Pure Frost' :
                value === 'tint' ? 'Clear Tint' :
                VALUE_NAMES[value] || value;
    return {
      action: axis === 'mode' ? 'rotation.' + value :
              axis === 'soundvol' ? 'sound.vol.' + value :
              'choice.' + axis + '.' + value,
      axis: axis,
      value: value,
      disabled: !!disabled,
      label: label,
      description: desc || ''
    };
  }"""

new_choice = """  function choice(axis, value, disabled, desc) {
    var label = axis === 'font' ? (FONTS[value] ? FONTS[value].name : value) :
                axis === 'mode' ? (MODES.filter(function (m) { return m.id === value; })[0] || {}).name :
                axis === 'soundvol' ? (value === 'subtle' ? 'Subtle (15%)' : value === 'high' ? 'High (55%)' : 'Standard (30%)') :
                axis === 'soundtheme' ? 'Google Material UI' :
                axis === 'layout' ? (value === 'dock' ? 'Floating Glass Dock' : 'Vertical Left List') :
                axis === 'apps' ? (value === 'both' ? 'Icons & Titles' : value === 'icons' ? 'Icons Only' : 'Titles Only') :
                axis === 'focus' ? (value === 'glass' ? 'Luminous Glass Capsule' : 'Minimal Typographic') :
                axis === 'material' ? (value === 'soft' ? 'Soft Frosted Glass' : value === 'frost' ? 'Pure Frost Glass' : 'Clear Tint Glass') :
                axis === 'bg' ? (value === 'photo' ? 'Photo Artwork' : value === 'dark' ? 'Dark Mode (OLED)' : 'Light Mode (Gallery)') :
                VALUE_NAMES[value] || value;
    var defDesc = desc || (
      axis === 'layout' ? (value === 'dock' ? 'Horizontal glass dock floating along screen bottom' : 'Vertical minimalist list aligned to left edge') :
      axis === 'apps' ? (value === 'both' ? 'Display vector app logos with name titles' : 'Clean minimalist icon-only dock tiles') :
      axis === 'focus' ? (value === 'glass' ? 'Apple-style glowing frosted glass capsule highlight' : 'Bold high-contrast typographic focus') :
      axis === 'material' ? (value === 'soft' ? 'Smooth diffuse frosted glass with soft blur' : value === 'frost' ? 'High-contrast frosted glass with bright specular edge' : 'Light subtle translucent dark tint') :
      axis === 'bg' ? (value === 'photo' ? 'Full-resolution photography and museum artwork' : value === 'dark' ? 'Deep dark OLED ground for evening viewing' : 'Soft ambient gallery illumination') : ''
    );
    return {
      action: axis === 'mode' ? 'rotation.' + value :
              axis === 'soundvol' ? 'sound.vol.' + value :
              'choice.' + axis + '.' + value,
      axis: axis,
      value: value,
      disabled: !!disabled,
      label: label,
      description: defDesc
    };
  }"""

assert old_choice in text, "old_choice not found in main.js"
text = text.replace(old_choice, new_choice)

# 7. Update detailSections for appearance and add smarthome
old_appearance_sections = """    if (t.group === 'appearance') return [
      { id: 'font', title: 'Typography', items: options('font', LOOK_VALUES.font) },
      { id: 'bg', title: 'Wallpaper & Background', items: [
        { action: 'background.wallpaper', label: 'Choose Wallpaper (' + wall(S.c.wall).name + ')', thumbnail: true },
        choice('bg', 'photo'),
        choice('bg', 'dark'),
        choice('bg', 'light'),
        { action: 'background.rotation', label: 'Rotation: ' + mode().name, disabled: flat }
      ] },
      { id: 'layout', title: 'Interface & Dock', items: [
        choice('layout', 'dock'),
        choice('layout', 'list'),
        choice('apps', 'both'),
        choice('apps', 'icons'),
        choice('focus', 'glass'),
        choice('focus', 'type'),
        choice('material', 'soft', inactive),
        choice('material', 'frost', inactive),
        choice('material', 'tint', inactive)
      ] }
    ];"""

new_appearance_sections = """    if (t.group === 'appearance') return [
      { id: 'font', title: 'Typography', items: options('font', LOOK_VALUES.font) },
      { id: 'bg', title: 'Wallpaper & Theme', items: [
        { action: 'background.wallpaper', label: 'Choose Wallpaper', value: wall(S.c.wall).name, desc: 'Browse landscape photography and museum art gallery.', thumbnail: true },
        choice('bg', 'photo'),
        choice('bg', 'dark'),
        choice('bg', 'light'),
        { action: 'background.rotation', label: 'Wallpaper Rotation', value: mode().name, desc: 'Automatically cycle wallpaper gallery at regular intervals.', disabled: flat }
      ] },
      { id: 'layout', title: 'Dock Layout', items: [
        choice('layout', 'dock'),
        choice('layout', 'list')
      ] },
      { id: 'apps', title: 'App Tile Style', items: [
        choice('apps', 'both'),
        choice('apps', 'icons')
      ] },
      { id: 'focus', title: 'Focus Highlight Style', items: [
        choice('focus', 'glass'),
        choice('focus', 'type')
      ] },
      { id: 'material', title: 'Glass Material & Refraction', items: [
        choice('material', 'soft', inactive),
        choice('material', 'frost', inactive),
        choice('material', 'tint', inactive)
      ], reason: inactive ? (flat ? 'Glass materials require Photo Artwork wallpaper.' : 'Choose Luminous Glass focus to use materials.') : '' }
    ];
    if (t.group === 'smarthome') {
      var ha = window.CleanFrameHA || {};
      var online = ha.isOnline ? ha.isOnline() : ha.enabled;
      var host = (ha.dashboard || 'http://192.168.0.162:8123').replace(/\/dashboard-kiosk.*$/, '');
      var kioskUrl = ha.dashboard || 'http://192.168.0.162:8123/dashboard-kiosk/0';
      var devCount = (ha.ROOMS || []).reduce(function (acc, r) { return acc + (r.devices || []).length; }, 0);
      return [
        { id: 'hastatus', title: 'Home Assistant Connection', items: [
          { action: 'smarthome.info', label: 'Connection Status', value: online ? 'Online' : 'Connected', desc: 'Home Assistant instance active at ' + host + '.', disabled: true },
          { action: 'smarthome.kiosk', label: 'Launch Kiosk Dashboard', value: 'Open >', desc: 'Open full-screen Home Assistant kiosk dashboard (' + kioskUrl + ') in TV browser.' }
        ] },
        { id: 'hadevices', title: 'Smart Home Devices (' + (devCount || 5) + ' Configured)', items: [
          { action: 'smarthome.panel', label: 'Quick Devices Overlay', value: 'Open >', desc: 'Open quick-access device controls popup for lights, AC, and fans.' }
        ] }
      ];
    }"""

assert old_appearance_sections in text, "old_appearance_sections not found in main.js"
text = text.replace(old_appearance_sections, new_appearance_sections)

# 8. Update detailOk for smarthome actions
old_detail_ok = """    else if (item.action.indexOf('dock.manage.') === 0) {"""
new_detail_ok = """    else if (item.action === 'smarthome.kiosk') {
      var kioskUrl = (window.CleanFrameHA && CleanFrameHA.dashboard) || 'http://192.168.0.162:8123/dashboard-kiosk/0';
      FrameDevice.openUrl(kioskUrl, function () {});
    }
    else if (item.action === 'smarthome.panel') {
      pop();
      openHAPanel();
    }
    else if (item.action.indexOf('dock.manage.') === 0) {"""

assert old_detail_ok in text, "old_detail_ok not found in main.js"
text = text.replace(old_detail_ok, new_detail_ok)

# 9. Update itemHeroInfo
old_hero = """    if (group === 'remotes') return { icon: 'remote', desc: 'Manage TV remote navigation, quick actions, and native Samsung controls.' };"""
new_hero = """    if (group === 'smarthome' || item.action.indexOf('smarthome.') === 0) return { icon: 'home', desc: item.desc || 'Home Assistant integration for air conditioning, fans, lights, and room controls.' };
    if (group === 'remotes') return { icon: 'remote', desc: 'Manage TV remote navigation, quick actions, and native Samsung controls.' };"""

assert old_hero in text, "old_hero not found in main.js"
text = text.replace(old_hero, new_hero)

# 10. Update openSettings and openAppearance to resetStageScroll
old_open_settings = """  function openSettings() { push({ id: 'settings', f: { id: S.settingsFocus } }); }"""
new_open_settings = """  function openSettings() { resetStageScroll(); push({ id: 'settings', f: { id: S.settingsFocus } }); }"""
assert old_open_settings in text, "old_open_settings not found in main.js"
text = text.replace(old_open_settings, new_open_settings)

old_open_app = """  function openAppearance(group) {
    var axis = {"""
new_open_app = """  function openAppearance(group) {
    resetStageScroll();
    var axis = {"""
assert old_open_app in text, "old_open_app not found in main.js"
text = text.replace(old_open_app, new_open_app)

# 11. Add key repeat throttling in keydown
old_keydown = """  document.addEventListener('keydown', function (ev) {
    var code = ev.keyCode, k = KEYS[code];
    if (code === 9) { ev.preventDefault(); return; }"""

new_keydown = """  var lastDpadRepeatTime = 0;
  var MIN_DPAD_REPEAT_MS = 145;
  document.addEventListener('keydown', function (ev) {
    var code = ev.keyCode, k = KEYS[code];
    if (code === 9) { ev.preventDefault(); return; }
    if (k === 'left' || k === 'right' || k === 'up' || k === 'down') {
      var now = Date.now();
      if (ev.repeat && (now - lastDpadRepeatTime < MIN_DPAD_REPEAT_MS)) {
        ev.preventDefault();
        return;
      }
      lastDpadRepeatTime = now;
    }"""

assert old_keydown in text, "old_keydown not found in main.js"
text = text.replace(old_keydown, new_keydown)

# 12. Speed up hideBoot
old_hide_boot = """  function hideBoot() {
    var b = $('boot');
    if (!b) return;
    b.className = 'is-off';
    setTimeout(function () { if (b.parentNode) b.parentNode.removeChild(b); }, 320);
  }"""

new_hide_boot = """  function hideBoot() {
    var b = $('boot');
    if (!b) return;
    b.className = 'is-off';
    setTimeout(function () { if (b.parentNode) b.parentNode.removeChild(b); }, 120);
  }"""

assert old_hide_boot in text, "old_hide_boot not found in main.js"
text = text.replace(old_hide_boot, new_hide_boot)

with open('app/main.js', 'w', encoding='utf-8') as f:
    f.write(text)

print("Successfully updated app/main.js")
