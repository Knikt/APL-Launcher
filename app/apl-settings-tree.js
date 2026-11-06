/* ============================================================
   apl-settings-tree.js — what the ported Settings app lists.

   APL Launcher's own tree, kept where CleanFrame can back the row with the
   screen itself, and left out where the row belonged to APL Launcher's own
   features (household profiles, the aerial screen saver, its app grid, its
   automatic updates) — a row that opens nothing is worse than no row.

   Entry types are theirs: menu, info, toggle, choice, volume, mute, action,
   tv (a real picture setting, left/right), tvmode (real picture mode), game,
   native (another real setting of the screen), samsung (the screen's own
   settings, the fallback for everything it keeps to itself).
   ============================================================ */
(function (global) {
  'use strict';

  var APL = global.APL, sys = APL.sys, t = APL.t;

  function menu(label, icon, children, desc) { return { type: 'menu', label: label, icon: icon, children: children, desc: desc }; }
  function info(label, get, desc) { return { type: 'info', label: label, get: get, desc: desc }; }
  function toggle(label, key, desc) { return { type: 'toggle', label: label, key: key, desc: desc }; }
  function action(label, run, desc, icon) { return { type: 'action', label: label, run: run, desc: desc, icon: icon }; }
  function n(id, label, desc, options, format) {
    return { type: 'native', id: id, label: label, desc: desc, options: options, format: format };
  }
  function tv(id, label, desc) { return { type: 'tv', id: id, label: label, desc: desc }; }
  function choice(label, key, options, desc, apply) {
    return { type: 'choice', label: label, key: key, options: options, desc: desc, apply: apply };
  }
  /* A choice whose value lives in the app rather than in these preferences. */
  function appChoice(label, read, write, options, desc) {
    return { type: 'choice', label: label, key: 'cf.app', read: read, write: write, options: options, desc: desc };
  }
  /* CleanFrame's own settings pages, opened in the app (main.js keeps them). */
  function appPage(label, group, desc, icon) {
    return action(label, function () {
      APL.settings.close();
      if (global.CleanFrameSettings) global.CleanFrameSettings.open(group);
    }, desc, icon);
  }
  /* Rows for the launcher's own look, drawn by this shell: each one reads the
     live value and writes it back through CleanFrameSettings, so the change is
     the launcher's, not a preference of this port. */
  function cf() { return global.CleanFrameSettings; }
  function cfValue(field) { var s = cf(); return s && s.look ? s.look()[field] : ''; }
  function cfSet(field) {
    return function (v) { var s = cf(); if (s && s.set) s.set((function () { var p = {}; p[field] = v; return p; })()); };
  }
  function cfChoice(label, field, options, desc) {
    return appChoice(label, function () { return cfValue(field); }, cfSet(field), options, desc);
  }
  function wallChoice() {
    var s = cf(), list = s && s.walls ? s.walls() : [];
    return appChoice(t('Wallpaper'), function () { return cfValue('wall'); }, cfSet('wall'),
      list.map(function (w) { return [w.id, w.name]; }),
      t('The photograph behind the Home screen.'));
  }
  function fontChoice() {
    var s = cf(), list = s && s.fonts ? s.fonts() : [];
    return appChoice(t('Font'), function () { return cfValue('font'); }, cfSet('font'),
      list.map(function (f) { return [f.id, f.name]; }),
      t('The face the Home screen is set in.'));
  }
  function appearanceNow() { return global.CleanFrameSettings ? global.CleanFrameSettings.appearance() : 'photo'; }
  function appearanceSet(v) { if (global.CleanFrameSettings) global.CleanFrameSettings.setAppearance(v); }
  var ON_OFF = [[0, t('Off')], [1, t('On')]];

  function tintText(v) { return v === 15 ? '0/0' : v < 15 ? t('G{n}', { n: 15 - v }) : 'R' + (v - 15); }
  function signed(v) { return v > 0 ? '+' + v : String(v); }
  function balanceText(v) { return v === 10 ? t('Center') : v < 10 ? t('L{n}', { n: 10 - v }) : t('R{n}', { n: v - 10 }); }
  function eqText(v) { return signed((v - 50) / 10); }
  function delayText(v) { return v + ' ms'; }

  function confirmReset(title, message, run) {
    return function () {
      APL.alert({
        title: title, message: message, focus: 0,
        buttons: [
          { label: t('Cancel') },
          { label: t('Reset'), destructive: true, run: function () {
            run().then(function () { APL.toast(t('Settings restored'), true); }, function (e) { APL.toast(e.message); });
          } }
        ]
      });
    };
  }

  function openAudio() { APL.settings.close(); APL.controlCenter.openAudio(); }
  function openSources() { APL.settings.close(); if (APL.sources) APL.sources.open(); }

  function build() {
    return menu(t('Settings'), 'display', [

      action(t('Control Center'), function () { APL.settings.close(); APL.controlCenter.open(); },
        t('Also opens with the ⏯ button on the remote, or by holding Home.'), 'sliders'),

      /* -------- CleanFrame: the app's own settings -------- */
      menu(t('CleanFrame'), 'apps', [
        action(t('Profiles & Viewers'), function () { APL.settings.close(); if (APL.profilesUI) APL.profilesUI.open(); },
          t('Each person keeps their own Home Screen, wallpaper and recently opened apps.'), 'person'),
        action(t('Search'), function () { APL.settings.close(); if (global.CleanFrameSettings) global.CleanFrameSettings.search(); },
          t('Apps, movies, shows and YouTube. The capsule used to carry a search icon; the pill is the clock and the profile now.'), 'wifi'),
        appChoice(t('Appearance'), appearanceNow, appearanceSet,
          [['light', t('Light')], ['dark', t('Dark')], ['photo', t('Photo Artwork')]],
          t('Light or dark for the settings and panels, or the wallpaper behind them. Changes right away.')),
        menu(t('Wallpaper & Theme'), 'photo', [
          cfChoice(t('Background'), 'bg', [['photo', t('Photo Artwork')], ['dark', t('Dark')], ['light', t('Light')]],
            t('Photography and museum artwork, or the plain dark and light grounds.')),
          wallChoice(),
          cfChoice(t('Home Controls'), 'controls', [['both', t('Icons and Text')], ['icons', t('Icons')], ['text', t('Text')]],
            t('How the Home screen names its controls.'))
        ], t('The wallpaper, the ground behind it and the Home screen controls.')),
        menu(t('Layout & Display'), 'grid', [
          cfChoice(t('Layout'), 'layout', [['dock', t('Dock')], ['list', t('List')]],
            t('The floating dock or the vertical list on the Home screen.')),
          cfChoice(t('App Tiles'), 'apps', [['both', t('Icons and Text')], ['icons', t('Icons')], ['text', t('Text')]],
            t('How an app names itself on the Home screen.'))
        ], t('The Home screen layout and its tiles.')),
        menu(t('Typography'), 'globe', [
          fontChoice()
        ], t('The font family of the Home screen.')),
        menu(t('Focus & Materials'), 'sparkle', [
          cfChoice(t('Focus'), 'focus', [['glass', t('Glass')], ['type', t('Type')]],
            t('Whether focus is a pane of glass or the type itself.')),
          cfChoice(t('Material'), 'material', [['soft', t('Soft')], ['frost', t('Frost')], ['tint', t('Tint')]],
            t('The finish of the Home screen glass.'))
        ], t('How focus looks, and the glass material.')),
        appPage(t('Wallpaper Rotation'), 'rotation', t('How often the wallpaper changes.'), 'update'),
        appPage(t('Screen Saver'), 'aerial', t('The Aerial screen saver, its themes and its idle time.'), 'photo'),
        appPage(t('Sound & Audio'), 'sound', t('Interface sounds and their volume.'), 'sound'),
        appPage(t('Apps on the Home Dock'), 'editor', t('Add, remove and reorder the apps on the dock.'), 'apps'),
        appPage(t('Smart Home & Devices'), 'smarthome', t('The Home Assistant connection and its dashboard.'), 'sparkle'),
        appPage(t('Home & Control Centre'), 'homedevices', t('Which room devices the Home app and the Control Center show.'), 'source'),
        appPage(t('All App Settings'), null, t('The full CleanFrame settings menu.'), 'gear')
      ], t('Appearance, wallpaper, layout, fonts and the smart home.')),

      /* -------- Picture -------- */
      menu(t('Picture'), 'display', [
        { type: 'tvmode', label: t('Picture Mode'), desc: t('Dynamic, Standard, Eco, Movie. Changes right away. Each mode keeps its own settings.') },
        tv('backlight', t('Backlight'), t('Screen brightness. ◀ ▶ to adjust, live.')),
        tv('contrast', t('Contrast'), t('◀ ▶ to adjust, live.')),
        tv('sharpness', t('Sharpness'), t('◀ ▶ to adjust, live.')),
        tv('color', t('Color'), t('Color saturation. ◀ ▶ to adjust, live.')),
        menu(t('Eye Care'), 'sparkle', [
          n('eyeSaver', t('Eye Saver Mode'), t('Reduces blue light.'), ON_OFF),
          n('adaptive', t('Adaptive Picture'), t('Adjusts the picture to the light in the room.'), ON_OFF)
        ], t('Eye protection and adaptive picture.')),
        menu(t('Expert Settings'), 'sliders', [
          n('tint', t('Tint (G/R)'), t('◀ ▶ to adjust, live.'), null, tintText),
          n('contrastUp', t('Contrast Enhancer'), t('Adjusts the picture\'s contrast automatically.'),
            [[0, t('Disabled')], [1, t('Low')], [3, t('High')]]),
          n('shadow', t('Shadow Detail'), t('Brightens or darkens the dark areas.'), null, signed),
          n('gamma', t('Gamma'), t('BT.1886 curve: darker or brighter in the midtones.'), null, signed),
          n('colorSpace', t('Color Space'), t('Auto follows the source, Native uses all the colors of the screen.'),
            [[0, t('Auto')], [1, t('Native')]]),
          n('colorTone', t('Color Tone'), t('Cool leans blue, warm leans red.'),
            [[1, t('Cool')], [2, t('Standard')], [5, t('Warm1')], [6, t('Warm2')]]),
          n('clarity', t('Picture Clarity'), t('Smooths moving pictures.'),
            [[0, t('Disabled')], [2, t('Auto')], [4, t('Custom')]]),
          n('blur', t('Blur Reduction'), t('In Custom mode.'), null),
          n('judder', t('Judder Reduction'), t('In Custom mode.'), null),
          action(t('Reset Picture'),
            confirmReset(t('Reset Picture?'),
              t('Restores the factory values of the current picture mode, brightness included.'),
              function () { return sys.native.reset('ResetPicture'); }),
            t('Restores all picture settings to their default values.'), 'reset')
        ], t('Fine-tuning of the picture.')),
        info(t('Screen Resolution'), sys.display),
        info('HDR', function () { return sys.hdr(); })
      ], t('Picture Mode, colors and fine-tuning.')),

      /* -------- Gaming -------- */
      menu(t('Gaming'), 'gamepad', [
        { type: 'game', label: t('Game Mode'),
          desc: t('Reduces latency for consoles and PCs on HDMI and USB-C. OK to change.') }
      ], t('Game Mode.')),

      /* -------- Sound -------- */
      menu(t('Sound'), 'speaker', [
        { type: 'volume', label: t('Volume'), desc: t('◀ ▶ to adjust. The screen\'s real setting.') },
        { type: 'mute', label: t('Mute'), desc: t('Turns the sound off or back on.') },
        info(t('Digital Output Audio Format'), function () { return sys.audio.outputMode(); }),
        action(t('Sound Output'), openAudio,
          t('Screen speakers, AirPods, Bluetooth headphones and speakers.'), 'speaker'),
        n('soundMode', t('Sound Mode'), t('Amplify boosts voices and volume.'),
          [[1, t('Standard')], [5, t('Amplify')]]),
        n('autoVolume', t('Auto Volume'), t('Evens out the volume between sources.'),
          [[0, t('Disabled')], [1, t('Normal')], [2, t('Night')]]),
        menu(t('Expert Settings'), 'sound', [
          n('balance', t('Balance'), t('◀ ▶ toward the left or the right.'), null, balanceText),
          n('eq0', t('Equalizer: 100 Hz'), t('Bass.'), null, eqText),
          n('eq1', t('Equalizer: 300 Hz'), '', null, eqText),
          n('eq2', t('Equalizer: 1 kHz'), t('Voices.'), null, eqText),
          n('eq3', t('Equalizer: 3 kHz'), '', null, eqText),
          n('eq4', t('Equalizer: 10 kHz'), t('Treble.'), null, eqText),
          action(t('Reset Equalizer'),
            confirmReset(t('Reset Equalizer?'), t('All bands go back to the center.'),
              function () { return sys.native.reset('ResetEqualizer'); }), '', 'reset'),
          n('delay', t('Digital Output Audio Delay'), t('Fixes the lag between picture and sound.'), null, delayText),
          n('earc', t('HDMI-eARC Mode'), t('For a soundbar on HDMI-eARC.'), ON_OFF),
          n('feedback', t('Sound Feedback'), t('The sounds of the Samsung menus.'),
            [[0, t('Disabled')], [1, t('Low')], [2, t('Medium')], [3, t('High')]])
        ], t('Balance, equalizer, eARC, audio delay.'))
      ], t('Sound Output, Sound Mode, equalizer.')),

      /* -------- Connection -------- */
      menu(t('Connection'), 'wifi', [
        menu(t('Network'), 'wifi', [
          info(t('Status'), function () { return sys.network().connected ? t('Connected') : t('Disconnected'); }),
          info(t('Connection Type'), function () { return sys.network().type; }),
          info(t('Network Name'), function () { return sys.network().ssid; }),
          info(t('Signal Strength'), function () {
            var n = sys.network();
            return n.type === 'Wi-Fi' ? n.signal + ' / 5' : '—';
          }),
          info(t('IP Address'), function () { return sys.network().ip; }),
          info(t('MAC Address'), function () { return sys.network().mac; }),
          info(t('Gateway'), function () { return sys.network().gateway; }),
          info(t('DNS Server'), function () { return sys.network().dns; }),
          action(t('Change Network'), function () {
            APL.settings.close();
            if (global.CleanFramePanels) global.CleanFramePanels.network();
          }, t('The networks the screen already knows, and the one to join.'), 'wifi')
        ], t('Network status and addresses.')),
        action('Bluetooth', openAudio, t('Connect or pair AirPods, headphones or a speaker.'), 'bluetooth'),
        menu('HDMI', 'hdmi', [
          n('hdmiBlack', t('HDMI Black Level'), t('Change it if blacks look gray or crushed.'),
            [[0, t('Normal')], [1, t('Auto')], [2, t('Low')]])
        ], t('HDMI input settings.')),
        action('Sources', openSources, t('HDMI, USB-C and TV Access.'), 'source')
      ], t('Network, Bluetooth, HDMI, sources.')),

      /* -------- General & Privacy -------- */
      menu(t('General & Privacy'), 'sliders', [
        toggle(t('24-Hour Time'), 'clock24', t('Time format in Control Center.')),
        menu(t('Power and Energy Saving'), 'leaf', [
          n('ecoSensor', t('Brightness Optimization'), t('Lowers the brightness in a dark room.'), ON_OFF),
          n('energy', t('Power Saving Mode'), t('Reduces power consumption.'), ON_OFF)
        ], t('Brightness and power consumption.')),
        { type: 'samsung', label: t('Samsung Settings'),
          desc: t('For what the screen keeps for its own menus: changing Wi-Fi, time, language, Samsung account, parental controls, privacy, reset.') }
      ], t('Clock, energy, Samsung Settings.')),

      /* -------- Support -------- */
      menu(t('Support'), 'info', [
        menu(t('About This Screen'), 'info', [
          info(t('Name'), function () { return sys.product().name; }),
          info(t('Model'), function () { return sys.product().model; }),
          info(t('Software Version'), function () { return sys.product().firmware; }),
          info(t('Tizen Version'), function () { return sys.product().tizen; }),
          info(t('Resolution'), sys.display),
          info(t('Storage'), sys.storage),
          info(t('IP Address'), function () { return sys.network().ip; }),
          info('CleanFrame', function () { return t('Version {v}', { v: sys.version }); })
        ], t('Model, software and storage.'))
      ], t('About.')),

      action(t('Sleep Now'), function () { sys.sleepNow().catch(function (e) { APL.toast(e.message); }); },
        t('Turns off the screen.'), 'moon')

    ], t('All the screen\'s settings, the Apple TV way.'));
  }

  APL.settingsTree = build;
})(window);
