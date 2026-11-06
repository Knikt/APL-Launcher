/* ============================================================
   tv-settings.js — the screen's own picture controls, from the app.

   Samsung's AV service is reachable only over D-Bus as root, so the launcher
   cannot ask the TV for its brightness by itself: a web app has no D-Bus. Vetro
   is a small root service on the set that runs a command for us at
   127.0.0.1:8099, and APL Launcher for TizenOS reached the same controls the
   same way. This module is the client and the panel:

     - every read is one shell command that prints "name <answer>", so the whole
       picture is one round trip instead of six;
     - a write is the set call followed by its get, and the value read back is
       what the panel shows: a mode that the screen quietly corrects (Game Mode
       forcing one) never leaves a slider lying;
     - a row is shown only if the screen answered for it, so a firmware without
       a control does not offer a dead slider.

   Nothing here runs in the preview: without Vetro the panel says so.
   ============================================================ */
(function (global) {
  'use strict';

  var VETRO = 'http://127.0.0.1:8099';
  var AVOC = 'busctl --system call org.tizen.tv.avoc /org/tizen/tv/avoc org.tizen.tv.avoc.AvOutputControl ';
  var PREVIEW = !(global.tizen && global.tizen.application);

  /* key, label, D-Bus getter, D-Bus setter, range, and whether the value is a
     code rather than a number (picture mode is a bitmask, not a level). */
  var ROWS = [
    { id: 'backlight', label: 'Backlight', get: 'GetBacklight i 0', set: 'SetBacklight ii', min: 0, max: 50 },
    { id: 'contrast', label: 'Contrast', get: 'GetContrast i 0', set: 'SetContrast yi', min: 0, max: 50 },
    { id: 'sharpness', label: 'Sharpness', get: 'GetSharpness i 0', set: 'SetSharpness yi', min: 0, max: 20 },
    { id: 'color', label: 'Colour', get: 'GetColorStrength i 0', set: 'SetColorStrength yi', min: 0, max: 50 },
    { id: 'localdimming', label: 'Local Dimming', get: 'GetLocalDimming i 0', set: 'SetLocalDimming ii', min: 0, max: 2, names: ['Off', 'Standard', 'High'] },
    { id: 'pictureMode', label: 'Picture Mode', get: 'GetPictureMode i 0', set: 'SetPictureMode ii', coded: true }
  ];
  /* The modes this screen's own list shows, from the reference set's values. */
  var MODES = [[65536, 'Dynamic'], [65537, 'Standard'], [65552, 'Eco'], [65538, 'Movie'], [458769, 'Game']];

  function modeName(v) {
    var i;
    for (i = 0; i < MODES.length; i++) if (MODES[i][0] === v) return MODES[i][1];
    return 'Automatic';
  }

  /* ---------- asking the screen ----------
     Vetro runs a command but a web app cannot read its answer, so a request
     from here can change a value and never show what the value became. The
     bundled service (bridge/service.js) makes the request and hands the answer
     back over a trusted message port. If the service cannot be reached, the
     plain request is still sent - the value changes, the panel just says it
     could not read it back. */
  var BRIDGE_ID = 'CfrmLs03B1.Bridge', BRIDGE_PORT = 'CF_BRIDGE', REPLY_PORT = 'CF_BRIDGE_REPLY';
  var pending = {}, seq = 0, replyPort = null, bridgeDownUntil = 0, bridgeStarting = null;

  function msgField(data, key) {
    for (var i = 0; i < data.length; i++) if (data[i].key === key) return String(data[i].value);
    return '';
  }
  function ensureReplyPort() {
    if (replyPort) return;
    replyPort = tizen.messageport.requestTrustedLocalMessagePort(REPLY_PORT);
    replyPort.addMessagePortListener(function (data) {
      var id = msgField(data, 'id'), part = parseInt(msgField(data, 'part'), 10) || 0;
      var parts = parseInt(msgField(data, 'parts'), 10) || 1, status = parseInt(msgField(data, 'status'), 10) || 200;
      var p = pending[id], body, parsed;
      if (!p) return;
      p.chunks[part] = msgField(data, 'body');
      if (++p.got < parts) return;
      clearTimeout(p.timer);
      delete pending[id];
      body = p.chunks.join('');
      parsed = null;
      try { parsed = JSON.parse(body); } catch (e) { parsed = null; }
      p.resolve({
        sent: true,
        ok: status < 400 && (!parsed || parsed.ok !== false),
        output: parsed ? String(parsed.output || '') : '',
        raw: parsed,
        error: parsed && parsed.error ? String(parsed.error) : (status >= 400 ? 'Vetro ' + status : null)
      });
    });
  }
  /* A service opens its message port a few seconds after it is started, so the
     port cannot be used the moment the launch succeeds: wait for it. Their
     launcher does the same, and without it the first request of every session is
     lost - which is what happened to the microphone watch. */
  function waitBridge(until) {
    return new Promise(function (resolve, reject) {
      (function poll() {
        try { tizen.messageport.requestTrustedRemoteMessagePort(BRIDGE_ID, BRIDGE_PORT); resolve(); } catch (e) {
          if (Date.now() >= until) reject(e); else setTimeout(poll, 250);
        }
      })();
    });
  }
  function startBridge() {
    if (bridgeStarting) return bridgeStarting;
    bridgeStarting = new Promise(function (resolve) {
      function plain() { try { tizen.application.launch(BRIDGE_ID, resolve, resolve); } catch (e) { resolve(); } }
      try {
        var ctl = new tizen.ApplicationControl('http://tizen.org/appcontrol/operation/service');
        tizen.application.launchAppControl(ctl, BRIDGE_ID, resolve, plain);
      } catch (e) { plain(); }
    }).then(function () { return waitBridge(Date.now() + 12000); });
    bridgeStarting.then(function () { bridgeStarting = null; }, function () { bridgeStarting = null; });
    return bridgeStarting;
  }
  function bridgeSend(cmd) {
    return bridgeSendPath('/exec', JSON.stringify({ cmd: cmd }));
  }
  function bridgeSendPath(path, body) {
    return new Promise(function (resolve, reject) {
      var remote, id;
      try {
        remote = tizen.messageport.requestTrustedRemoteMessagePort(BRIDGE_ID, BRIDGE_PORT);
        ensureReplyPort();
      } catch (e) { reject(e); return; }
      id = String(++seq);
      pending[id] = {
        resolve: resolve, chunks: [], got: 0,
        timer: setTimeout(function () { delete pending[id]; reject(new Error('timeout')); }, 30000)
      };
      try {
        remote.sendMessage([{ key: 'id', value: id }, { key: 'method', value: 'POST' },
          { key: 'path', value: path }, { key: 'body', value: body || '' }]);
      } catch (e) { clearTimeout(pending[id].timer); delete pending[id]; reject(e); }
    });
  }
  function directExec(cmd) {
    return new Promise(function (resolve) {
      var xhr;
      try {
        xhr = new XMLHttpRequest();
        xhr.open('POST', VETRO + '/exec', true);
        xhr.setRequestHeader('content-type', 'text/plain');
        xhr.timeout = 6000;
        xhr.onload = function () {
          var body = null;
          try { body = JSON.parse(xhr.responseText); } catch (e) { body = null; }
          if (!body) { resolve({ sent: true, output: '' }); return; }
          if (body.error) { resolve({ sent: false, error: String(body.error) }); return; }
          resolve({ sent: true, ok: body.ok !== false, output: String(body.output || '') });
        };
        xhr.onerror = function () { resolve({ sent: false, error: 'unreachable' }); };
        xhr.ontimeout = function () { resolve({ sent: false, error: 'timeout' }); };
        xhr.send(JSON.stringify({ cmd: cmd }));
      } catch (e) {
        resolve({ sent: false, error: 'blocked' });
      }
    });
  }
  function exec(cmd) {
    if (PREVIEW || !global.tizen || !tizen.messageport) return directExec(cmd);
    if (Date.now() < bridgeDownUntil) return directExec(cmd);
    return bridgeSend(cmd).catch(function () {
      return startBridge().then(function () { return bridgeSend(cmd); });
    }).catch(function () {
      bridgeDownUntil = Date.now() + 5000;
      return directExec(cmd);
    });
  }

  /* Start the service and ask it to watch the remote's microphone. The service
     stays up while it watches; see bridge/service.js. */
  function mic() {
    if (PREVIEW || !global.tizen || !tizen.messageport) return Promise.reject(new Error('no tizen'));
    return bridgeSendPath('/mic', '').catch(function () {
      return startBridge().then(function () { return bridgeSendPath('/mic', ''); });
    });
  }

  var state = { rows: [], values: {}, raw: {}, open: false, i: 0, busy: false, note: '', readAt: 0, error: null };
  var el = null, listEl = null, noteEl = null, titleEl = null;

  function $(id) { return document.getElementById(id); }

  function readAll() {
    if (state.busy) return Promise.resolve(state);
    state.busy = true;
    var cmd = ROWS.map(function (r) { return 'echo ' + r.id + ' $(' + AVOC + r.get + ' 2>/dev/null)'; }).join('; ');
    return exec(cmd).then(function (r) {
      state.busy = false;
      if (!r.sent) {
        state.error = r.error === 'unreachable' ? 'Vetro is not answering on this set.' : r.error === 'timeout' ? 'Vetro did not answer in time.' : 'Vetro refused the request.';
        state.rows = [];
        paint();
        return state;
      }
      var byId = {}, lines = String(r.output || '').split('\n'), k, w;
      for (k = 0; k < lines.length; k++) {
        w = lines[k].trim().split(/\s+/);
        if (w.length >= 4) byId[w[0]] = { value: parseInt(w[2], 10), code: parseInt(w[3], 10) };
      }
      state.rows = ROWS.filter(function (row) { return byId[row.id] && byId[row.id].code === 0; });
      state.values = {};
      state.raw = {};
      state.rows.forEach(function (row) { state.values[row.id] = byId[row.id].value; });
      state.error = state.rows.length ? null : 'This screen did not answer for its picture controls.';
      state.readAt = Date.now();
      if (state.i >= state.rows.length) state.i = Math.max(0, state.rows.length - 1);
      paint();
      return state;
    });
  }

  function valueText(row) {
    var v = state.values[row.id];
    if (typeof v !== 'number') return '—';
    if (row.coded) return modeName(v);
    if (row.names) return row.names[v] || String(v);
    return String(v);
  }

  /* Each picture mode keeps its own values, and on this family of screens a mode
     that has never been used comes with its backlight - or its contrast - at
     zero, which is a black picture with menus you cannot read. So a mode change
     carries the values it found into the mode it lands in, both read and written
     in the same round trip. This is the guard APL Launcher added for the same
     reason. */
  function carryValues(before) {
    var cmd = '', i, row;
    for (i = 0; i < ROWS.length; i++) {
      row = ROWS[i];
      if (row.id !== 'backlight' && row.id !== 'contrast') continue;
      if (state.values[row.id] !== 0 || !(before[row.id] > 0)) continue;
      cmd += AVOC + row.set + ' ' + before[row.id] + ' 1 2>&1; ';
    }
    if (!cmd) return Promise.resolve();
    return exec(cmd + AVOC + 'GetBacklight i 0 2>&1; ' + AVOC + 'GetContrast i 0 2>&1').then(function (r) {
      var lines = String((r && r.output) || '').trim().split('\n'), w, v, k = 0;
      var ids = ['backlight', 'contrast'];
      for (k = 0; k < lines.length; k++) {
        w = lines[k].trim().split(/\s+/);
        if (w.length >= 2 && ids[k]) {
          v = parseInt(w[1], 10);
          if (!isNaN(v)) state.values[ids[k]] = v;
        }
      }
    });
  }

  function write(row, want) {
    if (state.busy) return;
    state.busy = true;
    var before = { backlight: state.values.backlight, contrast: state.values.contrast };
    var cmd = AVOC + row.set + ' ' + want + ' 1 2>&1; ' + AVOC + row.get + ' 2>&1';
    exec(cmd).then(function (r) {
      state.busy = false;
      if (!r.sent || !r.output) { state.note = 'The screen did not answer; the value may not have changed.'; paint(); return; }
      var lines = String(r.output).trim().split('\n'), w = lines[lines.length - 1].trim().split(/\s+/);
      var back = parseInt(w[1], 10);
      if (isNaN(back)) { state.note = 'The screen did not answer for that value.'; paint(); return; }
      state.values[row.id] = back;
      state.note = back === want ? '' : 'The screen set ' + valueText(row) + ' instead.';
      paint();
      if (!row.coded) return;
      return readAll().then(function () { return carryValues(before); }).then(paint);
    });
  }

  function step(delta) {
    var row = state.rows[state.i];
    if (!row) return;
    var v = state.values[row.id];
    if (typeof v !== 'number') return;
    if (row.coded) {
      var at = 0, i;
      for (i = 0; i < MODES.length; i++) if (MODES[i][0] === v) at = i;
      at = (at + delta + MODES.length) % MODES.length;
      write(row, MODES[at][0]);
      return;
    }
    var max = typeof row.max === 'number' ? row.max : 100;
    var next = Math.max(row.min || 0, Math.min(max, v + delta));
    if (next === v) return;
    state.values[row.id] = next;
    paint();
    write(row, next);
  }

  function paint() {
    if (!listEl) return;
    var html = '', i, row, focused;
    if (state.error) {
      html = '<p class="tvp-error">' + escapeHtml(state.error) + '</p>' +
        '<p class="tvp-hint">Picture controls go through Vetro on the set. The panel reads them from the TV, so it needs Vetro open once.</p>';
    } else {
      for (i = 0; i < state.rows.length; i++) {
        row = state.rows[i];
        focused = i === state.i;
        html += '<div class="tvp-row' + (focused ? ' is-focus' : '') + '" data-i="' + i + '" role="button">' +
          '<span class="tvp-label">' + escapeHtml(row.label) + '</span>' +
          '<span class="tvp-value">' + escapeHtml(valueText(row)) + '</span>' +
          '</div>';
      }
    }
    listEl.innerHTML = html;
    if (noteEl) {
      noteEl.textContent = state.note || (state.rows.length ? 'Left / Right changes the value. Back closes.' : (state.busy ? 'Reading the screen\u2026' : ''));
    }
    if (titleEl) titleEl.textContent = PREVIEW ? 'Picture (preview)' : 'Picture';
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function open() {
    el = el || $('tvPanel');
    if (!el) return false;
    listEl = listEl || $('tvpList');
    noteEl = noteEl || $('tvpNote');
    titleEl = titleEl || $('tvpTitle');
    if (!PREVIEW) state.error = null;
    state.open = true;
    el.hidden = false;
    el.classList.remove('is-open');
    void el.offsetWidth;
    el.classList.add('is-open');
    paint();
    readAll();
    return true;
  }

  function close() {
    if (!el) return;
    state.open = false;
    el.classList.remove('is-open');
    el.hidden = true;
  }

  /* Registered before main.js and on the capture phase: the pane is modal, so a
     key that belongs to it must never also move the focus behind it. */
  document.addEventListener('keydown', function (ev) {
    var code = ev.keyCode;
    if (!state.open) return;
    if (code !== 10009 && code !== 27 && code !== 8 && code !== 13 && code !== 37 && code !== 39 && code !== 38 && code !== 40) return;
    ev.preventDefault();
    ev.stopImmediatePropagation();
    if (code === 10009 || code === 27 || code === 8) { close(); return; }
    if (code === 13 || code === 39) { step(1); return; }
    if (code === 37) { step(-1); return; }
    if (code === 38) { state.i = Math.max(0, state.i - 1); paint(); return; }
    state.i = Math.min(Math.max(0, state.rows.length - 1), state.i + 1);
    paint();
  }, true);

  global.CleanFrameTV = {
    open: open,
    close: close,
    exec: exec,
    mic: mic,
    picture: readAll,
    set: function (id, value) {
      var row = null, i;
      for (i = 0; i < ROWS.length; i++) if (ROWS[i].id === id) row = ROWS[i];
      if (row) write(row, value);
    },
    state: function () { return { rows: state.rows.map(function (r) { return r.id; }), values: state.values, error: state.error }; }
  };
})(window);
