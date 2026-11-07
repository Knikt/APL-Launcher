/* ha.js - Home Assistant for the Home app (home-app.js).

   The Home app draws the house; this file is the only thing that talks to
   Home Assistant, and the only thing that knows how to get a token.

   Three ways in, in order of what a viewer will actually use:

   1. Sign in on the TV with the account they already have. Home Assistant's
      own auth flow issues the token and this file keeps it: POST
      /auth/login_flow, then /auth/login_flow/<id> with the password, then
      /auth/token with the code. The access token lives 30 minutes and is
      renewed with its refresh token, which Home Assistant extends on every
      use - so the screen stays signed in until the account says otherwise
      (Profile -> Security shows the session and can end it).
   2. Paste a long-lived access token (Profile -> Security -> Long-lived
      access tokens). Nothing to renew, nothing to expire, revocable there.
   3. js/keys.local.js, for an installation packaged with its token already
      in it: ignored by Git, never shipped.

   The connection is stored on the screen (localStorage, "apl.ha.conn"):
   address, token, refresh token and expiry. No credential is ever written
   into this repository or into a public build.

   Every read is GET /api/states carrying "Authorization: Bearer <token>";
   every press is POST /api/services/<domain>/<service>. Nothing here invents
   state: the map below is what Home Assistant last said, except in a browser
   preview with no connection, where a small demo house is drawn so the
   screen has something to show.

   ES5, no dependencies: the TV's WebKit is old and this runs beside the
   launcher's own loop. */
