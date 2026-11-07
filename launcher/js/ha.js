/* ha.js - Home Assistant for the Home app (home-app.js).

   The Home app draws the house; this file is the only thing that talks to
   Home Assistant. The address and a long-lived access token come from
   js/keys.local.js, which is ignored by Git and never ships:

     window.APL_KEYS = { ha: {
       url:   "http://homeassistant.local:8123/tv",   // the dashboard, for the tile
       token: "<long-lived access token>",            // Profile -> Security
       name:  "Home",
       rooms: [ { id: "living", name: "Living Room", devices: [ ... ] } ],
       scenes: [ { id: "scene.movie", name: "Movie Night", type: "scene" } ]
     } };

   A long-lived access token is a plain string: no login flow to redo, no
   expiry to chase, and deleting it under Profile -> Security cuts this screen
   off at once. Every read is GET /api/states carrying "Authorization: Bearer
   <token>"; every press is POST /api/services/<domain>/<service>. Nothing
   here invents state: the map below is what Home Assistant last said, except
   in a browser preview with no token, where a small demo house is drawn so
   the screen has something to show.

   ES5, no dependencies: the TV's WebKit is old and this runs beside the
   launcher's own loop. */
(function (root) {
  'use strict';

  var K = (root.APL_KEYS && root.APL_KEYS.ha) || {};
  var token = String(K.token || '');
  var PREVIEW = !!(root.APL && root.APL.sys && root.APL.sys.PREVIEW);

  /* "http://host:8123/tv" -> "http://host:8123": the API sits at the root of
     the dashboard's origin, whatever path the dashboard itself is on. */
  function base() {
    var u = String(K.url || '');
    if (!u) return '';
    var a = root.document.createElement('a');
    a.href = u;
    if (!a.protocol || !a.host) return '';
    return a.protocol + '//' + a.host;
  }

  var ROOMS = K.rooms || [];
  var SCENES = K.scenes || [];
  var states = {};
  var listeners = [];
  var online = false;
  var timer = 0;
  var POLL = 10000;

  function notify() {
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](); } catch (e) {}
    }
  }

  function getState(id) {
    return states[id] || null;
  }

  /* ---------- preview: no token in a browser, so draw a house ---------- */
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

  /* ---------- REST ---------- */
  function refresh() {
    var b = base();
    if (!b || !token) { if (PREVIEW) notify(); return; }
    var x = new XMLHttpRequest();
    x.open('GET', b + '/api/states', true);
    x.setRequestHeader('Authorization', 'Bearer ' + token);
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
        } catch (e) { online = false; }
      }
      notify();
    };
    x.send();
  }

  function service(domain, svc, data) {
    if (PREVIEW && !token) { applyLocally(svc, data || {}); return; }
    var b = base();
    if (!b || !token) return;
    var x = new XMLHttpRequest();
    x.open('POST', b + '/api/services/' + domain + '/' + svc, true);
    x.setRequestHeader('Authorization', 'Bearer ' + token);
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

  if (PREVIEW && !token) seedDemo();

  root.CleanFrameHA = {
    enabled: !!(base() && token),
    preview: PREVIEW && !token,
    dashboard: String(K.url || ''),
    ROOMS: ROOMS,
    SCENES: SCENES,
    getState: getState,
    getAllStates: function () { return states; },
    isOnline: function () { return online || (PREVIEW && !token); },
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
