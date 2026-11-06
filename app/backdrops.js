/* CleanFrame dynamic backdrops - one current title per streaming app.
   The catalogue is JustWatch's public trending list for the viewer's storefront;
   the same provider Search uses. Every pick is a single landscape backdrop, and
   each app keeps its own rotation so a later launch shows a different title.
   ES5, no live blur, no image pixels read at runtime. */
(function (root) {
  'use strict';

  /* v2: the artwork profile changed, so the cached catalogue is rebuilt rather
     than keeping a session of the old, heavier images. */
  /* v5: the fast artwork profile moved to s1440. A stored catalogue carries its
     own addresses, and v4 held s1280 ones that this host answers with 400, so
     the key has to move again or the launcher keeps the broken copies for six
     hours. */
  var STORE_KEY = 'cleanframe.backdrops.v5';
  var WATCH_URL = 'https://apis.justwatch.com/graphql';
  var IMAGE_BASE = 'https://images.justwatch.com';
  /* 1920 is what this host's backdrop CDN tops out at (there is no 4K set of
     these frames), and the stage is a 1920x1080 surface the panel upscales - so
     1920 is the sharp copy, a true 1:1 frame rather than the 1440 that read as
     soft on a 4K set. 640 is the same picture at 41 KB against 300-440, used to
     put the right artwork on screen within one dwell and swapped for the sharp
     frame in the background once it has arrived. */
  var PROFILE = 's1920';
  /* 1440 rather than 640: the fast copy is painted on the stage while the sharp
     frame is still arriving, and at 640 a 1920-wide stage stretched it three
     times over - on the first scrolls the backdrop read as a zoom that then
     snapped into place. 1440 is the next profile this host actually serves
     above 640 (1280 returns 400), and at a 1.33x upscale the swap is no longer
     visible as a change of scale. */
  var PROFILE_FAST = 's1440';
  var FRESH = 6 * 60 * 60 * 1000;
  var MAX_PICKS = 5;
  var GENERAL = 'general';
  /* Artwork that ships with the widget instead of coming from the catalogue.
     YouTube's tile has no public trending list, so its backdrop is bundled.
     assets/backdrops/catalog.js is generated at package time: a private build
     can point a key at artwork kept in ignored .local/ storage, while the
     committed catalogue keeps the public drawing. */
  var BUNDLED = {
    youtube: { title: '', year: 0, url: 'assets/backdrops/youtube.svg', bundled: true },
    /* The Home tile opens the launcher's own dashboard, so it has no storefront
       list to draw from: its backdrop is the Home glyph, bundled. */
    homecontrol: { title: '', year: 0, url: 'assets/backdrops/home-app-photo.jpg', bundled: true },
    /* Settings is CleanFrame's own screen too: it opens on the reference set's
       room photograph rather than a drawn mark. */
    settingsapp: { title: '', year: 0, url: 'assets/backdrops/settings.jpg', bundled: true }
  };
  (function () {
    var chosen = root.CleanFrameBundledBackdrops || {}, key;
    for (key in BUNDLED) {
      if (Object.prototype.hasOwnProperty.call(BUNDLED, key) && typeof chosen[key] === 'string' && chosen[key]) {
        BUNDLED[key].url = chosen[key];
      }
      if (has(BUNDLED, key)) BUNDLED[key].fast = BUNDLED[key].url;
    }
  }());
  /* Package technical names are reported on each offer. JustWatch's own package
     filter is ignored on some storefronts, so the catalogue is filtered here. */
  var SERVICES = {
    netflix: ['netflix', 'netflixbasicwithads'],
    primevideo: ['amazonprimevideo', 'amazonprimevideowithads'],
    hotstar: ['jiohotstar', 'hotstar'],
    appletv: ['appletvplus', 'itunes'],
    sonyliv: ['sonyliv'],
    /* Stremio has no public catalogue of its own, so it shares the storefront's
       trending list rather than claiming a provider's titles. */
    stremio: null
  };
  /* Apps that draw their titles from another app's list instead of their own.
     Nuvio runs Netflix's catalogue, so its backdrop comes from Netflix's picks.
     Both installed ids are named; `nuvio` is kept so either one resolves. */
  var SHARES = {
    nuvio: 'netflix', nuviotv: 'netflix',
    /* The YouTube family shares its bundled artwork: same platform, so the same
       poster is the truthful one, and every tile on the dock has a backdrop. */
    tizentube: 'youtube', youtubetv: 'youtube', youtubekids: 'youtube'
  };
  var QUERY = 'query CleanFrameBackdrop($country: Country!, $language: Language!, $first: Int!) { ' +
    'popularTitles(country: $country, first: $first, sortBy: TRENDING) { edges { node { ' +
    'objectType content(country: $country, language: $language) { title originalReleaseYear ' +
    'backdrops { backdropUrl } } ' +
    'offers(country: $country, platform: WEB) { package { technicalName } } } } } }';

  var cache = null;
  var listeners = [];
  var started = false;
  var loading = false;
  var advanced = false;
  /* One different title per app for as long as it is held. Set by assign() from
     the row the launcher actually shows; null until then. */
  var assignment = null;

  function now() { return Date.now(); }
  function has(object, key) { return Object.prototype.hasOwnProperty.call(object, key); }

  function readStore() {
    try { return JSON.parse(root.localStorage.getItem(STORE_KEY) || 'null'); }
    catch (e) { return null; }
  }
  function writeStore(value) {
    try { root.localStorage.setItem(STORE_KEY, JSON.stringify(value)); return true; }
    catch (e) { return false; }
  }
  /* The storefront follows the same rule as Search: cached weather country, then
     the TV's locale or time zone. */
  function storefront() {
    var c = root.CleanFrameStatus && root.CleanFrameStatus.country && root.CleanFrameStatus.country();
    if (c && /^[A-Za-z]{2}$/.test(c)) return c.toUpperCase();
    var lang = root.navigator.language || '';
    var match = /[-_]([A-Za-z]{2})$/.exec(lang);
    if (match) return match[1].toUpperCase();
    var tz = '';
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}
    if (tz.indexOf('Kolkata') >= 0 || tz.indexOf('Calcutta') >= 0) return 'IN';
    if (tz.indexOf('London') >= 0) return 'GB';
    if (tz.indexOf('Sydney') >= 0 || tz.indexOf('Melbourne') >= 0) return 'AU';
    if (tz.indexOf('Tokyo') >= 0) return 'JP';
    if (tz.indexOf('America/') === 0) return 'US';
    return 'US';
  }
  function imageUrl(path, profile) {
    if (!path) return '';
    if (path.indexOf('http') === 0) return path;
    return IMAGE_BASE + path.replace('{profile}', profile || PROFILE).replace('{format}', 'jpg');
  }
  /* The small copy of an address that is already resolved. Anything that is not
     a catalogue frame (a bundled drawing, a file) is its own only copy. */
  function fastUrl(url) {
    if (!url || url.indexOf(IMAGE_BASE) !== 0) return url || '';
    return url.replace('/' + PROFILE + '/', '/' + PROFILE_FAST + '/');
  }
  /* A catalogue written by an earlier build carries only the 1440 addresses.
     Fill in the small copy in place instead of rebuilding it: a profile change
     would throw away a perfectly good list and leave the first launch after an
     update with no posters at all until JustWatch answers. */
  function ensureFast() {
    var keys = cache && cache.picks ? Object.keys(cache.picks) : [], i, j, list, item;
    for (i = 0; i < keys.length; i++) {
      list = cache.picks[keys[i]];
      if (!list) continue;
      for (j = 0; j < list.length; j++) {
        item = list[j];
        if (item && item.url && !item.fast) item.fast = fastUrl(item.url);
      }
    }
  }
  function post(body, callback) {
    var finished = false, xhr;
    function finish(err, data) {
      if (finished) return;
      finished = true;
      callback(err, data);
    }
    try { xhr = new root.XMLHttpRequest(); }
    catch (e) { finish(e); return; }
    xhr.open('POST', WATCH_URL, true);
    xhr.timeout = 12000;
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onreadystatechange = function () {
      var data;
      if (xhr.readyState !== 4) return;
      if (xhr.status < 200 || xhr.status >= 300) { finish(new Error('Status ' + xhr.status)); return; }
      try { data = JSON.parse(xhr.responseText); }
      catch (e) { finish(e); return; }
      finish(null, data);
    };
    xhr.ontimeout = function () { finish(new Error('Timeout')); };
    xhr.onerror = function () { finish(new Error('Network error')); };
    try { xhr.send(body); } catch (e) { finish(e); }
  }

  function notify() {
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](); } catch (e) {}
    }
  }

  /* One trending pass fills every service. A service with too few of its own
     titles is topped up from the storefront list so its app still has a
     backdrop, and the entry records that it came from the wider list. */
  function pushUnique(list, item) {
    for (var i = 0; i < list.length; i++) if (list[i].url === item.url) return false;
    list.push(item);
    return true;
  }
  function buildPicks(data, country) {
    var edges = data && data.data && data.data.popularTitles && data.data.popularTitles.edges;
    /* The artwork profile travels with the cache: a stored catalogue whose
       image widths no longer match the one this build asks for is stale, not
       reusable - otherwise every poster 404s until the six hours run out. */
    var picks = { country: country, profile: PROFILE, at: now(), picks: {}, cursors: (cache && cache.cursors) || {} };
    var general = [], keys = Object.keys(SERVICES), i, k;
    if (!edges) return null;
    picks.picks[GENERAL] = general;
    for (k = 0; k < keys.length; k++) picks.picks[keys[k]] = [];
    for (i = 0; i < edges.length; i++) {
      var node = edges[i] && edges[i].node;
      var content = node && node.content;
      var backdrops = content && content.backdrops;
      var url = imageUrl(backdrops && backdrops[0] && backdrops[0].backdropUrl);
      if (!url) continue;
      var packages = [], offers = node.offers || [];
      for (var o = 0; o < offers.length; o++) {
        if (offers[o] && offers[o].package && offers[o].package.technicalName) packages.push(offers[o].package.technicalName);
      }
      var item = { title: content.title || '', year: content.originalReleaseYear || 0, url: url, fast: fastUrl(url) };
      if (general.length < MAX_PICKS) pushUnique(general, item);
      for (k = 0; k < keys.length; k++) {
        var aliases = SERVICES[keys[k]];
        if (!aliases || picks.picks[keys[k]].length >= MAX_PICKS) continue;
        for (var p = 0; p < aliases.length; p++) {
          if (packages.indexOf(aliases[p]) >= 0) { pushUnique(picks.picks[keys[k]], item); break; }
        }
      }
    }
    /* Nuvio and Stremio share the storefront list. A service with fewer than two
       of its own titles is topped up so it still rotates between launches. */
    for (k = 0; k < keys.length; k++) {
      var list = picks.picks[keys[k]], g;
      if (!SERVICES[keys[k]]) { picks.picks[keys[k]] = general.slice(0, MAX_PICKS); continue; }
      for (g = 0; g < general.length && list.length < 2; g++) {
        pushUnique(list, { title: general[g].title, year: general[g].year, url: general[g].url, fast: general[g].fast, shared: true });
      }
    }
    return picks;
  }

  function save() {
    if (!cache) return;
    writeStore(cache);
  }

  /* Advance only when this document has cached choices, so a first run starts at
     the newest pick and every later launch opens on a different title. */
  function advanceCursors() {
    if (advanced || !cache || !cache.picks) return;
    advanced = true;
    var changed = false, keys = Object.keys(cache.picks), i;
    for (i = 0; i < keys.length; i++) {
      var list = cache.picks[keys[i]];
      if (!list || !list.length) continue;
      cache.cursors = cache.cursors || {};
      cache.cursors[keys[i]] = ((cache.cursors[keys[i]] || 0) + 1) % list.length;
      changed = true;
    }
    if (changed) save();
  }

  function refresh() {
    if (loading) return;
    loading = true;
    var country = storefront();
    post(JSON.stringify({
      operationName: 'CleanFrameBackdrop',
      query: QUERY,
      variables: { country: country, language: 'en', first: 100 }
    }), function (err, data) {
      loading = false;
      if (err) return;
      var next = buildPicks(data, country);
      if (!next) return;
      if (!cache) advanced = true; /* first catalogue: start at the newest pick */
      next.cursors = next.cursors || {};
      cache = next;
      assignment = null;
      save();
      notify();
    });
  }

  function start(listener) {
    if (typeof listener === 'function') listeners.push(listener);
    if (started) { if (cache) notify(); return; }
    started = true;
    if (!cache) cache = readStore();
    if (cache) {
      cache.picks = cache.picks || {};
      cache.cursors = cache.cursors || {};
      ensureFast();
      advanceCursors();
      assignment = null;
    }
    notify();
    /* Let the launcher paint and settle before the catalogue request. */
    setTimeout(function () {
      var stale = !cache || !cache.at || cache.profile !== PROFILE || cache.country !== storefront() || (now() - cache.at) > FRESH;
      if (stale) refresh();
    }, 1500);
    setInterval(function () {
      if (!cache || !cache.at || (now() - cache.at) > FRESH) refresh();
    }, FRESH);
  }

  function keyFor(id) { if (has(BUNDLED, id)) return id; if (has(SHARES, id)) return SHARES[id]; return has(SERVICES, id) ? (SERVICES[id] ? id : GENERAL) : ''; }

  /* The same title sits near the top of several provider lists and at the top of
     the storefront list, so on a fresh catalogue every app would open on one
     image and moving along the row would look like nothing happened. Assign each
     app the first title no earlier app in the row has taken, starting from its
     own rotation point. */
  function assignFrom(ids) {
    var taken = {}, out = {}, i, j, id, key, list, start, cand, pick;
    for (i = 0; i < ids.length; i++) {
      id = ids[i];
      if (has(BUNDLED, id)) { out[id] = BUNDLED[id]; continue; }
      key = keyFor(id);
      list = key && cache && cache.picks && cache.picks[key];
      if (!list || !list.length) continue;
      start = ((cache.cursors && cache.cursors[key]) || 0) % list.length;
      pick = null;
      for (j = 0; j < list.length; j++) {
        cand = list[(start + j) % list.length];
        if (cand && !taken[cand.url]) { pick = cand; break; }
      }
      /* Every title in the list is already shown by a neighbour: keep the
         app's own rotation pick rather than returning nothing. */
      if (!pick) pick = list[start];
      if (pick) { out[id] = pick; taken[pick.url] = true; }
    }
    return out;
  }

  /* Which title one app should slide to when it is left in focus: walk its own
     list from the pick it is showing and take the first title no other app on
     the row is showing, so a dwell never brings in a neighbour's poster. The
     row is only a preference - when every other title is already on the row the
     next different one wins, so a held tile keeps moving instead of freezing. */
  function nextPick(id, row) {
    var key, list, current, taken = {}, start = 0, pass, i, j, cand, other;
    if (!assignment || !assignment[id]) return null;
    key = keyFor(id);
    list = key && cache && cache.picks && cache.picks[key];
    if (!list || list.length < 2) return null;
    row = row || [];
    for (i = 0; i < row.length; i++) {
      other = assignment[row[i]];
      if (other && other.url) taken[other.url] = true;
    }
    current = assignment[id];
    for (i = 0; i < list.length; i++) if (list[i] === current) { start = i; break; }
    for (pass = 0; pass < 2; pass++) {
      for (j = 1; j <= list.length; j++) {
        cand = list[(start + j) % list.length];
        if (!cand) continue;
        if (!pass) { if (!taken[cand.url]) return cand; }
        else if (cand.url !== current.url) return cand;
      }
    }
    return null;
  }

  /* Is this address already the backdrop of some other app? */
  function usesUrl(url, id) {
    var other;
    for (other in assignment) {
      if (!has(assignment, other) || other === id) continue;
      if (assignment[other] && assignment[other].url === url) return true;
    }
    return false;
  }
  /* Remember the title a pick settled on, so the next render agrees with it. */
  function remember(id, pick) {
    if (!assignment) assignment = {};
    assignment[id] = pick;
  }

  root.CleanFrameBackdrops = {
    supports: function (id) { return keyFor(id) !== ''; },
    /* Hand the row the launcher shows so its apps get distinct titles. */
    assign: function (ids) {
      if (!ids || !ids.length || !cache || !cache.picks) { assignment = null; return null; }
      assignment = assignFrom(ids);
      return assignment;
    },
    /* The single backdrop this launch shows for an app, or null.

       A pick must never collide with the pick of another app that is on screen.
       Two tiles showing the same poster is indistinguishable from a backdrop
       that failed to change, which is exactly how a slow set made the row look
       out of sync: the catalogue arrived late, the assignment never had a list
       to hand out, and every provider fell back to the storefront's first title.
       So a pick that is already taken is walked to the next distinct title and
       remembered, whether or not assign() has run yet. */
    pick: function (id) {
      var key, list, index, i, cand, url;
      if (has(BUNDLED, id)) return BUNDLED[id];
      if (assignment && assignment[id]) return assignment[id];
      key = keyFor(id); if (!key || !cache || !cache.picks) return null;
      list = cache.picks[key];
      if (!list || !list.length) return null;
      index = (cache.cursors && cache.cursors[key] || 0) % list.length;
      cand = list[index];
      if (!cand || !usesUrl(cand.url, id)) return cand;
      for (i = 1; i <= list.length; i++) {
        cand = list[(index + i) % list.length];
        if (cand && cand.url && !usesUrl(cand.url, id)) { remember(id, cand); return cand; }
      }
      return list[index];
    },
    /* The titles this app is currently showing on its own list, in order. The
       Top Shelf is built from these, so its row is the same real catalogue the
       backdrop comes from rather than a second, invented one. */
    list: function (id, n) {
      var key, list, out = [], start, i, cand;
      if (has(BUNDLED, id)) return [BUNDLED[id]];
      key = keyFor(id);
      list = key && cache && cache.picks && cache.picks[key];
      if (!list || !list.length) return out;
      start = ((cache.cursors && cache.cursors[key]) || 0) % list.length;
      for (i = 0; i < list.length && out.length < (n || 6); i++) {
        cand = list[(start + i) % list.length];
        if (cand) out.push(cand);
      }
      return out;
    },
    /* The title a focus dwell would slide in, without committing it, so the
       launcher can start downloading it before the move is due. */
    peek: function (id, row) { return nextPick(id, row); },
    /* Commit that title as the app's pick, so the row keeps its distinct-title
       guarantee and moving away and back does not resurrect an older poster. */
    rotate: function (id, row) {
      var pick = nextPick(id, row);
      if (pick && assignment) assignment[id] = pick;
      return pick;
    },
    start: start,
    refresh: refresh,
    /* Read-only status for browser checks; no titles are exposed to the UI. */
    status: function () {
      var counts = {}, keys = cache && cache.picks ? Object.keys(cache.picks) : [], b;
      for (b = 0; b < Object.keys(BUNDLED).length; b++) counts[Object.keys(BUNDLED)[b]] = 1;
      for (var i = 0; i < keys.length; i++) counts[keys[i]] = cache.picks[keys[i]].length;
      return { country: cache && cache.country || '', at: cache && cache.at || 0, counts: counts, loading: loading };
    }
  };
}(window));