(function (root) {
  'use strict';

  var STORE = 'apl.ha.conn';
  var K = (root.APL_KEYS && root.APL_KEYS.ha) || {};
  var PREVIEW = !!(root.APL && root.APL.sys && root.APL.sys.PREVIEW);
  /* Home Assistant ties the code it issues to the client that asked for it,
     so this string has to be the same in both requests. It is a name, not a
     URL the TV has to be reachable at. */
  var CID = 'http://apl-launcher.local';
  var POLL = 10000;

  var conn = load();
  var pendingBase = '';
  var states = {};
  var listeners = [];
  var online = false;
  var timer = 0;
  var ROOMS = (conn && conn.rooms) || K.rooms || [];
  var SCENES = (conn && conn.scenes) || K.scenes || [];

  function load() {
    try {
      var raw = root.localStorage.getItem(STORE);
      if (!raw) return null;
      var c = JSON.parse(raw);
      return c && c.url ? c : null;
    } catch (e) { return null; }
  }
  function store(c) {
    conn = c;
    try {
      if (c) root.localStorage.setItem(STORE, JSON.stringify(c));
      else root.localStorage.removeItem(STORE);
    } catch (e) {}
    root.CleanFrameHA.enabled = !!(dashboardUrl() && token());
  }

  /* "http://host:8123/tv" -> "http://host:8123": the API sits at the root of
     the dashboard's origin, whatever path the dashboard itself is on. */
  function originOf(u) {
    var a = root.document.createElement('a');
    a.href = String(u || '');
    if (!a.protocol || !a.host || !/^https?:$/i.test(a.protocol)) return '';
    return a.protocol + '//' + a.host;
  }
  function base() {
    if (pendingBase) return pendingBase;
    return originOf(dashboardUrl());
  }
  function dashboardUrl() {
    return String((conn && conn.url) || K.url || '');
  }
  function token() {
    return String((conn && conn.token) || K.token || '');
  }

  function notify() {
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](); } catch (e) {}
    }
  }

  function getState(id) {
    return states[id] || null;
  }

  /* ---------- preview: no connection in a browser, so draw a house ---------- */
  function demoState(d) {
    var a = {}, type = d.type || 'switch';
    if (type === 'climate') { a.temperature = 21; a.current_temperature = 22.5; }
    if (type === 'light') a.brightness = 204;
    if (type === 'fan') { a.percentage = 66; a.percentage_step = 16.667; }
    if (type === 'media') { a.volume_level = 0.28; a.media_title = 'Radio Nova'; }
    /* Climate reports its mode ('cool'), not 'on': the app decides "is it
       running" from the mode, exactly as it does against a real instance. */
    return { entity_id: d.id, state: type === 'scene' ? 'scene' : (type === 'climate' ? 'cool' : 'on'), attributes: a };
  }
  function seedDemo() {
    var i, j, d, room;
    for (i = 0; i < ROOMS.length; i++) {
      room = ROOMS[i];
      for (j = 0; j < (room.devices || []).length; j++) {
        d = room.devices[j];
        if (d && d.id) states[d.id] = demoState(d);
      }
    }
  }

  function applyLocally(svc, data) {
    var ids = data.entity_id ? String(data.entity_id).split(',') : [], i, id, st;
    for (i = 0; i < ids.length; i++) {
      id = ids[i].replace(/^\s+|\s+$/g, '');
      st = states[id];
      if (!st) continue;
      st.attributes = st.attributes || {};
      if (svc === 'turn_on') st.state = id.indexOf('scene.') === 0 ? 'scene' : (id.indexOf('climate.') === 0 ? 'cool' : 'on');
      else if (svc === 'turn_off') st.state = 'off';
      else if (svc === 'toggle') st.state = st.state === 'on' ? 'off' : 'on';
      if (typeof data.brightness_pct === 'number') st.attributes.brightness = Math.round(data.brightness_pct * 2.55);
      if (typeof data.percentage === 'number') st.attributes.percentage = data.percentage;
      if (typeof data.volume_level === 'number') st.attributes.volume_level = data.volume_level;
      if (typeof data.temperature === 'number') st.attributes.temperature = data.temperature;
      if (data.hvac_mode) st.state = data.hvac_mode;
    }
    notify();
  }

  /* ---------- the house, when nobody typed one in ---------- */
  var DOMAIN = { light: 'light', switch: 'switch', climate: 'climate', fan: 'fan', media_player: 'media' };
  function deriveHouse() {
    if (ROOMS.length) return;
    var devs = [], scenes = [], id, type, st, name, friendly;
    for (id in states) {
      if (!states.hasOwnProperty(id)) continue;
      type = id.split('.')[0];
      st = states[id] || {};
      friendly = st.attributes && st.attributes.friendly_name;
      name = String(friendly || id.split('.').slice(1).join(' ').replace(/_/g, ' '));
      if (DOMAIN[type]) devs.push({ id: id, name: name, type: DOMAIN[type] });
      else if (type === 'scene') scenes.push({ id: id, name: name, type: 'scene' });
    }
    if (!devs.length && !scenes.length) return;
    devs.sort(function (a, b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : 0; });
    scenes.sort(function (a, b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : 0; });
    ROOMS = [{ id: 'home', name: 'Home', devices: devs.slice(0, 30) }];
    SCENES = scenes.slice(0, 12);
    root.CleanFrameHA.ROOMS = ROOMS;
    root.CleanFrameHA.SCENES = SCENES;
  }

  /* ---------- auth ---------- */
  function postJson(path, body, cb) {
    var b = base();
    if (!b) { cb(0, null); return; }
    var x = new XMLHttpRequest();
    x.open('POST', b + path, true);
    x.setRequestHeader('Content-Type', 'application/json');
    x.onreadystatechange = function () {
      if (x.readyState !== 4) return;
      var data = null;
      try { data = JSON.parse(x.responseText); } catch (e) {}
      cb(x.status, data);
    };
    x.onerror = function () { cb(0, null); };
    x.send(JSON.stringify(body || {}));
  }

  function why(st) {
    if (st === 0) return 'Home Assistant did not answer. Check the address, and that the TV is on the same network.';
    if (st === 403) return 'Home Assistant refused the request. It may not allow this screen yet (CORS).';
    if (st === 401) return 'Home Assistant refused those details.';
    return 'Home Assistant answered ' + st + '.';
  }

  /* Sign in with the account the viewer already has. Home Assistant issues
     the token; the password is used once, in this request, and is never
     stored. */
  function connect(url, user, pass, cb) {
    var u = String(url || '').replace(/^\s+|\s+$/g, '').replace(/\/+$/, '');
    var origin = originOf(u);
    if (!origin) { cb('The address should look like http://homeassistant.local:8123'); return; }
    if (!user || !pass) { cb('Enter the username and password of a Home Assistant account.'); return; }
    pendingBase = origin;
    postJson('/auth/login_flow', {
      client_id: CID,
      handler: ['homeassistant', null],
      redirect_uri: CID + '/'
    }, function (st, d) {
      if (st !== 200 || !d || !d.flow_id) { pendingBase = ''; cb(why(st)); return; }
      postJson('/auth/login_flow/' + d.flow_id, {
        client_id: CID,
        username: user,
        password: pass
      }, function (st2, d2) {
        if (st2 !== 200 || !d2) { pendingBase = ''; cb(why(st2)); return; }
        if (d2.type !== 'create_entry' || !d2.result) {
          pendingBase = '';
          cb(d2.errors ? 'Home Assistant did not accept that username or password.' :
                         'That account has to finish its setup in Home Assistant first.');
          return;
        }
        postJson('/auth/token', {
          grant_type: 'authorization_code',
          code: d2.result,
          client_id: CID
        }, function (st3, d3) {
          pendingBase = '';
          if (st3 !== 200 || !d3 || !d3.access_token) { cb(why(st3)); return; }
          store({
            url: u,
            token: d3.access_token,
            refresh: d3.refresh_token || '',
            expires: Date.now() + (d3.expires_in || 1800) * 1000
          });
          refresh();
          cb(null);
        });
      });
    });
  }

  /* The other door: a long-lived token, checked before it is kept. */
  function setToken(url, tok, cb) {
    var u = String(url || '').replace(/^\s+|\s+$/g, '').replace(/\/+$/, '');
    var origin = originOf(u);
    tok = String(tok || '').replace(/^\s+|\s+$/g, '');
    if (!origin) { cb('The address should look like http://homeassistant.local:8123'); return; }
    if (!tok) { cb('Paste the token Home Assistant showed you.'); return; }
    pendingBase = origin;
    var x = new XMLHttpRequest();
    x.open('GET', origin + '/api/states', true);
    x.setRequestHeader('Authorization', 'Bearer ' + tok);
    x.onreadystatechange = function () {
      if (x.readyState !== 4) return;
      pendingBase = '';
      if (x.status === 200) {
        store({ url: u, token: tok, refresh: '', expires: 0 });
        refresh();
        cb(null);
      } else {
        cb(x.status === 401 ? 'Home Assistant refused that token.' : why(x.status));
      }
    };
    x.onerror = function () { pendingBase = ''; cb(why(0)); };
    x.send();
  }

  function disconnect() {
    store(null);
    states = {};
    online = false;
    notify();
  }

  /* ---------- REST ---------- */
  function renew(cb) {
    if (!conn || !conn.refresh) { cb(); return; }
    if (conn.expires && Date.now() < conn.expires - 60000) { cb(); return; }
    pendingBase = originOf(conn.url);
    postJson('/auth/token', {
      grant_type: 'refresh_token',
      refresh_token: conn.refresh,
      client_id: CID
    }, function (st, d) {
      pendingBase = '';
      if (st === 200 && d && d.access_token) {
        store({
          url: conn.url,
          token: d.access_token,
          refresh: d.refresh_token || conn.refresh,
          expires: Date.now() + (d.expires_in || 1800) * 1000
        });
      }
      cb();
    });
  }

  function refresh() {
    var b = originOf(dashboardUrl());
    if (!b || !token()) { if (PREVIEW && !conn) notify(); return; }
    renew(function () {
      var x = new XMLHttpRequest();
      x.open('GET', b + '/api/states', true);
      x.setRequestHeader('Authorization', 'Bearer ' + token());
      x.onreadystatechange = function () {
        if (x.readyState !== 4) return;
        online = x.status >= 200 && x.status < 300;
        if (online) {
          try {
            var list = JSON.parse(x.responseText), i, id, map = {};
            for (i = 0; i < list.length; i++) {
              id = list[i].entity_id;
              if (id) map[id] = list[i];
            }
            states = map;
            deriveHouse();
          } catch (e) { online = false; }
        }
        notify();
      };
      x.onerror = function () { online = false; notify(); };
      x.send();
    });
  }

  function service(domain, svc, data) {
    if (PREVIEW && !token()) { applyLocally(svc, data || {}); return; }
    var b = originOf(dashboardUrl());
    if (!b || !token()) return;
    var x = new XMLHttpRequest();
    x.open('POST', b + '/api/services/' + domain + '/' + svc, true);
    x.setRequestHeader('Authorization', 'Bearer ' + token());
    x.setRequestHeader('Content-Type', 'application/json');
    x.onreadystatechange = function () {
      if (x.readyState === 4) setTimeout(refresh, 250);
    };
    x.send(JSON.stringify(data || {}));
  }

  function domainOf(id) { return String(id || '').split('.')[0]; }
  function num(v, d) { return typeof v === 'number' ? v : d; }

  function toggleEntity(id) {
    if (domainOf(id) === 'scene') { activateScene(id); return; }
    service('homeassistant', 'toggle', { entity_id: id });
  }
  function turnOnEntity(id) { service('homeassistant', 'turn_on', { entity_id: id }); }
  function turnOffEntity(id) { service('homeassistant', 'turn_off', { entity_id: id }); }

  function setBrightness(id, pct) {
    if (pct <= 0) { service('light', 'turn_off', { entity_id: id }); return; }
    service('light', 'turn_on', { entity_id: id, brightness_pct: Math.round(pct) });
  }
  function brightnessPct(id) {
    var a = (getState(id) || {}).attributes || {};
    if (typeof a.brightness === 'number') return Math.round(a.brightness / 2.55);
    return num(a.brightness_pct, 100);
  }

  function setFanSpeed(id, pct) {
    if (pct <= 0) { service('fan', 'turn_off', { entity_id: id }); return; }
    service('fan', 'set_percentage', { entity_id: id, percentage: Math.round(pct) });
  }
  function adjustFanSpeed(id, delta) {
    var a = (getState(id) || {}).attributes || {};
    setFanSpeed(id, Math.max(0, Math.min(100, num(a.percentage, 0) + delta)));
  }
  function stepOf(id) {
    return num(((getState(id) || {}).attributes || {}).percentage_step, 16.667);
  }
  function increaseFanSpeed(id) { adjustFanSpeed(id, stepOf(id)); }
  function decreaseFanSpeed(id) { adjustFanSpeed(id, -stepOf(id)); }

  function setVolume(id, v) {
    service('media_player', 'volume_set', { entity_id: id, volume_level: Math.max(0, Math.min(1, v)) });
  }
  function adjustVolume(id, delta) {
    var a = (getState(id) || {}).attributes || {};
    setVolume(id, num(a.volume_level, 0) + delta);
  }

  function adjustClimateTemp(id, delta) {
    var a = (getState(id) || {}).attributes || {};
    service('climate', 'set_temperature', { entity_id: id, temperature: num(a.temperature, 21) + delta });
  }
  function activateScene(id) { service('scene', 'turn_on', { entity_id: id }); }
  function callService(domain, svc, data) { service(domain, svc, data); }

  function subscribe(fn) {
    if (typeof fn !== 'function') return function () {};
    listeners.push(fn);
    return function () {
      var i = listeners.indexOf(fn);
      if (i >= 0) listeners.splice(i, 1);
    };
  }

  /* Polling runs only while the panel is open: a closed app asks Home
     Assistant nothing, which is the point of an app on a set-top box. */
  function setPanelActive(on) {
    if (on) {
      refresh();
      if (!timer) timer = setInterval(refresh, POLL);
    } else if (timer) {
      clearInterval(timer);
      timer = 0;
    }
  }

  if (PREVIEW && !token()) seedDemo();

  root.CleanFrameHA = {
    enabled: !!(originOf(dashboardUrl()) && token()),
    preview: PREVIEW && !token(),
    connected: function () { return !!(originOf(dashboardUrl()) && token()); },
    dashboardUrl: dashboardUrl,
    dashboard: dashboardUrl(),
    connect: connect,
    setToken: setToken,
    disconnect: disconnect,
    ROOMS: ROOMS,
    SCENES: SCENES,
    getState: getState,
    getAllStates: function () { return states; },
    isOnline: function () { return online || (PREVIEW && !token()); },
    refresh: refresh,
    subscribe: subscribe,
    setPanelActive: setPanelActive,
    toggleEntity: toggleEntity,
    turnOnEntity: turnOnEntity,
    turnOffEntity: turnOffEntity,
    setBrightness: setBrightness,
    brightnessPct: brightnessPct,
    setFanSpeed: setFanSpeed,
    adjustFanSpeed: adjustFanSpeed,
    increaseFanSpeed: increaseFanSpeed,
    decreaseFanSpeed: decreaseFanSpeed,
    adjustVolume: adjustVolume,
    setVolume: setVolume,
    adjustClimateTemp: adjustClimateTemp,
    activateScene: activateScene,
    callService: callService,
    onMovieLaunched: function () {},
    tvSettings: function () {},
    tvOff: function () {},
    tvVolume: function () { return null; },
    tvSetVolume: function () {}
  };
})(window);
