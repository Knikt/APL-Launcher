/* ============================================================
   apl-sys.js — what the ported Settings app and Control Centre read and write
   on the screen.

   This is APL Launcher's system layer, carried over: the same D-Bus calls on
   the AV service (picture, picture mode, Game Mode, the native Samsung
   settings), the same Tizen APIs for sound, network and the device, the same
   sleep timer. Only the transport changed: their build had its own web service
   and trusted message port, while CleanFrame already has one (tv-settings.js,
   window.CleanFrameTV.exec), so every root command goes through it. That
   client falls back to asking Vetro directly, and answers with the screen's
   own output, so nothing here needs a second bridge.

   Nothing here is invented: a setting the screen does not answer for is shown
   as unavailable rather than as a value.
   ============================================================ */
(function (global) {
  'use strict';

  var APL = global.APL = global.APL || {};
  var t = APL.t;
  var tz = global.tizen;
  var wa = global.webapis;
  var PREVIEW = !(tz && tz.application);

  function safe(fn, fallback) {
    try {
      var v = fn();
      return (v === undefined || v === null || v === '') ? fallback : v;
    } catch (e) { return fallback; }
  }

  /* ---------- preferences ----------
     Stored on the screen, under CleanFrame's own key space so the app's other
     settings and these cannot overwrite each other. */
  var STORE = 'cleanframe.apl.v1';
  var DEFAULTS = {
    clock24: true,
    dnd: false,
    sleepTimer: 0,
    sleepAt: 0,
    gameWanted: false,
    uiSounds: true,
    profileName: ''
  };
  function load() {
    try { return JSON.parse(global.localStorage.getItem(STORE) || 'null') || {}; } catch (e) { return {}; }
  }
  var store = load();
  function pref(k) {
    return (k in store) ? store[k] : DEFAULTS[k];
  }
  function setPref(k, v) {
    store[k] = v;
    try { global.localStorage.setItem(STORE, JSON.stringify(store)); } catch (e) {}
    (listeners[k] || []).forEach(function (fn) { fn(v); });
  }
  var listeners = {};
  function onPref(k, fn) { (listeners[k] = listeners[k] || []).push(fn); }

  /* Household profiles live in app/apl-profiles.js, over the launcher's own
     saved state: each person keeps their Home Screen, wallpaper and folders. */
  var profiles = {
    list: function () { return APL.profiles ? APL.profiles.list() : []; },
    current: function () {
      return APL.profiles ? APL.profiles.current() : { id: 'p1', name: t('Me'), color: '#0a84ff' };
    },
    colors: ['#ff9f0a', '#30d158', '#0a84ff', '#bf5af2', '#ff375f', '#64d2ff', '#ffd60a', '#ac8e68'],
    switchTo: function (id) { if (APL.profiles) APL.profiles.switchTo(id); },
    add: function (name) { return APL.profiles ? APL.profiles.add(name) : null; },
    update: function (id, fields) { if (APL.profiles) APL.profiles.update(id, fields); },
    remove: function (id) { return APL.profiles ? APL.profiles.remove(id) : false; },
    onChange: function (fn) { if (APL.profiles) APL.profiles.onChange(fn); },
    noteLaunch: function () {}
  };

  /* ---------- sound ---------- */
  var mockAudio = { volume: 18, mute: false };
  var audio = {
    getVolume: function () {
      return PREVIEW ? mockAudio.volume : safe(function () { return tz.tvaudiocontrol.getVolume(); }, 0);
    },
    setVolume: function (v) {
      v = Math.max(0, Math.min(100, Math.round(v)));
      if (PREVIEW) { mockAudio.volume = v; return v; }
      safe(function () { tz.tvaudiocontrol.setVolume(v); });
      return audio.getVolume();
    },
    isMute: function () {
      return PREVIEW ? mockAudio.mute : safe(function () { return tz.tvaudiocontrol.isMute(); }, false);
    },
    setMute: function (m) {
      if (PREVIEW) mockAudio.mute = m;
      else safe(function () { tz.tvaudiocontrol.setMute(m); });
    },
    outputMode: function () {
      var m = PREVIEW ? 'PCM' : safe(function () { return tz.tvaudiocontrol.getOutputMode(); }, '—');
      return {
        PCM: 'PCM', DOLBY: 'Dolby Digital', DTS: 'DTS', AAC: 'AAC',
        DOLBY_DIGITAL_PLUS: 'Dolby Digital+'
      }[m] || m;
    }
  };

  /* ---------- network ---------- */
  function network() {
    if (PREVIEW) {
      return { connected: true, type: 'Wi-Fi', ssid: t('Livebox (preview)'), signal: 4,
               ip: '192.168.0.191', mac: '—', gateway: '192.168.0.1', dns: '192.168.0.1' };
    }
    var n = wa && wa.network;
    var type = safe(function () { return n.getActiveConnectionType(); }, -1);
    return {
      connected: type > 0,
      type: { 0: t('Disconnected'), 1: 'Wi-Fi', 2: 'Ethernet', 3: 'Mobile' }[type] || t('Unknown'),
      ssid: type === 1 ? safe(function () { return n.getWiFiSsid(); }, '—') : '—',
      signal: type === 1 ? safe(function () { return n.getWiFiSignalStrengthLevel(); }, 0) : 0,
      ip: safe(function () { return n.getIp(); }, '—'),
      mac: safe(function () { return n.getMac(); }, '—'),
      gateway: safe(function () { return n.getGateway(); }, '—'),
      dns: safe(function () { return n.getDns(); }, '—')
    };
  }

  /* ---------- device ---------- */
  function product() {
    if (PREVIEW) {
      return { model: 'QA55LS03BAUXZN', name: t('The Frame (preview)'), firmware: '—', tizen: '—' };
    }
    var p = wa && wa.productinfo;
    return {
      model: safe(function () { return p.getRealModel(); }, safe(function () { return p.getModel(); }, '—')),
      name: safe(function () { return p.getModel(); }, t('Samsung screen')),
      firmware: safe(function () { return p.getFirmware(); }, '—'),
      tizen: safe(function () { return tz.systeminfo.getCapability('http://tizen.org/feature/platform.version'); }, '—')
    };
  }

  function display() {
    return new Promise(function (resolve) {
      if (PREVIEW) return resolve(t('3840 × 2160 (preview)'));
      var p = wa && wa.productinfo;
      var panel = safe(function () { return p.is8KPanelSupported() ? '7680 × 4320' : ''; }, '') ||
                  safe(function () { return p.isUdPanelSupported() ? '3840 × 2160' : ''; }, '');
      try {
        tz.systeminfo.getPropertyValue('DISPLAY', function (d) {
          var ui = d.resolutionWidth + ' × ' + d.resolutionHeight;
          resolve(panel && panel !== ui ? t('{panel} (interface {ui})', { panel: panel, ui: ui }) : ui);
        }, function () { resolve(panel || '—'); });
      } catch (e) { resolve(panel || '—'); }
    });
  }

  function gb(bytes) {
    var n = (bytes / 1e9).toFixed(1);
    return t('{n} GB', { n: n });
  }
  function storage() {
    return new Promise(function (resolve) {
      if (PREVIEW) return resolve(t('4.1 GB free of 8.0 GB (preview)'));
      try {
        tz.systeminfo.getPropertyValue('STORAGE', function (s) {
          var u = (s.units || [])[0];
          resolve(u ? t('{free} free of {total}', { free: gb(u.availableCapacity), total: gb(u.capacity) }) : '—');
        }, function () { resolve('—'); });
      } catch (e) { resolve('—'); }
    });
  }

  function hdr() {
    if (PREVIEW) return t('Supported');
    return safe(function () { return wa.avinfo.isHdrTvSupport() ? t('Supported') : t('Not supported'); }, '—');
  }

  /* ---------- root commands ----------
     CleanFrame's client: the bundled service hands back Vetro's answer, and
     when that service cannot be reached it posts to Vetro directly. */
  function exec(cmd) {
    var api = global.CleanFrameTV;
    if (!api || !api.exec) return Promise.reject(new Error(t('Vetro is not available')));
    return api.exec(cmd).then(function (r) {
      if (!r || r.sent === false) throw new Error(t('Vetro is not responding (open Vetro once on the screen)'));
      return { sent: true, ok: r.ok !== false, output: String(r.output || '') };
    });
  }

  var aliveAt = 0, alive = false;
  function vetroAlive() {
    if (PREVIEW) return Promise.resolve(true);
    if (Date.now() - aliveAt < 30000) return Promise.resolve(alive);
    return global.fetch('http://127.0.0.1:8099/status').then(function (r) {
      return r.ok ? r.json() : null;
    }).then(function (s) {
      alive = !!s && !(s.agent && s.agent.connected === false);
      aliveAt = Date.now();
      return alive;
    }, function () { alive = false; aliveAt = Date.now(); return false; });
  }

  /* Remote keys the screen simulates itself, as root: the same input_keyevent
     Vetro's own launcher uses. */
  var XKEYS = {
    KEY_MENU: 'XF86Menu', KEY_POWER: 'XF86PowerOff', KEY_SOURCE: 'XF86Display',
    KEY_HOME: 'XF86Home', KEY_RETURN: 'XF86Back', KEY_EXIT: 'XF86Exit', KEY_INFO: 'XF86Info'
  };
  function remoteKey(key) {
    if (PREVIEW) return Promise.reject(new Error(t('PC preview: {key} not sent', { key: key })));
    var x = XKEYS[key] || key;
    if (!/^[A-Za-z0-9]+$/.test(x)) return Promise.reject(new Error(t('Unknown key: {key}', { key: key })));
    return exec('/usr/bin/input_keyevent ' + x + ' 2>&1').then(function (r) {
      if (r.ok === false) throw new Error(t('The screen refused the key ({key})', { key: x }));
    });
  }
  function sleepNow() { return remoteKey('KEY_POWER'); }

  /* Switch to an input, like Samsung's own Source tile: tv-viewer is asked to
     show input number `type` (TV 0, HDMI 1 to 4 = 13 to 16; on the Smart
     Monitor M8, 14 is USB-C). Directly from the app first, otherwise through
     Vetro's launcher. */
  function switchSource(type, label) {
    if (PREVIEW) return Promise.reject(new Error(t('PC preview: input change not sent')));
    var n = String(type);
    var icon = '/usr/apps/com.samsung.tv.theme-resource/shared/res/org.tizen.menu/Settings_Popup/device_icon/' +
      (type >= 13 && type <= 16 ? 'r_icon_device_s_hdmi' + (type - 12) : 'r_icon_device_s_tv') + '.webp';
    var extra = [['change_source', n], ['sourceType', n],
                 ['sourceName', String(label || 'HDMI ' + (type - 12)).replace(/[^A-Za-z0-9 +-]/g, '')],
                 ['sourceIcon', icon]];
    function viaVetro() {
      /* No mbrIndex here: app_launcher reads "-2" as an option and rejects it. */
      var args = extra.concat([['__K_EX_LAUNCH_REQUESTOR', 'user']]).map(function (kv) { return kv[0] + " '" + kv[1] + "'"; }).join(' ');
      return exec('app_launcher -s org.tizen.tv-viewer ' + args + ' 2>&1').then(function (r) {
        if (r.ok === false) throw new Error(t('The screen refused the input change'));
      });
    }
    return game.applyOnInput ? game.applyOnInput().then(launch) : launch();
    function launch() {
      return new Promise(function (resolve, reject) {
        try {
          var data = extra.concat([['mbrIndex', '-2']]).map(function (kv) { return new tz.ApplicationControlData(kv[0], [kv[1]]); });
          var ctl = new tz.ApplicationControl('http://tizen.org/appcontrol/operation/default', null, null, null, data);
          tz.application.launchAppControl(ctl, 'org.tizen.tv-viewer', resolve, function () { viaVetro().then(resolve, reject); });
        } catch (e) { viaVetro().then(resolve, reject); }
      });
    }
  }

  function openSamsungSettings(path) {
    return exec('app_launcher -s org.tizen.menu >/dev/null 2>&1; true').then(function () { return path; });
  }

  /* ---------- sleep timer ----------
     The screen counts: an app stops as soon as something else is in front, so
     the countdown lives in a small shell job and a file, exactly as before. */
  var SLEEP_FILE = '/tmp/cleanframe-sleep-at';
  function armSleepTimer(minutes) {
    var at = minutes ? Date.now() + minutes * 60000 : 0;
    setPref('sleepTimer', minutes);
    setPref('sleepAt', at);
    if (PREVIEW) return;
    var secs = Math.round(at / 1000);
    exec(minutes
      ? 'echo ' + secs + ' > ' + SLEEP_FILE + '; (sleep ' + (minutes * 60) +
        '; if [ "$(cat ' + SLEEP_FILE + ' 2>/dev/null)" = "' + secs + '" ]; then rm -f ' + SLEEP_FILE +
        '; /usr/bin/input_keyevent XF86PowerOff; fi) >/dev/null 2>&1 &'
      : 'rm -f ' + SLEEP_FILE).catch(function () {});
  }
  function readSleepTimer() {
    if (PREVIEW) return Promise.resolve();
    return exec('cat ' + SLEEP_FILE + ' 2>/dev/null').then(function (r) {
      var secs = parseInt(String(r.output || '').trim(), 10), at = secs ? secs * 1000 : 0;
      if (at < Date.now()) at = 0;
      setPref('sleepAt', at);
      if (!at) setPref('sleepTimer', 0);
    }, function () {});
  }

  function runningApps() {
    return new Promise(function (resolve, reject) {
      if (!tz || !tz.application || !tz.application.getAppsContext) { reject(new Error(t('unavailable'))); return; }
      tz.application.getAppsContext(function (list) {
        resolve(list.map(function (c) { return c.appId; }));
      }, reject);
    });
  }

  /* ---------- picture and Game Mode: the AV service ---------- */
  var AVOC = 'busctl --system call org.tizen.tv.avoc /org/tizen/tv/avoc org.tizen.tv.avoc.AvOutputControl ';
  var PICTURE = [
    { id: 'backlight', get: 'GetBacklight i 0', set: 'SetBacklight ii', min: 0, max: 50 },
    { id: 'contrast', get: 'GetContrast i 0', set: 'SetContrast yi', min: 0, max: 50 },
    { id: 'sharpness', get: 'GetSharpness i 0', set: 'SetSharpness yi', min: 0, max: 20 },
    { id: 'color', get: 'GetColorStrength i 0', set: 'SetColorStrength yi', min: 0, max: 50 },
    { id: 'pictureMode', get: 'GetPictureMode i 0', set: 'SetPictureMode ii', coded: true }
  ];
  var PICTURE_MODES = [
    [65536, t('Dynamic')], [65537, 'Standard'], [65552, t('Eco')], [65538, t('Movie')]
  ];
  var GAME_PICTURE = 458769;
  function pictureModeName(v) {
    if (v === GAME_PICTURE) return t('Game');
    for (var i = 0; i < PICTURE_MODES.length; i++) if (PICTURE_MODES[i][0] === v) return PICTURE_MODES[i][1];
    return t('Automatic');
  }
  function answerValue(line) { return parseInt(String(line || '').trim().split(/\s+/)[1], 10); }

  var MOCK_TV = [
    { id: 'backlight', writable: true, value: 35, min: 0, max: 50 },
    { id: 'contrast', writable: true, value: 45, min: 0, max: 50 },
    { id: 'sharpness', writable: true, value: 10, min: 0, max: 20 },
    { id: 'color', writable: true, value: 25, min: 0, max: 50 },
    { id: 'pictureMode', writable: true, value: 65538, coded: true }
  ];
  var tvCache = null, tvAt = 0, tvPending = null;

  function tvSettings(force) {
    if (PREVIEW) return Promise.resolve(MOCK_TV);
    if (!force && tvCache && Date.now() - tvAt < 8000) return Promise.resolve(tvCache);
    if (tvPending) return tvPending;
    var cmd = PICTURE.map(function (p) { return 'echo ' + p.id + ' $(' + AVOC + p.get + ' 2>/dev/null)'; }).join('; ');
    tvPending = exec(cmd).then(function (r) {
      var byId = {};
      String(r.output || '').split('\n').forEach(function (l) {
        var w = l.trim().split(/\s+/);
        if (w.length >= 4) byId[w[0]] = { value: parseInt(w[2], 10), code: parseInt(w[3], 10) };
      });
      tvCache = PICTURE.filter(function (p) { return byId[p.id] && byId[p.id].code === 0; })
        .map(function (p) {
          return { id: p.id, writable: true, value: byId[p.id].value, min: p.min, max: p.max, coded: !!p.coded, def: p };
        });
      tvAt = Date.now();
      tvPending = null;
      return tvCache;
    }, function (e) { tvPending = null; throw e; });
    return tvPending;
  }

  /* A write is the set followed by the get: the value read back is the one that
     counts, because the screen quietly corrects some of them. */
  function tvWrite(it, want) {
    var p = it.def;
    return exec(AVOC + p.set + ' ' + want + ' 1 2>&1; ' + AVOC + p.get + ' 2>&1').then(function (r) {
      var lines = String(r.output || '').trim().split('\n');
      var back = answerValue(lines[lines.length - 1]);
      if (isNaN(back)) throw new Error(t('The screen did not respond'));
      it.value = back;
      if (back !== want) throw new Error(t('The screen refused this setting for now'));
      return back;
    });
  }

  /* A mode that has never been used can come with its backlight at zero — a
     black picture under menus that cannot be read — so the mode being left
     hands its backlight and contrast to the one being entered. */
  function setPictureMode(v) {
    if (PREVIEW) { MOCK_TV[MOCK_TV.length - 1].value = v; return Promise.resolve(v); }
    return tvSettings(true).then(function (before) {
      var old = {};
      before.forEach(function (it) { old[it.id] = it; });
      if (!old.pictureMode) throw new Error(t('Picture Mode unavailable'));
      return tvWrite(old.pictureMode, v).then(function (back) {
        return tvSettings(true).then(function (now) {
          var next = Promise.resolve();
          now.forEach(function (it) {
            if ((it.id === 'backlight' || it.id === 'contrast') && it.value === 0 &&
                old[it.id] && old[it.id].value > 0) {
              next = next.then(function () { return tvWrite(it, old[it.id].value); });
            }
          });
          return next.then(function () { tvCache = null; return back; });
        });
      });
    });
  }

  /* Game Mode: the screen accepts it once an input has been shown since
     power-on. Before that the request is held and sent when switching. */
  var game = {
    get: function () {
      if (PREVIEW) return Promise.resolve({ available: true, on: !!pref('gameWanted') });
      return exec(AVOC + 'CheckGameMode 2>&1; ' + AVOC + 'GetGameMode i 0 2>&1').then(function (r) {
        var lines = String(r.output || '').trim().split('\n');
        var available = answerValue(lines[0]) === 1;
        if (available && pref('gameWanted')) setPref('gameWanted', false);
        return {
          available: available,
          on: available ? answerValue(lines[1]) === 1 : !!pref('gameWanted'),
          pending: !available && !!pref('gameWanted')
        };
      });
    },
    set: function (on) {
      if (PREVIEW) { setPref('gameWanted', !!on); return Promise.resolve({ available: true, on: !!on }); }
      return game.get().then(function (g) {
        if (!g.available) {
          setPref('gameWanted', !!on);
          return { available: false, on: !!on, pending: !!on };
        }
        return exec(AVOC + 'SetGameMode ii 1 ' + (on ? 1 : 0) + ' 2>&1; sleep 1; ' +
                    AVOC + 'GetGameMode i 0 2>&1').then(function (r) {
          var lines = String(r.output || '').trim().split('\n');
          var now = answerValue(lines[lines.length - 1]) === 1;
          tvCache = null;
          if (now !== !!on) throw new Error(t('The screen refused Game Mode for now'));
          return { available: true, on: now };
        });
      });
    },
    applyOnInput: function () {
      if (PREVIEW || !pref('gameWanted')) return Promise.resolve();
      var sent = exec('(for i in 1 2 3 4 5 6 7 8 9 10; do sleep 2; if [ "$(' + AVOC +
        'CheckGameMode)" = "i 1" ]; then ' + AVOC + 'SetGameMode ii 1 1; break; fi; done) >/dev/null 2>&1 &')
        .catch(function () {});
      return Promise.race([sent, new Promise(function (resolve) { setTimeout(resolve, 1500); })]);
    }
  };

  /* ---------- the screen's other settings ----------
     AV service or vconf, read and written directly, each one write-then-read
     back. The values and ranges are APL Launcher's, measured on this family of
     screens; a control the firmware does not have fails to read and the row
     shows "Unavailable" rather than a made-up value. */
  var NATIVE = {
    tint:       { get: 'GetColorTint i 0', set: 'SetColorTint yi -- V 1', min: 0, max: 30 },
    shadow:     { get: 'GetBrightness i 0', set: 'SetBrightness ii -- V 1', min: -5, max: 5 },
    gamma:      { get: 'GetGamma i 0', set: 'SetGamma ii -- V 1', min: -3, max: 3 },
    blur:       { get: 'GetBlurReduction i 0', set: 'SetBlurReduction iy -- 1 V', min: 0, max: 10 },
    judder:     { get: 'GetJuddlerReduction i 0', set: 'SetJuddlerReduction iy -- 1 V', min: 0, max: 10 },
    balance:    { get: 'GetBalance u 0', set: 'SetBalance uu -- V 1', min: 0, max: 20 },
    delay:      { get: 'GetDelay u 0', set: 'SetDelay uu -- V 1', min: 0, max: 250, step: 10 },
    eq0:        { get: 'GetEqualizer uu 0 0', set: 'SetEqualizer iii -- 0 V 1', min: 0, max: 100, step: 10 },
    eq1:        { get: 'GetEqualizer uu 1 0', set: 'SetEqualizer iii -- 1 V 1', min: 0, max: 100, step: 10 },
    eq2:        { get: 'GetEqualizer uu 2 0', set: 'SetEqualizer iii -- 2 V 1', min: 0, max: 100, step: 10 },
    eq3:        { get: 'GetEqualizer uu 3 0', set: 'SetEqualizer iii -- 3 V 1', min: 0, max: 100, step: 10 },
    eq4:        { get: 'GetEqualizer uu 4 0', set: 'SetEqualizer iii -- 4 V 1', min: 0, max: 100, step: 10 },
    contrastUp: { get: 'GetDynamicContrast i 0', set: 'SetDynamicContrast ii -- V 1' },
    colorTone:  { get: 'GetColorToneMode i 0', set: 'SetColorToneMode ii -- V 1' },
    colorSpace: { get: 'GetColorSpace i 0', set: 'SetColorSpace ii -- V 1' },
    clarity:    { get: 'GetAutoMotionPlus i 0', set: 'SetAutoMotionPlus ii -- V 1' },
    eyeSaver:   { get: 'GetEyeSaverMode i 0', set: 'SetEyeSaverMode ii -- V 1' },
    adaptive:   { get: 'GetAdaptivePicture', set: 'SetAdaptivePicture i -- V' },
    energy:     { get: 'GetEnergySaving i 0', set: 'SetEnergySaving ii -- 1 V' },
    ecoSensor:  { get: 'GetEcoSensor i 0', set: 'SetEcoSensor ii -- 1 V' },
    hdmiBlack:  { get: 'GetHdmiBlackLevel i 0', set: 'SetHdmiBlackLevel ii -- V 1' },
    earc:       { get: 'GetEarcEnable', set: 'SetEarcEnable i -- V' },
    soundMode:  { get: 'GetSoundMode u 0', set: 'SetSoundMode uu -- V 1' },
    autoVolume: { get: 'GetAutoVolume u 0', set: 'SetAutoVolume uu -- V 1' },
    feedback:   { get: 'GetSoundFeedback i 0', set: 'SetSoundFeedback ii -- 1 V' },
    smartHub:   { vconf: 'db/menu/smart_hub/ontvsetting/auto_start' }
  };
  var MOCK_NATIVE = {};

  function nativeGet(id) {
    var d = NATIVE[id];
    if (!d) return Promise.reject(new Error(t('Unavailable')));
    if (PREVIEW) return Promise.resolve(MOCK_NATIVE[id] || (d.min !== undefined ? Math.round((d.min + d.max) / 2) : 0));
    if (d.vconf) {
      return exec('vconftool get ' + d.vconf + ' 2>&1').then(function (r) {
        var m = /value = (-?[0-9]+)/.exec(String(r.output || ''));
        if (!m) throw new Error(t('Unavailable'));
        return parseInt(m[1], 10);
      });
    }
    return exec(AVOC + d.get + ' 2>&1').then(function (r) {
      var w = String(r.output || '').trim().split(/\s+/);
      if (w.length < 3 || w[w.length - 1] !== '0') throw new Error(t('Unavailable'));
      return parseInt(w[1], 10);
    });
  }
  function nativeSet(id, value) {
    var d = NATIVE[id];
    if (!d) return Promise.reject(new Error(t('Unavailable')));
    if (PREVIEW) { MOCK_NATIVE[id] = value; return Promise.resolve(value); }
    var write = d.vconf
      ? 'vconftool set -f -t int ' + d.vconf + ' ' + value + ' 2>&1'
      : AVOC + d.set.replace('V', value) + ' 2>&1';
    return exec(write).then(function () { return nativeGet(id); }).then(function (back) {
      if (back !== value) throw new Error(t('The screen refused this setting for now'));
      return back;
    });
  }
  function nativeReset(method) {
    return PREVIEW ? Promise.resolve() : exec(AVOC + method + ' 2>&1');
  }

  function tvItem(id) {
    return tvSettings().then(function (items) {
      for (var i = 0; i < items.length; i++) if (items[i].id === id) return items[i];
      return null;
    });
  }

  /* Left / right: the number on screen moves at once and the write goes out
     after the last press, one at a time. */
  var tvTimers = {}, tvWriting = {};
  function tvAdjust(id, delta, onChange) {
    return tvItem(id).then(function (it) {
      if (!it || !it.writable) throw new Error(t('Setting unavailable for now'));
      if (it.target === undefined) it.target = it.value;
      it.target = Math.max(it.min, Math.min(it.max, it.target + delta));
      if (onChange) onChange(it.target, it);
      clearTimeout(tvTimers[id]);
      tvTimers[id] = setTimeout(function flush() {
        if (tvWriting[id]) { tvTimers[id] = setTimeout(flush, 150); return; }
        if (it.target === it.value) return;
        if (PREVIEW) { it.value = it.target; return; }
        tvWriting[id] = true;
        tvWrite(it, it.target).then(function () {
          tvWriting[id] = false;
        }, function (e) {
          tvWriting[id] = false;
          it.target = it.value;
          tvCache = null;
          if (onChange) onChange(it.value, it);
          if (APL.toast) APL.toast(e.message);
        });
      }, 350);
      return it.target;
    });
  }
  function tvValue(id) {
    return tvItem(id).then(function (it) { return it ? (it.target !== undefined ? it.target : it.value) : null; });
  }

  APL.sys = {
    PREVIEW: PREVIEW,
    pref: pref, setPref: setPref, onPref: onPref, profiles: profiles, switchSource: switchSource,
    audio: audio, network: network, product: product, display: display, storage: storage, hdr: hdr,
    remoteKey: remoteKey, openSamsungSettings: openSamsungSettings, sleepNow: sleepNow,
    vetroAlive: vetroAlive, armSleepTimer: armSleepTimer, readSleepTimer: readSleepTimer,
    exec: exec, game: game, runningApps: runningApps,
    native: {
      get: nativeGet, set: nativeSet, reset: nativeReset,
      info: function (id) { return NATIVE[id]; }
    },
    PICTURE_MODES: PICTURE_MODES, pictureModeName: pictureModeName, setPictureMode: setPictureMode,
    tvSettings: tvSettings, tvItem: tvItem, tvAdjust: tvAdjust, tvValue: tvValue,
    version: '0.6.1'
  };
})(window);
