/* ============================================================
   panels.js — the TV's own switches, from the launcher.

   Three views in one glass panel, each reading the screen rather than pretending:

     Sources  the inputs Tizen announces (HDMI, USB-C), switched through the same
              app-control Samsung's own Source tile uses, with Vetro's
              app_launcher as the fallback. Hold OK is not needed to switch; a
              device name can be given to a port from the same panel.
     Network  the networks the screen already knows, read with connmanctl through
              Vetro. OK joins one; a network that has never been joined needs its
              password, and that is the screen's own Wi-Fi page, so this opens it
              instead of inventing a keyboard.
     Sound    the paired Bluetooth speakers and headphones, from Tizen's own
              Bluetooth adapter, connected and disconnected through Samsung's
              connection manager - the route APL Launcher uses, because Tizen's
              isConnected is not what decides where the sound goes.

   A web app cannot switch the radios itself: Wi-Fi has no web API at all, and
   Bluetooth's API lists devices but does not carry the audio route. Everything
   here therefore either uses a documented Tizen call or asks Vetro to run the
   screen's own command.
   ============================================================ */
(function (global) {
  'use strict';

  var PREVIEW = !(global.tizen && global.tizen.application);
  var BT_MGR = 'gdbus call --system --dest com.samsung.tv.bt.connectionmanager ' +
    '--object-path /com/samsung/tv/bt/connectionmanager --method ';
  var BT_ADDR = /^[0-9A-F]{2}(:[0-9A-F]{2}){5}$/i;
  var AUDIO_NAME = /airpods|beats|buds|casque|headphone|headset|écouteur|ecouteur|enceinte|speaker|soundbar|barre de son|sony|bose|jbl|marshall|sennheiser|galaxy/i;
  var PHONE_NAME = /airpods|buds|casque|headphone|headset|écouteur|ecouteur|beats|galaxy buds/i;
  var PREF = 'cleanframe.sources.v1';

  var state = { view: 'sources', i: 0, rows: [], note: '', busy: false, open: false };
  var el = null, listEl = null, noteEl = null, titleEl = null, sources = null, audio = null, nets = null;

  function $(id) { return document.getElementById(id); }
  function tv() { return global.CleanFrameTV || null; }
  function run(cmd) {
    var api = tv();
    if (!api) return Promise.reject(new Error('Vetro is not available'));
    return api.exec(cmd);
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------- preferences: which device is plugged into a port ---------- */

  function prefs() {
    try { return JSON.parse(global.localStorage.getItem(PREF) || '{}') || {}; } catch (e) { return {}; }
  }
  function savePrefs(p) {
    try { global.localStorage.setItem(PREF, JSON.stringify(p)); } catch (e) {}
  }

  /* ---------- Sources ---------- */

  var PORTS = { HDMI: 'HDMI', PC: 'PC', DVI: 'DVI', DP: 'USB-C', USBC: 'USB-C', AV: 'AV', COMP: 'Component', SCART: 'SCART' };
  var DEVICES = ['Switch 2', 'PlayStation 5', 'Xbox', 'Steam Deck', 'PC', 'Mac', 'Apple TV', 'Chromecast', 'Fire TV', 'Shield', 'Freebox', 'Orange'];

  function inputRows() {
    var list = [], i, tw = global.tizen && global.tizen.tvwindow;
    try {
      if (tw && tw.getAvailableSources) {
        list = tw.getAvailableSources().filter(function (s) { return PORTS[s.type]; })
          .map(function (s) { return { type: s.type, number: s.number || 1, label: s.name || '' }; });
      }
    } catch (e) { list = []; }
    if (!list.length) list = [{ type: 'HDMI', number: 1 }, { type: 'USBC', number: 1 }];
    var hdmi = list.filter(function (s) { return s.type === 'HDMI'; }).length;
    var chosen = prefs();
    return list.map(function (s) {
      var id = s.type + s.number;
      var port = PORTS[s.type] + (s.type === 'HDMI' && hdmi > 1 ? ' ' + s.number : '');
      var device = chosen[id] || '';
      return {
        kind: 'input', id: id, port: port, device: device, label: device || port,
        sub: device ? port : 'Hold OK to name this input',
        sourceType: s.type === 'HDMI' ? 12 + (s.number || 1)
          : (s.type === 'USBC' || s.type === 'DP') ? 14 : -1
      };
    });
  }

  /* Samsung's own Source tile does this with an app-control; Vetro repeats it when
     the web app is not allowed to. The icon path is the screen's own. */
  function switchTo(row) {
    if (row.sourceType < 0) { state.note = 'This input cannot be picked on this screen.'; paint(); return; }
    state.busy = true;
    state.note = 'Switching to ' + row.label + '\u2026';
    paint();
    var icon = '/usr/apps/com.samsung.tv.theme-resource/shared/res/org.tizen.menu/Settings_Popup/device_icon/' +
      (row.sourceType >= 13 && row.sourceType <= 16 ? 'r_icon_device_s_hdmi' + (row.sourceType - 12) : 'r_icon_device_s_tv') + '.webp';
    var extra = [['change_source', String(row.sourceType)], ['sourceType', String(row.sourceType)],
      ['sourceName', String(row.label).replace(/[^A-Za-z0-9 +-]/g, '')], ['sourceIcon', icon]];
    function viaVetro() {
      var args = extra.concat([['__K_EX_LAUNCH_REQUESTOR', 'user']])
        .map(function (kv) { return kv[0] + " '" + kv[1] + "'"; }).join(' ');
      return run('app_launcher -s org.tizen.tv-viewer ' + args + ' 2>&1').then(function (r) {
        state.busy = false;
        if (r && r.sent === false) { state.note = 'The screen refused the input change.'; }
        else { close(); }
        paint();
      });
    }
    if (PREVIEW) {
      state.busy = false;
      state.note = 'Preview: on the TV this would switch to ' + row.label + '.';
      paint();
      return;
    }
    try {
      var data = extra.concat([['mbrIndex', '-2']]).map(function (kv) {
        return new tizen.ApplicationControlData(kv[0], [kv[1]]);
      });
      var ctl = new tizen.ApplicationControl('http://tizen.org/appcontrol/operation/default', null, null, null, data);
      tizen.application.launchAppControl(ctl, 'org.tizen.tv-viewer', function () {
        state.busy = false;
        close();
      }, function () { viaVetro(); });
    } catch (e) { viaVetro(); }
  }

  function deviceRows(inputId) {
    var chosen = prefs(), portRow = null, i;
    var rows = [{ kind: 'device', id: inputId, label: 'Use the port name', sub: '', value: '' }];
    for (i = 0; i < DEVICES.length; i++) {
      rows.push({ kind: 'device', id: inputId, label: DEVICES[i], sub: '', value: DEVICES[i] });
    }
    rows.forEach(function (r) { r.current = (chosen[inputId] || '') === r.value; });
    return rows;
  }

  /* ---------- Network, through connman ---------- */

  function parseNetworks(text) {
    var out = [], lines = String(text || '').split('\n'), i, m;
    for (i = 0; i < lines.length; i++) {
      m = lines[i].match(/^([*A-Za-z]*)\s+(.+?)\s{2,}((?:wifi|ethernet)_\S+)/);
      if (!m) continue;
      out.push({
        kind: 'net', id: m[3], service: m[3],
        label: m[2], sub: /^wifi/.test(m[3]) ? 'Wi-Fi' : 'Wired',
        connected: m[1].indexOf('*') !== -1
      });
    }
    /* The one in use first, then alphabetically: a list that moves is a list you
       cannot aim at with a remote. */
    out.sort(function (a, b) {
      if (a.connected !== b.connected) return a.connected ? -1 : 1;
      return String(a.label).localeCompare(String(b.label));
    });
    return out;
  }

  function loadNetworks() {
    if (PREVIEW) {
      state.note = 'Preview: on the TV this lists the networks the screen knows.';
      paint();
      return Promise.resolve();
    }
    state.note = 'Reading the screen\u2019s networks\u2026';
    paint();
    return run('connmanctl services 2>&1').then(function (r) {
      nets = parseNetworks(r && r.output);
      state.note = nets.length ? '' : 'The screen lists no saved networks. Join one in its own Wi-Fi page.';
      paint();
    }).catch(function () {
      state.note = 'Vetro did not answer, so the screen\u2019s networks cannot be read.';
      paint();
    });
  }

  function joinNetwork(row) {
    if (row.connected) { state.note = row.label + ' is already the network in use.'; paint(); return; }
    state.busy = true;
    state.note = 'Joining ' + row.label + '\u2026';
    paint();
    run('connmanctl connect ' + row.service + ' 2>&1').then(function (r) {
      state.busy = false;
      state.note = (r && r.output ? String(r.output).trim() + ' ' : '') || 'Asked the screen to join ' + row.label + '.';
      return loadNetworks();
    }).catch(function () {
      state.busy = false;
      state.note = 'The screen refused the connection. Its own Wi-Fi page can ask for the password.';
      paint();
    });
  }

  /* ---------- Sound output, through Samsung's connection manager ---------- */

  function adapter() {
    try { return global.tizen.bluetooth.getDefaultAdapter(); } catch (e) { return null; }
  }

  /* The sound sheet is laid out the way the set's own audio page reads: what you
     wear, what fills the room, then what is not paired yet. The screen's own
     speakers are always the first row of the second group, so the way back is
     never further than the top of the list. */
  var ICONS = {
    headphones: '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="2.5" y="13" width="4.5" height="7" rx="2.2"/><rect x="17" y="13" width="4.5" height="7" rx="2.2"/></svg>',
    speaker: '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 9v6h3l5 4V5L8 9z"/><path d="M17 9.5a4 4 0 0 1 0 5"/><path d="M19.5 7a7.5 7.5 0 0 1 0 10"/></svg>',
    tv: '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="2.5" y="5" width="19" height="12" rx="2.5"/><path d="M9 20.5h6"/></svg>',
    bluetooth: '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M8.5 7.5 15.5 16.5 12 20V4l3.5 3.5-7 9"/></svg>',
    wifi: '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3 9a14 14 0 0 1 18 0"/><path d="M6.5 12.6a9 9 0 0 1 11 0"/><path d="M10 16.2a4 4 0 0 1 4 0"/><circle cx="12" cy="19.2" r="1"/></svg>',
    hdmi: '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="8" width="18" height="8" rx="2"/><path d="M7.5 12h9"/><path d="M8 16v4M16 16v4"/></svg>'
  };

  function audioGroups() {
    var phones = [], spk = [], other = [], anyOn = false;
    (audio || []).forEach(function (d) {
      anyOn = anyOn || d.connected;
      var row = {
        kind: 'bt', id: d.address, address: d.address, label: d.name,
        sub: d.connected ? 'Connected' : 'Not connected',
        ico: d.kind === 'headphones' ? 'headphones' : 'speaker',
        connected: d.connected
      };
      if (d.kind === 'headphones') phones.push(row); else spk.push(row);
    });
    var groups = [];
    if (phones.length) groups.push({ label: 'Headphones', rows: phones });
    groups.push({
      label: 'Speakers',
      rows: [{ kind: 'tv', id: 'tv', label: 'TV Speakers', sub: 'The screen\u2019s own speakers', ico: 'tv', connected: !anyOn }].concat(spk)
    });
    other.push({ kind: 'pair', id: 'pair', label: 'Pair AirPods or Headphones\u2026', sub: 'Searches for nearby devices', ico: 'bluetooth' });
    groups.push({ label: 'Other Devices', rows: other });
    return groups;
  }

  function audioRows() {
    var out = [];
    audioGroups().forEach(function (g) { out = out.concat(g.rows); });
    return out;
  }

  function loadAudio() {
    var a = adapter();
    if (PREVIEW || !a) {
      state.note = PREVIEW ? 'Preview: the TV\u2019s paired devices list appears here.' : 'This screen has no Bluetooth adapter to read.';
      audio = [];
      paint();
      return Promise.resolve();
    }
    state.note = 'Reading the screen\u2019s paired devices\u2026';
    paint();
    return new Promise(function (resolve) {
      a.getKnownDevices(function (list) {
        audio = (list || []).map(function (d) {
          var cls = d.deviceClass || {}, name = d.name || '';
          var kind = (PHONE_NAME.test(name) || (cls.major === 4 && (cls.minor === 1 || cls.minor === 2 || cls.minor === 6)))
            ? 'headphones' : (cls.major === 4 || AUDIO_NAME.test(name)) ? 'speaker' : null;
          return { address: d.address, name: name || 'Bluetooth device', kind: kind, bonded: !!d.isBonded, connected: !!d.isConnected };
        }).filter(function (d) { return d.kind && d.bonded; });
        resolve();
      }, function () { audio = []; resolve(); });
    }).then(function () {
      /* Tizen's isConnected is not what carries the sound: ask the manager. */
      return run(BT_MGR + 'org.tizen.btapp.ApiInterface.get_connected_bt_speaker_info 2>&1').then(function (r) {
        var on = String(r && r.output || '').toUpperCase();
        audio.forEach(function (d) { d.connected = on.indexOf(d.address.toUpperCase()) !== -1; });
      }, function () {});
    }).then(function () {
      state.note = audio.length ? '' : 'No paired speakers or headphones. Pair one in the screen\u2019s Sound settings.';
      paint();
    });
  }

  function btToggle(row) {
    if (state.busy) return;
    if (!BT_ADDR.test(row.address)) { state.note = 'This device has no usable address.'; paint(); return; }
    state.busy = true;
    state.note = (row.connected ? 'Disconnecting ' : 'Connecting to ') + row.label + '\u2026';
    paint();
    var cmd = row.connected
      ? BT_MGR + 'org.tizen.btapp.ApiInterface.disconnect_last_btspk_list 2>&1'
      : BT_MGR + 'org.tizen.btapp.ApiInterface.buds_switching_connect ' + row.address + ' 2>&1';
    run(cmd).then(function () {
      /* Bluetooth answers a few seconds later: read it again, once, then say what
         happened rather than claiming it worked. */
      return new Promise(function (r) { setTimeout(r, 2500); });
    }).then(loadAudio).then(function () {
      state.busy = false;
      var now = null, i;
      for (i = 0; i < (audio || []).length; i++) if (audio[i].address === row.address) now = audio[i];
      state.note = now && now.connected === !row.connected
        ? (now.connected ? 'Sound on ' + now.name + '.' : 'Sound on the screen\u2019s speakers.')
        : (row.connected ? 'It is still connected: try again in a moment.' : 'It did not answer: turn it on and try again.');
      paint();
    }).catch(function () {
      state.busy = false;
      state.note = 'The screen refused the change.';
      paint();
    });
  }

  /* ---------- rendering ---------- */

  var TITLES = { sources: 'Sources', network: 'Network', audio: 'Sound Output', device: 'Input Device' };

  function groups() {
    if (state.view === 'sources') {
      if (!sources) sources = inputRows();
      return [{ label: 'Inputs', rows: sources }];
    }
    if (state.view === 'network') return [{ label: 'Networks', rows: nets || [] }];
    if (state.view === 'audio') return audioGroups();
    if (state.view === 'device') return [{ label: 'Devices', rows: state.deviceRows || [] }];
    return [];
  }

  function rows() {
    var out = [];
    groups().forEach(function (g) { out = out.concat(g.rows); });
    return out;
  }

  function paint() {
    if (!listEl) return;
    var list = rows(), html = '', i, at = 0, groupsOut = groups();
    groupsOut.forEach(function (g) {
      if (!g.rows.length) return;
      html += '<p class="tvp-sec">' + esc(g.label) + '</p>';
      g.rows.forEach(function (r) {
        var i2 = at++;
        var sub = r.sub ? '<span class="tvp-sub">' + esc(r.sub) + '</span>' : '';
        var value = r.kind === 'input' && r.current ? 'Current' : '';
        html += '<div class="tvp-row' + (i2 === state.i ? ' is-focus' : '') + '" data-i="' + i2 + '" role="button">' +
          '<span class="tvp-ico">' + (ICONS[r.ico] || ICONS.hdmi) + '</span>' +
          '<span class="tvp-meta"><span class="tvp-name">' + esc(r.label) + '</span>' + sub + '</span>' +
          (r.connected || value ? '<span class="tvp-check">\u2713</span>' : '<span class="tvp-chev">\u203a</span>') +
          '</div>';
      });
    });
    if (!list.length && !state.note) html = '<p class="tvp-hint">Nothing to show yet.</p>';
    listEl.innerHTML = html;
    if (noteEl) noteEl.textContent = state.note || (list.length ? hint() : '');
    if (titleEl) titleEl.textContent = TITLES[state.view] || 'Sources';
  }

  function hint() {
    if (state.view === 'sources') return 'OK switches to the input. Back closes.';
    if (state.view === 'network') return 'OK joins a network the screen already knows.';
    if (state.view === 'audio') return 'OK sends the sound there, or brings it back.';
    if (state.view === 'device') return 'OK names this input, so the tile says what is plugged in.';
    return '';
  }

  function show(view) {
    el = el || $('srcPanel');
    if (!el) return false;
    listEl = listEl || $('srcList');
    noteEl = noteEl || $('srcNote');
    titleEl = titleEl || $('srcTitle');
    state.view = view || 'sources';
    state.i = 0;
    state.note = '';
    state.deviceRows = null;
    state.open = true;
    el.hidden = false;
    el.classList.remove('is-open');
    void el.offsetWidth;
    el.classList.add('is-open');
    paint();
    if (state.view === 'network') loadNetworks();
    else if (state.view === 'audio') loadAudio();
    return true;
  }

  function close() {
    if (!el) return;
    clearTimeout(holdTimer);
    holdTimer = null;
    held = false;
    state.open = false;
    state.deviceRows = null;
    state.view = 'sources';
    el.classList.remove('is-open');
    el.hidden = true;
  }

  function openSamsungSound() {
    var d = global.FrameDevice;
    close();
    try {
      if (d && d.bluetooth) d.bluetooth(function () {});
      else if (d && d.settings) d.settings(function () {});
    } catch (e) {}
  }

  function activate() {
    var list = rows(), row = list[state.i];
    if (!row) return;
    if (row.kind === 'pair') { openSamsungSound(); return; }
    if (row.kind === 'tv') {
      if (row.connected) { state.note = 'The sound is already on the screen\u2019s speakers.'; paint(); return; }
      state.busy = true;
      state.note = 'Bringing the sound back to the screen\u2026';
      paint();
      run(BT_MGR + 'org.tizen.btapp.ApiInterface.disconnect_last_btspk_list 2>&1').then(function () {
        return new Promise(function (r) { setTimeout(r, 2500); });
      }).then(loadAudio).then(function () { state.busy = false; });
      return;
    }
    if (row.kind === 'input') { switchTo(row); return; }
    if (row.kind === 'device') {
      var p = prefs();
      if (row.value) p[row.id] = row.value; else delete p[row.id];
      savePrefs(p);
      sources = null;
      state.view = 'sources';
      state.i = 0;
      state.note = row.value ? row.label + ' is on ' + row.id + '.' : 'The port keeps its own name.';
      paint();
      return;
    }
    if (row.kind === 'net') { joinNetwork(row); return; }
    if (row.kind === 'bt') { btToggle(row); return; }
  }

  /* A long press on OK names the input instead of switching to it, and on a port
     that already has a name it offers the list again. Timing matches the app's
     other hold gestures. */
  var holdTimer = null, held = false;

  function onKeyDown(ev) {
    var code = ev.keyCode, list;
    if (!state.open) return;
    if ([10009, 27, 8, 13, 37, 39, 38, 40].indexOf(code) === -1) return;
    ev.preventDefault();
    ev.stopImmediatePropagation();
    if (code === 10009 || code === 27 || code === 8) { close(); return; }
    list = rows();
    if (code === 38) { state.i = Math.max(0, state.i - 1); paint(); return; }
    if (code === 40) { state.i = Math.min(Math.max(0, list.length - 1), state.i + 1); paint(); return; }
    if (code === 37 || code === 39) return;
    if (code === 13) {
      var row = list[state.i];
      /* A held key repeats: the first press owns the wait, and a repeat must not
         restart it, or a hold would never reach its menu. */
      if (holdTimer) return;
      if (row && row.kind === 'input') {
        held = false;
        holdTimer = setTimeout(function () {
          held = true;
          state.deviceRows = deviceRows(row.id);
          state.view = 'device';
          state.i = 0;
          state.note = '';
          paint();
        }, 600);
        return;
      }
      activate();
    }
  }

  function onKeyUp(ev) {
    if (ev.keyCode !== 13 || !holdTimer) return;
    clearTimeout(holdTimer);
    holdTimer = null;
    if (held) { held = false; return; }
    ev.preventDefault();
    ev.stopImmediatePropagation();
    activate();
  }

  document.addEventListener('keydown', onKeyDown, true);
  document.addEventListener('keyup', onKeyUp, true);

  global.CleanFramePanels = {
    open: show,
    close: close,
    sources: function () { return show('sources'); },
    network: function () { return show('network'); },
    audio: function () { return show('audio'); },
    state: function () { return { view: state.view, rows: rows().map(function (r) { return r.label; }), note: state.note }; }
  };
})(window);
