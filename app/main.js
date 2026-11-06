/* CleanFrame Home. Static materials, local preferences and public Tizen app controls. */
(function () {
  'use strict';

  /* ---------- Bundled data ---------- */
  var ASSETS = 'assets/', ICONS = ASSETS + 'icons/', WP = ASSETS + 'wallpapers/';
  var CAP = 20, SCRIM_Y = 560;
  var DOCK_MODES = { both: { tw: 288, th: 200, pitch: 296 }, text: { tw: 288, th: 104, pitch: 296 }, icons: { tw: 176, th: 144, pitch: 184 } };
  var GRID_ROW = 240, GRID_COL = 344, COLS = 5;
  var ED_ROW = 80, ED_SEP = 56, ED_VIEW = 752, STRIP_PITCH = 188;
  var PH_TOP = 220, PH_PITCH = 128, PH_FULL = 5, PH_HEIGHT = 944, PH_COMPACT_TOP = 144, PH_COMPACT_PITCH = 88, PH_COMPACT_VISIBLE = 9;
  var WALL_VISIBLE = 6, WALL_ROW = 92, WALL_DELAY = 200;
  var KEYS = { 37: 'left', 38: 'up', 39: 'right', 40: 'down', 13: 'ok', 27: 'back', 8: 'back', 10009: 'back', 461: 'back' };
  var FULL = 'Home is full. Remove one first.', LAST = 'Home needs one app';

  var PRIMARY_APPS = [
    /* Part of CleanFrame rather than an installed package: the tile opens the
       launcher's own Home app, so it carries a drawn icon and a `builtin` flag
       instead of an app id. */
    { id: 'stremio', name: 'Stremio', mark: true, appId: 'newslO9NqF.stremio' },
    { id: 'netflix', name: 'Netflix', mark: true, appId: 'org.tizen.netflix-app' },
    { id: 'youtube', name: 'YouTube', mark: true, appId: '9Ur5IzDKqV.TizenYouTube' },
    { id: 'appletv', name: 'Apple TV', mark: true, appId: 'com.samsung.tv.aria-video' },
    { id: 'primevideo', name: 'Prime Video', mark: true, appId: 'org.tizen.primevideo' },
    { id: 'hotstar', name: 'JioHotstar', mark: true, appId: 'fiZNCxMH9Y.Hotstar' },
    { id: 'sonyliv', name: 'Sony LIV', mark: true, appId: 'EUKHUxrGQA.SonyLIV' },
    { id: 'applemusic', name: 'Apple Music', mark: true, appId: 'org.tizen.apple.apple-music' },
    { id: 'spotify', name: 'Spotify', mark: true, appId: 'rJeHak5zRg.Spotify' },
    /* The visible app, not `com.samsung.tv.tvPlusDeeplinker`: that one is a
       headless deeplink handler, so its launch succeeds and nothing appears. */
    { id: 'samsungtvplus', name: 'Samsung TV Plus', mark: true, appId: 'com.samsung.tv.tvplus' },
    { id: 'moonlight', name: 'Moonlight', mark: true, appId: 'MoonLightS.MoonlightWasm' },
    { id: 'nuviotv', name: 'Nuvio TV', mark: true, appId: 'NuvioTV001.NuvioTV' },
    { id: 'tizentube', name: 'TizenTube', mark: true, appId: 'xvvl3S1TT1.TizenTubeStandalone' },
    { id: 'alexa', name: 'Amazon Alexa', mark: true, appId: 'AQKO41xyKP.AmazonAlexa' },
    { id: 'youtubetv', name: 'YouTube TV', mark: true, appId: 'com.samsung.tv.cobalt-yttv' },
    { id: 'youtubekids', name: 'YouTube Kids', mark: true, appId: 'com.samsung.tv.cobalt-ytkids' },
    { id: 'internet', name: 'Internet', mark: true, appId: 'org.tizen.browser' }
  ];
  var PRIMARY = PRIMARY_APPS.map(function (a) { return a.id; }), APPS = PRIMARY_APPS.slice(), ALPHA = [];
  /* Folders are slots on Home like an app, but their contents live beside the
     order (`S.c.folders`) rather than in the app catalogue. `FOLDERS` is that
     list keyed by id: `app(id)` resolves a folder to a pseudo-app so every
     existing renderer - the dock, the tiles, the launch - keeps working. */
  var FOLDERS = {};
  /* Part of CleanFrame, drawn as an app: the Home tile opens the Home app, a
     screen of its own over the stage rather than a browser tab. A build with no
     Home Assistant client (the public stub, the preview) has no tile at all,
     and because it has no package behind it, it is never filtered out with the
     TV's apps. */
  var HOME_TILE = { id: 'homecontrol', brand: 'home', name: 'Home', mark: true, builtin: true, home: true, icon: 'assets/icons/home.png' };
  APPS.push(HOME_TILE);
  /* Settings is CleanFrame's own screen, so it is a built-in tile like Home and
     not something the TV reports as installed. Its mark is the gear card the
     reference set uses. */
  var SETTINGS_TILE = { id: 'settingsapp', brand: 'settings', name: 'Settings', builtin: true, settings: true, icon: 'assets/icons/settings.png' };
  APPS.push(SETTINGS_TILE);
  /* The Lite build for the weaker set. It ships its own package identity and a
     reduced archive - no screen saver module or catalogue, no poster module,
     one wallpaper - so this flag only has to keep the interface from offering
     what is not there. It is undefined in the Frame build, so every branch
     below is the same code that set has been running. */
  var LITE = !!window.CleanFrameLite;

  var WALLS = window.CleanFrameWallpapers || [{ id: 'misty', name: 'Misty coast', tone: 'light', ut: { tr: 'mist', br: 'mist' }, frostVeil: .20 }];
  var ADAPTIVE_INK = window.CleanFrameAdaptiveInk || {};
  WALLS.forEach(function (w) { w.ut = w.ut || { tr: 'light', br: 'light' }; w.frostVeil = w.frostVeil || .12; });
  var MODES = [
    { id: 'fixed', name: 'Fixed', min: 0 }, { id: 'open', name: 'Each time Home opens', min: 0 },
    { id: '5', name: 'Every 5 minutes', min: 5 }, { id: '15', name: 'Every 15 minutes', min: 15 },
    { id: '60', name: 'Every hour', min: 60 }
  ];
  var KEY = 'cleanframe.home.v1', storageOk = true, catalog = { loading: false, loaded: false, error: null, request: 0, revision: 0 };
  var QA = window.ShoreQA = { minuteMs: window.ShoreQA && window.ShoreQA.minuteMs || 60000 };

  /* The set this build is for. `profile.js` ships the reference Frame's name
     and its Art Mode; a build packaged for another television replaces that one
     file, so nothing here has to know which model it is running on. */
  var PROFILE = (function () {
    var p = window.CleanFrameProfile || {};
    return {
      name: typeof p.name === 'string' && p.name ? p.name : 'Samsung Frame TV',
      art: p.art !== false
    };
  }());
  var FONTS = {
    sf: { name: 'Apple SF Pro', family: 'SF Pro Display', display: 600, ui: 400, clock: 500 },
    manrope: { name: 'Manrope', family: 'Manrope', display: 600, ui: 500, clock: 500 },
    montreal: { name: 'Neue Montreal', family: 'Study Montreal', display: 300, ui: 400, clock: 300 },
    mori: { name: 'Mori', family: 'Study Mori', display: 200, ui: 400, clock: 200 },
    pangram: { name: 'Pangram Sans', family: 'Study Pangram', display: 300, ui: 400, clock: 300 },
    geist: { name: 'Geist', family: 'Study Geist', display: 300, ui: 400, clock: 300 },
    newsreader: { name: 'Newsreader', family: 'Study Newsreader', display: 400, ui: 400, clock: 400 }
  };
  var PRIVATE_FONTS = window.CleanFramePrivateFontIDs || [], fontMetrics = {}, unavailableFonts = {}, widthCache = {}, fontsReady = false;
  var LOOK_KEYS = ['bg', 'layout', 'apps', 'font', 'controls', 'focus', 'material'];
  var LOOK_VALUES = { bg: ['dark', 'light', 'photo'], layout: ['list', 'dock'], apps: ['icons', 'both', 'text'], font: Object.keys(FONTS).filter(function (id) { return id === 'manrope' || PRIVATE_FONTS.indexOf(id) >= 0; }), controls: ['icons', 'both', 'text'], focus: ['type', 'glass'], material: ['soft', 'frost', 'tint'] };
  var LOOK_NAMES = { bg: 'Background', layout: 'Layout', apps: 'Apps', font: 'Font', controls: 'Home controls', focus: 'Focus', material: 'Material' };
  var VALUE_NAMES = { dark: 'Dark', light: 'Light', photo: 'Photo', list: 'List', dock: 'Dock', type: 'Type', glass: 'Glass', soft: 'Soft', frost: 'Frost', tint: 'Clear tint', icons: 'Icons', both: 'Icons and text', text: 'Text' };
  var UTIL = { art: ['Art Mode', 'art'], apps: ['All apps', 'apps'], home: ['Smart Home', 'home'], arrange: ['Arrange', 'arrange'], settings: ['Settings', 'settings'] };
  var MSG = {
    leave: { title: 'Leave Home?', line: 'Open Samsung Home?', note: '', actions: [['stay', 'Stay'], ['samsung', 'Samsung Home']] }
  };
  var SVG = {
    art: '<path fill="currentColor" stroke="none" d="M3.5 4h17A2.5 2.5 0 0 1 23 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-17A2.5 2.5 0 0 1 1 17.5v-11A2.5 2.5 0 0 1 3.5 4Zm14.5 4.5a1.75 1.75 0 1 0 0-3.5 1.75 1.75 0 0 0 0 3.5ZM2.8 17.5a1 1 0 0 0 .7.3h17a1 1 0 0 0 .8-.4l-5-6.5a1 1 0 0 0-1.6 0L11 15.2l-2.7-3.2a1 1 0 0 0-1.5 0L2.8 17.5Z"/>',
    apps: '<rect x="3" y="3" width="7.5" height="7.5" rx="2.5" fill="currentColor" stroke="none"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2.5" fill="currentColor" stroke="none"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2.5" fill="currentColor" stroke="none"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2.5" fill="currentColor" stroke="none"/>',
    arrange: '<path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" d="M4 8.5h16M16 5.5l3.5 3-3.5 3M20 15.5H4M8 12.5l-3.5 3 3.5 3"/>',
    settings: '<path fill="currentColor" stroke="none" d="M12 8.25a3.75 3.75 0 1 0 0 7.5 3.75 3.75 0 0 0 0-7.5Zm0 1.5a2.25 2.25 0 1 1 0 4.5 2.25 2.25 0 0 1 0-4.5Z"/><path fill="currentColor" stroke="none" d="M10.1 2.5a1.2 1.2 0 0 0-1.18.98l-.34 1.7a7.6 7.6 0 0 0-1.5.87L5.5 5.2a1.2 1.2 0 0 0-1.46.39L2.6 7.9a1.2 1.2 0 0 0 .28 1.5l1.32 1.05c-.07.5-.1 1.01-.1 1.55s.03 1.05.1 1.55L2.88 15.1a1.2 1.2 0 0 0-.28 1.5l1.44 2.31c.33.53.98.74 1.46.39l1.58-.85c.47.34.98.63 1.5.87l.34 1.7c.1.6.61.98 1.18.98h2.88c.57 0 1.08-.38 1.18-.98l.34-1.7c.52-.24 1.03-.53 1.5-.87l1.58.85c.48.35 1.13.14 1.46-.39l1.44-2.31c.33-.52.22-1.2-.28-1.5l-1.32-1.05c.07-.5.1-1.01.1-1.55s-.03-1.05-.1-1.55l1.32-1.05c.5-.3.61-.98.28-1.5l-1.44-2.31a1.2 1.2 0 0 0-1.46-.39l-1.58.85a7.6 7.6 0 0 0-1.5-.87l-.34-1.7a1.2 1.2 0 0 0-1.18-.98h-2.88Z"/>',
    home: '<path fill="currentColor" stroke="none" d="M12 2.35 2.6 9.88a1.1 1.1 0 0 0-.2.72v9.65c0 .6.5 1.1 1.1 1.1h5.25v-5.5a1.25 1.25 0 0 1 1.25-1.25h4a1.25 1.25 0 0 1 1.25 1.25v5.5h5.25c.6 0 1.1-.5 1.1-1.1V10.6c0-.28-.1-.54-.3-.72L12 2.35Z"/>',
    undo: '<path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="M9 7 4.5 11.5 9 16M4.5 11.5h10a5 5 0 0 1 0 10H12"/>',
    check: '<path fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" d="m5 12.5 4.5 4.5 9.5-10"/>',
    plus: '<path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" d="M12 5v14M5 12h14"/>',
    left: '<path fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" d="m15 5.5-6.5 6.5 6.5 6.5"/>',
    right: '<path fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" d="m9 5.5 6.5 6.5L9 18.5"/>',
    up: '<path fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" d="m5.5 15 6.5-6.5 6.5 6.5"/>',
    down: '<path fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" d="m5.5 9 6.5 6.5 6.5-6.5"/>',
    updown: '<path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="m7.5 9 4.5-4.5 4.5 4.5M7.5 15l4.5 4.5 4.5-4.5"/>',
    tv: '<rect x="2.5" y="4" width="19" height="13" rx="3" fill="currentColor" stroke="none"/><path stroke="currentColor" stroke-width="2.2" stroke-linecap="round" d="M8.5 20h7M12 17v3"/>',
    power: '<path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" d="M12 3v9M7 6.5a7.5 7.5 0 1 0 10 0"/>',
    volume: '<path fill="currentColor" stroke="none" d="M11.5 3.7a1 1 0 0 0-1.05.15L5.75 7.5H3A1.5 1.5 0 0 0 1.5 9v6A1.5 1.5 0 0 0 3 16.5h2.75l4.7 3.65a1 1 0 0 0 1.05.15 1 1 0 0 0 .5-.9V4.6a1 1 0 0 0-.5-.9Z"/><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" d="M15.5 8.5a5 5 0 0 1 0 7M18.8 5.5a9.2 9.2 0 0 1 0 13"/>',
    wifi: '<path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" d="M3.5 8.5a12.5 12.5 0 0 1 17 0M6.8 12a7.8 7.8 0 0 1 10.4 0M10 15.5a3.2 3.2 0 0 1 4 0"/><circle cx="12" cy="19.2" r="1.2" fill="currentColor" stroke="none"/>',
    bluetooth: '<path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="M7 6.5 17 14.5l-5 4.5V3l5 4.5L7 15.5"/>',
    search: '<path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" d="m20.5 20.5-4.8-4.8M17.5 10.5a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z"/>',
    weather: '<circle cx="15.5" cy="8.5" r="3.2" fill="none" stroke="currentColor" stroke-width="1.8"/><path stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M15.5 3v1.5M15.5 12.5v1.5M10 8.5h1.5M19.5 8.5H21M11.6 4.6l1 1M18.4 11.4l1 1M11.6 12.4l1-1M18.4 5.6l1-1"/><path fill="currentColor" stroke="none" d="M14 19a4 4 0 0 0 .5-7.96 4.5 4.5 0 0 0-8.8 1.46A3.5 3.5 0 0 0 6.5 19H14Z"/>',
    warn: '<path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="M12 3.5 2 20.5h20L12 3.5Z"/><path stroke="currentColor" stroke-width="2.2" stroke-linecap="round" d="M12 9.5v5M12 17.5v.2"/>',
    remote: '<rect x="6.5" y="2" width="11" height="20" rx="3.5" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="7.2" r="2.4" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="12" cy="7.2" r="0.9" fill="currentColor" stroke="none"/><circle cx="9.6" cy="13.2" r="0.9" fill="currentColor" stroke="none"/><circle cx="14.4" cy="13.2" r="0.9" fill="currentColor" stroke="none"/><circle cx="12" cy="16.8" r="1.1" fill="currentColor" stroke="none"/>',
    type: '<path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="M3.5 18 7.8 7h2.4l4.3 11M5 14.2h8.5M16 11.5v6.5M18.8 11.5a2.5 2.5 0 0 1 0 6.5h-2.8"/>',
    sparkle: '<path fill="currentColor" stroke="none" d="M12 2.5 13.5 8l5.5 1.5L13.5 11 12 16.5 10.5 11 5 9.5 10.5 8 12 2.5Zm6 12 1 3.5 3.5 1-3.5 1-1 3.5-1-3.5-3.5-1 3.5-1 1-3.5Z"/>',
    info: '<circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2"/><path stroke="currentColor" stroke-width="2.2" stroke-linecap="round" d="M12 7.8v.2M12 11v5.2"/>'
  };

  /* ---------- State ---------- */
  var REDUCED_MOTION = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var S = {
    variant: 'B', geom: 'broad', c: null, stack: null,
    sel: null, selIdx: 0, lastUtil: 0, lastStatus: 0, appsFocus: null, settingsFocus: 'background', appearanceFocus: 'bg', detailFocus: {},
    undo: [], removedAt: {}, note: null, err: null,
    writes: 0, failed: 0, log: [], logN: 0, lastLaunch: null, press: null,
    wallShown: null, wallPending: null, wallError: null,
    shown: null, pending: null, lookError: null, bundleKey: null, previewBundle: null, reflow: false, fontSwitch: false
  };
  var scroll = { first: 0, off: 0, photo: 0, photoArrange: 0 };
  function pick(v, list, fallback) {
    v = String(v || '').toLowerCase();
    for (var i = 0; i < list.length; i++) if (list[i].toLowerCase() === v) return list[i];
    return fallback;
  }
  function lookOf(c) { return { bg: c.bg, wall: c.wall, layout: c.layout, apps: c.apps, font: c.font, controls: c.controls, focus: c.focus, material: c.material }; }
  function materialApplies(c) { c = c || S.c; return c.bg === 'photo' && (c.layout === 'dock' || c.focus === 'glass'); }
  function derivedTheme() { return S.c.layout === 'list' ? 'list' : 'shore'; }

  /* ---------- Helpers ---------- */
  function app(id) { for (var i = 0; i < APPS.length; i++) if (APPS[i].id === id) return APPS[i]; return FOLDERS[id] || null; }
  function folder(id) { return typeof id === 'string' && FOLDERS[id] ? FOLDERS[id] : null; }
  /* A new folder is named from what is in it, the way tvOS groups apps by
     genre. The list is deliberately small: it only needs to name the sets that
     actually sit on a television's home screen, and anything else is a Folder. */
  var FOLDER_GROUPS = [
    { name: 'Entertainment', ids: ['netflix', 'youtube', 'primevideo', 'hotstar', 'jiohotstar', 'sonyliv', 'appletv', 'disneyplus', 'stremio', 'samsungtvplus', 'tizentube', 'youtubetv', 'youtubekids', 'abciview', 'sbs', 'nuviotv', 'tubi', 'hbomax', 'internet', 'moonlight'] },
    { name: 'Music', ids: ['applemusic', 'spotify'] },
    { name: 'Utilities', ids: ['settingsapp', 'homecontrol', 'alexa'] }
  ];
  function folderNameFor(ids) {
    var i, g, first = '';
    for (g = 0; g < FOLDER_GROUPS.length; g++) {
      for (i = 0; i < ids.length; i++) {
        if (FOLDER_GROUPS[g].ids.indexOf(ids[i]) < 0 && FOLDER_GROUPS[g].ids.indexOf((app(ids[i]) || {}).brand || '') < 0) break;
      }
      if (i === ids.length && ids.length) return FOLDER_GROUPS[g].name;
    }
    first = app(ids[0]);
    return first && ids.length === 1 ? String(first.name).slice(0, 40) : 'Folder';
  }
  /* Rebuild the id -> folder map from the saved list. A member that is not in
     the catalogue is dropped: a folder is a view of apps, and opening it must
     never fall back to a raw package id. */
  function syncFolders(list) {
    FOLDERS = {};
    (Array.isArray(list) ? list : []).forEach(function (f) {
      if (!f || !safeId(f.id) || String(f.id).indexOf('folder.') !== 0) return;
      var ids = [];
      (Array.isArray(f.apps) ? f.apps : []).forEach(function (id) {
        if (!safeId(id) || String(id).indexOf('folder.') === 0) return;
        if (!app(id) || ids.indexOf(id) >= 0 || ids.length >= 12) return;
        ids.push(id);
      });
      if (!ids.length) return;
      FOLDERS[f.id] = {
        id: f.id, folder: true, folderApps: ids,
        name: typeof f.name === 'string' && f.name.trim() ? f.name.trim().slice(0, 40) : folderNameFor(ids),
        builtin: false, mark: false
      };
    });
  }
  function cloneFolders(list) {
    return (Array.isArray(list) ? list : []).map(function (f) { return { id: f.id, name: f.name, apps: f.apps.slice() }; });
  }
  function folderMembers(f) {
    var out = [], i, a;
    if (!f) return out;
    for (i = 0; i < f.folderApps.length; i++) { a = app(f.folderApps[i]); if (a) out.push(a); }
    return out;
  }
  /* The top row is the dock capsule: the two built-in tiles (Home, Settings)
     followed by the first four apps. A folder belongs on the grid below, so an
     order saved before that rule - or one whose surrounding apps were removed -
     is repaired here. The folder keeps its place in the sequence but is carried
     down to the first grid slot. */
  function keepFoldersInGrid(h, list) {
    var out = [], moved = [], i, id;
    h = Array.isArray(h) ? h : [];
    list = Array.isArray(list) ? list : (S.c && S.c.folders) || [];
    function isFolder(id) {
      for (var j = 0; j < list.length; j++) if (list[j].id === id) return true;
      return false;
    }
    for (i = 0; i < h.length; i++) {
      id = h[i];
      if (i < 4 && isFolder(id)) moved.push(id);
      else out.push(id);
    }
    if (!moved.length) return h.slice();
    Array.prototype.splice.apply(out, [Math.min(4, out.length), 0].concat(moved));
    return out;
  }
  function wall(id) { for (var i = 0; i < WALLS.length; i++) if (WALLS[i].id === id) return WALLS[i]; return null; }
  function wallIndex(id) { for (var i = 0; i < WALLS.length; i++) if (WALLS[i].id === id) return i; return 0; }
  function frostClass(w) { var i = [.12, .20, .30, .36, .44].indexOf(w.frostVeil); return i > 0 ? ' fv-' + (i + 1) : ''; }
  function wallClasses(w) { return frostClass(w) + (w.listColumn ? ' lc-' + w.listColumn : '') + (w.dockQuiet ? ' db-quiet' : '') + (w.clockMist ? ' tl-mist' : ''); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function without(list, id) { return list.filter(function (x) { return x !== id; }); }
  function same(a, b) { if (a.length !== b.length) return false; for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function onHome(id) { return S.c.home.indexOf(id) >= 0; }
  function top() { return S.stack[S.stack.length - 1]; }
  function inStack(id) { for (var i = S.stack.length - 1; i >= 0; i--) if (S.stack[i].id === id) return S.stack[i]; return null; }
  function push(e) { S.stack.push(e); return e; }
  function pop() { if (S.stack.length > 1) S.stack.pop(); }
  function px(n) { return n.toFixed(2) + 'px'; }
  /* Every pane of glass shows the wallpaper larger than life, the way a thick
     sheet bends the light passing through it. The slice stays aligned with the
     artwork at the pane's centre and drifts outward at its edges - a quarter of
     the pane at the rim - which is what makes the surface read as a solid slab
     of glass rather than a hole cut in the picture. Lens size matches
     background-size in style.css. */
  var GLASS_LENS = 1.25;
  /* Liquid glass passes light through, so the artwork inside a pane reads brighter
     than the artwork beside it. The lift goes into the frosted pixels themselves
     rather than another white layer over them, so a pane keeps the picture's own
     colour while it reads as lit glass. This is the knob for how lit it looks. */
  var GLASS_LIFT = 1.30;
  function lensPos(x, y, w, h) {
    var k = GLASS_LENS;
    return (-x * k + (1 - k) * w / 2).toFixed(1) + 'px ' + (-y * k + (1 - k) * h / 2).toFixed(1) + 'px';
  }
  function icon(name, cls, underlay) {
    return '<svg class="ico' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true">'
      + (underlay ? '<g class="ut-underlay" transform="translate(0 .5)">' + SVG[name] + '</g><g class="ut-ink">' + SVG[name] + '</g>' : SVG[name]) + '</svg>';
  }
  function badge(on) {
    return on
      ? '<svg class="badge is-on" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="currentColor"/><path class="badge-tick" d="m7.6 12.4 3 3 5.8-6.2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      : '<svg class="badge is-off" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';
  }
  function log(text) { S.log.unshift('#' + (++S.logN) + ' ' + text); if (S.log.length > 10) S.log.pop(); }

  var maskSupport = 'webkitMaskImage' in document.documentElement.style || 'maskImage' in document.documentElement.style, markProbes = {};
  function probeMark(id) {
    if (markProbes[id]) return;
    var im = new Image(); markProbes[id] = 'loading';
    im.onload = function () { markProbes[id] = 'ok'; };
    im.onerror = function () {
      markProbes[id] = 'bad';
      Array.prototype.forEach.call(document.querySelectorAll('[data-mark="' + id + '"]'), function (el) { el.className += ' is-bad'; });
    };
    im.src = ICONS + id + '.svg';
  }
  /* Optical placement is identical for the CSS mask and the image fallback. */
  function markHtml(id, w, h, size) {
    var m = window.FrameIconMetrics && window.FrameIconMetrics[id], st;
    if (m) {
      var weight = clamp(Math.pow(0.45 / m.fill, 0.3), 0.84, 1.25);
      var k = Math.min(w / m.w, h / m.h, size * weight / Math.sqrt(m.w * m.h)), s = m.n * k;
      st = 'width:' + px(s) + ';height:' + px(s) + ';left:' + px(w / 2 - (m.x + m.w / 2) * k) + ';top:' + px(h / 2 - (m.y + m.h / 2) * k);
    } else st = 'width:' + w + 'px;height:' + h + 'px;left:0;top:0;object-fit:contain';
    probeMark(id);
    return '<span class="mark' + (markProbes[id] === 'bad' ? ' is-bad' : '') + '" data-mark="' + id + '" style="width:' + w + 'px;height:' + h + 'px">'
      + (maskSupport ? '<span class="mk" style="' + st + ';-webkit-mask-image:url(' + ICONS + id + '.svg);mask-image:url(' + ICONS + id + '.svg)"></span>' : '<img alt="" src="' + ICONS + id + '.svg" style="' + st + '">') + '</span>';
  }
  /* Tile art is keyed by brand, but the catalogue (built from APL Launcher's
     artwork) covers many more services than the dock's own brand list. A name
     that normalises to a key - "Disney+" to disneyplus, "HBO Max" to hbomax -
     finds its card too, so a newly installed app is not left with initials. */
  var TILE_ALIASES = { jiohotstar: 'hotstar', hulu: 'hulu', tvplus: 'samsungtvplus' };
  function tileKey(name) {
    return String(name || '').toLowerCase().replace(/\+/g, 'plus').replace(/[^a-z0-9]/g, '');
  }
  function appTileArt(brand, name) {
    var tiles = window.CleanFrameAppTiles, url, key;
    if (!tiles) return '';
    url = tiles[brand];
    if (typeof url === 'string' && url) return url;
    key = tileKey(name);
    if (key && TILE_ALIASES[key]) key = TILE_ALIASES[key];
    url = tiles[key];
    return typeof url === 'string' && url ? url : '';
  }
  function appMark(a, w, h, size) {
    if (a.mark && (maskSupport || S.c.bg !== 'light')) return markHtml(a.brand || a.id, w, h, size);
    var words = a.name.split(/\s+/), letters = words[0].charAt(0) + (words.length > 1 ? words[1].charAt(0) : '');
    return '<span class="mark monogram' + (a.icon ? ' native-icon' : '') + '" style="width:' + w + 'px;height:' + h + 'px;font-size:' + Math.round(size * .65) + 'px"><span>' + esc(letters.toUpperCase()) + '</span>'
      + (a.icon ? '<img alt="" data-native-icon="true" src="' + esc(a.icon) + '">' : '') + '</span>';
  }
  function smallMark(a) { return appMark(a, 56, 44, 36); }
  var measureCanvas = document.createElement('canvas'), measureContext = measureCanvas.getContext('2d'), measureSpan = document.createElement('span');
  measureSpan.setAttribute('aria-hidden', 'true');
  measureSpan.style.cssText = 'position:absolute;left:-10000px;top:0;visibility:hidden;white-space:pre;font-synthesis:none;';
  document.body.appendChild(measureSpan);
  function homeFont() { return S.shown && S.shown.font || 'manrope'; }
  function fontRole(id, role, size) {
    var f = FONTS[id], serif = id === 'newsreader';
    return { family: f.family,
      weight: role === 'display' ? f.display : role === 'clock' ? f.clock : serif ? 400 : f.ui,
      opsz: serif ? role === 'display' ? 72 : role === 'clock' ? 48 : role === 'ui' && (!size || size === 28) ? 28 : 36 : 0 };
  }
  function measureFace(id, faces) {
    var result = { roles: {}, digits: [], digitCell: 0 }, roles = { display: [88, 76, 56], clock: [48], primary: [30, 32, 34, 36, 40], ui: [28, 30, 48] };
    var face = id === 'newsreader' ? faces[0][0] : null, original = face ? face.variationSettings : '', r, widths, min, max;
    Object.keys(roles).forEach(function (role) {
      result.roles[role] = {};
      // Canvas has no optical-size property. Set this face's default only while measuring;
      // CSS specifies each rendered role explicitly, and the descriptor is restored below.
      roles[role].forEach(function (size) {
        r = fontRole(id, role, size);
        if (face) face.variationSettings = r.opsz ? '"opsz" ' + r.opsz : original;
        measureContext.font = r.weight + ' ' + size + 'px "' + r.family + '"';
        var m = measureContext.measureText('H'), d = measureContext.measureText('gjpqy');
        result.roles[role][size] = { cap: m.actualBoundingBoxAscent || size * .72, ascent: m.fontBoundingBoxAscent || size * 1.066, descent: m.fontBoundingBoxDescent || size * .3, lower: d.actualBoundingBoxDescent || size * .255 };
      });
    });
    if (face) face.variationSettings = original;
    r = fontRole(id, 'clock');
    measureSpan.style.font = r.weight + ' 48px/64px "' + r.family + '"';
    measureSpan.style.letterSpacing = '0'; measureSpan.style.fontVariantNumeric = 'tabular-nums';
    measureSpan.style.fontVariationSettings = r.opsz ? '"opsz" ' + r.opsz : 'normal';
    widths = '0123456789'.split('').map(function (n) { measureSpan.textContent = n; return measureSpan.getBoundingClientRect().width; });
    min = Math.min.apply(Math, widths); max = Math.max.apply(Math, widths);
    result.digits = widths; result.digitCell = max - min > .02 ? max : 0;
    return result;
  }
  function fontChoices() {
    LOOK_VALUES.font = Object.keys(FONTS).filter(function (id) { return id === 'manrope' || PRIVATE_FONTS.indexOf(id) >= 0 && !unavailableFonts[id]; });
  }
  function retryFontFaces(id) {
    // A rejected CSS FontFace cannot load again. Recreate only that failed family's
    // rules; the displayed family's faces and the rest of the stylesheet stay intact.
    Array.prototype.forEach.call(document.styleSheets, function (sheet) {
      var rules, i, rule, family, css;
      try { rules = sheet.cssRules; } catch (e) { return; }
      if (!rules) return;
      for (i = 0; i < rules.length; i++) {
        rule = rules[i];
        if (rule.type !== 5) continue;
        family = rule.style.getPropertyValue('font-family').replace(/["']/g, '').trim();
        if (family !== FONTS[id].family) continue;
        css = rule.cssText; sheet.deleteRule(i); sheet.insertRule(css, i);
      }
    });
  }
  function loadFont(id, done) {
    var f = FONTS[id], weights = [f.display], timer, ended = false;
    if (fontMetrics[id]) { done(true); return; }
    if (!document.fonts || !document.fonts.load) { if (id === 'manrope') { fontMetrics.manrope = measureFace('manrope', []); fontsReady = true; done(true); } else done(false, 'unsupported'); return; }
    if (unavailableFonts[id]) retryFontFaces(id);
    if (id !== 'newsreader' && weights.indexOf(f.ui) < 0) weights.push(f.ui);
    function finish(ok, reason, faces) {
      if (ended) return;
      ended = true; clearTimeout(timer);
      if (ok) {
        fontMetrics[id] = measureFace(id, faces); delete unavailableFonts[id];
        if (id === 'manrope') fontsReady = true;
      } else if (reason !== 'timeout') unavailableFonts[id] = true;
      fontChoices(); done(ok, reason);
    }
    timer = setTimeout(function () { finish(false, 'timeout'); }, 3000);
    Promise.all(weights.map(function (weight) { return document.fonts.load(weight + ' 88px "' + f.family + '"'); })).then(function (faces) {
      finish(faces.every(function (list) { return list.length > 0 && list.every(function (face) { return face.status === 'loaded'; }); }), 'load', faces);
    }, function () { finish(false, 'load'); });
  }
  var baselineRecovery = false;
  function ensureFont(id, done) {
    loadFont('manrope', function (ok, reason) {
      if (!ok && id === 'manrope') {
        // The local fallback keeps Home usable if the baseline face is slow or missing.
        fontMetrics.manrope = measureFace('manrope', []); fontMetrics.manrope.fallback = true; fontsReady = true;
        done(true, reason);
        if (!baselineRecovery && document.fonts && document.fonts.ready) {
          baselineRecovery = true;
          document.fonts.ready.then(function () {
            delete fontMetrics.manrope; delete unavailableFonts.manrope;
            loadFont('manrope', function (loaded) {
              if (!loaded) { fontMetrics.manrope = measureFace('manrope', []); fontMetrics.manrope.fallback = true; fontsReady = true; }
              render();
            });
          });
        }
        return;
      }
      if (!ok || id === 'manrope') done(ok, reason); else loadFont(id, done);
    });
  }
  function fontShift(role, size) {
    var id = homeFont(), base = fontMetrics.manrope, metrics = fontMetrics[id], a, b;
    if (id === 'manrope' || !base || !metrics) return 0;
    a = base.roles[role][size]; b = metrics.roles[role][size];
    return (a.ascent - a.descent - a.cap - b.ascent + b.descent + b.cap) / 2;
  }
  function textWidth(text, size, weight, spacing, role) {
    var id = homeFont(), r = fontRole(id, role || 'ui', size), key, width;
    if (id !== 'manrope') { weight = r.weight; spacing = role === 'display' ? -size * .01 : 0; }
    key = [id, role || 'ui', text, size, weight, spacing].join('|');
    if (widthCache.hasOwnProperty(key)) return widthCache[key];
    if (r.opsz) {
      measureSpan.style.font = weight + ' ' + size + 'px "' + r.family + '"';
      measureSpan.style.fontVariationSettings = '"opsz" ' + r.opsz;
      measureSpan.style.fontVariantNumeric = 'normal'; measureSpan.style.letterSpacing = '0'; measureSpan.textContent = text;
      width = measureSpan.getBoundingClientRect().width;
    } else {
      measureContext.font = (weight || 500) + ' ' + size + 'px "' + r.family + '", Arial, sans-serif';
      width = measureContext.measureText(text).width;
    }
    width += Math.max(0, text.length - 1) * (spacing || 0);
    // Do not retain fallback measurements made before the baseline font is ready.
    if (fontMetrics[id]) widthCache[key] = width;
    return width;
  }
  function dockLabelSize(id) { return S.c.apps === 'text' ? (textWidth(app(id).name, 40, 600, -.8, 'primary') > 264 ? 34 : 40) : textWidth(app(id).name, 36, 500, -.8, 'primary') > 280 ? 32 : 36; }
  function reducedDockLabel(id) { return S.c.apps !== 'icons' && dockLabelSize(id) === (S.c.apps === 'text' ? 34 : 32); }
  function actionWidth(text) { return clamp(Math.ceil(textWidth(text, 30, 500, -.3) + 40), 288, 400); }
  function photoLabel(id, compact) {
    var text = app(id).name, size = compact ? 56 : 88, limit = compact ? 640 : 992, width = textWidth(text, size, 600, -1.8, 'display');
    if (!compact && width > limit) { size = 76; width = textWidth(text, size, 600, -1.8, 'display'); }
    // Newsreader's ninth compact Type row otherwise enters the lower fade by .63px.
    return { size: size, top: (compact ? 10.66 : size === 76 ? 10.36 : 9.68) + fontShift('display', size) - (compact && homeFont() === 'newsreader' ? .7 : 0), width: Math.min(limit, width), ellipsis: width > limit };
  }
  function listPlateWidth(id, compact) {
    if (S.c.apps === 'icons') return compact ? 120 : 144;
    var text = S.c.apps === 'text';
    return clamp(Math.ceil(photoLabel(id, compact).width + (text ? 84 : compact ? 156 : 184)), text ? 280 : 360, text ? compact ? 724 : 1076 : compact ? 796 : 1176);
  }

  /* Keyed children: elements persist by key so transforms animate instead of re-creating.
     Children are absolutely positioned, so DOM order never needs to change. */
  function keyed(parent, items, update) {
    var map = parent._k || (parent._k = {}), seen = {}, i, it, el, isNew, k;
    for (i = 0; i < items.length; i++) {
      it = items[i]; el = map[it.key]; isNew = !el;
      if (isNew) { el = document.createElement('div'); map[it.key] = el; }
      update(el, it, i);
      if (isNew) parent.appendChild(el);
      seen[it.key] = 1;
    }
    for (k in map) if (map.hasOwnProperty(k) && !seen[k]) { if (map[k].parentNode === parent) parent.removeChild(map[k]); delete map[k]; }
  }
  function setContent(el, sig, html) {
    sig += '|' + catalog.revision;
    if (el._sig === sig) return;
    el._sig = sig; el.innerHTML = html;
    Array.prototype.forEach.call(el.querySelectorAll('[data-native-icon]'), function (img) {
      function ready() { img.parentNode.classList.add('has-native-icon'); }
      function failed() { img.style.display = 'none'; img.parentNode.classList.remove('has-native-icon'); }
      img.onload = ready; img.onerror = failed;
      if (img.complete) { if (img.naturalWidth) ready(); else failed(); }
    });
  }
  function setHTML(el, html) { if (el._html !== html) { el._html = html; el.innerHTML = html; } }
  function attrs(el, z, i, action) { el.setAttribute('data-z', z); el.setAttribute('data-i', String(i)); el.setAttribute('data-action', action); }

  /* ---------- Saved preferences ---------- */
  function safeId(id) { return typeof id === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,160}$/.test(id) && ['constructor', 'prototype', '__proto__'].indexOf(id) < 0; }
  function safeIcon(path) { return typeof path === 'string' && path.length < 2048 && /^(?:\/[^\/]|file:\/\/\/|wgt-package:\/\/\/)/.test(path) ? path : ''; }
  function load() {
    var keys = [KEY, 'cleanframe.shore.v1'], raw, saved, i;
    for (i = 0; i < keys.length; i++) {
      try {
        raw = localStorage.getItem(keys[i]);
        if (!raw) continue;
        saved = JSON.parse(raw);
        if (saved && typeof saved === 'object' && !Array.isArray(saved)) return saved;
      } catch (e) { storageOk = false; }
    }
    return null;
  }
  function clean(saved) {
    var s = saved && typeof saved === 'object' ? saved : {}, modern = s.look && typeof s.look === 'object' ? s.look : s;
    var legacyList = s.theme === 'list', h = [], recent = [], records = Array.isArray(s.appRecords) ? s.appRecords : [];
    var folders = [], seenFolder = {};
    records.slice(0, 256).forEach(function (a) {
      if (!a || !safeId(a.id) || !safeId(a.appId) || typeof a.name !== 'string' || !a.name.trim() || app(a.id)) return;
      APPS.push({ id: a.id, appId: a.appId, name: a.name.slice(0, 160), brand: ['hbomax', 'spotify', 'tubi', 'nuviotv', 'hotstar', 'sonyliv', 'moonlight', 'samsungtvplus', 'stremio', 'tizentube', 'alexa', 'youtubetv', 'youtubekids', 'internet'].indexOf(a.brand) >= 0 ? a.brand : '', mark: ['hbomax', 'spotify', 'tubi', 'nuviotv', 'hotstar', 'sonyliv', 'moonlight', 'samsungtvplus', 'stremio', 'tizentube', 'alexa', 'youtubetv', 'youtubekids', 'internet'].indexOf(a.brand) >= 0, icon: safeIcon(a.icon) });
    });
    /* Folders are read before the home order, so a folder id in a slot already
       resolves through `app()`. Members that are not in the catalogue are looked
       up by package id when the TV's list arrives; until then the folder keeps
       the placeholder record, exactly like an app restored from a saved order. */
    (Array.isArray(s.folders) ? s.folders : []).forEach(function (f) {
      if (!f || !safeId(f.id) || String(f.id).indexOf('folder.') !== 0 || seenFolder[f.id]) return;
      var ids = [];
      (Array.isArray(f.apps) ? f.apps : []).forEach(function (id) {
        if (!safeId(id) || String(id).indexOf('folder.') === 0 || ids.indexOf(id) >= 0 || ids.length >= 12) return;
        if (!app(id)) {
          if (String(id).indexOf('.') < 0) return;
          APPS.push({ id: id, appId: id, name: String(id).split('.').pop(), mark: false });
        }
        ids.push(id);
      });
      if (!ids.length) return;
      seenFolder[f.id] = true;
      folders.push({ id: f.id, name: typeof f.name === 'string' && f.name.trim() ? f.name.trim().slice(0, 40) : folderNameFor(ids), apps: ids });
    });
    syncFolders(folders);
    (Array.isArray(s.home) ? s.home : Array.isArray(s.dock) ? s.dock : []).forEach(function (id) {
      if (!safeId(id) || h.indexOf(id) >= 0 || h.length >= CAP) return;
      if (String(id).indexOf('folder.') === 0) { if (folder(id)) h.push(id); return; }
      if (!app(id) && id.indexOf('.') > 0) APPS.push({ id: id, appId: id, name: id.split('.').pop(), mark: false });
      if (app(id)) h.push(id);
    });
    if (!h.length) h = PRIMARY.slice();
    /* The two built-in tiles sit in the Home order like any app, so they can be
       moved, put in a folder and rearranged with the rest. They used to be glued
       in front of the rows outside the saved order, which is why a held OK on
       them offered nothing. An order saved before this still has them pinned, so
       they are folded in at the front once. */
    [HOME_TILE.id, SETTINGS_TILE.id].forEach(function (id, at) {
      if (h.indexOf(id) >= 0) return;
      if (h.length >= CAP) h.length = CAP - 1;
      h.splice(Math.min(at, h.length), 0, id);
    });
    /* A saved folder can never sit in the dock capsule. */
    h = keepFoldersInGrid(h, folders);
    (Array.isArray(s.recent) ? s.recent : []).forEach(function (id) { if (safeId(id) && app(id) && h.indexOf(id) < 0 && recent.indexOf(id) < 0 && recent.length < 5) recent.push(id); });
    return {
      bg: pick(modern.bg, LOOK_VALUES.bg, legacyList ? 'dark' : 'photo'), layout: pick(modern.layout, LOOK_VALUES.layout, legacyList ? 'list' : 'dock'),
      apps: pick(modern.apps, LOOK_VALUES.apps, legacyList ? 'text' : 'both'), controls: pick(modern.controls, LOOK_VALUES.controls, 'both'),
      focus: pick(modern.focus, LOOK_VALUES.focus, legacyList ? 'type' : 'glass'), material: pick(modern.material, LOOK_VALUES.material, 'soft'),
      font: pick(modern.font, LOOK_VALUES.font, 'manrope'), wall: wall(modern.wall || s.wallpaper) ? modern.wall || s.wallpaper : WALLS[0].id,
      home: h, recent: recent, lastApp: h.indexOf(s.lastApp) >= 0 ? s.lastApp : h[0],
      mode: pick(s.mode, MODES.map(function (m) { return m.id; }), 'fixed'),
      folders: folders
    };
  }
  function serialise(c) {
    var out = {}, id;
    Object.keys(c).forEach(function (key) { out[key] = c[key]; });
    out.version = 2; out.look = lookOf(c); out.dock = c.home.slice(); out.wallpaper = c.wall;
    out.theme = c.layout === 'list' ? 'list' : 'shore';
    out.appRecords = [];
    /* Folder members are saved as app records too: an app kept only inside a
       folder is still an app the owner put there, and it must survive a reload
       even when the TV's own list has not arrived yet. */
    var keys = c.home.concat(c.recent);
    (c.folders || []).forEach(function (f) { keys = keys.concat(f.apps || []); });
    keys.forEach(function (key) {
      var a;
      if (folder(key)) return;
      a = app(key);
      if (a && PRIMARY.indexOf(key) < 0 && !out.appRecords.some(function (r) { return r.id === key; })) out.appRecords.push({ id: a.id, appId: a.appId, name: a.name, brand: a.brand || '', icon: a.icon || '' });
    });
    return out;
  }
  function initialise() {
    try {
      var cachedA = JSON.parse(localStorage.getItem('cleanframe.apps.alpha.v1') || '[]');
      if (Array.isArray(cachedA) && cachedA.length) { ALPHA = cachedA; catalog.loaded = true; }
    } catch (eInitA) {}
    var saved = load(), initial; S.c = clean(saved); initial = next(S.c.home.slice(), S.c.recent.slice());
    S.stack = [{ id: 'home', f: { zone: 'apps', u: 0 } }];
    S.sel = S.c.lastApp; S.selIdx = S.c.home.indexOf(S.sel);
    if (saved && initial.mode === 'open') initial.wall = WALLS[(wallIndex(initial.wall) + 1) % WALLS.length].id;
    // Keep the old schema keys alongside the builder values for in-place updates.
    try { localStorage.setItem(KEY, JSON.stringify(serialise(initial))); S.c = initial; storageOk = true; } catch (e) { storageOk = false; }
  }
  function clearSession() { S.undo = []; S.removedAt = {}; S.note = null; S.err = null; }
  function begin() { S.note = null; }
  function next(home, recent, folders) { var c = lookOf(S.c); c.home = home; c.recent = recent; c.lastApp = S.c.lastApp; c.mode = S.c.mode; c.folders = cloneFolders(folders || S.c.folders); return c; }
  function snap() { return { home: S.c.home.slice(), recent: S.c.recent.slice(), folders: cloneFolders(S.c.folders) }; }
  function pushRecent(list, id) { return [id].concat(without(list, id)).slice(0, 5); }
  function write(c, label) {
    /* Folders belong on the grid, never in the top row, whatever order the
       caller built. */
    c.home = keepFoldersInGrid(c.home, c.folders);
    try { localStorage.setItem(KEY, JSON.stringify(serialise(c))); }
    catch (e) { storageOk = false; S.failed++; S.err = label; log('Not saved: ' + label); return false; }
    if (c.wall !== S.c.wall || c.mode !== S.c.mode) resetRotation();
    storageOk = true; S.c = c; syncFolders(c.folders); S.writes++; S.err = null; log('Saved: ' + label);
    return true;
  }
  function errText(lifted) {
    return 'Couldn’t save. Nothing changed.';
  }
  function statusHtml(def, lifted) {
    if (S.err) return '<span class="warn error-chip">' + esc(errText(lifted)) + '</span>';
    return esc(S.note || def);
  }

  function ensureSel() {
    var h = S.c.home, i;
    if (!h.length) { S.sel = null; return -1; }
    i = h.indexOf(S.sel);
    if (i < 0) { i = clamp(S.selIdx, 0, h.length - 1); S.sel = h[i]; }
    S.selIdx = i;
    return i;
  }
  function setSel(id) { S.sel = id; S.selIdx = S.c.home.indexOf(id); }

  /* Membership and order operations shared by B and C. A works on slots (below). */
  function homeRemove(id) {
    var a = app(id), i = S.c.home.indexOf(id), before = snap(), h;
    var folders = S.c.folders || [];
    if (i < 0) return false;
    if (S.c.home.length <= 1) { S.note = LAST; return false; }
    h = S.c.home.slice(); h.splice(i, 1);
    /* Taking a folder off Home releases its apps: they stay installed and move
       back into the drawer, and the empty folder is not left in the saved list. */
    if (folder(id)) folders = folders.filter(function (f) { return f.id !== id; });
    if (!write(next(h, pushRecent(S.c.recent, id), folders), 'Remove ' + a.name + ' from Home')) return false;
    S.removedAt[id] = i;
    S.undo.push({ label: 'Remove ' + a.name, snap: before });
    return true;
  }
  function homeAdd(id) {
    var a = app(id), before = snap(), h = S.c.home.slice(), at;
    if (h.length >= CAP) { S.note = FULL; return false; }
    at = S.removedAt.hasOwnProperty(id) ? Math.min(S.removedAt[id], h.length) : h.length;
    h.splice(at, 0, id);
    if (!write(next(h, without(S.c.recent, id)), 'Add ' + a.name + ' to Home')) return false;
    S.undo.push({ label: 'Add ' + a.name, snap: before });
    return true;
  }
  function homeMove(order, id, before) {
    var a = app(id);
    if (!write(next(order, S.c.recent.slice()), 'Move ' + a.name)) return false;
    S.undo.push({ label: 'Move ' + a.name, snap: before });
    return true;
  }
  function undoLast(arr) {
    var u = S.undo[S.undo.length - 1];
    if (!u) { S.note = 'Nothing to undo'; return false; }
    if (!write(next(u.snap.home.slice(), u.snap.recent.slice(), u.snap.folders || []), 'Undo ' + u.label)) return false;
    S.undo.pop();
    S.note = 'Undone: ' + u.label + '.';
    return true;
  }
  function undoLabel() { var u = S.undo[S.undo.length - 1]; return u ? u.label : ''; }
  function undoCaption() { var label = undoLabel(); return label ? 'Undo ' + label.charAt(0).toLowerCase() + label.slice(1) : 'Nothing to undo'; }
  function editStatus(hint, move) {
    if (S.err) return statusHtml('', !!move);
    if (S.note === FULL || S.note === LAST) return '<span class="warn">' + esc(S.note) + '</span>';
    if (hint === FULL || hint === LAST) return '<span class="warn">' + esc(hint) + '</span>';
    return esc(move || hint || S.note || '');
  }

  var busy = false, busyTimer = 0;
  /* How long the tile is given to grow into the black field before the launch
     request leaves. Short enough that a warm app still feels instant, long
     enough that a target can never appear before the zoom has finished. */
  var LAUNCH_ANIM_MS = 460, launchTimer = 0, launchSafety = 0, launchActive = false;
  function release() { busy = false; clearTimeout(busyTimer); S.press = null; }
  function message(title, line, note) {
    push({ id: 'message', msg: 'error', content: { title: title, line: line, note: note || '', actions: [['back', 'Back']] }, f: { b: 0 } });
  }
  /* Where the opening card should appear to come from: the focused dock tile, a
     suggestion row, or the service mark under a search card. */
  function launchAnchorEl() {
    return document.querySelector('.appletv-tile.is-focus .appletv-card') ||
      document.querySelector('.search-scope.is-focus') ||
      document.querySelector('.search-sug.is-focus') ||
      document.querySelector('.search-tile.is-focus .search-tile-logo') ||
      document.querySelector('.search-tile-logo') ||
      null;
  }
  /* A system destination has no installed app tile, so its opening card draws
     the same glyph the Control Centre uses for it. */
  function systemCard(ico) {
    return '<div class="appletv-card launch-sys"><svg class="ico launch-glyph" viewBox="0 0 24 24" aria-hidden="true">' +
      (SVG[ico] || '') + '</svg></div>';
  }
  /* A launch anchor for something that is not an installed app: the focused
     button or settings row is where the card lifts from, and its own glyph is
     what fills the black field. */
  function systemAnchor(ico, el) {
    return { card: systemCard(ico), el: el || null };
  }
  /* The opening card for an app id that may not be on Home (a provider badge,
     a YouTube deep link): its own tile art, from an element that already exists. */
  function appAnchor(id, el) {
    return { card: appCardHtml(app(id) || { id: id, name: id, brand: id }), el: el || null };
  }
  /* The card starts on the focused tile's own centre and size, then grows into
     the middle of the black field. The field stays up until CleanFrame is front
     again, so an app's cold start - which is blank for a second or more - shows
     this instead of the TV's own loading screen. */
  function showLaunch(cardHtml, anchorEl) {
    var sr, scale, r, cx = 960, cy = 540, k = 0.84;
    if (!launchEl || !launchCardEl) return;
    launchCardEl.innerHTML = cardHtml || '';
    if (anchorEl && anchorEl.getBoundingClientRect && sceneEl) {
      sr = sceneEl.getBoundingClientRect();
      scale = sr.width / 1920 || 1;
      r = anchorEl.getBoundingClientRect();
      if (r.width > 8 && r.height > 8) {
        cx = (r.left + r.width / 2 - sr.left) / scale;
        cy = (r.top + r.height / 2 - sr.top) / scale;
        k = clamp((r.width / scale) / 249, 0.55, 1.4);
      }
    }
    launchEl.classList.remove('is-on', 'is-zoom');
    launchCardEl.style.setProperty('--dx', (cx - 960).toFixed(1) + 'px');
    launchCardEl.style.setProperty('--dy', (cy - 540).toFixed(1) + 'px');
    launchCardEl.style.setProperty('--k', k.toFixed(3));
    /* Commit the start frame before the class adds the end values, or the zoom
       would have no previous state to animate from. */
    void launchEl.offsetWidth;
    launchEl.classList.add('is-on', 'is-zoom');
    launchActive = true;
    clearTimeout(launchSafety);
    /* A last-resort guard only: the field is meant to stay up until the target
       app is on screen, and it clears itself when CleanFrame is front again.
       This timer just stops a launch that never arrives from leaving the TV on
       black forever; Back also cancels. */
    launchSafety = setTimeout(hideLaunch, 45000);
  }
  function hideLaunch() {
    launchActive = false;
    clearTimeout(launchSafety);
    launchSafety = 0;
    if (!launchEl) return;
    launchEl.classList.remove('is-on', 'is-zoom');
  }
  /* Back before the card has finished growing: drop the queued request instead
     of sending it after the field has already gone. */
  function cancelLaunch() {
    if (launchTimer) { clearTimeout(launchTimer); launchTimer = 0; release(); }
    hideLaunch();
  }
  /* Opening a screen or an app. With an anchor the launch waits for the card to
     finish growing, so the request only leaves once the animation is over; the
     card is left up on success because CleanFrame can lose the screen before the
     target paints, and cleared when CleanFrame is front again. */
  function perform(title, run, anchor) {
    if (busy) return;
    busy = true; busyTimer = setTimeout(release, 14000);
    function start() {
      var settled = false, before = top().id;
      /* A built-in screen paints inside CleanFrame, so nothing will ever bring
         the launcher back to the front to clear the opening field. Its run takes
         no callback: the field comes down with the screen it opened, and the
         press is released on the spot rather than by the 14 s safety timer. */
      function complete(err) {
        if (settled) return;
        settled = true;
        release();
        if (err) {
          hideLaunch();
          message(title, err.message || 'The TV could not open this screen.', err.detail || '');
        }
        render(); syncRotation();
        if (!err && (run.length === 0 || top().id !== before)) hideLaunch();
      }
      if (run.length === 0) { run(); complete(null); return; }
      run(complete);
    }
    if (!anchor) { start(); return; }
    showLaunch(anchor.card || '', anchor.el);
    clearTimeout(launchTimer);
    launchTimer = setTimeout(function () { launchTimer = 0; start(); }, LAUNCH_ANIM_MS);
  }
  function launch(id) {
    var a = app(id), c;
    if (!a || busy) return;
    if (S.c.home.indexOf(id) >= 0) { c = next(S.c.home.slice(), S.c.recent.slice()); c.lastApp = id; write(c, 'Last app'); }
    S.press = id; S.lastLaunch = a.name;
    /* A folder is a screen CleanFrame draws itself, like Settings and Home: it
       opens on the press, with no opening card to wait for. */
    if (a.folder) { perform(a.name, function () { openFolder(id); }); return; }
    /* A built-in opens a screen rather than a package. */
    if (a.builtin) {
      /* Settings and Home are screens CleanFrame draws itself: there is no cold
         start to mask, so they open on the press. The opening card used to be
         flown for them as well, and its 460 ms of zoom was pure delay before a
         screen that could have been up already. */
      if (a.settings) {
        perform(a.name, function () { openSettings(); });
        return;
      }
      if (a.home) {
        /* A screen of CleanFrame's own, over the stage. It is not the Home
           Assistant dashboard in the TV's browser: that leaves the launcher,
           loses the remote's own navigation and cannot read or write a device
           without a page load. The Home app is the same controls drawn here. */
        perform(a.name, function () { openHomeApp(); });
        return;
      }
      perform(a.name, function (done) { FrameDevice.openUrl(a.url, done); },
        { card: appCardHtml(a), el: launchAnchorEl() });
      return;
    }
    perform(a.name, function (done) { FrameDevice.launchApp(a.appId, done); },
      { card: appCardHtml(a), el: launchAnchorEl() });
  }
  function refreshCatalog() {
    var request, oldFocus;
    if (catalog.loading) return;
    request = ++catalog.request; catalog.loading = true; catalog.error = null;
    FrameDevice.apps(function (err, entries) {
      if (request !== catalog.request) return;
      catalog.loading = false;
      if (err) { catalog.error = err.message || 'Could not read installed apps.'; if (!catalog.loaded) ALPHA = []; render(); return; }
      oldFocus = top().id === 'apps' ? ALPHA[top().f.i] : null;
      ALPHA = [];
      entries.forEach(function (entry) {
        var id = PRIMARY.indexOf(entry.brand) >= 0 ? entry.brand : entry.appId, a;
        if (!safeId(id) || !safeId(entry.appId) || ALPHA.indexOf(id) >= 0) return;
        a = app(id);
        if (!a) { a = { id: id }; APPS.push(a); }
        a.appId = entry.appId; a.brand = entry.brand || ''; a.mark = !!entry.brand;
        a.icon = safeIcon(entry.icon);
        a.name = PRIMARY.indexOf(id) >= 0 ? PRIMARY_APPS[PRIMARY.indexOf(id)].name : String(entry.name).slice(0, 160);
        ALPHA.push(id);
      });
      ALPHA.sort(function (a, b) { return app(a).name.toLowerCase().localeCompare(app(b).name.toLowerCase()); });
      try { localStorage.setItem('cleanframe.apps.alpha.v1', JSON.stringify(ALPHA)); } catch (eAlpha) {}
      catalog.loaded = true; catalog.error = null; catalog.revision++;
      if (top().id === 'apps' && oldFocus && ALPHA.indexOf(oldFocus) >= 0) top().f.i = ALPHA.indexOf(oldFocus);
      norm(); render();
    });
  }

  /* ---------- Navigation targets ---------- */
  /* "All apps" is gone from the top row: every installed app now lives in the
     dock itself, so the separate button was redundant. */
  function utils() { return PROFILE.art ? ['art', 'home', 'settings'] : ['home', 'settings']; }
  /* prev/next run along the apps; out goes to the controls, inn comes back (or to a per-app action). */
  function axes() {
    var v = S.c.layout === 'list';
    return { prev: v ? 'up' : 'left', next: v ? 'down' : 'right', out: v ? 'right' : 'up', inn: v ? 'left' : 'down' };
  }
  function utilAction(u) {
    var el = document.querySelector('[data-action="util.' + u + '"].is-focus');
    if (u === 'art') perform('Art Mode', FrameDevice.art, systemAnchor('art', el));
    else if (u === 'apps') openApps();
    else if (u === 'home') openHAPanel();
    else openSettings();
  }
  /* Control-panel tiles. Wi-Fi and Bluetooth open the TV's own network and sound
     screens - a Tizen app is not allowed to switch the radios itself - while the
     round Settings button opens this launcher's settings. Weather refreshes in
     place and keeps the panel open; the rest leave Home. None of them slides a
     launch card across the screen: the TV's settings pane only covers a corner of
     the picture, so a full-screen "opening" card would misdescribe it. */
  /* How those screens are reached: Home Assistant's Samsung TV remote presses the
     set's own Menu key, which lands on Settings from whatever is on screen and
     cannot be refused by the app sandbox. Without that client (a public build) the
     TV's own settings app is launched instead, and the radio tiles ask their own
     list first, so the network and sound screens are one press away when they are
     reachable. */
  function tvScreen(kind) {
    var specific = kind === 'network' ? FrameDevice.network : kind === 'sound' ? FrameDevice.bluetooth : null;
    return function (done) {
      var ha = window.CleanFrameHA;
      /* Home Assistant's Samsung TV remote presses the set's own Menu key first:
         firmware handles that key from whatever is on screen, so it lands on
         Settings and no app sandbox can refuse it. The dedicated network and
         sound screens, then the settings app, are the fallbacks for a build
         without that client or a set that answers the key with an error. */
      function viaDevice() {
        if (specific) specific(function (err) { if (err) FrameDevice.settings(done); else done(null); });
        else FrameDevice.settings(done);
      }
      if (ha && ha.tvSettings && ha.isOnline && ha.isOnline()) {
        ha.tvSettings(function (err) { if (err) viaDevice(); else done(null); });
      } else viaDevice();
    };
  }
  function controlAction(i, f) {
    var c = CONTROLS[i];
    if (!c) return;
    S.lastStatus = i;
    if (c.act === 'weather') {
      if (window.CleanFrameStatus) CleanFrameStatus.refresh();
      updateControlStatus();
      return;
    }
    f.zone = 'status';
    if (c.act === 'off') {
      /* A real power-down through Home Assistant's Smart TV integration. The
         public build has no client, and a widget cannot reach the power key
         itself, so it says so instead of pretending. */
      perform('Turn off the TV', function (done) {
        var ha = window.CleanFrameHA;
        if (ha && ha.tvOff && ha.isOnline && ha.isOnline()) ha.tvOff(function (err) { done(err || null); });
        else done(new Error('Turning the TV off needs the Home Assistant client.'));
      });
    }
    /* Wi-Fi and Bluetooth open the launcher's own glass panels, which read the
       screen and switch it through Vetro; the screen's own pages stay as the
       fallback for what an app cannot do (a new network's password). */
    else if (c.act === 'wifi') openPanel('network', 'Network settings', tvScreen('network'));
    else if (c.act === 'bluetooth') openPanel('audio', 'Sound settings', tvScreen('sound'));
    else if (c.act === 'sources') openPanel('sources', 'Sources', tvScreen('source'));
    /* Picture is the screen's own hardware, read and written through Vetro:
       the panel opens straight over the Control Centre, no launch card. */
    else if (c.act === 'picture') { if (window.CleanFrameTV) window.CleanFrameTV.open(); }
    else if (c.act === 'art') perform('Art Mode', FrameDevice.art);
    else if (c.act === 'home') openHAPanel();
    else if (c.act === 'search') openSearch();
    else if (c.act === 'settings') openSettings();
  }
  function openPanel(view, title, fallback) {
    if (window.CleanFramePanels && window.CleanFramePanels.open(view)) {
      if (controlOpen) renderControlPanel(null);
      return;
    }
    perform(title, fallback);
  }
  function addAppsRoute() { openEditor('home'); }
  /* Settings is the ported APL settings app (apl-settings.js): the tvOS split
     view, backed by the screen itself. The in-app pane stays as the fallback
     for a build where the port is missing. */
  /* The ported Settings app (app/apl-settings-tree.js) needs two things from
     here: the current light / dark / photo choice, and the way into the app's
     own pages for everything that is CleanFrame's rather than the screen's. */
  /* Profiles keep one saved launcher state each (`cleanframe.home.v1` is the
     live slot; the profile module swaps blobs between them). The app restarts
     after a switch because every renderer, cache and wallpaper choice is built
     from that one state at start. */
  window.CleanFrameProfiles = {
    stateKey: function () { return KEY; },
    reload: function () { location.reload(); }
  };

  window.CleanFrameSettings = {
    open: function (group) {
      if (!group) { openSettings(); return; }
      S.settingsFocus = group;
      openAppearance(group);
    },
    appearance: function () { return S.c.bg; },
    setAppearance: function (mode) {
      if (['photo', 'dark', 'light'].indexOf(mode) < 0) return S.c.bg;
      if (S.c.bg !== mode) setLook({ bg: mode }, {});
      return S.c.bg;
    },
    groups: function () { return settingsIds(); },
    search: function () { openSearch(); },
    /* The Home centre is the screen's own control panel: the same sheet the
       remote opens, with the same tiles, grid and size as the Control Centre. */
    closeControl: function () { renderControlPanel(null); },
    control: function () { renderControlPanel({ zone: 'statusmenu', mi: 0 }); },
    home: function () { renderControlPanel({ zone: 'statusmenu', mi: 0 }); },
    /* The launcher's whole appearance, for the rows the ported Settings draws
       itself instead of handing off to the app's older pages. */
    look: function () {
      return { bg: S.c.bg, wall: S.c.wall, layout: S.c.layout, apps: S.c.apps, font: S.c.font,
               controls: S.c.controls, focus: S.c.focus, material: S.c.material };
    },
    set: function (patch) {
      var allowed = {}, k;
      for (k in patch) if (patch.hasOwnProperty(k) &&
        LOOK_VALUES[k] && LOOK_VALUES[k].indexOf(patch[k]) >= 0) allowed[k] = patch[k];
      if (!Object.keys(allowed).length) return this.look();
      setLook(allowed, {});
      return this.look();
    },
    walls: function () { return WALLS.map(function (w) { return { id: w.id, name: w.name }; }); },
    fonts: function () {
      return Object.keys(FONTS).filter(function (id) {
        return id === 'manrope' || PRIVATE_FONTS.indexOf(id) >= 0 || unavailableFonts[id] !== true;
      }).map(function (id) { return { id: id, name: FONTS[id].name }; });
    }
  };

  function openSettings() {
    if (window.APL && APL.settings) { APL.settings.open(); return; }
    resetStageScroll(); push({ id: 'settings', f: { id: S.settingsFocus } });
  }
  function openAppearance(group) {
    resetStageScroll();
    var t = { id: 'appearance', group: group, f: { action: '' } };
    var rows = detailRows(t);
    var firstAction = '';
    if (rows.length > 1 && rows[1].length && rows[1][0].action) {
      firstAction = rows[1][0].action;
    } else if (rows.length && rows[0].length && rows[0][0].action !== 'settings.back') {
      firstAction = rows[0][0].action;
    }
    var axis = { background: 'bg', layout: 'layout', typography: 'font', focus: 'focus' }[group];
    var action = S.detailFocus[group] || (axis ? 'choice.' + axis + '.' + S.c[axis] : group === 'rotation' ? 'rotation.' + S.c.mode : firstAction);
    var air = window.CleanFrameAerial;
    if (group === 'aerial' && air) action = 'choice.aerial.' + air.get('theme');
    t.f.action = action || firstAction;
    push(t);
  }
  function openMessage(key) { push({ id: 'message', msg: key, f: { b: 0 } }); }
  function openApps() {
    var e = { id: 'apps', mode: 'browse', top: 0, f: { zone: 'grid', i: Math.max(0, ALPHA.indexOf(S.appsFocus)), h: 0 } };
    push(e); refreshCatalog(); return e;
  }
  function openEditor(origin) {
    var i = ensureSel();
    clearSession();
    refreshCatalog();
    push({ id: 'editor', origin: origin, lifted: null, top: 0, otherReturn: { id: otherList()[0] || null, index: 0, top: 0 }, f: { zone: S.c.home.length ? 'home' : 'other', i: Math.max(0, i), part: 'name', h: 1, j: 0 } });
  }
  function openWallpaper() {
    var i = wallIndex(S.c.wall);
    S.err = null; S.wallError = null;
    push({ id: 'wallpaper', i: i, top: clamp(i - 2, 0, Math.max(0, WALLS.length - WALL_VISIBLE)), f: { zone: 'photo' },
      previewTimer: 0, previewDue: null, applyPending: null, failedId: null, failedApply: false, retryBundle: null });
  }
  function isSettingsDetail(t) { return t.id === 'appearance' || t.id === 'wallpaper'; }

  var V = {};

  /* ---------- Home (browse) ---------- */
  V.home = {
    norm: function (t) {
      /* The Dock's controls live behind the pill. A List focus must not survive a
         layout switch as an invisible control. */
      if (S.c.layout === 'dock' && t.f.zone === 'util') t.f.zone = 'status';
      if (t.f.zone === 'statusmenu') t.f.mi = clamp(t.f.mi || 0, 0, CONTROLS.length - 1);
      /* Which of the capsule's two tools is armed: 0 = Control Centre,
         1 = Home. Coming back to the capsule re-arms the last used. */
      if (t.f.zone === 'status') {
        if (typeof t.f.pick !== 'number' || t.f.pick < 0 || t.f.pick > 1) t.f.pick = clamp(S.lastPill || 0, 0, 1);
      } else t.f.pick = undefined;
    },
    key: function (t, k) {
      var f = t.f, h = S.c.home, U = utils(), x = axes(), i = ensureSel();
      if (S.c.layout === 'list') { listHomeKey(t, k, i, U); return; }
      if (f.zone === 'search') {
        if (k === x.prev) { f.zone = 'status'; }
        else if (k === x.inn || k === 'back') { f.zone = 'apps'; }
        else if (k === 'ok') { openSearch(); return; }
        return;
      }
      if (f.zone === 'status') {
        /* One pill: the clock and the household's avatar, as on the screen this
           launcher follows. It no longer carries tools of its own - OK opens the
           Control Centre (the remote's Play/Pause does too) - so the only way
           out of the pill is back into the grid. */
        f.pick = 0;
        if (k === x.next || k === x.prev || k === x.inn || k === 'down' || k === 'back') { f.zone = 'apps'; return; }
        if (k === 'ok') {
          S.lastPill = 0;
          if (window.APL && APL.controlCenter) { APL.controlCenter.open(); return; }
          openHAPanel();
          return;
        }
        return;
      }
      if (f.zone === 'statusmenu') {
        f.mi = clamp(f.mi || 0, 0, CONTROLS.length - 1);
        /* Panel geometry as a grid: Off(0) is a two-by-two cell block on the
           left, Wi-Fi(1) and Bluetooth(2) are one cell each stacked beside it,
           the weather capsule(3) runs the full width below, then the four round
           buttons(4-7) take a cell each. Up/Down walks that grid, Right/Left
           stays inside a row, and Up from the top row or Left from Off returns
           to the capsule. */
        if (k === 'up') {
          if (f.mi === 3 || f.mi === 2) f.mi = 1;
          else if (f.mi >= 4) f.mi = 3;
          else f.zone = 'status';
        } else if (k === 'down') {
          if (f.mi === 1) f.mi = 2;
          else if (f.mi <= 2) f.mi = 3;
          else if (f.mi === 3) f.mi = 4;
        } else if (k === 'right') {
          if (f.mi === 0) f.mi = 1;
          else if (f.mi >= 4 && f.mi < 7) f.mi += 1;
        } else if (k === 'left') {
          if (f.mi === 1 || f.mi === 2) f.mi = 0;
          else if (f.mi > 4) f.mi -= 1;
          else f.zone = 'status';
        } else if (k === 'back') f.zone = 'status';
        else if (k === 'ok') { controlAction(f.mi, f); return; }
        return;
      }
      var atvRows = getAppleTVAppRows();
      if (S.appleTvRow === undefined) S.appleTvRow = 0;
      if (S.appleTvCol === undefined) S.appleTvCol = 0;
      var curRowApps = atvRows[S.appleTvRow] || atvRows[0];

      // In 'apps' zone (everything not handled above)
      f.zone = 'apps';
      if (k === 'left') {
        if (S.appleTvCol > 0) S.appleTvCol--;
      } else if (k === 'right') {
        if (S.appleTvCol < curRowApps.length - 1) S.appleTvCol++;
      } else if (k === 'down') {
        if (S.appleTvRow < atvRows.length - 1) {
          S.appleTvRow++;
          S.appleTvCol = Math.min(S.appleTvCol, atvRows[S.appleTvRow].length - 1);
        }
      } else if (k === 'up') {
        if (S.appleTvRow > 0) {
          S.appleTvRow--;
          S.appleTvCol = Math.min(S.appleTvCol, atvRows[S.appleTvRow].length - 1);
        } else {
          f.zone = 'status';
        }
      } else if (k === 'back') {
        if (S.appleTvRow > 0) {
          S.appleTvRow = 0;
        } else {
          openMessage('leave');
        }
      } else if (k === 'ok') {
        var targetApp = curRowApps[S.appleTvCol];
        if (targetApp) launch(targetApp.id);
      }
    },
    point: function (t, z, i, id, el, ev) {
      if (z === 'search') { openSearch(); return; }
      if (z === 'util') { t.f.zone = 'util'; t.f.u = i; S.lastUtil = i; }
      else if (z === 'status') {
        /* Clicking the clock widens the capsule instead of committing to the
           Control Centre, so the Home tool is reachable with a mouse too. */
        t.f.zone = 'status'; t.f.pick = clamp(t.f.pick || 0, 0, 1); return;
      }
      else if (z === 'ctrl' || z === 'home') {
        t.f.zone = 'status'; t.f.pick = z === 'home' ? 1 : 0;
        this.key(t, 'ok'); return;
      }
      else if (z === 'menu') {
        t.f.zone = 'statusmenu'; t.f.mi = i;
      }
      else if (z === 'app') { t.f.zone = 'apps'; setSel(S.c.home[i]); }
      else if (z === 'empty') t.f.zone = 'apps';
      else return;
      this.key(t, 'ok');
    }
  };
  function listHomeKey(t, k, i, U) {
    var f = t.f, h = S.c.home;
    if (f.zone === 'search') {
      if (k === 'right') { f.zone = 'util'; f.u = 0; S.lastUtil = 0; }
      else if (k === 'left' || k === 'down' || k === 'back') { f.zone = 'apps'; }
      else if (k === 'ok') { openSearch(); return; }
      return;
    }
    if (f.zone === 'util') {
      f.u = clamp(f.u, 0, U.length - 1);
      if (k === 'up' && f.u > 0) f.u--;
      else if (k === 'down' && f.u < U.length - 1) f.u++;
      else if (k === 'left') {
        if (f.u === 0) f.zone = 'search';
        else f.zone = 'apps';
      }
      else if (k === 'back') f.zone = 'apps';
      else if (k === 'ok') { S.lastUtil = f.u; utilAction(U[f.u]); return; }
      S.lastUtil = f.u;
      return;
    }
    f.zone = 'apps';
    if (k === 'up') {
      if (i > 0) setSel(h[i - 1]);
      else f.zone = 'search';
    }
    else if (k === 'right') { f.zone = 'search'; }
    else if (k === 'down' && i < h.length - 1) setSel(h[i + 1]);
    else if (k === 'back') openMessage('leave');
    else if (k === 'ok') { if (h.length) launch(S.sel); else addAppsRoute(); }
  }

  /* ---------- Wallpaper child: focus previews, activation applies ---------- */
  function cancelWallpaperTimer(t) {
    clearTimeout(t.previewTimer); t.previewTimer = 0; t.previewDue = null;
  }
  function failWallpaper(t, id, apply, bundle) {
    t.applyPending = null; t.failedId = id; t.failedApply = apply; t.retryBundle = bundle || null;
    restoreLook();
    if (!bundle) S.wallError = id;
  }
  function applyWallpaper(t, prepared) {
    var w = WALLS[t.i], c, bundle = prepared || S.previewBundle;
    if (!prepared && (S.wallPending || t.previewDue || S.wallShown !== w.id || S.wallError)) {
      t.applyPending = w.id;
      if (t.previewDue || S.wallPending !== w.id) { cancelWallpaperTimer(t); loadWallpaperPreview(t); }
      return;
    }
    t.applyPending = null;
    if (w.id === S.c.wall) { S.err = null; t.failedId = null; t.failedApply = false; t.retryBundle = null; return; }
    if (!bundle || bundle.key !== bundleKey({ wall: w.id, material: S.c.material })) { t.applyPending = w.id; loadWallpaperPreview(t); return; }
    c = next(S.c.home.slice(), S.c.recent.slice()); c.wall = w.id;
    if (!write(c, 'Wallpaper ' + w.name)) { failWallpaper(t, w.id, true, bundle); return; }
    installBundle(bundle, c); committedBundle = bundle; S.previewBundle = null;
    t.failedId = null; t.failedApply = false; t.retryBundle = null;
  }
  function loadWallpaperPreview(t) {
    var id = WALLS[t.i].id;
    cancelWallpaperTimer(t);
    showWall(id, function (ok) {
      if (top() !== t || WALLS[t.i].id !== id) return;
      if (!ok) failWallpaper(t, id, t.applyPending === id, null);
      else if (t.applyPending === id) applyWallpaper(t);
      render(); syncRotation();
    });
  }
  function previewWallpaper(t, index, apply, immediate) {
    var id, target;
    cancelWallpaperTimer(t); cancelLook();
    t.i = index; t.f.zone = 'photo'; id = WALLS[index].id;
    t.applyPending = apply ? id : null; t.failedId = null; t.failedApply = false; t.retryBundle = null;
    S.err = null; S.wallError = null;
    if (id === S.c.wall && committedBundle) {
      installBundle(committedBundle, S.c, true); S.previewBundle = null;
      if (apply) applyWallpaper(t);
      return;
    }
    if (S.wallShown === id && S.previewBundle && S.previewBundle.key === bundleKey({ wall: id, material: S.c.material })) {
      if (apply) applyWallpaper(t);
      return;
    }
    if (apply || immediate) { loadWallpaperPreview(t); return; }
    target = lookOf(S.c); target.wall = id;
    S.pending = { patch: { wall: id }, target: target, row: 'bg', preview: true, transient: false, deferred: true };
    t.previewDue = id;
    t.previewTimer = setTimeout(function () { if (top() === t && WALLS[t.i].id === id) loadWallpaperPreview(t); }, WALL_DELAY);
  }
  function retryWallpaper(t) {
    var apply = t.failedApply, bundle = t.retryBundle;
    t.f.zone = 'photo';
    if (bundle && apply) applyWallpaper(t, bundle);
    else previewWallpaper(t, t.i, apply, true);
  }
  function closeWallpaper(t) {
    cancelWallpaperTimer(t); t.applyPending = null; S.err = null; pop(); restoreLook();
    if (top().id === 'appearance' && top().group === 'background') detailFocus(top(), { action: 'background.wallpaper' }, 0);
  }
  V.wallpaper = {
    norm: function (t) {
      t.i = clamp(t.i, 0, WALLS.length - 1);
      if (t.f.zone === 'retry' && !t.failedId) t.f.zone = 'photo';
      if (t.i < t.top) t.top = t.i;
      if (t.i >= t.top + WALL_VISIBLE) t.top = t.i - WALL_VISIBLE + 1;
      t.top = clamp(t.top, 0, Math.max(0, WALLS.length - WALL_VISIBLE));
    },
    key: function (t, k) {
      if (k === 'back') { closeWallpaper(t); return; }
      if (t.f.zone === 'back') {
        if (k === 'ok') closeWallpaper(t);
        else if (k === 'down' || k === 'right') t.f.zone = 'photo';
        return;
      }
      if (t.f.zone === 'retry') {
        if (k === 'ok') retryWallpaper(t);
        else if (k === 'up' || k === 'left') t.f.zone = 'photo';
        return;
      }
      if (k === 'left' || k === 'up' && t.i === 0) { t.f.zone = 'back'; t.applyPending = null; }
      else if (k === 'up' && t.i > 0) previewWallpaper(t, t.i - 1, false);
      else if (k === 'down' && t.i < WALLS.length - 1) previewWallpaper(t, t.i + 1, false);
      else if ((k === 'right' || k === 'down') && t.failedId) t.f.zone = 'retry';
      else if (k === 'ok') { if (t.retryBundle) applyWallpaper(t, t.retryBundle); else applyWallpaper(t); }
    },
    point: function (t, z, i) {
      if (z === 'wall-back') closeWallpaper(t);
      else if (z === 'wall-retry') retryWallpaper(t);
      else if (z === 'wall-choice' && i >= 0 && i < WALLS.length) {
        if (i === t.i) { t.f.zone = 'photo'; this.key(t, 'ok'); }
        else previewWallpaper(t, i, true);
      }
    }
  };

  /* ---------- Installed apps ---------- */
  function appsItems() { return catalog.error ? [] : ALPHA; }
  function appsHead() { return catalog.error ? [['retry', 'Try again', '', '']] : [['editor', 'Apps on Home', '', 'home']]; }
  V.apps = {
    sheet: true,
    norm: function (t) {
      var n = appsItems().length;
      t.f.i = clamp(t.f.i, 0, Math.max(0, n - 1));
      if (!n) t.f.zone = 'head';
    },
    key: function (t, k) {
      var f = t.f, items = appsItems(), n = items.length, col = f.i % COLS, row = Math.floor(f.i / COLS);
      if (k === 'back') { pop(); return; }
      if (f.zone === 'head') {
        if (k === 'down' && n) f.zone = 'grid';
        else if (k === 'ok') { if (catalog.error) refreshCatalog(); else openEditor('apps'); }
        return;
      }
      if (k === 'left' && col > 0) f.i--;
      else if (k === 'right' && col < COLS - 1 && f.i < n - 1) f.i++;
      else if (k === 'down' && row < Math.ceil(n / COLS) - 1) f.i = Math.min(f.i + COLS, n - 1);
      else if (k === 'up') { if (row > 0) f.i -= COLS; else f.zone = 'head'; }
      else if (k === 'ok' && n) launch(items[f.i]);
      S.appsFocus = items[f.i] || null;
    },
    point: function (t, z, i) { if (z === 'grid') { t.f.zone = 'grid'; t.f.i = i; } else if (z === 'head') t.f.zone = 'head'; else return; this.key(t, 'ok'); }
  };

  /* ---------- B: two-zone Home editor ---------- */
  function otherGroups() {
    var rec = S.c.recent.filter(function (id) { return !onHome(id) && app(id); });
    return { recent: rec, rest: ALPHA.filter(function (id) { return !onHome(id) && rec.indexOf(id) < 0; }) };
  }
  function otherList() { var o = otherGroups(); return o.recent.concat(o.rest); }
  function editorCut() { return 5; }
  function editorHomeY(i) { return i * ED_ROW + (i >= editorCut() ? 24 : 0); }
  function editorOtherY(j) {
    var o = otherGroups();
    return j * ED_ROW + (o.recent.length ? ED_SEP : 0) + (o.recent.length && j >= o.recent.length ? ED_SEP : 0);
  }
  function rememberOther(t) {
    var list = otherList();
    t.otherReturn = { id: list[t.f.j] || null, index: t.f.j, top: t.top };
  }
  function returnOther(t) {
    var list = otherList(), memory = t.otherReturn, i = memory ? list.indexOf(memory.id) : -1;
    t.f.zone = 'other';
    t.f.j = i >= 0 ? i : clamp(memory ? memory.index : 0, 0, Math.max(0, list.length - 1));
    if (memory) t.top = memory.top;
  }
  function nearestHome(t, count) {
    var target = editorOtherY(t.f.j) - t.top + 36, best = 0, distance = Infinity, i, d;
    for (i = 0; i < count; i++) {
      d = Math.abs(editorHomeY(i) + 36 - target);
      if (d < distance) { best = i; distance = d; }
    }
    return best;
  }
  V.editor = {
    sheet: true,
    norm: function (t) {
      var f = t.f, nh = (t.lifted ? t.lifted.order : S.c.home).length, no = otherList().length;
      f.i = clamp(f.i, 0, Math.max(0, nh - 1));
      f.j = clamp(f.j, 0, Math.max(0, no - 1));
      if (f.zone === 'home' && !nh) f.zone = no ? 'other' : 'head';
      if (f.zone === 'other' && !no) f.zone = nh ? 'home' : 'head';
    },
    key: function (t, k) {
      var f = t.f, H = t.lifted ? t.lifted.order : S.c.home, O = otherList(), nh = H.length, no = O.length, d, tmp;
      if (t.lifted) {
        d = k === 'up' ? -1 : k === 'down' ? 1 : 0;
        if (d && f.i + d >= 0 && f.i + d < nh) { tmp = H[f.i + d]; H[f.i + d] = H[f.i]; H[f.i] = tmp; f.i += d; S.err = null; }
        else if (k === 'ok') editorPlace(t);
        else if (k === 'back') { f.i = t.lifted.from; t.lifted = null; S.err = null; }
        return;
      }
      if (k === 'back') { closeEditor(t); return; }
      if (f.zone === 'head') {
        if (k === 'left' && f.h > 0) f.h--;
        else if (k === 'right' && f.h < 1) f.h++;
        else if (k === 'down') { if (no) returnOther(t); else if (nh) f.zone = 'home'; }
        else if (k === 'ok') { begin(); if (f.h === 0) undoLast(null); else closeEditor(t); }
      } else if (f.zone === 'home') {
        if (k === 'up') { if (f.i > 0) f.i--; else f.zone = 'head'; }
        else if (k === 'down') { if (f.i < nh - 1) f.i++; }
        else if (k === 'right') { if (f.part === 'name') f.part = 'remove'; else if (no) returnOther(t); }
        else if (k === 'left') { if (f.part === 'remove') f.part = 'name'; }
        else if (k === 'ok') {
          begin();
          if (f.part === 'name') t.lifted = { id: H[f.i], from: f.i, order: H.slice(), snap: snap() };
          else editorRemove(t, H[f.i]);
        }
      } else {
        if (k === 'up') { if (f.j > 0) { f.j--; rememberOther(t); } else f.zone = 'head'; }
        else if (k === 'down') { if (f.j < no - 1) { f.j++; rememberOther(t); } }
        else if (k === 'left') { if (nh) { rememberOther(t); f.i = nearestHome(t, nh); f.zone = 'home'; f.part = 'name'; } }
        else if (k === 'ok') { begin(); editorAdd(t, O[f.j]); }
      }
    },
    point: function (t, z, i) {
      if (t.lifted) { if (z === 'name' && i === t.f.i) this.key(t, 'ok'); return; }
      if (z === 'name' || z === 'remove') { t.f.zone = 'home'; t.f.i = i; t.f.part = z; }
      else if (z === 'other') { t.f.zone = 'other'; t.f.j = i; rememberOther(t); }
      else if (z === 'head') { t.f.zone = 'head'; t.f.h = i; }
      else return;
      this.key(t, 'ok');
    }
  };
  /* Focus follows the app between zones, so a repeated OK toggles the same app. */
  function editorRemove(t, id) {
    if (!homeRemove(id)) return;
    t.f.zone = 'other'; t.f.j = otherList().indexOf(id);
    S.note = app(id).name + ' is in Recently removed. OK puts it back.';
  }
  function editorAdd(t, id) {
    rememberOther(t);
    if (!homeAdd(id)) return;
    var remaining = otherList(), at = clamp(t.otherReturn.index, 0, Math.max(0, remaining.length - 1));
    t.otherReturn.id = remaining[at] || null; t.otherReturn.index = at;
    t.f.zone = 'home'; t.f.i = S.c.home.indexOf(id); t.f.part = 'remove';
    S.note = app(id).name + ' is on Home, position ' + (t.f.i + 1) + '.';
  }
  function editorPlace(t) {
    var L = t.lifted;
    begin();
    if (same(L.order, S.c.home)) { t.lifted = null; return; }
    if (!homeMove(L.order.slice(), L.id, L.snap)) return;
    t.lifted = null;
    S.note = app(L.id).name + ' moved to position ' + (t.f.i + 1) + '.';
  }
  function closeEditor() { clearSession(); pop(); }

  /* ---------- Settings, Layout and messages ---------- */
  function mode() { for (var i = 0; i < MODES.length; i++) if (MODES[i].id === S.c.mode) return MODES[i]; return MODES[0]; }
  function settingsRows() {
    var n = S.c.home.length;
    var audioOn = window.CleanFrameAudio && !window.CleanFrameAudio.isMuted();
    var audioVol = window.CleanFrameAudio && window.CleanFrameAudio.getVolumeLevel ? window.CleanFrameAudio.getVolumeLevel() : 'standard';
    var audioLabel = audioOn ? (audioVol === 'subtle' ? 'Subtle' : audioVol === 'high' ? 'High' : 'Standard') : 'Off';
    return [
      { id: 'appearance', label: 'Appearance & Themes', value: FONTS[S.c.font] ? FONTS[S.c.font].name : 'Apple SF Pro', icon: 'art', desc: 'Customise interface fonts, wallpapers, visual materials, and dock layouts.' },
      { id: 'aerial', label: 'Screen Saver', value: aerialSummary(), icon: 'tv', desc: 'Choose Apple Aerial video themes, shuffle modes, and idle timer durations.' },
      { id: 'sound', label: 'Sound & Audio', value: audioLabel, icon: 'volume', desc: 'Adjust navigation sound effects, feedback volume, and audio cues.' },
      { id: 'picture', label: 'Picture & Brightness', value: 'Read from the TV', icon: 'settings', desc: 'Backlight, contrast, sharpness, colour and picture mode, read from and written to the screen through Vetro.' },
      { id: 'remotes', label: 'Remotes & Devices', value: 'Samsung Remote', icon: 'remote', desc: 'Manage TV remote navigation, quick actions, and native Samsung controls.' },
      { id: 'editor', label: 'Apps on Home', value: n + (n === 1 ? ' app' : ' apps'), icon: 'apps', desc: 'Add, remove, and reorder the apps displayed in your Home dock.' },
      { id: 'smarthome', label: 'Smart Home', value: 'Home Assistant', icon: 'home', desc: 'View Home Assistant connection status, entities, and room devices.' },
      { id: 'homedevices', label: 'Home & Control Centre', value: (function () { var n = haDeviceTotals(); return n.all ? n.shown + ' of ' + n.all + ' devices' : 'No devices'; }()), icon: 'apps', desc: 'Choose which room devices the Home app and the Control Centre show.' },
      { id: 'system', label: 'System & About', value: 'CleanFrame v0.6.1', icon: 'settings', desc: 'View TV hardware model, Tizen version, IP address, and system diagnostics.' }
    ];
  }
  function aerialSummary() {
    var a = window.CleanFrameAerial;
    if (!a) return 'Aerial gallery';
    var theme = a.themes().filter(function (t) { return t.value === a.get('theme'); })[0];
    var idle = a.idles().filter(function (t) { return t.value === a.get('idle'); })[0];
    return (theme ? theme.label : 'Landscape') + ' · ' + (idle ? idle.label : '5 minutes');
  }
  function aerialValue(axis) {
    var a = window.CleanFrameAerial;
    if (!a) return null;
    return axis === 'aerial' ? a.get('theme') : axis === 'aerialidle' ? a.get('idle') :
      axis === 'aerialclip' ? a.get('clip') : null;
  }
  function settingsIds() { return settingsRows().map(function (r) { return r.id; }); }
  V.settings = {
    sheet: true,
    norm: function (t) { var ids = settingsIds(); if (ids.indexOf(t.f.id) < 0) t.f.id = ids[0]; },
    key: function (t, k) {
      var ids = settingsIds(), i = Math.max(0, ids.indexOf(t.f.id));
      if (k === 'up' && i > 0) i--;
      else if (k === 'down' && i < ids.length - 1) i++;
      else if (k === 'back') { pop(); return; }
      t.f.id = ids[i]; S.settingsFocus = ids[i];
      if (k === 'ok') settingsOk(ids[i]);
    },
    point: function (t, z, i, id) { if (z === 'row' && id) { t.f.id = id; this.key(t, 'ok'); } }
  };
  function settingsOk(id) {
    /* The picture panel is the screen's own hardware, not one of CleanFrame's
       preferences, so it opens its own pane instead of a settings page. */
    if (id === 'picture') { if (window.CleanFrameTV) window.CleanFrameTV.open(); return; }
    openAppearance(id);
  }
  var DETAIL_NAMES = {
    appearance: 'Appearance & Themes',
    smarthome: 'Smart Home & Devices',
    background: 'Background & Wallpaper',
    layout: 'Layout & Display',
    typography: 'Typography',
    focus: 'Focus & Materials',
    rotation: 'Wallpaper Rotation',
    aerial: 'Screen Saver',
    sound: 'Sound & Audio',
    remotes: 'Remotes & Devices',
    system: 'System & About',
    editor: 'Apps on Home Dock',
    picture: 'Picture & Brightness',
    homedevices: 'Home & Control Centre'
  };
  function choice(axis, value, disabled, desc) {
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
  }
  function itemHeroInfo(item, group) {
    if (!item) return { icon: 'settings', desc: '' };
    if (item.action === 'settings.back') return { icon: 'left', desc: 'Return to the main Settings menu.' };
    if (item.axis === 'font') {
      if (item.value === 'sf') return { icon: 'type', desc: 'Apple San Francisco (SF Pro Display). Balanced geometric proportions designed for sharp legibility on 4K displays.' };
      if (item.value === 'manrope') return { icon: 'type', desc: 'Manrope. Modern geometric sans-serif with rounded forms and warm character.' };
      if (item.value === 'geist') return { icon: 'type', desc: 'Geist Sans. Swiss-style neo-grotesque engineered for high contrast and modern UI.' };
      if (item.value === 'newsreader') return { icon: 'type', desc: 'Newsreader. Editorial serif with distinctive optical sizing for ambient displays.' };
    }
    if (item.axis === 'bg') return { icon: 'art', desc: 'Choose between full photography wallpapers, deep dark mode, or soft ambient light mode.' };
    if (item.action === 'background.wallpaper') return { icon: 'art', desc: 'Browse and select high-resolution museum artwork and landscape photography.' };
    if (item.action === 'background.rotation' || item.axis === 'mode') return { icon: 'art', desc: 'Automatically cycle through your wallpaper gallery at regular intervals.' };
    if (item.axis === 'layout') return { icon: 'apps', desc: 'Choose between the bottom floating Glass Dock and the left-aligned minimalist List view.' };
    if (item.axis === 'apps') return { icon: 'apps', desc: 'Show app icons alongside their titles, or display clean minimalist icon-only dock tiles.' };
    if (item.axis === 'focus') return { icon: 'art', desc: 'Select between Apple-style luminous glass capsule focus and clean typographic contrast.' };
    if (item.axis === 'material') return { icon: 'art', desc: 'Choose the visual frosted glass refraction material for dock tiles and sheets.' };
    if (item.axis === 'aerial') return { icon: 'tv', desc: 'Set the video gallery category for Apple Aerial footage (Landscape, Earth, Cityscape, Underwater).' };
    if (item.axis === 'aerialidle') return { icon: 'tv', desc: 'Time of inactivity before the Apple Aerial 4K screen saver starts playing.' };
    if (item.axis === 'aerialclip') return { icon: 'tv', desc: 'Select a specific cinematic video clip or rotate randomly through all available clips.' };
    if (item.action === 'aerial.preview') return { icon: 'tv', desc: 'Start the Apple Aerial screen saver immediately in full resolution.' };
    if (item.action === 'sound.toggle') return { icon: 'volume', desc: 'Turn navigation clicks, selection feedback, and sheet transitions on or off.' };
    if (item.axis === 'soundvol') return { icon: 'volume', desc: 'Adjust acoustic volume for directional ticks and selection confirmations.' };
    if (item.axis === 'soundtheme') return { icon: 'volume', desc: 'High-fidelity audio pack sampled from Google Material Design UI resources.' };
    if (item.action === 'samsung.settings') return { icon: 'settings', desc: 'Open native Samsung TV settings for Picture calibration, Audio output, and Network.' };
    if (item.action === 'samsung.home') return { icon: 'home', desc: 'Switch to Samsung Smart Hub native Home interface.' };
    if (item.action === 'system.reload') return { icon: 'undo', desc: 'Reload CleanFrame launcher application and re-initialize device services.' };
    if (group === 'smarthome' || item.action.indexOf('smarthome.') === 0) return { icon: 'home', desc: item.desc || 'Home Assistant integration for air conditioning, fans, lights, and room controls.' };
    if (group === 'remotes') return { icon: 'remote', desc: 'Manage TV remote navigation, quick actions, and native Samsung controls.' };
    if (group === 'system') return { icon: 'settings', desc: 'Hardware details, Tizen platform information, and IP network connection status.' };
    return { icon: 'settings', desc: item.desc || item.description || item.label || '' };
  }
  function detailSections(t) {
    var flat = S.c.bg !== 'photo', inactive = !materialApplies();
    function options(axis, values, disabled) { return values.map(function (value) { return choice(axis, value, disabled); }); }
    if (t.group === 'editor') {
      var homeApps = S.c.home.map(function (id, idx) {
        var a = app(id);
        return {
          action: 'dock.manage.' + id,
          id: id,
          label: (idx + 1) + '. ' + a.name,
          value: idx === 0 ? 'First' : idx === S.c.home.length - 1 ? 'Last' : '#' + (idx + 1),
          desc: a.name + ' (position ' + (idx + 1) + ' of ' + S.c.home.length + '). OK opens reorder and remove options.'
        };
      });
      var otherApps = otherList().map(function (id) {
        var a = app(id);
        return {
          action: 'dock.add.' + id,
          id: id,
          label: a.name,
          value: '+ Add',
          desc: 'Add ' + a.name + ' to your Home dock.'
        };
      });
      var sec = [
        { id: 'dockapps', title: 'Apps on Home Dock (' + S.c.home.length + ' of ' + CAP + ')', items: homeApps }
      ];
      if (otherApps.length) {
        sec.push({ id: 'moreapps', title: 'Other Installed Apps (Click to Add)', items: otherApps });
      }
      return sec;
    }
    if (t.group && t.group.indexOf('app_manage:') === 0) {
      var targetId = t.group.slice(11), a = app(targetId), idx = S.c.home.indexOf(targetId), n = S.c.home.length;
      var actions = [];
      if (idx > 0) {
        actions.push({ action: 'dock.move.top.' + targetId, label: 'Move to Top (Position 1)', desc: 'Place ' + a.name + ' as the first item on your Home dock.' });
        actions.push({ action: 'dock.move.up.' + targetId, label: 'Move Up (Position ' + idx + ')', desc: 'Swap ' + a.name + ' with ' + app(S.c.home[idx - 1]).name + '.' });
      }
      if (idx >= 0 && idx < n - 1) {
        actions.push({ action: 'dock.move.down.' + targetId, label: 'Move Down (Position ' + (idx + 2) + ')', desc: 'Swap ' + a.name + ' with ' + app(S.c.home[idx + 1]).name + '.' });
      }
      if (n > 1) {
        actions.push({ action: 'dock.remove.' + targetId, label: 'Remove from Home Dock', desc: 'Remove ' + a.name + ' from the Home dock (remains installed on TV).' });
      }
      return [{ id: 'appactions', title: 'Position ' + (idx + 1) + ' of ' + n, items: actions }];
    }
    if (t.group === 'appearance') return [
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
    if (t.group === 'homedevices') {
      var devRooms = haRooms(), devSecs = [], seenRoomDev = {}, r, k, dev, items, list;
      for (r = 0; r < devRooms.length; r++) {
        items = [];
        list = devRooms[r].devices || [];
        for (k = 0; k < list.length; k++) {
          dev = list[k];
          if (!dev || !dev.id || seenRoomDev[dev.id]) continue;
          seenRoomDev[dev.id] = 1;
          items.push({
            action: 'device.toggle.' + dev.id,
            label: dev.name,
            value: deviceShown(dev.id) ? 'Shown' : 'Hidden',
            desc: deviceShown(dev.id)
              ? 'Shown in the Home app and the Control Centre. OK removes it from both.'
              : 'Hidden from the Home app and the Control Centre. OK puts it back.'
          });
        }
        if (items.length) devSecs.push({ id: 'devroom' + r, title: devRooms[r].name || 'Devices', items: items });
      }
      if (!devSecs.length) devSecs.push({ id: 'devempty', title: 'Devices', items: [{ action: 'smarthome.info', label: 'No Home Assistant devices found', disabled: true }] });
      return devSecs;
    }
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
    }
    if (t.group === 'background') return [
      { id: 'wall', title: 'Wallpaper', items: [{ action: 'background.wallpaper', label: wall(S.c.wall).name, thumbnail: true, disabled: flat }] },
      { id: 'bg', title: 'Background type', items: options('bg', ['photo', 'dark', 'light']) },
      { id: 'rotation', title: 'Rotation', items: [{ action: 'background.rotation', label: mode().name, disabled: flat }], reason: flat ? 'Choose Photo to use wallpaper and rotation.' : '' }
    ];
    if (t.group === 'layout') return [
      { id: 'layout', title: 'Layout', items: options('layout', ['dock', 'list']) },
      { id: 'apps', title: 'App display', items: options('apps', ['both', 'icons']) }
    ];
    if (t.group === 'typography') return [{ id: 'font', title: 'Font Family', items: options('font', LOOK_VALUES.font) }];
    if (t.group === 'focus') return [
      { id: 'focus', title: 'Focus style', items: options('focus', ['glass', 'type']) },
      { id: 'material', title: 'Material', items: options('material', ['soft', 'frost', 'tint'], inactive),
        reason: inactive ? flat ? 'Materials are available with a Photo background.' : 'Choose Glass focus or the Dock layout to use materials.' : '' }
    ];
    if (t.group === 'rotation') return [{ id: 'mode', title: 'Interval', items: options('mode', MODES.map(function (m) { return m.id; }), flat),
      reason: flat ? 'Choose Photo in Background to use rotation.' : 'Timed changes pause while Settings or another panel is open.' }];
    if (t.group === 'sound') {
      var audioOn = window.CleanFrameAudio && !window.CleanFrameAudio.isMuted();
      return [
        { id: 'soundeffects', title: 'Audio Feedback', items: [
          { action: 'sound.toggle', axis: 'soundtoggle', value: audioOn ? 'on' : 'off', label: 'Sound Effects', description: audioOn ? 'On' : 'Off' }
        ] },
        { id: 'soundvol', title: 'Feedback Volume', items: [
          choice('soundvol', 'subtle', false, 'Subtle acoustic ticks (15% volume)'),
          choice('soundvol', 'standard', false, 'Standard balanced feedback (30% volume)'),
          choice('soundvol', 'high', false, 'High volume feedback (55% volume)')
        ] },
        { id: 'soundpack', title: 'Audio Theme', items: [
          choice('soundtheme', 'material', false, 'Material Design UI Audio')
        ] }
      ];
    }
    if (t.group === 'remotes') return [
      { id: 'remoteinfo', title: 'Remote Control', items: [
        { action: 'remote.device', label: 'TV Remote', value: 'Connected', desc: 'Samsung Smart Remote connected via Bluetooth.', disabled: true },
        { action: 'remote.btn', label: 'TV Button', value: 'CleanFrame Home', desc: 'Press the TV button once to go to the CleanFrame Home Screen.', disabled: true }
      ] },
      { id: 'samsungcontrols', title: 'Samsung Controls', items: [
        { action: 'samsung.settings', label: 'Samsung TV Settings', value: 'Open', desc: 'Open native Samsung TV settings for Picture calibration, Audio output, and Network.' },
        { action: 'samsung.home', label: 'Samsung Smart Hub', value: 'Open', desc: 'Switch to Samsung Smart Hub native Home interface.' }
      ] }
    ];
    if (t.group === 'system') return [
      { id: 'sysinfo', title: 'About This TV', items: [
        { action: 'sys.model', label: 'TV Model', value: 'Samsung The Frame 55"', desc: 'Model: QA55LS03BAKXXL (The Frame 2022).', disabled: true },
        { action: 'sys.os', label: 'Operating System', value: 'Tizen OS 6.5', desc: 'Samsung Tizen platform release 6.5.', disabled: true },
        { action: 'sys.cf', label: 'CleanFrame', value: 'v0.6.1', desc: 'Custom minimalist home launcher for The Frame TV.', disabled: true },
        { action: 'sys.ip', label: 'Network', value: '192.168.0.191', desc: 'Local Wi-Fi network connection active.', disabled: true }
      ] },
      { id: 'sysactions', title: 'Maintenance', items: [
        { action: 'system.reload', label: 'Restart CleanFrame', value: 'Reload', desc: 'Reload CleanFrame launcher application and re-initialize device services.' }
      ] }
    ];
    if (t.group === 'aerial') {
      var air = window.CleanFrameAerial;
      if (!air) return [{ id: 'aerial', title: '', items: [{ action: 'aerial.preview', label: 'Screen saver unavailable', description: 'The gallery did not load.' }] }];
      return [
        { id: 'aerial', title: 'Theme', items: air.themes().filter(function (r) {
          return r.value !== 'photos';
        }).map(function (r) {
          return { action: r.action, axis: 'aerial', value: r.value, label: r.label };
        }) },
        { id: 'aerialidle', title: 'Start after', items: air.idles().map(function (r) {
          return { action: r.action, axis: 'aerialidle', value: r.value, label: r.label };
        }) },
        { id: 'aerialclip', title: 'Video', items: air.clips().map(function (r) {
          return { action: 'choice.aerialclip.' + r.value, axis: 'aerialclip', value: r.value, label: r.label };
        }) },
        { id: 'aerialpreview', title: '', items: [{ action: 'aerial.preview', label: 'Preview Screen Saver',
          description: 'Fill the screen now. Any key returns here.' }] }
      ];
    }
    return [{ id: 'samsung', title: '', items: [
      { action: 'samsung.home', label: 'Samsung Home', description: 'Open Samsung’s Home screen' },
      { action: 'samsung.settings', label: 'TV settings', description: 'Picture, sound and network settings' }
    ] }];
  }
  function detailRows(t) {
    var rows = [[{ action: 'settings.back', label: 'Settings' }]];
    detailSections(t).forEach(function (section) {
      var enabled = section.items.filter(function (item) { return !item.disabled; });
      enabled.forEach(function (item) { rows.push([item]); });
    });
    if (S.lookError) rows.push([{ action: 'settings.retry', label: 'Try again' }]);
    return rows;
  }
  function detailLocation(t) {
    var rows = detailRows(t), row = 0, column = 0;
    rows.forEach(function (items, r) { items.forEach(function (item, c) { if (item.action === t.f.action) { row = r; column = c; } }); });
    return { rows: rows, row: row, column: column, item: rows[row][column] };
  }
  function detailFocus(t, item, column) {
    t.f.action = item.action;
    if (item.action !== 'settings.back') S.detailFocus[t.group] = item.action;
    if (column !== undefined) t.f.column = column;
    if (item.axis) S.appearanceFocus = item.axis;
  }
  function applyRotation(value) {
    var c;
    if (S.c.bg !== 'photo') return;
    S.err = null; S.lookError = null;
    if (value === S.c.mode) return;
    c = next(S.c.home.slice(), S.c.recent.slice()); c.mode = value;
    if (!write(c, 'Wallpaper rotation')) S.lookError = { type: 'save', patch: { mode: value }, row: 'mode', transient: false };
  }
  function detailBack() { cancelLook(); S.err = null; pop(); }
  function detailOk(t, item) {
    var patch = {}, error = S.lookError;
    if (item.action === 'settings.back') { detailBack(); return; }
    if (item.disabled || S.pending) return;
    if (item.action === 'settings.retry') {
      if (error && error.patch[error.row] !== undefined) detailFocus(t, choice(error.row, error.patch[error.row]), 0);
      if (error && error.row === 'mode') applyRotation(error.patch.mode);
      else if (error) setLook(error.patch, { row: error.row });
    } else if (item.axis === 'mode') applyRotation(item.value);
    else if (item.axis === 'aerial' || item.axis === 'aerialidle' || item.axis === 'aerialclip') {
      var airKey = item.axis === 'aerial' ? 'theme' : (item.axis === 'aerialclip' ? 'clip' : 'idle');
      if (window.CleanFrameAerial) window.CleanFrameAerial.set(airKey, item.value);
      renderAppearance(t);
    }
    else if (item.action === 'aerial.preview') { if (window.CleanFrameAerial) window.CleanFrameAerial.start(); }
    else if (item.action === 'smarthome.kiosk') {
      var kioskUrl = (window.CleanFrameHA && CleanFrameHA.dashboard) || 'http://192.168.0.162:8123/dashboard-kiosk/0';
      FrameDevice.openUrl(kioskUrl, function () {});
    }
    else if (item.action.indexOf('device.toggle.') === 0) {
      var toggleId = item.action.slice(14);
      setDeviceShown(toggleId, !deviceShown(toggleId));
      if (window.CleanFrameAudio) CleanFrameAudio.select();
      if (window.CleanFrameHomeApp && window.CleanFrameHomeApp.refresh) window.CleanFrameHomeApp.refresh();
      renderAppearance(t);
    }
    else if (item.action === 'smarthome.panel') {
      pop();
      openHAPanel();
    }
    else if (item.action.indexOf('dock.manage.') === 0) {
      openAppearance('app_manage:' + item.action.slice(12));
    }
    else if (item.action.indexOf('dock.add.') === 0) {
      homeAdd(item.action.slice(9));
      if (window.CleanFrameAudio) CleanFrameAudio.select();
      renderAppearance(t);
    }
    else if (item.action.indexOf('dock.move.top.') === 0) {
      var id = item.action.slice(14), h = S.c.home.slice(), cur = h.indexOf(id);
      if (cur > 0) { h.splice(cur, 1); h.unshift(id); homeMove(h, id, snap()); }
      if (window.CleanFrameAudio) CleanFrameAudio.select();
      renderAppearance(t);
    }
    else if (item.action.indexOf('dock.move.up.') === 0) {
      var id = item.action.slice(13), h = S.c.home.slice(), cur = h.indexOf(id);
      if (cur > 0) { var tmp = h[cur-1]; h[cur-1] = h[cur]; h[cur] = tmp; homeMove(h, id, snap()); }
      if (window.CleanFrameAudio) CleanFrameAudio.select();
      renderAppearance(t);
    }
    else if (item.action.indexOf('dock.move.down.') === 0) {
      var id = item.action.slice(15), h = S.c.home.slice(), cur = h.indexOf(id);
      if (cur >= 0 && cur < h.length - 1) { var tmp = h[cur+1]; h[cur+1] = h[cur]; h[cur] = tmp; homeMove(h, id, snap()); }
      if (window.CleanFrameAudio) CleanFrameAudio.select();
      renderAppearance(t);
    }
    else if (item.action.indexOf('dock.remove.') === 0) {
      var id = item.action.slice(12);
      homeRemove(id);
      if (window.CleanFrameAudio) CleanFrameAudio.snap();
      pop();
    }
    else if (item.action === 'sound.toggle') {
      if (window.CleanFrameAudio) {
        window.CleanFrameAudio.mute(!window.CleanFrameAudio.isMuted());
      }
      renderAppearance(t);
    }
    else if (item.axis === 'soundvol') {
      if (window.CleanFrameAudio) {
        window.CleanFrameAudio.setVolumeLevel(item.value);
      }
      renderAppearance(t);
    }
    else if (item.action === 'system.reload') {
      location.reload();
    }
    else if (item.axis) { patch[item.axis] = item.value; setLook(patch, { row: item.axis }); }
    else if (item.action === 'background.wallpaper') openWallpaper();
    else if (item.action === 'background.rotation') openAppearance('rotation');
    else if (item.action === 'samsung.home' || item.action === 'samsung.settings') {
      perform(item.action === 'samsung.home' ? 'Samsung Home' : 'TV settings',
        item.action === 'samsung.home' ? FrameDevice.home : FrameDevice.settings,
        systemAnchor(item.action === 'samsung.home' ? 'home' : 'settings',
          document.querySelector('[data-action="' + item.action + '"].is-focus')));
    }
  }
  V.appearance = {
    norm: function (t) {
      var rows = detailRows(t), exists = false, applied = null;
      var axis = { background: 'bg', layout: 'layout', typography: 'font', focus: 'focus', rotation: 'mode' }[t.group];
      rows.forEach(function (items) { items.forEach(function (item) {
        if (item.action === t.f.action) exists = true;
        /* Only a real axis row can be the applied one. Items without an axis
           (Choose Wallpaper, Rotation) used to match `S.c[undefined]` and stole
           the opening focus, dropping the list at its last row. */
        if (axis && item.axis === axis && item.value === S.c[axis]) applied = item;
      }); });
      if (!exists) detailFocus(t, applied || (rows[1] || rows[0])[0], 0);
      if (t.f.column === undefined) t.f.column = detailLocation(t).column;
    },
    key: function (t, k) {
      var at = detailLocation(t), row = at.row, column = at.column;
      if (k === 'back') { detailBack(); return; }
      if (k === 'ok') { detailOk(t, at.item); return; }
      if (k === 'up' || k === 'down') {
        row = clamp(row + (k === 'up' ? -1 : 1), 0, at.rows.length - 1);
        column = Math.min(t.f.column || 0, at.rows[row].length - 1);
        detailFocus(t, at.rows[row][column]);
      } else if (k === 'left' || k === 'right') {
        column = clamp(column + (k === 'left' ? -1 : 1), 0, at.rows[row].length - 1);
        detailFocus(t, at.rows[row][column], column);
      }
    },
    point: function (t, z, i, action) {
      if (z !== 'detail') return;
      detailRows(t).some(function (items) { return items.some(function (item, column) {
        if (item.action !== action) return false;
        detailFocus(t, item, column); detailOk(t, item); return true;
      }); });
    }
  };
  function messageContent(t) { return t.content || MSG[t.msg]; }
  V.message = {
    sheet: true,
    key: function (t, k) {
      var A = messageContent(t).actions, a;
      if (k === 'left') t.f.b = Math.max(0, t.f.b - 1);
      else if (k === 'right') t.f.b = Math.min(A.length - 1, t.f.b + 1);
      else if (k === 'back') pop();
      else if (k === 'ok') { a = A[t.f.b][0]; pop(); if (a === 'samsung') perform('Samsung Home', FrameDevice.home, systemAnchor('home', null)); }
    },
    point: function (t, z, i) { if (z === 'act') { t.f.b = i; this.key(t, 'ok'); } }
  };
  /* ---------- Search ---------- */
  /* The sheet follows the set's own search screen: Back, one query field, the
     abc/123 keyboard and the results beside it. Every character is typed on
     that keyboard - the query is drawn, never held in a text input - so the
     TV's own IME never opens over the launcher. */
  var SEARCH_ROWS = {
    abc: [
      ['a', 'b', 'c', 'd', 'e', 'f'],
      ['g', 'h', 'i', 'j', 'k', 'l'],
      ['m', 'n', 'o', 'p', 'q', 'r'],
      ['s', 't', 'u', 'v', 'w', 'x'],
      ['y', 'z']
    ],
    num: [
      ['1', '2', '3', '4', '5', '6'],
      ['7', '8', '9', '0', '-', ':'],
      ['/', '.', ',', '?', '!', '&'],
      ['@', '#', '%', '+', '=', '*']
    ]
  };
  var SEARCH_UTIL = ['space', 'del', 'clear'];
  /* Apps that can take a search term, in the order their rows are offered. The
     row hands the query to the app itself, so the viewer lands in that app's
     own search results rather than on its home screen. Netflix is left out: this
     set has no working Netflix app, and a Netflix offer opens in Nuvio instead,
     so a Netflix pill would only lead nowhere. Its place goes to SonyLIV, which
     is installed and had no pill of its own. */
  var SEARCH_APPS = ['appletv', 'youtube', 'primevideo', 'sonyliv', 'hotstar',
    'disneyplus', 'stremio', 'nuviotv', 'applemusic', 'spotify', 'samsungtvplus', 'tizentube', 'youtubetv'];
  /* Four pills fit the scope row beside the keyboard, as in the reference. */
  var SEARCH_SCOPE_MAX = 4;
  var SEARCH_MAX = 48;

  function searchTabRows(tab) { return SEARCH_ROWS[tab] || SEARCH_ROWS.abc; }
  function searchRowLen(tab, row) {
    var rows = searchTabRows(tab);
    if (row >= rows.length) return SEARCH_UTIL.length;
    return rows[row] ? rows[row].length : 0;
  }
  function searchKeyAt(tab, row, col) {
    var rows = searchTabRows(tab);
    if (row >= rows.length) return SEARCH_UTIL[col] || '';
    return (rows[row] && rows[row][col]) || '';
  }
  function searchAppRef(brand) {
    for (var i = 0; i < APPS.length; i++) {
      var a = APPS[i];
      if (a.id !== brand && a.brand !== brand) continue;
      return { brand: brand, appId: a.appId || '', name: a.name, icon: a.icon || '', id: a.id };
    }
    return null;
  }
  /* The scope row lists the installed apps that can take a term, in one fixed
     order, so the row never shuffles underneath the remote. */
  function searchScopeRefs() {
    var out = [], i, ref;
    for (i = 0; i < SEARCH_APPS.length && out.length < SEARCH_SCOPE_MAX; i++) {
      ref = searchAppRef(SEARCH_APPS[i]);
      if (ref) out.push(ref);
    }
    return out;
  }

  V.search = {
    sheet: false,
    norm: function (t) {
      var f = t.f, rows = searchTabRows(f.tab);
      if (f.tab !== 'num') f.tab = 'abc';
      /* A frame saved before the header became the field itself still names
         the retired back key, so it restarts on the keyboard. */
      if (!f.zone || f.zone === 'back') f.zone = 'keys';
      if (f.zone === 'tabs') f.ti = f.ti ? 1 : 0;
      if (f.zone === 'keys') {
        f.kr = clamp(f.kr || 0, 0, rows.length);
        f.kc = clamp(f.kc || 0, 0, Math.max(0, searchRowLen(f.tab, f.kr) - 1));
      }
      if (f.zone === 'scopes') f.sc = clamp(f.sc || 0, 0, Math.max(0, searchState.scopes.length - 1));
      if (f.zone === 'sug') f.si = clamp(f.si || 0, 0, Math.max(0, searchState.sugs.length - 1));
      if (f.zone === 'results') { f.ri = Math.max(0, f.ri || 0); f.ci = Math.max(0, f.ci || 0); }
    },
    key: function (t, k) {
      var f = t.f, rows = searchTabRows(f.tab), last = rows.length;
      if (k === 'back') { closeSearch(); return; }
      if (f.zone === 'field') {
        if (k === 'down') { f.zone = 'tabs'; f.ti = f.tab === 'num' ? 1 : 0; }
        else if (k === 'right' && searchState.scopes.length) { f.zone = 'scopes'; f.sc = 0; }
        return;
      }
      if (f.zone === 'tabs') {
        if (k === 'left' || k === 'right') {
          f.ti = f.ti ? 0 : 1;
          f.tab = f.ti ? 'num' : 'abc';
          f.kr = 0; f.kc = 0;
        } else if (k === 'up') {
          f.zone = 'field';
        } else if (k === 'down') {
          f.zone = 'keys'; f.kr = 0;
          f.kc = clamp(f.kc || 0, 0, Math.max(0, searchRowLen(f.tab, 0) - 1));
        } else if (k === 'ok') {
          f.tab = f.ti ? 'num' : 'abc';
        }
        return;
      }
      if (f.zone === 'keys') {
        if (k === 'left') {
          if (f.kc > 0) f.kc--;
        } else if (k === 'right') {
          if (f.kc < searchRowLen(f.tab, f.kr) - 1) f.kc++;
          else if (searchState.cards.length) { f.zone = 'results'; f.ri = 0; f.ci = 0; }
          else if (searchState.scopes.length) { f.zone = 'scopes'; f.sc = 0; }
        } else if (k === 'up') {
          if (f.kr > 0) {
            f.kr--;
            f.kc = Math.min(f.kc, Math.max(0, searchRowLen(f.tab, f.kr) - 1));
          } else { f.zone = 'tabs'; f.ti = f.tab === 'num' ? 1 : 0; }
        } else if (k === 'down') {
          if (f.kr < last) {
            f.kr++;
            f.kc = Math.min(f.kc, Math.max(0, searchRowLen(f.tab, f.kr) - 1));
          } else if (searchState.cards.length) { f.zone = 'results'; f.ri = 0; f.ci = 0; }
          else if (searchState.scopes.length) { f.zone = 'scopes'; f.sc = 0; }
        } else if (k === 'ok') {
          searchType(searchKeyAt(f.tab, f.kr, f.kc));
        }
        return;
      }
      if (f.zone === 'scopes') {
        if (k === 'left') { if (f.sc > 0) f.sc--; }
        else if (k === 'right') { if (f.sc < searchState.scopes.length - 1) f.sc++; }
        else if (k === 'up') { f.zone = 'field'; }
        else if (k === 'down') {
          if (searchState.sugs.length) { f.zone = 'sug'; f.si = 0; }
          else if (searchState.cards.length) { f.zone = 'results'; f.ri = 0; f.ci = 0; }
          else { f.zone = 'keys'; f.kr = last; f.kc = 0; }
        } else if (k === 'ok') { activateSearchScope(searchState.scopes[f.sc]); }
        return;
      }
      if (f.zone === 'sug') {
        if (k === 'up') { if (f.si > 0) f.si--; else f.zone = 'scopes'; }
        else if (k === 'down') {
          if (f.si < searchState.sugs.length - 1) f.si++;
          else if (searchState.cards.length) { f.zone = 'results'; f.ri = 0; f.ci = 0; }
        } else if (k === 'left') { f.zone = 'keys'; f.kr = last; f.kc = 0; }
        else if (k === 'ok') { activateSearchSuggestion(searchState.sugs[f.si]); }
        return;
      }
      if (f.zone === 'results') {
        var grid = searchState.rows || [], len = grid[f.ri] ? grid[f.ri].length : 0;
        if (k === 'left') {
          if (f.ci > 0) f.ci--;
          else { f.zone = 'keys'; f.kr = last; f.kc = 0; }
        }
        else if (k === 'right') { if (f.ci < len - 1) f.ci++; }
        else if (k === 'up') {
          if (f.ri > 0) { f.ri--; f.ci = Math.min(f.ci, Math.max(0, (grid[f.ri] || []).length - 1)); }
          /* Up leaves the grid for the suggestions or the scope row above it,
             which is where the rest of the page's choices sit. */
          else if (searchState.sugs.length) { f.zone = 'sug'; f.si = 0; }
          else if (searchState.scopes.length) { f.zone = 'scopes'; f.sc = 0; }
          else f.zone = 'keys';
        } else if (k === 'down') {
          if (f.ri < grid.length - 1) { f.ri++; f.ci = Math.min(f.ci, Math.max(0, (grid[f.ri] || []).length - 1)); }
        } else if (k === 'ok') { activateSearchCard(f.ri, f.ci); }
        return;
      }
    },
    point: function (t, z, i, id) {
      var f = t.f, row, col;
      if (z === 's-field') { f.zone = 'field'; return; }
      if (z === 's-tab') {
        f.zone = 'tabs'; f.ti = id === 'num' ? 1 : 0; f.tab = f.ti ? 'num' : 'abc';
        f.kr = 0; f.kc = 0;
        return;
      }
      if (z === 's-key') {
        if (!isFinite(i)) return;
        row = Math.floor(i / 10); col = i % 10;
        f.zone = 'keys'; f.kr = row; f.kc = col; f.ti = f.tab === 'num' ? 1 : 0;
        searchType(searchKeyAt(f.tab, row, col));
        return;
      }
      if (z === 's-scope') { f.zone = 'scopes'; f.sc = i; activateSearchScope(searchState.scopes[i]); return; }
      if (z === 's-sug') { f.zone = 'sug'; f.si = i; activateSearchSuggestion(searchState.sugs[i]); return; }
      if (z === 's-card') { activateSearchCardByIndex(i); return; }
    }
  };

  /* ---------- Dispatch ---------- */
  function norm() { var t = top(), v = V[t.id]; if (v.norm) v.norm(t); }
  function focusSig() {
    var t = top(), f = (t && t.f) || {};
    return [t ? t.id : '', f.zone || '', f.pick !== undefined ? f.pick : '', f.mi !== undefined ? f.mi : '', f.devIdx !== undefined ? f.devIdx : '', f.kr !== undefined ? f.kr : '', f.kc !== undefined ? f.kc : '', f.sc !== undefined ? f.sc : '', f.si !== undefined ? f.si : '', f.ri !== undefined ? f.ri : '', f.ci !== undefined ? f.ci : '', S.appleTvRow || 0, S.appleTvCol || 0].join(':');
  }

  /* ---------- Scroll motion ----------
     A single press is a step and keeps the soft settle. The remote repeating is a
     scroll, and a scroll can never finish a 380 ms move: every press restarted an
     animation the eye never saw complete, which is what read as stutter. So the
     dock is told the speed and the direction of travel, and while it is scrolling
     it runs one short settle from the side the viewer came from. The classes sit
     on <body>, which no render pass rewrites, so they cannot be wiped mid-move. */
  var motionAt = 0, motionDir = 'r', motionFast = false, motionTimer = 0, lastFocusSound = 0, dockSettle = 0;
  function applyMotion() {
    var cls = 'mv-dir-' + motionDir + (motionFast ? ' mv-fast' : '');
    var body = document.body;
    /* Other modules - the private Home Assistant poll above all - ask before they
       start work of their own, so an entity refresh cannot land inside a flick. */
    window.CleanFrameMotion = { busy: function () { return motionFast; } };
    if ((body.getAttribute('data-motion') || '') === cls) return;
    body.setAttribute('data-motion', cls);
    body.className = (body.className || '').replace(/\s*mv-[a-z-]+/g, '').replace(/^\s+|\s+$/g, '');
    body.className = (body.className ? body.className + ' ' : '') + cls;
  }
  function driveMotion(k) {
    var at = Date.now(), dir = k === 'left' ? 'l' : k === 'right' ? 'r' : k === 'up' ? 'u' : k === 'down' ? 'd' : '';
    var gap;
    if (!dir) return;
    gap = motionAt ? at - motionAt : 9999;
    /* A repeat under 200 ms is the remote held down; a second early press in the
       same direction keeps the scroll going rather than dropping back to a step. */
    motionFast = gap < 200 || (motionFast && gap < 340);
    motionAt = at;
    motionDir = dir;
    clearTimeout(motionTimer);
    if (motionFast) {
      /* Coming to rest is the only moment worth paying for: one full render
         replaces the stripped-down one, and that render is what swaps in the
         poster of the tile the row stopped on. */
      motionTimer = setTimeout(function () {
        motionFast = false;
        applyMotion();
        /* The row has stopped. This is the one moment a poster swap is worth
           paying for, and it lands before the render that settles the dock. */
        flushPoster();
        render();
      }, 240);
    }
    applyMotion();
  }

  function press(k) {
    /* Every key the launcher accepts stamps the clock. The saver reads this
       instead of trusting its own re-arm: a held key steps through `press`
       without a keydown, so its timer could run out while the viewer was still
       moving, which is how the saver came up over a live screen. */
    window.CleanFrameInputAt = Date.now();
    driveMotion(k);
    norm();
    var t = top();
    var prevDepth = S.stack.length;
    var prevSig = focusSig();
    V[t.id].key(t, k);
    norm();
    render();
    /* The dwell rotation only matters once the row is at rest; asking on every
       repeat of a held key is timer work inside the scroll. */
    if (!motionFast) syncRotation();

    // Sound feedback
    if (window.CleanFrameAudio) {
      var nextDepth = S.stack.length;
      var nextSig = focusSig();
      if (nextDepth > prevDepth) {
        CleanFrameAudio.select();
      } else if (nextDepth < prevDepth) {
        CleanFrameAudio.back();
      } else if (k === 'ok') {
        CleanFrameAudio.select();
      } else if (k === 'back') {
        CleanFrameAudio.back();
      } else if (prevSig !== nextSig) {
        /* One click per tile is a pleasure; sixteen a second is a stutter, and on
           the set each one starts an audio buffer on the same thread as the move.
           The click thins out while the remote is repeating. */
        if (!motionFast || Date.now() - lastFocusSound > 90) { lastFocusSound = Date.now(); CleanFrameAudio.focus(); }
      } else {
        CleanFrameAudio.blocked();
      }
    }
  }

  /* ---------- Rendering ---------- */
  var $ = function (id) { return document.getElementById(id); };
  var stage = $('stage'), homeEl = $('home'), caption = $('caption'), utilsEl = $('utils');
  var utilFocusLabel = $('utilFocusLabel'), utilFocusKey = '', appFocusName = $('appFocusName');
  var dock = $('dock'), shelf = $('shelf'), track = $('track'), plate = $('plate'), matScrim = $('matScrim'), dockEmpty = $('dockEmpty');
  var cueL = $('cueL'), cueR = $('cueR'), dockAction = $('dockAction');
  var focusStatus = $('focusStatus'), sceneEl = $('scene'), appearanceEl = $('appearance'), appearanceRows = $('appearanceRows'), appearanceDesc = $('appearanceDesc');
  var appearanceBack = $('appearanceBack'), appearanceTitle = $('appearanceTitle'), appearanceStatus = $('appearanceStatus');
  var phScene = $('phScene'), phPlate = $('phPlate'), phField = $('phField'), phList = $('phList'), phRows = $('phRows'), phAction = $('phAction'), phEmpty = $('phEmpty');
  var phPlates = [phPlate, $('phPlateAlt')], phFields = [phField, $('phFieldAlt')], photoPlateIndex = 0, photoPlateKey = null;
  var utPlates = [$('utLens'), $('utLensAlt')], utFields = [$('utField'), $('utFieldAlt')], utPlateIndex = 0, utPlateKey = null;
  var photoMode = null, photoTransitionToken = 0;
  var sheetEl = $('sheet'), sheetView = $('sheetView');
  var IMG = { photo: $('photo'), mat: $('matImg'), bg: $('sheetBg'), field: $('phFieldImg'), fieldAlt: $('phFieldImgAlt'), utility: $('utFieldImg'), utilityAlt: $('utFieldImgAlt') };
  var sheetKey = '', slotEls = {}, dockEdgeFrame = 0, dockEdgeUntil = 0, dockAnchorCenter = 960;
  var appliedPalette = null, appliedPhoto = null, appliedFont = null, appliedFontMetrics = null;
  var searchViewEl = $('searchView'), searchContentEl = $('searchContent');
  var searchGlassEl = $('searchGlassBg');
  var searchFieldEl = $('searchField'), searchFieldTextEl = $('searchFieldText');
  var searchKeysEl = $('searchKeys'), searchTabsEl = $('searchTabs'), searchScopesEl = $('searchScopes');
  var searchSuggestEl = $('searchSuggest');
  var searchHeadEl = document.querySelector('.search-head'), searchSpinEl = $('searchSpin');
  var homeSearchPill = $('homeSearchPill');
  var appletvDockScroll = $('appletvDockScroll'), appletvScrollCue = $('appletvScrollCue'), appletvMainBlur = $('appletvMainBlur'), appletvFullscreenBlur = $('appletvFullscreenBlur');
  /* The tile that carries focus or the pick-up right now. Both are single-tile
     facts, so a move updates two elements instead of walking every tile in the
     drawer; see renderDock. */
  var dockFocusTile = null, dockHeldTile = null;
  /* False until the launcher has painted once. The first frame draws only the
     focused row's marks - see renderDock - because every mark it includes is an
     image the set has to decode before it can show the dock at all. */
  var firstPaintDone = false;
  function markDockTile(el, cls, on) {
    if (!el) return;
    if (on) el.classList.add(cls);
    else el.classList.remove(cls);
  }
  function setDockFocusTile(tile) {
    if (dockFocusTile === tile) return;
    markDockTile(dockFocusTile, 'is-focus', false);
    dockFocusTile = tile;
    markDockTile(tile, 'is-focus', true);
  }
  function setDockHeldTile(tile) {
    if (dockHeldTile === tile) return;
    markDockTile(dockHeldTile, 'is-held', false);
    dockHeldTile = tile;
    markDockTile(tile, 'is-held', true);
  }
  var searchState = { query: '', results: null, loading: false, debounceTimer: 0,
    token: 0, open: false, cards: [], scopes: [], sugs: [], rows: [], keysBuilt: '' };
  /* ---------- Top bar: one capsule holding the time and Search pills ---------- */
  var topPill = $('topPill'), homeTopRight = $('homeTopRight');
  var statusPill = $('statusPill'), statusPillClock = $('statusPillClock');
  var pillToolCtrl = $('pillToolCtrl'), pillToolHome = $('pillToolHome');
  var ctrlDay = $('ctrlDay'), ctrlDate = $('ctrlDate'), ctrlStatusClock = $('ctrlStatusClock');
  var statusPillGlass = $('statusPillGlass'), statusPillGlassNext = $('statusPillGlassNext');
  /* Which of the capsule's two glass layers is showing the current slice: a
     change cross-fades to the other one, exactly like the stage's two images. */
  var pillGlassLive = statusPillGlass;
  var controlPanelEl = $('controlPanel'), controlGrid = $('ctrlGrid');
  var controlOpen = false, controlGlassKey = '', pillGlassTimer = 0, ctrlEnterTimer = 0;
  /* The app-opening field (see showLaunch). */
  var launchEl = $('launchScreen'), launchCardEl = $('launchCard');
  /* A folder's own pane (see openFolder). */
  var folderEl = $('folderOverlay'), folderPanelEl = $('folderPanel'), folderGridEl = $('folderGrid'), folderTitleEl = $('folderTitle');
  /* The small menu a held tile opens (see openDockMenu). */
  var menuEl = $('ctxMenu'), menuListEl = $('ctxList');

  /* The hold menu is glass like the tiles: one slice of the pre-blurred
     wallpaper under its own rounded box, tinted so the words read. No live
     blur, so nothing is added to the animation path. */
  function paintCtxGlass() {
    if (!menuEl || !window.CleanFrameGlass) return;
    var g = menuEl.querySelector('.ctx-glass');
    if (!g) {
      g = document.createElement('div');
      g.className = 'ctx-glass';
      menuEl.insertBefore(g, menuEl.firstChild);
    }
    g.style.backgroundImage = 'url("' + window.CleanFrameGlass.src + '")';
    g.style.backgroundPosition = window.CleanFrameGlass.lens(
      menuEl.offsetLeft, menuEl.offsetTop, menuEl.offsetWidth, menuEl.offsetHeight);
  }
  /* The capsule frosts one poster at a time: the title the stage has adopted. */
  var pillFrostUrl = '';
  /* The control panel replaced the three-row time dropdown. Its order is the
     panel's reading order: one tall TV tile, the two capsule tiles, the weather
     capsule, then the round icon buttons. Wi-Fi, Bluetooth and TV open the TV's
     own settings because an installed app cannot switch the radios. */
  var CONTROLS = [
    { key: 'off', shape: 'hero', label: 'Power Off', sub: '', ico: 'power', act: 'off' },
    { key: 'wifi', shape: 'pill', label: 'Wi-Fi', sub: 'Network settings', ico: 'wifi', act: 'wifi' },
    { key: 'bluetooth', shape: 'pill', label: 'Bluetooth', sub: 'Sound settings', ico: 'bluetooth', act: 'bluetooth' },
    { key: 'sources', shape: 'pill', label: 'Sources', sub: 'HDMI, USB-C', ico: 'settings', act: 'sources' },
    { key: 'picture', shape: 'pill', label: 'Picture', sub: 'TV controls', ico: 'settings', act: 'picture' },
    { key: 'weather', shape: 'wide', label: 'Weather', sub: 'Tap to update', ico: 'weather', act: 'weather' },
    { key: 'art', shape: 'round', label: 'Art Mode', sub: '', ico: 'art', act: 'art' },
    { key: 'home', shape: 'round', label: 'Smart Home', sub: '', ico: 'home', act: 'home' },
    { key: 'settings', shape: 'round', label: 'Settings', sub: '', ico: 'settings', act: 'settings' },
    { key: 'search', shape: 'round', label: 'Search', sub: '', ico: 'search', act: 'search' }
  ];
  /* A set without Art Mode has no art key at all: the round button never
     exists, so there is nothing to focus and nothing to disable. */
  if (!PROFILE.art) CONTROLS = CONTROLS.filter(function (c) { return c.key !== 'art'; });
  var radioState = { network: '', ssid: '', bluetooth: null };

  /* ---------- Dynamic backdrops ---------- */
  var backdropImgs = [$('bdA'), $('bdB')];
  var backdropTitleEl = $('bdTitle'), backdropTitleName = $('bdTitleName'), backdropTitleYear = $('bdTitleYear');
  var backdropUrl = '', backdropApp = '', backdropZ = 0;
  var backdropLoading = {}, backdropWaiters = {}, backdropFailedAt = {};
  /* The panel's field is a pre-rendered slice of the wallpaper, which cannot
     describe a poster that arrived at runtime. Each backdrop is rasterised once,
     when its image finishes decoding, into a small blurred and darkened tile that
     takes the same slot. Nothing blurs per frame and no CSS filter is involved. */
  var backdropImages = {}, backdropBlurs = {}, backdropCORS = true;
  /* The drawer's frozen state needs the same treatment at stage scale: a wider
     soft copy of the current poster, built alongside the panel tile on load. */
  var backdropBlursFull = {}, backdropBlurEl = $('bdBlur');
  /* A lighter frost built for the Control Center tiles (see buildBackdropBlur). */
  var backdropBlursPanel = {};

  function backdropActive() { return !!backdropUrl; }
  /* Only the Dock's first row carries a title backdrop; every other app and row
     keeps the ground. The chosen app stays behind the top bar and panels. Any
     ground carries it: on Dark and Light the poster simply replaces the flat
     colour. */
  function backdropWanted(t) {
    var row, id;
    if (t.id !== 'home') return backdropApp;
    if (S.c.layout !== 'dock' || (S.appleTvRow || 0) !== 0) return '';
    if (['apps', 'search', 'status', 'statusmenu'].indexOf(t.f.zone) < 0) return '';
    if (!window.CleanFrameBackdrops) return '';
    row = getAppleTVAppRows()[0] || [];
    id = row[clamp(S.appleTvCol || 0, 0, row.length - 1)];
    id = id && id.id;
    return id && CleanFrameBackdrops.supports(id) ? id : '';
  }
  /* Images are decoded once per session; a focus change never waits on the
     network for an image that is already in memory. The request is made in CORS
     mode so the panel can read the pixels; if a host ever refuses that, a second
     request keeps the poster and only the panel's blur is lost. */
  var backdropPanelImages = {};
  /* Every title browsed used to pin its 1920x1080 bitmap and two base64 frosts
     for the rest of the session, and the rotation brings a new title in for a
     tile left alone. On the set that ends in an out-of-memory kill while the
     app sits behind another one, which is why CleanFrame came back cold every
     time. The last six posters cover the row; anything older is dropped. */
  var BACKDROP_KEEP = 20, backdropOrder = [];
  function rememberBackdrop(url) {
    var i = backdropOrder.indexOf(url), drop = '', j, cand;
    if (i >= 0) backdropOrder.splice(i, 1);
    backdropOrder.push(url);
    while (backdropOrder.length > BACKDROP_KEEP) {
      /* The sharp frames are four times the bitmap of a small one, so they are
         the first to go: a tile whose sharp copy was dropped still holds its
         small copy for the next visit, which is what keeps the row instant.
         Nothing on screen and nothing the drawer is frosting is ever dropped. */
      drop = '';
      for (j = 0; j < backdropOrder.length; j++) {
        cand = backdropOrder[j];
        if (cand === backdropUrl || cand === pillFrostUrl) continue;
        if (drop === '' && cand.indexOf('/s1440/') >= 0) { drop = cand; break; }
        if (drop === '') drop = cand;
      }
      if (!drop) return;
      backdropOrder.splice(backdropOrder.indexOf(drop), 1);
      delete backdropImages[drop];
      releaseFrostUrl(drop, backdropBlursFull[drop]);
      releaseFrostUrl('panel:' + drop, backdropBlursPanel[drop]);
      delete backdropBlursFull[drop];
      delete backdropBlursPanel[drop];
      delete backdropPanelImages[drop];
      delete backdropLoading[drop];
    }
  }
  function finishBackdropLoad(url, im) {
    backdropImages[url] = im;
    rememberBackdrop(url);
    backdropLoading[url] = 'ok';
    flushBackdrop(url, true);
    if (url === backdropUrl) {
      /* Only the poster that is actually on the stage gets a frost tile, and
         only after this frame: the poster itself is what the viewer is waiting
         for. A prefetched poster collects its tile when (and if) it takes
         focus. */
      refreshHomeGlass();
      syncSearchGlass();
      setPillFrost(url);
      ensureFrost(url);
    }
  }
  function markBackdropBad(url) {
    backdropLoading[url] = 'bad';
    backdropFailedAt[url] = Date.now();
    flushBackdrop(url, false);
  }
  function loadBackdrop(url, cb) {
    var state = backdropLoading[url], im;
    if (state === 'ok') { cb(true); return; }
    /* A failed fetch used to be final for the session. On the set a fast row
       aborts requests, so a poster marked bad stayed bad and that tile showed
       the previous app's artwork for the rest of the evening - a desync that
       never cleared. A failure is now only trusted for fifteen seconds. */
    if (state === 'bad') {
      if (Date.now() - (backdropFailedAt[url] || 0) < 15000) { cb(false); return; }
      delete backdropLoading[url];
    }
    /* One list per address, emptied before its callbacks run. The old single
       array lost any request made from inside a flush when that request landed
       on the tail: the loop had already passed the end, the rebuilt array
       dropped it, and the image - which had in fact loaded - never called it
       back. That is what left the warm queue frozen at two requests for the
       rest of the session. */
    if (state === 'loading') { (backdropWaiters[url] || (backdropWaiters[url] = [])).push(cb); return; }
    backdropLoading[url] = 'loading';
    /* The caller that starts the fetch is a waiter like any other. It used to
       be the one caller whose callback was never kept: the image loaded, the
       other waiters were told, and the poster that had actually asked for it
       heard nothing until the next render happened to look again. That was the
       second or two a cold tile spent on the previous app's artwork - and the
       reason the warm queue could stop dead at two requests. */
    (backdropWaiters[url] || (backdropWaiters[url] = [])).push(cb);
    im = new Image();
    if (backdropCORS) im.crossOrigin = 'anonymous';
    im.onload = function () { finishBackdropLoad(url, im); };
    im.onerror = function () {
      if (backdropCORS && im.crossOrigin) {
        backdropCORS = false;
        var retry = new Image();
        retry.onload = function () { finishBackdropLoad(url, retry); };
        retry.onerror = function () { markBackdropBad(url); };
        retry.src = url;
        return;
      }
      markBackdropBad(url);
    };
    im.src = url;
    /* A request the engine never answers must not strand its caller either:
       after twelve seconds it counts as a failure and everyone is told. */
    setTimeout(function () {
      if (backdropLoading[url] !== 'loading') return;
      markBackdropBad(url);
    }, 12000);
  }
  /* One cheap pass on a small canvas: every pane here is blurred, so a
     reduced-size tile is indistinguishable from a full-size field. The drawer's
     frozen copy is built from the same image. Each of these runs once, on the
     image's load callback, never on the navigation path. */
  /* Draw the source the way the stage shows it: a poster is cropped to the
     16:9 frame with object-fit: cover, so the frost must be cropped the same
     way or the glass and the backdrop behind it would not line up. */
  /* Draw the crop onto the tile. A blur pulls pixels in from outside the tile,
     and with nothing out there the pane would fade out along its own rim. So the
     crop is blurred on a canvas padded with mirrored strips of the frame's own
     edge and only its centre is copied out: the frost is real artwork right up to
     the tile's edge, while the tile still holds the exact stage crop, so the glass
     keeps lining up with the artwork behind it. */
  function paintCrop(ctx, im, sx, sy, cw, ch, w, h, blurPx, gain) {
    var pad, px, py, big, bctx, lit;
    lit = !!gain && gain !== 1 && typeof ctx.filter === 'string';
    if (!blurPx || typeof ctx.filter !== 'string') {
      if (lit) ctx.filter = 'brightness(' + gain + ')';
      ctx.drawImage(im, sx, sy, cw, ch, 0, 0, w, h);
      if (typeof ctx.filter === 'string') ctx.filter = 'none';
      return;
    }
    pad = Math.ceil(blurPx * 3);
    px = pad * cw / w;
    py = pad * ch / h;
    big = document.createElement('canvas');
    big.width = w + pad * 2;
    big.height = h + pad * 2;
    bctx = big.getContext('2d');
    bctx.filter = 'blur(' + blurPx + 'px)';
    bctx.drawImage(im, sx, sy, cw, ch, pad, pad, w, h);
    /* Each strip mirrors the frame's own edge about that edge, so the seam stays
       continuous and takes the same blur as the pane itself. */
    bctx.save(); bctx.translate(pad, 0); bctx.scale(-1, 1);
    bctx.drawImage(im, sx, sy, px, ch, 0, pad, pad, h); bctx.restore();
    bctx.save(); bctx.translate(2 * (pad + w), 0); bctx.scale(-1, 1);
    bctx.drawImage(im, sx + cw - px, sy, px, ch, w, pad, pad, h); bctx.restore();
    bctx.save(); bctx.translate(0, pad); bctx.scale(1, -1);
    bctx.drawImage(im, sx, sy, cw, py, pad, 0, w, pad); bctx.restore();
    bctx.save(); bctx.translate(0, 2 * (pad + h)); bctx.scale(1, -1);
    bctx.drawImage(im, sx, sy + ch - py, cw, py, pad, h, w, pad); bctx.restore();
    /* And the four corners, mirrored about their own corner both ways: a striped
       edge alone would leave them empty, and the Control Center sits close
       enough to the stage's top-right corner to sample there. */
    bctx.save(); bctx.translate(pad, pad); bctx.scale(-1, -1);
    bctx.drawImage(im, sx, sy, px, py, 0, 0, pad, pad); bctx.restore();
    bctx.save(); bctx.translate(2 * (pad + w), pad); bctx.scale(-1, -1);
    bctx.drawImage(im, sx + cw - px, sy, px, py, w, 0, pad, pad); bctx.restore();
    bctx.save(); bctx.translate(pad, 2 * (pad + h)); bctx.scale(-1, -1);
    bctx.drawImage(im, sx, sy + ch - py, px, py, 0, h, pad, pad); bctx.restore();
    bctx.save(); bctx.translate(2 * (pad + w), 2 * (pad + h)); bctx.scale(-1, -1);
    bctx.drawImage(im, sx + cw - px, sy + ch - py, px, py, w, h, pad, pad); bctx.restore();
    bctx.filter = 'none';
    if (lit) ctx.filter = 'brightness(' + gain + ')';
    ctx.drawImage(big, pad, pad, w, h, 0, 0, w, h);
    if (lit) ctx.filter = 'none';
  }
  /* One tile canvas, reused. A fresh canvas per poster cost an allocation and a
     backing-store teardown on the same thread that is trying to show the next
     poster; on the set that churn was measurable over a row of prefetches. */
  var tileCanvas = null;
  function tileContext(im, w, blurPx, darken, gain, canvas) {
    var ctx, h = Math.max(1, Math.round(w * 9 / 16)), sw, sh, cw, ch, sx, sy, ratio, target;
    sw = im.naturalWidth; sh = im.naturalHeight; cw = sw; ch = sh; sx = 0; sy = 0;
    if (!sw || !sh) return null;
    target = w / h; ratio = sw / sh;
    if (ratio > target) { cw = sh * target; sx = (sw - cw) / 2; }
    else if (ratio < target) { ch = sw / target; sy = (sh - ch) / 2; }
    canvas = canvas || tileCanvas || (tileCanvas = document.createElement('canvas'));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; canvas.height = h;
    }
    ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.clearRect(0, 0, w, h);
    paintCrop(ctx, im, sx, sy, cw, ch, w, h, blurPx, gain);
    /* Match the tone the material fields ship with, so the glass reads the
       same whether the backdrop came from a poster or a wallpaper. */
    if (darken) {
      ctx.fillStyle = 'rgba(0, 0, 0, ' + darken + ')';
      ctx.fillRect(0, 0, w, h);
    }
    return ctx;
  }
  function softTile(im, w, blurPx, darken, gain) {
    var ctx = tileContext(im, w, blurPx, darken, gain), h;
    if (!ctx) return '';
    h = Math.max(1, Math.round(w * 9 / 16));
    try { return tileCanvas.toDataURL('image/jpeg', 0.72); } catch (e) { return ''; }
  }
  /* A data URL is encoded on the main thread inside toBlob's caller; an object
     URL is encoded on the browser's own image thread. The frost is only ever
     read by the compositor, so the encode no longer has to hold a frame. */
  function softTileUrl(im, w, blurPx, darken, gain, cb) {
    /* Its own canvas: toBlob encodes after this frame, and the shared one may
       already be holding the next poster by then. */
    var canvas = document.createElement('canvas');
    var ctx = tileContext(im, w, blurPx, darken, gain, canvas);
    if (!ctx || !canvas.toBlob || !window.URL || !URL.createObjectURL) { cb(softTile(im, w, blurPx, darken, gain)); return; }
    try {
      canvas.toBlob(function (blob) {
        var url = '';
        if (blob) { try { url = URL.createObjectURL(blob); } catch (e) { url = ''; } }
        cb(url);
      }, 'image/jpeg', 0.78);
    } catch (e) { cb(softTile(im, w, blurPx, darken, gain)); }
  }
  /* Blob URLs own memory until they are revoked, so every tile that is replaced
     or evicted gives its own back. */
  var frostObjectUrls = {};
  function releaseFrostUrl(key, value) {
    if (frostObjectUrls[key] && frostObjectUrls[key] === value) {
      try { URL.revokeObjectURL(value); } catch (e) {}
      delete frostObjectUrls[key];
    }
  }
  /* The frost is now built for one poster only: the one the stage is actually
     showing, and only once the row has stopped moving. A fast scroll used to
     pay for a canvas pass and a JPEG encode on every poster the prefetch queue
     pulled in - three of them at once, on the frames that can least afford it -
     for artwork the viewer had already scrolled past. Everything below reads the
     cached tile exactly as before; a tile that is not built yet is simply absent,
     which every reader already treats as "no frost". */
  var frostPending = {};
  function ensureFrost(url) {
    var im, pending;
    if (!url || frostPending[url]) return;
    if (backdropBlursFull[url] !== undefined) return;
    im = backdropImages[url];
    if (!im || !im.naturalWidth) return;
    frostPending[url] = true;
    idleTask(function () {
      frostPending[url] = false;
      if (backdropBlursFull[url] !== undefined) return;
      if (!backdropImages[url]) return;
      buildBackdropBlur(url, im);
      if (url === backdropUrl) applyFrost(url);
    });
  }
  function applyFrost(url) {
    if (!url || url !== backdropUrl) return;
    if (backdropBlurEl && backdropBlursFull[url] && backdropBlurEl.getAttribute('src') !== backdropBlursFull[url]) {
      backdropBlurEl.setAttribute('src', backdropBlursFull[url]);
    }
    refreshHomeGlass();
    syncSearchGlass();
    setPillFrost(url);
  }
  function buildBackdropBlur(url, im) {
    if (!im || !im.naturalWidth) return;
    if (backdropBlursFull[url] === undefined) {
      /* The stage-scale frost is a canvas blur plus a JPEG encode. Only the
         poster that is actually on screen builds it straight away; a prefetched
         neighbour's copy waits for the first idle slot, so scrolling the row
         never pays for six encoders in the middle of a move. `ensureFrost`
         still asks for it directly if a poster becomes current first. */
      var fullPass = function () {
        if (backdropBlursFull[url] !== undefined) return;
        softTileUrl(im, 480, 15, 0.12, 0, function (value) {
          backdropBlursFull[url] = value;
          if (value) frostObjectUrls[url] = value;
          if (url === backdropUrl) applyFrost(url);
        });
      };
      if (url === backdropUrl) fullPass();
    }
    /* The Control Center tiles want liquid glass: a real frost, enough that the
       pane reads as glass rather than a window onto a sharp picture, and no
       darkening of its own - the veil already carries the tile's tint. */
    /* The panes want a finer frost than the stage's blurred backdrop: a real
       blur, but enough shape to read as glass rather than a flat wash. 720 px
       across, blurred 4.5 px, is the same picture on screen as the 1280/8 it
       replaces (both land near 15 px of blur at a 2400 px slice) on a quarter
       of the pixels, and this pass runs for every poster the row prefetches. */
    if (backdropBlursPanel[url] === undefined && url === backdropUrl) {
      /* The stage's own frost is what the poster waits for. The finer pane
         tile is only read when a sheet or the Control Center opens, so it is
         painted after the frame that shows the poster, not in front of it:
         two canvas passes inside one load callback were the difference between
         a poster that appears with the focus and one that lands after it. */
      idleTask(function () {
        if (backdropBlursPanel[url] !== undefined || !backdropImages[url]) return;
        softTileUrl(im, 720, 4.5, 0, GLASS_LIFT, function (value) {
          backdropBlursPanel[url] = value;
          if (value) frostObjectUrls['panel:' + url] = value;
          if (value && backdropPanelImages[url] === undefined) {
            var pane = new Image();
            pane.onload = function () { backdropPanelImages[url] = pane; };
            pane.onerror = function () { backdropBlursPanel[url] = ''; };
            pane.src = value;
          }
          refreshHomeGlass();
          syncSearchGlass();
          if (url === backdropUrl) setPillFrost(url);
        });
      });
    }
  }
  /* Work that must never sit in the same frame as a focus change. */
  function idleTask(fn) {
    var ric = window.requestIdleCallback;
    if (typeof ric === 'function') { ric(fn, { timeout: 900 }); return; }
    setTimeout(fn, 120);
  }
  /* Search sits over the live backdrop, so it frosts over the same poster the
     drawer freezes: the stage-scale blur tile when a poster is up, the
     wallpaper's prepared field when the ground is a photo, nothing when the
     ground is flat. Same rule as the Control Center panel. */
  function syncSearchGlass() {
    var src = '', look;
    if (!searchGlassEl) return;
    if (backdropUrl && backdropBlursFull[backdropUrl]) src = backdropBlursFull[backdropUrl];
    else {
      look = S.shown || S.c;
      if (look.bg === 'photo') src = fieldSrc(look.wall, look.material);
    }
    if (src) {
      searchGlassEl.hidden = false;
      if (searchGlassEl.getAttribute('src') !== src) searchGlassEl.setAttribute('src', src);
    } else {
      searchGlassEl.hidden = true;
    }
  }
  /* The Home sheet frosts each tile from the same poster or wallpaper field the
     Control Center uses. A new poster invalidates every slice, so the next
     render re-samples them against the artwork that is actually behind. */
  function refreshHomeGlass() {
    homeGlassKey = '';
    if (homeOpen) syncHomeGlass(true, true);
  }
  function flushBackdrop(url, ok) {
    var list = backdropWaiters[url], i;
    delete backdropWaiters[url];
    if (!list) return;
    for (i = 0; i < list.length; i++) {
      try { list[i](ok); } catch (e) {}
    }
  }
  /* Resolve the row once the catalogue is in: give each app on screen its own
     title, then fetch every one of those images ahead of the move that needs
     them. Without both, a focus change waits on a cold download and the change
     looks late, random, or absent because two neighbouring apps resolved to the
     same image and nothing had to fade. */
  function backdropRowIds() {
    var row = getAppleTVAppRows()[0] || [], ids = [], i, id;
    for (i = 0; i < row.length; i++) {
      id = row[i] && row[i].id;
      if (id) ids.push(id);
    }
    return ids;
  }
  /* The focused app and two either side of it. Warming the whole row on every
     move queued a stream of full-screen decodes over and over; on the set those
     decodes are the frames the viewer is trying to move through, which is what
     made the top row feel heavy. Two neighbours give two presses of lead, and
     they are warmed at the small size - the sharp copy is only ever fetched for
     the tile the viewer actually stops on. */
  function backdropNeighbourIds() {
    var rows = getAppleTVAppRows(), row = rows[S.appleTvRow || 0] || rows[0] || [], col = S.appleTvCol || 0, out = [], i, id;
    for (i = col - 2; i <= col + 2; i++) {
      id = i >= 0 && i < row.length && row[i] && row[i].id;
      if (id) out.push(id);
    }
    return out;
  }
  /* Every app in the drawer, not just the first row: an app on row 2 that was
     never assigned fell back to its own rotation cursor and could land on the
     same poster as an app on row 0, which reads as the wrong title for the tile
     in focus. Assignment is one pass over the drawer and only runs when the
     catalogue arrives or the order changes, never on a key press. */
  function backdropDrawerIds() {
    var rows = getAppleTVAppRows(), ids = [], i, j, id;
    for (i = 0; i < rows.length; i++) {
      for (j = 0; j < rows[i].length; j++) {
        id = rows[i][j] && rows[i][j].id;
        if (id) ids.push(id);
      }
    }
    return ids;
  }
  /* Posters are fetched ahead of the move that needs them, newest focus first.
     The queue and its counter are shared, so a move that re-arms the row cannot
     start a second stream of requests beside the first. Two at a time, not
     three: a poster is a 1440-wide frame, and three decodes landing together
     was enough to drop the frame the key press had just asked for. The queue
     carries the small copy - 41 KB, decoded in milliseconds - so a neighbour is
     ready by the time the focus reaches it. */
  var prefetchQueue = [], prefetchInFlight = 0, PREFETCH_MAX = 2, prefetchAt = 0;
  function pumpPrefetch() {
    var url;
    while (prefetchInFlight < PREFETCH_MAX && prefetchQueue.length) {
      url = prefetchQueue.shift();
      if (backdropLoading[url] === 'ok') continue;
      prefetchInFlight++;
      (function (pending) {
        try {
          loadBackdrop(pending, function () {
            prefetchInFlight--;
            /* One poster per breath: a queue that refills instantly keeps the
               decoder busy through the whole flick. */
            setTimeout(pumpPrefetch, 90);
          });
        } catch (e) {
          /* Never let one bad request retire the queue for the session. */
          prefetchInFlight--;
        }
      }(url));
    }
  }
  function prefetchBackdropRow(ids) {
    var i, id, item, url;
    if (!window.CleanFrameBackdrops || !ids) return;
    /* Newest focus first: a tile the viewer is about to reach jumps the queue
       the background warm pass is filling. */
    for (i = ids.length - 1; i >= 0; i--) {
      id = ids[i];
      if (!id || !CleanFrameBackdrops.supports(id)) continue;
      item = CleanFrameBackdrops.pick(id);
      url = item && posterFast(item);
      if (!url || backdropLoading[url] === 'ok' || prefetchQueue.indexOf(url) >= 0) continue;
      prefetchQueue.unshift(url);
    }
    pumpPrefetch();
  }
  /* The row cannot be instant on a cold visit any other way: on the set a
     poster request costs between half a second and two seconds, and that is the
     round trip rather than the bytes - a 41 KB copy is not much quicker than a
     279 KB one when the wait is the connection. So once the first screen is up,
     every app in the drawer queues its small copy in the background, lowest
     priority, and a focus move jumps that queue. Nothing is painted from this
     pass and no canvas work happens in it: it only decodes small frames while
     the viewer is looking at something else. */
  var warmTimer = 0, warmDone = {};
  function warmBackdropRow() {
    var ids, i, id, item, url;
    if (!window.CleanFrameBackdrops) return;
    if (motionFast) { clearTimeout(warmTimer); warmTimer = setTimeout(warmBackdropRow, 1200); return; }
    ids = backdropDrawerIds();
    for (i = 0; i < ids.length; i++) {
      id = ids[i];
      if (!id || warmDone[id] || !CleanFrameBackdrops.supports(id)) continue;
      item = CleanFrameBackdrops.pick(id);
      url = item && posterFast(item);
      warmDone[id] = 1;
      if (!url || backdropLoading[url] === 'ok' || prefetchQueue.indexOf(url) >= 0) continue;
      prefetchQueue.push(url);
    }
    pumpPrefetch();
  }
  function scheduleWarm(delay) {
    clearTimeout(warmTimer);
    warmDone = {};
    warmTimer = setTimeout(warmBackdropRow, delay || 2600);
  }
  function syncBackdropRow() {
    var ids, drawer;
    if (!window.CleanFrameBackdrops) return;
    ids = backdropRowIds();
    drawer = backdropDrawerIds();
    CleanFrameBackdrops.assign(drawer.length ? drawer : ids);
    prefetchBackdropRow(backdropNeighbourIds());
    /* The assignment can change the focused app's pick; syncBackdrop compares
       the pick with the poster that is up and repaints only if it differs. */
    if (top() && top().id === 'home') render();
    scheduleWarm(900);
  }
  /* The top-left title card belongs to the backdrop, not to the dock: it appears
     with the poster and leaves with it. */
  function renderBackdropTitle(pick) {
    var name = pick && pick.title ? String(pick.title) : '', year = pick && pick.year ? Number(pick.year) : 0;
    if (!backdropTitleEl) return;
    if (!name) {
      backdropTitleEl.className = 'bd-title';
      backdropTitleName.innerHTML = '';
      backdropTitleYear.innerHTML = '';
      return;
    }
    backdropTitleName.innerHTML = esc(name);
    backdropTitleYear.innerHTML = year ? esc(String(year)) : '';
    backdropTitleYear.className = 'bd-title-year' + (year ? '' : ' is-blank');
    backdropTitleEl.className = 'bd-title is-on';
  }
  /* ---------- Poster sync ----------
     One rule, enforced in one place: the stage shows the poster of BK.pick, and
     the credit on screen belongs to the poster on screen.

       focus moves  -> BK.app updates immediately
                    -> if that title's bitmap is decoded, one class flip
                    -> if only its small copy is decoded, that paints instead,
                       and the full frame replaces it as soon as it lands
                    -> if neither is decoded, request the small copy, then the
                       full one: nothing is painted until a bitmap exists, so
                       the previous scene stays whole instead of flashing the
                       ground
                    -> a decode that lands after the focus moved on is ignored

     The small copy is the whole reason a cold tile no longer sits on the
     previous app's artwork for a second or two. A 1440-wide frame is 279 KB;
     the same picture at 640 is 41 KB, which arrives in a fraction of the time
     on the set's network and decodes in a few milliseconds. The viewer sees the
     right title at once, and the sharp frame cross-fades in underneath while
     they read it - the same artwork, so the swap is invisible.

     While the remote is repeating (mv-fast) nothing is painted at all: the swap
     waits for the row to come to rest. This replaces the graph of tokens,
     waiters, retries and a second rotation state machine that could each move a
     layer without the painter agreeing - the source of the desyncs on the set. */
  var POSTER_FADE_MS = 320;

  /* Marks for a row that is not on screen yet are made after the drawer has
     stopped, and the render that follows puts the focus back on the rebuilt
     tiles. A held scroll keeps postponing it, so a flick never pays for it. */
  var dockArtTimer = 0, dockArtDue = false;
  function scheduleDockArtFill() {
    if (dockArtTimer) return;
    dockArtTimer = setTimeout(function () {
      dockArtTimer = 0;
      if (motionFast || !top() || top().id !== 'home' || S.c.layout !== 'dock') return;
      dockArtDue = true;
      render();
      dockArtDue = false;
    }, 300);
  }
  var BK = { app: '', pick: null, url: '', fast: false, layer: null, pending: '', queued: null, retry: 0 };

  function posterPick(appId) {
    var pick = window.CleanFrameBackdrops && CleanFrameBackdrops.pick(appId);
    return pick && pick.url ? pick : null;
  }
  /* One copy is painted, and it is the sharp one. The small copy used to be
     painted first and the sharp frame cross-faded over it, and because both go
     through `object-fit: cover` in a fixed 16:9 box the artwork was composited
     twice at two different source sizes - on a cold start that reads as the
     backdrop scaling as you move along the row. Bundled files never had a
     second copy, which is why the jump showed up on the first streaming app.
     The neighbour prefetch still warms each sharp frame, so it is in memory
     before the move that needs it. */
  function posterFast(pick) {
    return (pick && pick.url) || '';
  }

  function paintPoster(pick, appId, asyncPaint, useFast) {
    var next, old, src = useFast ? posterFast(pick) : pick.url;
    if (!backdropImgs[0] || !pick || !src) return false;
    BK.app = appId || BK.app;
    backdropApp = BK.app;
    if (BK.layer && BK.pick && BK.pick.url === pick.url && BK.url === src) {
      renderBackdropTitle(pick);
      return true;
    }
    next = BK.layer === backdropImgs[0] ? backdropImgs[1] : backdropImgs[0];
    if (!next) return false;
    old = BK.layer;
    /* Reset the reused layer before giving it the new source: nothing from its
       previous role - a half-finished fade, a parked offset - carries over. */
    next.style.transition = 'none';
    next.className = 'bd-img';
    next.style.zIndex = String(++backdropZ);
    next.src = src;
    next.offsetWidth; /* commit the source at zero opacity */
    next.style.transition = '';
    BK.layer = next;
    BK.pick = pick;
    BK.url = src; backdropUrl = src;
    BK.fast = src !== pick.url;
    next.className = 'bd-img is-on';
    renderBackdropTitle(pick);
    if (old && old !== next) {
      /* Only this paint's old layer is stripped, and only after the fade. A
         later paint owns the stage and strips its own. */
      (function (layer) {
        setTimeout(function () {
          if (BK.layer === layer) return;
          layer.className = 'bd-img';
        }, POSTER_FADE_MS + 40);
      }(old));
    }
    stage.classList.add('has-backdrop');
    refreshHomeGlass();
    syncSearchGlass();
    setPillFrost(src);
    /* The drawer's soft copy is this poster's tile, applied the moment it lands
       so the drawer never opens onto a sharp poster. */
    if (backdropBlurEl && backdropBlursFull[src] && backdropBlurEl.getAttribute('src') !== backdropBlursFull[src]) backdropBlurEl.setAttribute('src', backdropBlursFull[src]);
    ensureFrost(src);
    /* A poster that landed from a download needs one pass to repaint the glass
       and ink that read it. A poster painted inside render() is already in that
       pass, so it never asks for a second one. */
    if (asyncPaint) window.requestAnimationFrame(function () {
      if (!top() || top().id !== 'home') return;
      /* Mid-flick the whole screen is not repainted for one poster: the dock is
         the only thing that can have changed, and it is the only thing asked. */
      if (motionFast) { if (appletvDockScroll) renderDock(homeState(top())); return; }
      render();
    });
    return true;
  }

  /* The small copy is showing. Ask for the full frame once, and paint it only
     if the same title is still the one in focus: a sharper copy of another
     app's artwork is still the wrong poster. */
  function upgradePoster(appId, pick, asyncPaint) {
    if (!pick) return;
    if (BK.url === pick.url) { BK.fast = false; return; }
    if (backdropImages[pick.url]) { paintPoster(pick, appId, asyncPaint, false); return; }
    if (BK.pending === pick.url) return;
    BK.pending = pick.url;
    loadBackdrop(pick.url, function (ok) {
      if (BK.pending === pick.url) BK.pending = '';
      if (!ok || BK.app !== appId) return;
      if (!BK.pick || BK.pick.url !== pick.url || BK.url === pick.url) return;
      /* A flick in progress defers it: the settle pass re-reads the stage. */
      if (motionFast) return;
      paintPoster(pick, appId, true, false);
    });
  }

  function requestPoster(appId, pick) {
    var fast = posterFast(pick), url = pick.url, now, queued;
    if (BK.pending === fast) return;
    /* A queued warm request is this request now: hand it over rather than
       fetching the same file twice. */
    queued = prefetchQueue.indexOf(fast);
    if (queued >= 0) prefetchQueue.splice(queued, 1);
    BK.pending = fast;
    loadBackdrop(fast, function (ok) {
      if (BK.pending === fast) BK.pending = '';
      if (!ok) {
        if (BK.app !== appId) return;
        /* A refused fast copy must never cost the poster: ask for the sharp
           address at once. This is the failure mode where an artwork profile
           the host does not serve empties the whole stage - the drawer then has
           no backdrop at all, because the small copy is the one it waits on. */
        if (fast !== url && !backdropImages[url]) {
          BK.pending = url;
          loadBackdrop(url, function (okSharp) {
            if (BK.pending === url) BK.pending = '';
            if (!okSharp || BK.app !== appId || motionFast) return;
            now = posterPick(appId);
            if (!now || now.url !== url) return;
            paintPoster(now, appId, true, false);
          });
          return;
        }
        /* One retry, well after the press: a failure on the set is usually a
           request the engine aborted mid-flick. It only runs while this app is
           still the one in focus. */
        clearTimeout(BK.retry);
        BK.retry = setTimeout(function () {
          if (BK.app !== appId || backdropImages[fast]) return;
          delete backdropLoading[fast];
          requestPoster(appId, pick);
        }, 1400);
        return;
      }
      /* The focus may have moved while this was decoding, or the row's
         assignment may have changed: neither may paint another app's poster. */
      if (BK.app !== appId) return;
      now = posterPick(appId);
      if (!now || now.url !== url) return;
      /* A flick no longer waits for the row to stop. By the time this copy has
         landed it is already decoded, so painting it mid-scroll is a source swap
         on a layer that is about to cross-fade, not a decode - which is what
         lets the artwork change with the row instead of snapping in at the end.
         Only a frame still in flight is queued for the settle. */
      if (motionFast) { BK.queued = { app: appId, pick: now }; return; }
      paintPoster(now, appId, true, fast !== now.url);
      if (fast !== now.url) upgradePoster(appId, now, true);
    });
  }

  function syncBackdrop(appId) {
    var pick, fast;
    /* Rows below the first keep the scene: the drawer freezes whatever was on
       screen and Back restores it exactly. Panels over the dock do the same. */
    if (!appId) return;
    if (S.c.layout !== 'dock' || (S.appleTvRow || 0) !== 0) return;
    BK.app = appId;
    backdropApp = appId;
    pick = posterPick(appId);
    if (!pick) {
      /* An app with no artwork gets no credit, and the scene it leaves stays
         until another poster replaces it: the ground never shows between two. */
      if (backdropTitleEl) backdropTitleEl.className = 'bd-title';
      return;
    }
    if (BK.layer && BK.pick && BK.pick.url === pick.url) {
      /* Already this title. Only the sharper copy can still be outstanding. */
      renderBackdropTitle(pick);
      if (BK.fast) upgradePoster(appId, pick, false);
      return;
    }
    if (backdropImages[pick.url]) { paintPoster(pick, appId, false, false); return; }
    fast = posterFast(pick);
    if (fast !== pick.url && backdropImages[fast]) {
      /* The small copy is already here: paint it in this frame, sharpen after. */
      paintPoster(pick, appId, false, true);
      upgradePoster(appId, pick, false);
      return;
    }
    requestPoster(appId, pick);
    if (Date.now() - prefetchAt > 500) {
      prefetchAt = Date.now();
      prefetchBackdropRow([appId].concat(backdropNeighbourIds()));
    }
  }

  /* The row came to rest: paint the poster that arrived during the flick, or
     ask for the one the resting tile owns. */
  function flushPoster() {
    var queued = BK.queued, pick;
    BK.queued = null;
    if (!BK.app) return;
    if (queued && queued.app === BK.app) {
      pick = posterPick(queued.app);
      if (pick && pick.url === queued.pick.url) {
        if (backdropImages[pick.url]) { paintPoster(pick, queued.app, false, false); return; }
        if (posterFast(pick) !== pick.url && backdropImages[posterFast(pick)]) {
          paintPoster(pick, queued.app, false, true);
          upgradePoster(queued.app, pick, false);
          return;
        }
      }
    }
    syncBackdrop(BK.app);
  }

  /* ---------- Dwell rotation ---------- */
  /* A top row left alone should not hold one poster: ten seconds on the same
     tile slides in another of that app's own titles, and keeps walking the app's
     list for as long as the viewer stays. The timer follows the focus rather
     than the clock - moving along the row, opening the capsule's panels,
     scrolling below the first row or hiding the window disarms it, so nothing
     ever rotates out from under something the viewer is doing. */
  var DWELL_MS = 10000, dwellTimer = 0, dwellApp = '';
  function dwellWanted(appId) {
    var t = top();
    if (!appId || document.hidden || !window.CleanFrameBackdrops) return false;
    /* Only the tile grid counts as "on an app": the capsule and its panels sit
       over the dock and own the screen until they close. */
    if (!t || t.id !== 'home' || S.c.layout !== 'dock' || !t.f || t.f.zone !== 'apps') return false;
    if ((S.appleTvRow || 0) !== 0) return false;
    return CleanFrameBackdrops.supports(appId);
  }
  function dwellRowIds() {
    var row = getAppleTVAppRows()[0] || [], ids = [], i, id;
    for (i = 0; i < row.length; i++) { id = row[i] && row[i].id; if (id) ids.push(id); }
    return ids;
  }
  function pauseDwell() {
    clearTimeout(dwellTimer);
    dwellTimer = 0;
    dwellApp = '';
  }
  /* Arm when focus lands on an app, and again after a panel, a hidden window or
     a move away and back. Re-rendering the same app leaves the timer alone, so
     a clock tick or a Home Assistant poll never postpones the rotation. */
  function syncDwell() {
    var next;
    /* Never rotate a poster in the middle of a flick: that is another decode and
       another swap landing on the frames that can least afford one. It re-arms on
       the render that follows the row coming to rest. */
    if (motionFast) { pauseDwell(); return; }
    if (!dwellWanted(backdropApp)) { pauseDwell(); return; }
    if (dwellApp === backdropApp && dwellTimer) return;
    pauseDwell();
    dwellApp = backdropApp;
    /* Start the next title downloading now, so the slide lands on the tick
       rather than whenever a cold fetch happens to finish. */
    next = CleanFrameBackdrops.peek(dwellApp, dwellRowIds());
    if (next && next.url) loadBackdrop(next.url, function () {});
    dwellTimer = setTimeout(rotateBackdrop, DWELL_MS);
  }
  function rotateBackdrop() {
    var forApp = BK.app, pick;
    dwellTimer = 0;
    if (!dwellWanted(forApp) || forApp !== BK.app) { syncDwell(); return; }
    pick = CleanFrameBackdrops.rotate(forApp, dwellRowIds());
    if (!pick || !pick.url) { syncDwell(); return; }
    if (BK.pick && BK.pick.url === pick.url) { syncDwell(); return; }
    /* The rotation is a dwell, not a move: the full frame is already being
       fetched by the peek above, and the small one covers a cold start. */
    loadBackdrop(posterFast(pick), function (ok) {
      if (!ok) { syncDwell(); return; }
      if (forApp !== BK.app || !dwellWanted(forApp)) { syncDwell(); return; }
      if (motionFast) { BK.queued = { app: forApp, pick: pick }; return; }
      /* The rotation uses the same painter as a focus move: one place decides
         what is on the stage and what the credit says. */
      paintPoster(pick, forApp, true, posterFast(pick) !== pick.url);
      if (posterFast(pick) !== pick.url) upgradePoster(forApp, pick, true);
      syncDwell();
    });
  }

  /* ---------- Home Assistant Control Center Controller ---------- */
  var haPanelEl = $('haPanel'), haEnterTimer = 0;
  var haDeviceScrollEl = $('haDeviceScroll');
  var homeOpen = false, homeGlassKey = '';

  /* The control panel shows the clock and date in its header; the weather is
     one of its tiles. Both follow the same minute/status refresh as the pill. */
  var DAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var MONTH_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function dayText() {
    return DAY_LONG[new Date().getDay()];
  }
  function dateText() {
    var d = new Date();
    return d.getDate() + ' ' + MONTH_LONG[d.getMonth()];
  }
  function statusWeather() {
    var status = window.CleanFrameStatus ? CleanFrameStatus.get() : null;
    if (!status || !status.weather || typeof status.weather.temp !== 'number') return { temp: '', label: '' };
    return {
      temp: Math.round(status.weather.temp) + '°',
      label: window.CleanFrameStatus.label ? CleanFrameStatus.label(status.weather.code) : ''
    };
  }
  var statusPillKey = '';
  function updateStatusPill() {
    var day = dayText(), date = dateText(), clock = clockText(), weather = statusWeather();
    var key = day + '|' + date + '|' + clock + '|' + weather.temp + '|' + weather.label;
    if (key === statusPillKey) return;
    statusPillKey = key;
    if (ctrlDay) ctrlDay.textContent = day;
    if (ctrlDate) ctrlDate.textContent = date;
    if (statusPillClock) statusPillClock.textContent = clock;
    if (ctrlStatusClock) ctrlStatusClock.textContent = clock;
    updateControlStatus();
    schedulePillGlass();
  }

  if (window.CleanFrameHA) {
    CleanFrameHA.subscribe(function () {
      updateStatusPill();
      if (controlGrid) updateControlStatus();
      if (top().id === 'ha_panel') renderHAPanel();
    });
  }

  /* The Home sheet reads the room devices on every poll, so it asks the client
     for the faster cadence while it is open. The Control Centre reads the TV's
     radios from Tizen and the weather from the local service, so it does not. */
  function syncHAPolling() {
    if (!window.CleanFrameHA || !CleanFrameHA.setPanelActive) return;
    CleanFrameHA.setPanelActive(!!homeOpen);
  }

  /* The Home app owns its own screen and its own keys; see home-app.js. */
  function openHomeApp() {
    if (!window.CleanFrameHomeApp) {
      message('Home', 'The Home app is not available in this build.', '');
      return;
    }
    window.CleanFrameHomeApp.open();
  }

  /* ---------- A folder from Home ----------
     OK on a folder tile opens this pane instead of a package. It is the folder's
     own screen, drawn over the stage: the same app cards as the dock at the same
     size, four to a row, with the folder's name above them. Back closes it, OK
     opens the focused app, and the arrows walk the grid. */
  var FOLDER_COLS = 4, FOLDER_MAX = 12;
  var folderState = null;
  function folderFocusIndex(f) {
    var members = folderMembers(f);
    if (!members.length) return -1;
    return clamp(folderState.i, 0, members.length - 1);
  }
  function renderFolder() {
    var f = folderState && folder(folderState.id), members, html = '', i, m;
    if (!f || !folderGridEl) return;
    members = folderMembers(f);
    if (!members.length) { closeFolder(); return; }
    folderState.i = clamp(folderState.i, 0, members.length - 1);
    for (i = 0; i < members.length; i++) {
      m = members[i];
      html += '<div class="folder-app' + (i === folderState.i ? ' is-focus' : '') + '" data-i="' + i + '" data-z="folder" data-id="' + esc(m.id) + '">' +
        appCardHtml(m) +
        '<span class="appletv-label">' + esc(m.name) + '</span>' +
      '</div>';
    }
    setHTML(folderGridEl, html);
    if (folderPanelEl) folderPanelEl.setAttribute('data-count', String(members.length));
  }
  function openFolder(id) {
    var f = folder(id), members;
    if (!f) return;
    if (!folderEl) {
      message(f.name, 'Folders need the packaged app build.', '');
      return;
    }
    members = folderMembers(f);
    if (!members.length) {
      message(f.name, 'This folder has no apps the TV can open.', '');
      return;
    }
    folderState = { id: id, i: 0 };
    if (folderTitleEl) folderTitleEl.textContent = f.name;
    renderFolder();
    folderEl.hidden = false;
    folderEl.classList.remove('is-open');
    /* Commit the closed start state before the class opens it, so the pane has a
       previous frame to animate from. */
    void folderEl.offsetWidth;
    folderEl.classList.add('is-open');
    /* The pane's glass is the blurred poster beneath it: painted once as it
       opens, then it simply moves with the pane. */
    syncFolderGlass();
  }
  function closeFolder() {
    if (!folderState) return;
    folderState = null;
    if (folderEl) { folderEl.classList.remove('is-open'); folderEl.hidden = true; }
    render();
  }
  /* Only two tiles change on a move, so the pane is never rebuilt for one: the
     folder's mini icons are decodes, and a rebuild would ask for all of them on
     every arrow press. */
  function moveFolderFocus(delta) {
    var f = folderState && folder(folderState.id), members, from, to, tiles;
    if (!f || !folderGridEl) return;
    members = folderMembers(f);
    from = folderFocusIndex(f);
    to = from + delta;
    if (to < 0 || to >= members.length || to === from) return;
    tiles = folderGridEl.querySelectorAll('.folder-app');
    if (tiles[from]) tiles[from].classList.remove('is-focus');
    folderState.i = to;
    if (tiles[to]) tiles[to].classList.add('is-focus');
  }
  function folderLaunch() {
    var f = folderState && folder(folderState.id), members, m;
    if (!f) return;
    members = folderMembers(f);
    m = members[folderFocusIndex(f)];
    if (!m) return;
    closeFolder();
    launch(m.id);
  }
  function folderKey(k) {
    var f = folderState && folder(folderState.id);
    if (!f) { folderState = null; if (folderEl) { folderEl.classList.remove('is-open'); folderEl.hidden = true; } return; }
    if (k === 'back') { closeFolder(); return; }
    if (k === 'ok') { folderLaunch(); return; }
    if (k === 'left') moveFolderFocus(-1);
    else if (k === 'right') moveFolderFocus(1);
    else if (k === 'up') moveFolderFocus(-FOLDER_COLS);
    else if (k === 'down') moveFolderFocus(FOLDER_COLS);
  }

  function openHAPanel() {
    if (inStack('ha_panel')) return;
    resetStageScroll();
    push({ id: 'ha_panel', f: { zone: 'devices', devIdx: 0 } });
    homeOpen = true;
    /* Build the sheet while it is still off-screen, so the DOM work lands before
       the slide-in rather than on top of it. */
    renderHAPanel(true);
    if (haPanelEl) {
      /* The stagger plays once, on the way in; the class is dropped afterwards
         so focus moves and re-renders never replay it. */
      haPanelEl.classList.add('is-enter');
      clearTimeout(haEnterTimer);
      haEnterTimer = setTimeout(function () {
        if (haPanelEl) haPanelEl.classList.remove('is-enter');
      }, 780);
      haPanelEl.classList.add('is-open');
    }
    syncHAPolling();
  }

  function closeHAPanel() {
    if (top().id === 'ha_panel') pop();
    homeOpen = false;
    clearTimeout(haEnterTimer);
    if (haPanelEl) haPanelEl.classList.remove('is-open', 'is-enter');
    resetStageScroll();
    syncHAPolling();
  }

  /* The stage is an overflow:hidden scroll container. Anything that calls
     scrollIntoView() with default inline behaviour can scroll it sideways to
     reveal the off-screen panel, which drags the whole home screen left. */
  function resetStageScroll() {
    if (!stage) return;
    if (stage.scrollLeft) stage.scrollLeft = 0;
    if (stage.scrollTop) stage.scrollTop = 0;
  }

  /* Scroll only the sheet's own device list, vertically. */
  /* Layout offsets rather than client rects: the focused tile is scaled by 1.2%
     and mid-transition rects made the list settle a few pixels short, so the last
     tile could stay clipped. offsetTop is the unscaled position inside the list. */
  function scrollPanelCardIntoView(card) {
    var view, top, was = haDeviceScrollEl ? haDeviceScrollEl.scrollTop : 0;
    if (!card || !haDeviceScrollEl) return false;
    view = haDeviceScrollEl.clientHeight;
    top = card.offsetTop;
    if (top < haDeviceScrollEl.scrollTop + 12) {
      haDeviceScrollEl.scrollTop = Math.max(0, top - 12);
    } else if (top + card.offsetHeight > haDeviceScrollEl.scrollTop + view - 12) {
      haDeviceScrollEl.scrollTop = top + card.offsetHeight - view + 12;
    }
    return haDeviceScrollEl.scrollTop !== was;
  }

  function fanSpeedNum(pct) {
    if (!pct || pct <= 0) return 0;
    return Math.min(6, Math.max(1, Math.round(pct / 16.666)));
  }

  /* Where a tile sits on the stage. The list is read through layout offsets
     rather than client rects, so focus never moves a tile's own glass, and a
     fractional scroll keeps its place. */
  function stageBox(el, origin) {
    return {
      x: origin.x + el.offsetLeft,
      y: origin.y + el.offsetTop
    };
  }

  /* Each Home tile is its own glass object, exactly like the Control Center's: a
     still slice of the artwork behind that tile, clipped by its own rounded
     edge. Nothing filters while the sheet animates. */
  function syncHomeGlass(open, moved) {
    var src, tiles, origin;
    if (!haPanelEl || !haDeviceScrollEl) return;
    src = controlGlassSrc();
    haPanelEl.classList.toggle('has-glass', !!src);
    tiles = haDeviceScrollEl.querySelectorAll('.home-tile');
    Array.prototype.forEach.call(tiles, function (tile) {
      var glass = tile.querySelector('.ctrl-glass');
      if (!glass) return;
      if (src) {
        if (glass._src !== src) { glass.style.backgroundImage = 'url("' + src + '")'; glass._src = src; }
      } else if (glass._src) {
        glass.style.backgroundImage = '';
        glass._src = '';
      }
    });
    if (!open || !src) return;
    /* A focus move does not move any tile, so measuring the layout on every
       keypress is pure cost. Only an opened sheet, a rebuilt list or a scroll
       asks for new slices. */
    if (!moved && haPanelEl._geo) return;
    /* Layout offsets, never client rects: the sheet slides and scales while it
       opens, and a rect sampled mid-transition would bake a wrong origin into
       every card's slice. The offsets are the same before, during and after. */
    origin = {
      x: haPanelEl.offsetLeft + haDeviceScrollEl.offsetLeft - haDeviceScrollEl.scrollLeft,
      y: haPanelEl.offsetTop + haDeviceScrollEl.offsetTop - haDeviceScrollEl.scrollTop
    };
    haPanelEl._geo = origin.x.toFixed(1) + ',' + origin.y.toFixed(1);
    Array.prototype.forEach.call(tiles, function (tile) {
      var glass = tile.querySelector('.ctrl-glass'), box;
      if (!glass) return;
      box = stageBox(tile, origin);
      /* One decimal: a rounded offset left a visible seam on a tile whose row
         started between two pixels. */
      glass.style.backgroundPosition = lensPos(box.x, box.y, glass.offsetWidth, glass.offsetHeight);
    });
  }

  var _lastHAStateKey = '';

  var HA_ICONS = {
    climate: '<svg class="ico home-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18M4.4 7.6l15.2 8.8M19.6 7.6 4.4 16.4"/><path d="M12 6.1 10.2 4.3M12 6.1l1.8-1.8M12 17.9l-1.8 1.8M12 17.9l1.8 1.8"/></svg>',
    fan: '<svg class="ico home-ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="1.9"/><path d="M12 10.1c0-2.6-.9-5.1-2.6-5.1C7.9 5 7.4 6.6 7.9 8c.5 1.4 2 1.9 4.1 2.1zM13.9 12c2.6 0 5.1-.9 5.1-2.6 0-1.5-1.6-2-3-1.5-1.4.5-1.9 2-2.1 4.1zM12 13.9c0 2.6.9 5.1 2.6 5.1 1.5 0 2-1.6 1.5-3-.5-1.4-2-1.9-4.1-2.1zM10.1 12c-2.6 0-5.1.9-5.1 2.6 0 1.5 1.6 2 3 1.5 1.4-.5 1.9-2 2.1-4.1z"/></svg>',
    media: '<svg class="ico home-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M11 4.6 6.4 8.8H3.2v6.4h3.2L11 19.4z"/><path d="M14.6 8.4a5.2 5.2 0 0 1 0 7.2M17.4 5.8a9 9 0 0 1 0 12.4"/></svg>',
    play: '<svg class="ico is-solid home-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M8.2 4.9 19.4 12 8.2 19.1z"/></svg>',
    pause: '<svg class="ico is-solid home-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4.9h3.5v14.2H8zM12.5 4.9H16v14.2h-3.5z"/></svg>',
    power: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4.2v7"/><path d="M7.5 7.2a6.8 6.8 0 1 0 9 0"/></svg>',
    minus: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12"/></svg>',
    plus: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12M12 6v12"/></svg>'
  };

  /* Home Assistant states are lower case; the sheet prints them as words. */
  function haText(s) {
    s = String(s || '').replace(/_/g, ' ');
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  /* A bar is the slider itself: the fill and the knob both sit at the value, so
     a glance at the card is a glance at the setting. */
  function haBar(frac, id, i) {
    var pct = Math.round(Math.max(0, Math.min(1, frac || 0)) * 100);
    return '<div class="home-bar" data-z="haBar" data-i="' + i + '" data-id="' + id + '" role="slider" aria-valuenow="' + pct + '">' +
      '<span class="home-bar-fill" style="width:' + pct + '%"></span>' +
      '<span class="home-bar-knob" style="left:' + pct + '%"></span>' +
    '</div>';
  }

  /* One device, one glass card, and every control on the card itself. A square
     air conditioner carries its reading between two temperature keys and a power
     key; a capsule fan or speaker carries its mark as the switch, its name and
     state, and the bar that is its speed or volume. */
  /* One device, one pill - the Home sheet's shape from tvOS: a translucent
     capsule with the device's mark and its name, the state on the second line,
     and a white fill while the device is on. The sheet is a switchboard now
     that the Home app owns temperature, speed and the rest: OK turns a device
     on or off and nothing else is drawn on it. */
  function haDeviceTile(dev, i, isFocus) {
    var st = CleanFrameHA.getState(dev.id) || {};
    var a = st.attributes || {};
    var tag, icon = HA_ICONS[dev.type] || HA_ICONS.switch;
    var on = false;

    if (dev.type === 'climate') {
      on = ['cool', 'heat', 'dry', 'fan_only', 'auto'].indexOf(st.state) >= 0;
      tag = st.state === 'unavailable' ? 'Offline' : on ? haText(st.state) : 'Off';
    } else if (dev.type === 'fan') {
      on = st.state === 'on';
      tag = !on ? 'Off' : 'Speed ' + fanSpeedNum(Math.round(a.percentage || 0)) + ' of 6';
    } else if (dev.type === 'light' || dev.type === 'switch') {
      on = st.state === 'on';
      tag = on ? 'On' : 'Off';
    } else {
      on = st.state === 'playing' || st.state === 'on';
      tag = on ? (a.media_title || a.app_name || 'Playing') : 'Paused';
    }

    return '<div class="home-tile is-pill' + (on ? ' is-on' : '') + (isFocus ? ' is-focus' : '') +
      '" role="button" data-z="ha" data-i="' + i + '" data-id="tile"' +
      ' aria-label="' + esc(dev.name + ', ' + tag + '. OK turns it ' + (on ? 'off' : 'on')) + '">' +
      '<span class="ctrl-glass" aria-hidden="true"></span><span class="ctrl-veil" aria-hidden="true"></span>' +
      '<span class="home-pill-btn' + (on ? '' : ' is-dim') + '" aria-hidden="true">' + icon + '</span>' +
      '<span class="home-pill-copy"><span class="home-name">' + esc(dev.name) + '</span>' +
        '<span class="home-note">' + esc(tag) + '</span></span>' +
    '</div>';
  }

  /* The sheet has no room selector: every device the client knows about sits in
     one grid, so the bedroom fan is one press from the lounge air conditioner.
     The list is built the same way for the render, the D-pad and a click, so
     focus and hit-testing always agree on the index. A device listed in two
     rooms keeps its first place, and the cards are ordered by size - squares,
     then half cards, then the full-width bars - so the grid packs without
     holes rather than trapping a wide card between two half cards. */
  var HA_ORDER = { climate: 0, fan: 1, media: 2 };
  /* Which Home Assistant devices are part of CleanFrame's own surfaces. This
     lives under its own key rather than in the look preferences: it is a device
     list the Home app and the Control Centre both read, and it has to survive
     the preference migrations those two go through untouched. A device is shown
     unless it has been removed, so a newly added entity appears by itself. */
  var DEVICE_KEY = 'cleanframe.devices.v1';
  var devHidden = [];
  try {
    var storedHidden = JSON.parse(localStorage.getItem(DEVICE_KEY) || '[]');
    if (Array.isArray(storedHidden)) {
      for (var dh = 0; dh < storedHidden.length; dh++) {
        if (typeof storedHidden[dh] === 'string' && safeId(storedHidden[dh]) && devHidden.indexOf(storedHidden[dh]) < 0) devHidden.push(storedHidden[dh]);
      }
    }
  } catch (eDevHidden) { devHidden = []; }
  function deviceShown(id) { return devHidden.indexOf(id) < 0; }
  function setDeviceShown(id, shown) {
    var i = devHidden.indexOf(id);
    if (shown && i >= 0) devHidden.splice(i, 1);
    else if (!shown && i < 0) devHidden.push(id);
    try { localStorage.setItem(DEVICE_KEY, JSON.stringify(devHidden)); } catch (eDevSave) {}
  }
  function haRooms() { return (window.CleanFrameHA && CleanFrameHA.ROOMS) || []; }
  function haDeviceTotals() {
    var rooms = haRooms(), all = 0, shown, seen = {}, id, list, i, k;
    for (i = 0; i < rooms.length; i++) {
      list = rooms[i].devices || [];
      for (k = 0; k < list.length; k++) {
        id = list[k] && list[k].id;
        if (!id || seen[id]) continue;
        seen[id] = 1; all++;
      }
    }
    shown = haDevices().length;
    return { all: all, shown: shown };
  }
  window.CleanFrameDevicePrefs = {
    isShown: deviceShown,
    shown: function () { return haDevices().length; },
    hidden: function () { return devHidden.slice(); },
    set: setDeviceShown
  };
  function haDevices() {
    var out = [], seen = {}, rooms, list, i, id;
    rooms = (window.CleanFrameHA && CleanFrameHA.ROOMS) || [];
    for (var r = 0; r < rooms.length; r++) {
      list = rooms[r].devices || [];
      for (i = 0; i < list.length; i++) {
        id = list[i] && list[i].id;
        if (!id || seen[id] || !deviceShown(id)) continue;
        seen[id] = 1;
        out.push(list[i]);
      }
    }
    out.sort(function (a, b) {
      var oa = HA_ORDER[a.type] === undefined ? 3 : HA_ORDER[a.type],
          ob = HA_ORDER[b.type] === undefined ? 3 : HA_ORDER[b.type];
      return oa - ob;
    });
    return out;
  }

  function renderHAPanel(force) {
    if (!haPanelEl || !window.CleanFrameHA) return;
    var t = top();
    var f = (t && t.f && t.f.zone) ? t.f : { zone: 'devices', devIdx: 0 };
    var devices = haDevices();
    if (!devices.length) {
      if (haDeviceScrollEl) haDeviceScrollEl.innerHTML = '<div class="home-empty">Home Assistant is not set up on this TV.</div>';
      _lastHAStateKey = '';
      return;
    }

    var stateKey = '';
    for (var k = 0; k < devices.length; k++) {
      var ds = CleanFrameHA.getState(devices[k].id), da = (ds && ds.attributes) || {};
      stateKey += (ds ? [ds.state, da.temperature, da.current_temperature, da.percentage, da.fan_mode, da.media_title, da.volume_level].join('_') : 'x') + '|';
    }

    /* A card whose numbers changed is rebuilt; a card that only gained focus is
       not, so walking the sheet with the D-pad never touches the DOM. */
    var needFullRebuild = force || (_lastHAStateKey !== stateKey);
    _lastHAStateKey = stateKey;

    var moved = !!needFullRebuild;
    if (needFullRebuild) {
      var devHtml = '';
      /* One air conditioner in the whole sheet centres on its own row instead of
         leaving a hole in the grid beside it. */
      var acCount = 0;
      for (var ac = 0; ac < devices.length; ac++) if (devices[ac].type === 'climate') acCount++;
      for (var i = 0; i < devices.length; i++) {
        devHtml += haDeviceTile(devices[i], i, f.zone === 'devices' && f.devIdx === i,
          devices[i].type === 'climate' && acCount === 1);
      }
      if (haDeviceScrollEl) {
        haDeviceScrollEl.innerHTML = devHtml || '<div class="home-empty">No devices.</div>';
        haPanelEl._geo = '';
        if (f.zone === 'devices') scrollPanelCardIntoView(haDeviceScrollEl.querySelector('.home-tile.is-focus'));
      }
    } else {
      /* Same sheet, different focus: only the plates move. */
      var allTiles = haDeviceScrollEl.querySelectorAll('.home-tile');
      for (var ci = 0; ci < allTiles.length; ci++) {
        var isF = (f.zone === 'devices' && f.devIdx === ci);
        allTiles[ci].classList.toggle('is-focus', isF);
        if (isF && scrollPanelCardIntoView(allTiles[ci])) moved = true;
      }
    }
    syncHomeGlass(homeOpen, moved || !haPanelEl._geo);
  }

  /* One step of the focused card's own value. The D-pad and the bar share this,
     so a remote press and a click never disagree about the scale. */
  function haStep(dev, dir) {
    if (!dev) return;
    if (dev.type === 'climate') {
      CleanFrameHA.adjustClimateTemp(dev.id, dir * 0.5);
    } else if (dev.type === 'fan') {
      if (dir > 0) CleanFrameHA.increaseFanSpeed(dev.id);
      else CleanFrameHA.decreaseFanSpeed(dev.id);
    } else if (CleanFrameHA.adjustVolume) {
      CleanFrameHA.adjustVolume(dev.id, dir * 0.05);
    }
  }

  /* A bar clicked at a point lands on that point's value. */
  function haSetFromBar(dev, frac) {
    if (!dev) return;
    frac = Math.max(0, Math.min(1, frac || 0));
    if (dev.type === 'fan') {
      if (CleanFrameHA.setFanSpeed) CleanFrameHA.setFanSpeed(dev.id, Math.round(frac * 100));
    } else if (dev.type === 'media') {
      if (CleanFrameHA.setVolume) CleanFrameHA.setVolume(dev.id, Math.round(frac * 100) / 100);
    }
  }

  /* The nearest card in a direction, measured from the tiles themselves rather
     than from the device list: the grid mixes square and wide cards, so index
     arithmetic cannot know which card sits above the one in focus. `along` is
     the distance travelled and `cross` the misalignment, so the card directly
     beside this one beats a nearer one on the far side of the sheet. */
  function haStepFocus(f, devices, dir) {
    var els = haPanelEl ? haPanelEl.querySelectorAll('[data-z="ha"]') : null;
    var cur, cx, cy, i, el, dx, dy, along, cross, score, best = -1, bestScore = Infinity;
    if (!els || els.length !== devices.length) {
      if (dir === 'up') f.devIdx = Math.max(0, f.devIdx - 1);
      else if (dir === 'down') f.devIdx = Math.min(devices.length - 1, f.devIdx + 1);
      return;
    }
    cur = els[f.devIdx];
    if (!cur) return;
    cx = cur.offsetLeft + cur.offsetWidth / 2;
    cy = cur.offsetTop + cur.offsetHeight / 2;
    for (i = 0; i < els.length; i++) {
      if (i === f.devIdx) continue;
      el = els[i];
      dx = (el.offsetLeft + el.offsetWidth / 2) - cx;
      dy = (el.offsetTop + el.offsetHeight / 2) - cy;
      along = dir === 'left' ? -dx : dir === 'right' ? dx : dir === 'up' ? -dy : dy;
      if (along <= 1) continue;
      cross = (dir === 'left' || dir === 'right') ? Math.abs(dy) : Math.abs(dx);
      score = along + cross * 2.4;
      if (score < bestScore) { bestScore = score; best = i; }
    }
    if (best >= 0) f.devIdx = best;
  }

  V.ha_panel = {
    sheet: false,
    norm: function (t) {
      if (t.f.zone !== 'devices') t.f.zone = 'devices';
      if (t.f.devIdx === undefined) t.f.devIdx = 0;
    },
    key: function (t, k) {
      var f = t.f;
      var devices = haDevices();
      if (k === 'back') { closeHAPanel(); return; }
      if (!devices.length) { closeHAPanel(); return; }
      if (f.zone !== 'devices') { f.zone = 'devices'; f.devIdx = 0; }
      f.devIdx = clamp(f.devIdx || 0, 0, devices.length - 1);
      var dev = devices[f.devIdx];

      /* All four arrows walk the grid, so the sheet can be crossed in the
         direction the viewer is looking. Up and Down had it alone before, and
         Left and Right stepped the focused card's own value instead, which left
         the obvious gesture doing nothing useful when the card in focus had no
         value to step. OK is the switch; a card's own keys and its bar are
         still clicked directly. */
      if (k === 'up' || k === 'down' || k === 'left' || k === 'right') haStepFocus(f, devices, k);
      else if (k === 'ok') CleanFrameHA.toggleEntity(dev.id);
      renderHAPanel();
    },
    point: function (t, z, i, id, el, ev) {
      var devices, dev, frac, box;
      if (z !== 'ha' && z !== 'haCtl' && z !== 'haBar') return;
      devices = haDevices();
      dev = devices[i];
      if (!dev) return;
      t.f.zone = 'devices';
      t.f.devIdx = i;

      if (z === 'haBar') {
        frac = 0.5;
        if (el && el.getBoundingClientRect) {
          box = el.getBoundingClientRect();
          if (box.width) frac = ((ev ? ev.clientX : box.left + box.width / 2) - box.left) / box.width;
        }
        haSetFromBar(dev, frac);
        renderHAPanel(true);
        return;
      }
      if (z === 'haCtl') {
        if (id === 'minus') haStep(dev, -1);
        else if (id === 'plus') haStep(dev, 1);
        else CleanFrameHA.toggleEntity(dev.id);
        renderHAPanel(true);
        return;
      }
      /* The card itself is the switch, exactly like OK. */
      CleanFrameHA.toggleEntity(dev.id);
      renderHAPanel(true);
    }
  };

var PROVIDER_NAMES = { nuviotv: 'Nuvio', netflix: 'Netflix', primevideo: 'Prime Video', hotstar: 'JioHotstar', appletv: 'Apple TV', sonyliv: 'Sony LIV', stremio: 'Stremio', disneyplus: 'Disney+' };


  function launchMediaItem(item) {
    if (!item) return;
    var p = (item.provider || '').toLowerCase();
    if (!p) {
      message('Not available', 'No streaming offer was found for this title.', 'Try another title or service.');
      return;
    }
    /* This set has no working Netflix app, and its offers would otherwise just
       open an app store page. Nuvio is a local library that opens the same
       title from its IMDb id, so every Netflix offer is handed to Nuvio. */
    if (p === 'netflix') p = 'nuviotv';
    var appName = PROVIDER_NAMES[p] || p.charAt(0).toUpperCase() + p.slice(1);
    var extra = { id: item.id };
    if (item.videoId) extra.videoId = item.videoId;
    if (item.type) extra.type = item.type;
    if (item.gti) extra.gti = item.gti;
    if (item.webUrl) extra.webUrl = item.webUrl;
    if (item.monetizationType) extra.monetizationType = item.monetizationType;
    /* The card grows out of the poster's provider badge, which the closing
       search sheet is about to remove, so it is read first. */
    var anchorEl = document.querySelector('.search-tile.is-focus .search-tile-logo') || launchAnchorEl();
    closeSearch();
    perform(appName, function (done) {
      FrameDevice.launchMedia(p, item.title, extra, done);
    }, appAnchor(p, anchorEl));
  }

  function renderSearchPill(hs) {
    if (!homeSearchPill) return;
    var isFocus = hs && hs.zone === 'search';
    homeSearchPill.className = 'home-search-pill' + (isFocus ? ' is-focus' : '');
  }

  /* Scroll a focused row or card to the nearest edge of its own box. No smooth
     scrolling: the D-pad only ever moves one step, so an instant jump is the
     least surprising motion on the TV. */
  function ensureSearchFocusVisible(box, el) {
    if (!box || !el) return;
    try {
      var cr = el.getBoundingClientRect();
      var pr = box.getBoundingClientRect();
      if (cr.top < pr.top + 12) {
        box.scrollTop -= (pr.top + 12 - cr.top);
      } else if (cr.bottom > pr.bottom - 12) {
        box.scrollTop += (cr.bottom - pr.bottom + 12);
      }
    } catch (e) {}
  }

  function renderSearchEmpty(message) {
    if (!searchContentEl) return;
    setHTML(searchContentEl, '<div class="search-empty-state">' +
      '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="8" fill="none" stroke="currentColor" stroke-width="2"/><path d="m21 21-4.35-4.35" fill="none" stroke="currentColor" stroke-width="2"/></svg>' +
      '<p>' + esc(message || 'No results found') + '</p>' +
      '</div>');
  }

  /* The query lives in state and is drawn here, which is what keeps the TV's
     own keyboard away: nothing on this sheet is a text input. */
  function updateSearchField(q) {
    if (searchFieldTextEl) {
      searchFieldTextEl.textContent = q || 'Search';
      searchFieldTextEl.className = 'search-field-text' + (q ? '' : ' is-empty');
    }
    if (searchFieldEl) searchFieldEl.classList.toggle('has-query', !!q);
  }

  function searchKeyHtml(key, row, col) {
    var cls = 'search-key', label = key, aria = key;
    if (key === 'space') {
      cls += ' is-space'; label = 'space';
    } else if (key === 'del') {
      cls += ' is-del'; aria = 'Delete';
      label = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">' +
        '<path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M9 5h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9L3 12Z"/>' +
        '<path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="m12 9 5 6M17 9l-5 6"/></svg>';
    } else if (key === 'clear') {
      cls += ' is-clear'; label = 'clear';
    }
    return '<button type="button" class="' + cls + '" data-z="s-key" data-i="' + (row * 10 + col) + '"' +
      ' data-id="' + esc(key) + '" aria-label="' + esc(aria) + '">' + label + '</button>';
  }

  function renderSearchKeyboard(tab) {
    if (!searchKeysEl) return;
    if (searchState.keysBuilt === tab) return;
    searchState.keysBuilt = tab;
    var rows = searchTabRows(tab), html = '', r, c, row;
    for (r = 0; r < rows.length; r++) {
      row = rows[r] || [];
      html += '<div class="search-keyrow">';
      for (c = 0; c < row.length; c++) html += searchKeyHtml(row[c], r, c);
      html += '</div>';
    }
    html += '<div class="search-keyrow is-util">';
    html += searchKeyHtml('space', rows.length, 0);
    html += searchKeyHtml('del', rows.length, 1);
    html += searchKeyHtml('clear', rows.length, 2);
    html += '</div>';
    setHTML(searchKeysEl, html);
  }

  /* The bundled public icons, used only when the installed app did not report
     its own icon path (the browser preview, mainly). */
  var SEARCH_ICON_FILES = {
    netflix: 'netflix.svg', youtube: 'youtube.svg', primevideo: 'primevideo.svg',
    hotstar: 'jiohotstar.png', appletv: 'appletv.svg', sonyliv: 'sonyliv.png',
    disneyplus: 'disneyplus.svg', stremio: 'stremio.svg', nuviotv: 'nuviotv.png',
    applemusic: 'applemusic.svg', spotify: 'spotify.svg', samsungtvplus: 'samsungtvplus.svg',
    tubi: 'tubi.svg', hbomax: 'hbomax.svg', abciview: 'abciview.svg', sbs: 'sbs.svg',
    moonlight: 'moonlight.svg'
  };
  function searchMonogram(name) {
    var words = String(name || '?').replace(/[^A-Za-z0-9]+/g, ' ').trim().split(/\s+/), out = '';
    if (words[0]) out += words[0].charAt(0);
    if (words[1]) out += words[1].charAt(0);
    return (out || '?').toUpperCase();
  }
  /* Brand marks drawn in white ink vanish on the white key a selected pill
     becomes, so the bundled white-glyph files are named here and flipped to
     black on focus. Coloured marks and the raster app icons keep their own
     colour. */
  var SEARCH_MONO_FILES = {
    'appletv.svg': 1, 'primevideo.svg': 1, 'hotstar.svg': 1, 'disneyplus.svg': 1,
    'hbomax.svg': 1, 'sonyliv.svg': 1, 'samsungtvplus.svg': 1, 'stremio.svg': 1,
    'applemusic.svg': 1, 'spotify.svg': 1, 'tubi.svg': 1, 'abciview.svg': 1,
    'sbs.svg': 1, 'moonlight.svg': 1, 'nuviotv.svg': 1
  };
  function searchIconIsMono(src) {
    var file = String(src || '').split('?')[0].split('/').pop();
    return !!SEARCH_MONO_FILES[file];
  }
  function searchMonogram(name) {
    var words = String(name || '?').replace(/[^A-Za-z0-9]+/g, ' ').trim().split(/\s+/), out = '';
    if (words[0]) out += words[0].charAt(0);
    if (words[1]) out += words[1].charAt(0);
    return (out || '?').toUpperCase();
  }
  function searchScopeHtml(ref, i) {
    var brand = (ref && ref.brand) || '', src = (ref && ref.icon) || '', icon;
    if (!src && SEARCH_ICON_FILES[brand]) src = ICONS + SEARCH_ICON_FILES[brand];
    if (src) {
      icon = '<img class="search-scope-icon' + (searchIconIsMono(src) ? ' is-mono' : '') + '" src="' + esc(src) + '" alt="">';
    } else {
      icon = '<span class="search-scope-icon is-text">' + esc(searchMonogram((ref && ref.name) || brand || (ref && ref.id))) + '</span>';
    }
    return '<button type="button" class="search-scope" data-z="s-scope" data-i="' + i + '"' +
      ' aria-label="Search in ' + esc(ref.name) + '">' + icon +
      '<span class="search-scope-name">' + esc(ref.name) + '</span></button>';
  }

  /* The scope row is rebuilt only when the installed apps change, so a
     keypress never touches it. */
  var searchScopesBuilt = '';
  function renderSearchScopes() {
    if (!searchScopesEl) return;
    var refs = searchScopeRefs(), parts = [], html = '', i;
    for (i = 0; i < refs.length; i++) parts.push(refs[i].brand + ':' + refs[i].icon);
    searchState.scopes = refs;
    if (parts.join('|') === searchScopesBuilt) return;
    searchScopesBuilt = parts.join('|');
    for (i = 0; i < refs.length; i++) html += searchScopeHtml(refs[i], i);
    setHTML(searchScopesEl, html);
  }

  /* Local name matches answer on the first keypress, before the catalogue. */
  function searchAppMatches(q) {
    var out = [], query = String(q || '').toLowerCase(), i;
    if (!query) return out;
    for (i = 0; i < APPS.length; i++) {
      if (String(APPS[i].name || '').toLowerCase().indexOf(query) >= 0) out.push(APPS[i]);
    }
    return out;
  }

  /* As the query grows the page offers the title it thinks the viewer means and
     the installed apps that can take the term. The app rows need no network, so
     the list answers on the first keypress and the catalogue only adds the
     titles once it has an answer. */
  function buildSearchSuggestions(results) {
    var out = [], q = (results && results.query) || '', i, used = {}, ref, apps;
    if (!q) return out;
    if (results.movies && results.movies[0]) {
      out.push({ kind: 'title', item: results.movies[0] });
      if (results.movies[0].provider) used[results.movies[0].provider] = 1;
    }
    if (results.shows && results.shows[0]) out.push({ kind: 'title', item: results.shows[0] });
    apps = (results && results.apps) || [];
    for (i = 0; i < apps.length && out.length < 3; i++) {
      if (!apps[i]) continue;
      out.push({ kind: 'app', app: apps[i] });
      used[apps[i].brand || apps[i].id] = 1;
      break;
    }
    for (i = 0; i < SEARCH_APPS.length && out.length < 4; i++) {
      if (used[SEARCH_APPS[i]]) continue;
      ref = searchAppRef(SEARCH_APPS[i]);
      if (!ref) continue;
      used[SEARCH_APPS[i]] = 1;
      out.push({ kind: 'appsearch', ref: ref, q: q });
    }
    return out;
  }

  function searchSugIconHtml(ref) {
    var brand = (ref && ref.brand) || '', src = (ref && ref.icon) || '';
    if (!src && SEARCH_ICON_FILES[brand]) src = ICONS + SEARCH_ICON_FILES[brand];
    if (src) return '<img class="search-sug-icon' + (searchIconIsMono(src) ? ' is-mono' : '') + '" src="' + esc(src) + '" alt="">';
    return '<span class="search-sug-icon is-text">' + esc(searchMonogram((ref && ref.name) || brand)) + '</span>';
  }

  function searchSuggestionHtml(sug, i) {
    var html = '<div class="search-sug" role="button" data-z="s-sug" data-i="' + i + '">', sub = '';
    if (sug.kind === 'title') {
      html += '<img class="search-sug-thumb" src="' + esc(sug.item.poster || '') + '" alt="">';
      sub = [sug.item.year, PROVIDER_NAMES[sug.item.provider] || ''].filter(function (x) { return !!x; }).join(' \u00B7 ');
      html += '<span class="search-sug-copy"><span class="search-sug-title">' + esc(sug.item.title) + '</span>' +
        '<span class="search-sug-sub">' + esc(sub || 'Open title') + '</span></span>';
    } else if (sug.kind === 'app') {
      html += searchSugIconHtml({ brand: sug.app.brand || sug.app.id, icon: sug.app.icon, name: sug.app.name });
      html += '<span class="search-sug-copy"><span class="search-sug-title">' + esc(sug.app.name) + '</span>' +
        '<span class="search-sug-sub">Open app</span></span>';
    } else {
      html += searchSugIconHtml(sug.ref);
      html += '<span class="search-sug-copy"><span class="search-sug-title">' + esc(sug.ref.name) + '</span>' +
        '<span class="search-sug-sub">Search for \u201C' + esc(sug.q) + '\u201D</span></span>';
    }
    return html + '</div>';
  }

  function renderSearchSuggestions() {
    if (!searchSuggestEl) return;
    var sugs = searchState.sugs || [], html = '', i;
    if (!sugs.length) {
      setHTML(searchSuggestEl, '');
      searchSuggestEl.hidden = true;
      return;
    }
    for (i = 0; i < sugs.length; i++) html += searchSuggestionHtml(sugs[i], i);
    searchSuggestEl.hidden = false;
    setHTML(searchSuggestEl, html);
  }

  /* A scope pill, an app-suggestion row and an app-search suggestion all hand
     the term to the same app search. */
  function activateSearchSuggestion(sug) {
    if (!sug) return;
    if (sug.kind === 'app') { closeSearch(); launch(sug.app.id); return; }
    if (sug.kind === 'title') { launchMediaItem(sug.item); return; }
    if (sug.kind === 'appsearch') activateSearchScope(sug.ref);
  }

  /* The service mark and the title sit under the artwork, never on it: the
     still frame stays uncovered and the name is readable without focusing. */
  function searchCaptionHtml(item) {
    var p = (item && item.provider) || '', src = p ? ICONS + p + '.svg' : '';
    return '<span class="search-tile-cap" data-p="' + esc(p) + '">' +
      (p ? '<img class="search-tile-logo' + (searchIconIsMono(src) ? ' is-mono' : '') + '" src="' + esc(src) + '" alt="">' : '') +
      '<span class="search-tile-name">' + esc((item && item.title) || '') + '</span>' +
      '</span>';
  }

  /* One row of titles, as in the reference: landscape art in a 16:9 frame, the
     service badge in its corner and the name only while the card is chosen. */
  function searchGridHtml(list, cards, heading) {
    var html = '<div class="search-section">' +
      '<div class="search-section-header">' +
        '<h3 class="search-section-title">' + esc(heading) + '</h3>' +
      '</div>' +
      '<div class="search-grid">';
    for (var i = 0; i < list.length; i++) {
      var item = list[i], art = item.background || item.poster || '';
      cards.push(item);
      html += '<div class="search-tile" role="button" data-z="s-card" data-i="' + (cards.length - 1) + '"' +
        ' aria-label="' + esc(item.title) + '">' +
        '<div class="search-tile-art">' +
          '<img src="' + esc(art) + '" alt="" loading="lazy">' +
        '</div>' +
        searchCaptionHtml(item) +
      '</div>';
    }
    return html + '</div></div>';
  }

  /* Rebuilding twenty-odd cards per callback is what made typing feel heavy: a
     search fires twice per query (partial results, then the offers arriving),
     and the two sets almost always share the same titles. A cheap identity
     check lets the second pass patch badges in place. */
  var searchRenderSig = '';
  function searchResultsSig(results) {
    var parts = [results.query || ''];
    [results.movies, results.shows].forEach(function (list) {
      (list || []).forEach(function (item) { parts.push(String(item.id || item.title || '') + ':' + (item.provider || '')); });
    });
    return parts.join('~');
  }
  function patchSearchCaptions() {
    if (!searchContentEl) return;
    var cards = searchContentEl.querySelectorAll('.search-tile'), i, item, cap;
    for (i = 0; i < cards.length; i++) {
      item = searchState.cards[i];
      if (!item) continue;
      cap = cards[i].querySelector('.search-tile-cap');
      if (cap && cap.getAttribute('data-p') !== (item.provider || '')) cap.outerHTML = searchCaptionHtml(item);
    }
  }
  function renderSearchResults(results) {
    if (!searchContentEl) return;
    var q = (results && results.query) || '';
    var sig = searchResultsSig(results || {});
    searchState.sugs = buildSearchSuggestions(results || {});
    renderSearchSuggestions();
    if (sig === searchRenderSig && searchContentEl.querySelector('.search-tile')) {
      patchSearchCaptions();
      return;
    }
    searchRenderSig = sig;
    var movies = (results && results.movies) || [], shows = (results && results.shows) || [];
    if (!movies.length && !shows.length) {
      searchState.cards = [];
      searchState.rows = [];
      renderSearchEmpty(q ? 'No results for "' + q + '"' : 'No content available');
      return;
    }
    /* The reference puts the shows above the films and keeps both sections up
       before a query, when the catalogue answers with what is popular. */
    var cards = [], html = '';
    if (shows.length) html += searchGridHtml(shows, cards, 'TV Shows');
    if (movies.length) html += searchGridHtml(movies, cards, 'Movies');
    searchState.cards = cards;
    searchState.rows = [];
    setHTML(searchContentEl, html);
  }

  /* The cards wrap by row, and sections can split a visual row, so the D-pad
     model is measured from the laid-out cards rather than assumed. */
  function searchMeasureRows() {
    var rows = [], els, i, b, top = null;
    if (!searchContentEl || searchViewEl.hidden) {
      searchState.rows = searchState.rows || [];
      return;
    }
    els = searchContentEl.querySelectorAll('.search-tile');
    for (i = 0; i < els.length; i++) {
      b = els[i].getBoundingClientRect();
      if (top === null || Math.abs(b.top - top) > 10) {
        rows.push([]);
        top = b.top;
      }
      rows[rows.length - 1].push(i);
    }
    searchState.rows = rows;
  }

  function renderSearch(t) {
    if (!searchViewEl) return;
    if (t.id !== 'search') {
      /* Keep the sheet on screen while its close transition runs. The timeout
         in closeSearch() hides it after the last frame. */
      if (!searchViewEl.classList.contains('is-closing')) searchViewEl.hidden = true;
      return;
    }
    searchViewEl.hidden = false;
    /* Cheap attribute compare: keeps the glass in step with a backdrop that
       resolves while search is open, without touching pixels per keypress. */
    syncSearchGlass();
    var f = t.f, q = searchState.query || '', tabs, i, keyEls, rows, cardEls, scopeEls, sugEls;

    updateSearchField(q);
    if (searchFieldEl) {
      searchFieldEl.className = 'search-field' + (f.zone === 'field' ? ' is-focus' : '') + (q ? ' has-query' : '');
    }
    if (searchHeadEl) searchHeadEl.className = 'search-head' + (f.zone === 'field' ? ' is-focus' : '');
    /* The spinner is the page's only "working" mark, as in the reference. */
    if (searchSpinEl) searchSpinEl.hidden = !searchState.loading;

    renderSearchScopes();
    renderSearchKeyboard(f.tab);

    if (searchTabsEl) {
      tabs = searchTabsEl.querySelectorAll('.search-tab');
      for (i = 0; i < tabs.length; i++) {
        var tabId = tabs[i].getAttribute('data-id');
        tabs[i].className = 'search-tab' + (tabId === f.tab ? ' is-active' : '') +
          (f.zone === 'tabs' && tabId === (f.ti ? 'num' : 'abc') ? ' is-focus' : '');
        tabs[i].setAttribute('aria-selected', tabId === f.tab ? 'true' : 'false');
      }
    }

    /* The keys are static per layout, so they only carry their focus class. */
    if (searchKeysEl) {
      keyEls = searchKeysEl.querySelectorAll('.search-key');
      for (i = 0; i < keyEls.length; i++) {
        var ki = Number(keyEls[i].getAttribute('data-i'));
        keyEls[i].classList.toggle('is-focus',
          f.zone === 'keys' && Math.floor(ki / 10) === f.kr && ki % 10 === f.kc);
      }
    }

    if (searchScopesEl) {
      /* A shorter installed list can arrive while a pill is focused: clamp to
         the new row rather than leaving focus past its end. */
      if (f.zone === 'scopes') {
        if (!searchState.scopes.length) { f.zone = 'keys'; f.kr = searchTabRows(f.tab).length; f.kc = 0; }
        else f.sc = clamp(f.sc || 0, 0, searchState.scopes.length - 1);
      }
      scopeEls = searchScopesEl.querySelectorAll('.search-scope');
      for (i = 0; i < scopeEls.length; i++) {
        scopeEls[i].classList.toggle('is-focus', f.zone === 'scopes' && i === f.sc);
      }
    }

    if (searchSuggestEl) {
      /* A shorter list can arrive while a row is focused: clamp to it rather
         than leaving focus past the end. */
      if (f.zone === 'sug') {
        if (!searchState.sugs.length) { f.zone = 'scopes'; f.sc = 0; }
        else f.si = clamp(f.si || 0, 0, searchState.sugs.length - 1);
      }
      sugEls = searchSuggestEl.querySelectorAll('.search-sug');
      for (i = 0; i < sugEls.length; i++) {
        var isSug = (f.zone === 'sug' && i === f.si);
        sugEls[i].classList.toggle('is-focus', isSug);
        if (isSug) ensureSearchFocusVisible(searchSuggestEl, sugEls[i]);
      }
    }

    searchMeasureRows();
    rows = searchState.rows || [];
    if (f.zone === 'results') {
      f.ri = clamp(f.ri || 0, 0, Math.max(0, rows.length - 1));
      f.ci = clamp(f.ci || 0, 0, Math.max(0, (rows[f.ri] || []).length - 1));
    }
    var focusIdx = (f.zone === 'results' && rows[f.ri] && rows[f.ri][f.ci] !== undefined) ? rows[f.ri][f.ci] : -1;
    if (searchContentEl) {
      cardEls = searchContentEl.querySelectorAll('.search-tile');
      for (i = 0; i < cardEls.length; i++) {
        var isCard = (i === focusIdx);
        cardEls[i].classList.toggle('is-focus', isCard);
        if (isCard) ensureSearchFocusVisible(searchContentEl, cardEls[i]);
      }
    }
  }

  function openSearch() {
    if (inStack('search')) return;
    push({ id: 'search', f: { zone: 'keys', kr: 0, kc: 0, tab: 'abc' } });
    searchState.open = true;
    searchState.query = '';
    searchState.results = null;
    searchState.cards = [];
    searchState.scopes = searchScopeRefs();
    searchState.sugs = [];
    searchState.rows = [];
    searchState.keysBuilt = '';
    searchRenderSig = '';
    searchScopesBuilt = '';
    updateSearchField('');
    renderSearchScopes();
    renderSearchSuggestions();
    renderSearchKeyboard('abc');
    if (searchViewEl) {
      searchViewEl.hidden = false;
      searchViewEl.classList.remove('is-closing');
      setTimeout(function () {
        if (searchViewEl) searchViewEl.classList.add('is-open');
      }, 16);
    }
    renderSearchEmpty('Loading recommendations...');
    searchState.loading = true;
    syncSearchGlass();
    triggerSearch('');
    fit();
    render();
  }

  function closeSearch() {
    if (top().id === 'search') pop();
    searchState.open = false;
    if (searchViewEl) {
      searchViewEl.classList.remove('is-open');
      searchViewEl.classList.add('is-closing');
      setTimeout(function () {
        if (!searchState.open && searchViewEl) {
          searchViewEl.hidden = true;
          searchViewEl.classList.remove('is-closing');
        }
      }, 200);
    }
    searchState.query = '';
    searchState.results = null;
    searchState.cards = [];
    searchState.scopes = [];
    searchState.sugs = [];
    searchState.rows = [];
    searchState.keysBuilt = '';
    searchRenderSig = '';
    updateSearchField('');
    if (searchSuggestEl) {
      setHTML(searchSuggestEl, '');
      searchSuggestEl.hidden = true;
    }
    fit();
    render();
  }

  function triggerSearch(q, wait) {
    clearTimeout(searchState.debounceTimer);
    searchState.loading = true;
    var token = (searchState.token || 0) + 1;
    searchState.token = token;
    /* The app rows need no network, so they are drawn on the keypress and the
       catalogue only adds titles when it has an answer. */
    if (!searchState.results || searchState.results.query !== q) {
      searchState.sugs = buildSearchSuggestions({ query: q, apps: searchAppMatches(q), movies: [], shows: [] });
      renderSearchSuggestions();
    }
    searchState.debounceTimer = setTimeout(function () {
      if (typeof CleanFrameSearch === 'undefined') return;
      CleanFrameSearch.search(q, APPS, function (results) {
        if (token !== searchState.token) return;
        searchState.loading = !!results.watchLoading;
        searchState.results = results;
        if (top().id === 'search') {
          renderSearchResults(results);
          /* Redrawing the whole stage per search callback rebuilt the home DOM
             hidden behind the overlay; the search view only needs its own focus
             pass. */
          renderSearch(top());
        }
      });
    }, wait === 0 ? 0 : 260);
  }

  function searchType(key) {
    if (!key) return;
    if (window.CleanFrameAudio) CleanFrameAudio.typing();
    var q = searchState.query || '';
    if (key === 'space') q = q.slice(0, SEARCH_MAX - 1) + ' ';
    else if (key === 'del') q = q.slice(0, -1);
    else if (key === 'clear') q = '';
    else q = q.slice(0, SEARCH_MAX - 1) + key;
    searchState.query = q;
    updateSearchField(q);
    triggerSearch(q);
  }

  /* A scope pill hands the typed term to that app's own search page, so the
     viewer lands in its results rather than on its home screen. */
  function activateSearchScope(ref) {
    if (!ref) return;
    var q = searchState.query || '', anchor = document.querySelector('.search-scope.is-focus');
    closeSearch();
    perform('Search in ' + ref.name, function (done) {
      FrameDevice.search(ref, q, done);
    }, appAnchor(ref.brand || ref.id, anchor));
  }

  function activateSearchCardByIndex(idx) {
    var item = searchState.cards[idx];
    if (item) launchMediaItem(item);
  }
  function activateSearchCard(row, col) {
    var grid = searchState.rows || [], line = grid[row] || [];
    activateSearchCardByIndex(line[col]);
  }

  /* Curated locked palettes keep the existing rendering path exactly. */
  function applyAdaptiveInk(palette) {
    var active = S.c.bg === 'photo' && palette && !palette.locked && palette.light && palette.tl && palette.tr && palette.br;
    if (appliedPalette === palette && appliedPhoto === (S.c.bg === 'photo')) return !!active;
    appliedPalette = palette; appliedPhoto = S.c.bg === 'photo';
    ['tl', 'tr', 'br'].forEach(function (zone) {
      var r = active ? palette[zone] : null;
      var values = r ? { ink: r.ink, 'clock-ink': r.clockInk || r.ink, 'rest-ink': r.restInk, 'peer-ink': r.peerInk, rest: r.restAlpha, peer: r.peerAlpha, under: r.halo, shadow: r.shadow } : {};
      ['ink', 'clock-ink', 'rest-ink', 'peer-ink', 'rest', 'peer', 'under', 'shadow'].forEach(function (key) {
        var name = '--' + zone + '-' + key, value = values[key];
        if (value !== undefined && value !== null) stage.style.setProperty(name, String(value));
        else stage.style.removeProperty(name);
      });
    });
    if (active && palette.light) stage.style.setProperty('--home-app-ink', palette.light);
    else stage.style.removeProperty('--home-app-ink');
    return !!active;
  }
  function inkRungClasses(palette, active) {
    if (!active) return '';
    return ['tl', 'tr', 'br'].map(function (zone) {
      var rung = palette[zone].rung;
      return ['light', 'mist', 'mist-high', 'dark', 'dark-halo'].indexOf(rung) >= 0 ? ' ink-' + zone + '-' + rung : '';
    }).join('');
  }
  function render() {
    var t = top(), sheet = !!V[t.id].sheet, detail = isSettingsDetail(t), shown = wall(S.shown ? S.shown.wall : S.c.wall), palette = ADAPTIVE_INK[shown.id];
    /* The opening field belongs to a launch that leaves CleanFrame, and only the
       launcher coming back to the front is meant to clear it. A screen of
       CleanFrame's own that takes the stage in the meantime would sit under an
       opaque black card, so any such screen clears it here as well. */
    if (launchActive && (sheet || detail || t.id !== 'home')) hideLaunch();
    /* The capsule's panel belongs to Home. A sheet opened from it - Settings,
       the Home app, Search - takes the stage, and a panel left open would float
       over that sheet because nothing renders it while another view is on top. */
    if (controlOpen && t.id !== 'home') renderControlPanel(null);
    /* Arrange mode belongs to the dock; leaving it (a sheet, the editor, the
       list layout) drops the pick-up quietly rather than animating a tile that
       is no longer on screen. */
    if (editMode && (t.id !== 'home' || S.c.layout !== 'dock')) { editMode = false; holdId = null; }
    /* A folder pane belongs to Home too: a sheet, the list layout or another
       screen puts it away without waiting for the next key. */
    if (folderState && (t.id !== 'home' || S.c.layout !== 'dock')) {
      folderState = null;
      if (folderEl) { folderEl.classList.remove('is-open'); folderEl.hidden = true; }
    }
    /* The held tile's menu belongs to Home as well. */
    if (menuOpen && (t.id !== 'home' || S.c.layout !== 'dock')) closeMenu();
    /* Resolve the in-focus app's backdrop before the stage class is written: a
       cached image is shown in this frame, and the glass adapts to it. */
    syncBackdrop(backdropWanted(t));
    /* Keep the dwell timer in step with the focus without ever restarting it. */
    syncDwell();
    var dynamic = backdropActive();
    /* Below the first row the poster is frozen behind its soft copy. */
    var frozen = dynamic && t.id === 'home' && S.c.layout === 'dock' && (S.appleTvRow || 0) > 0 &&
      !!(backdropUrl && backdropBlursFull[backdropUrl]);
    /* `backdrop-frozen` hides the sharp poster, so freezing without the frost
       left the drawer over nothing for as long as the copy was being built. */
    if (dynamic && t.id === 'home' && (S.appleTvRow || 0) > 0 && backdropUrl && !backdropBlursFull[backdropUrl]) ensureFrost(backdropUrl);
    var adaptive = applyAdaptiveInk(dynamic ? null : palette), tr = adaptive && palette.tr ? palette.tr.pol : shown.ut.tr, br = adaptive && palette.br ? palette.br.pol : shown.ut.br;
    var dockQuiet = t.id === 'home' && S.c.layout === 'dock' && (S.appleTvRow || 0) > 0;
    /* This is the only state that may strip the dock's shadows. It was keyed off
       `mv-fast` alone, so a held key inside the Control Centre or the Home tab
       also removed them: the tiles behind the panel lost their shadow and got it
       back when the key was released, which read as flickering icons. */
    /* Every move inside the drawer takes the dock-only path, not just a held
       one. Opening or closing the drawer used to pay a full pass - capsule,
       panels, glass, search, focus status - for a change that only the dock and
       the app's name can show, and that pass is what made the drawer feel heavy
       going in and out. What it would have refreshed arrives on the settle
       below, so nothing is left stale. */
    var dockFast = !!(t.id === 'home' && S.c.layout === 'dock' && !sheet && !detail && t.f && t.f.zone === 'apps');
    /* Rewriting stage.className invalidates style for the whole tree; skip the
       write when the derived string is unchanged, which is every move along a
       row whose backdrop and scene did not change. */
    var nextStageClass = 'stage' + (dockFast ? ' is-dock-scroll' : '') + ' bg-' + S.c.bg + ' l-' + S.c.layout + ' v-' + S.variant + ' m-' + (materialApplies() ? S.c.material : 'none') + ' f-' + S.c.focus + ' a-' + S.c.apps + ' u-' + S.c.controls + ' g-' + S.geom + ' tone-' + shown.tone + ' tr-' + tr + ' br-' + br + wallClasses(shown) + inkRungClasses(palette, adaptive) + ' at-' + t.id + ' font-' + homeFont() + (homeFont() !== 'manrope' ? ' font-custom' : '') + (S.fontSwitch ? ' is-font-switch' : '') + (adaptive ? ' has-adaptive-ink adaptive-tl-' + palette.tl.pol : '') + (!adaptive && shown.clockInk ? ' has-clock-ink' : '') + (!adaptive && shown.dockClockInk ? ' has-dock-clock-ink' : '') + (registeredMaterial(shown.id) ? ' registered-material' : '') + (sheet || detail ? ' is-sheet' : '') + (S.reflow ? ' is-reflow' : '') + (dynamic ? ' has-backdrop' : '') + (frozen ? ' backdrop-frozen' : '') + (dockQuiet ? ' dock-scrolled' : '');
    if (stage.className !== nextStageClass) stage.className = nextStageClass;
    if (!adaptive && shown.clockInk) stage.style.setProperty('--clock-ink', shown.clockInk);
    else stage.style.removeProperty('--clock-ink');
    if (!adaptive && shown.dockClockInk) stage.style.setProperty('--dock-clock-ink', shown.dockClockInk);
    else stage.style.removeProperty('--dock-clock-ink');
    applyHomeFont();
    /* A flick along the dock changes exactly one thing: which tile carries focus.
       The capsule, its panels, the search pill, the caption and the sheets cannot
       change between one press and the next, and rebuilding them anyway was most
       of the cost of a fast scroll on the set. Only the dock is touched while the
       remote repeats; coming to rest renders everything else once. */
    if (dockFast) {
      var hsDock = homeState(t);
      renderDock(hsDock);
      try { syncFolderGlass(); } catch (e) {}
      renderCaption(t, hsDock);
      /* The capsule is not part of the cheap path, so its widened state was
         carried over from whatever rendered last: leaving it for the dock left
         the bar open for ever. It is the one control outside the dock that this
         pass has to settle, and it is a class toggle when nothing else moved. */
      renderStatusPill(hsDock);
      if (!motionFast && !dpadPace) {
        /* A single step: the rest of the screen catches up once the tile has
           finished moving, so the press itself only paints what changed. */
        clearTimeout(dockSettle);
        dockSettle = setTimeout(function () {
          dockSettle = 0;
          if (top() && top().id === 'home' && S.c.layout === 'dock') render();
        }, 240);
      }
      return;
    }
    /* Search covers the whole screen: rebuilding the dock, caption and focus
       status behind the overlay on every keypress is what made the remote feel
       slow. They resume the moment search closes. */
    /* The sheet and the appearance pane are decided first: they are whole
       screens, and their visibility must never depend on the Home pass below
       finishing. That dependency is what let a stale sheet or message sit over
       Home after Back. */
    renderSheet(t, sheet);
    renderAppearance(t);
    if (!sheet && !detail && t.id !== 'search') renderHome(t);
    if (t.id !== 'search') renderFocusStatus(t);
    renderSearch(t);
    resetStageScroll();
  }

  function applyHomeFont() {
    var id = homeFont(), f = FONTS[id], primary = fontRole(id, 'primary'), ui = fontRole(id, 'ui'), metrics = fontMetrics[id];
    if (appliedFont === id && appliedFontMetrics === metrics) return;
    appliedFont = id; appliedFontMetrics = metrics;
    var values = { 'display-family': '"' + f.family + '"', 'ui-family': '"' + ui.family + '"', 'primary-family': '"' + primary.family + '"', 'display-weight': f.display, 'ui-weight': ui.weight, 'primary-weight': primary.weight, 'clock-weight': f.clock,
      'clock-shift': px(fontShift('clock', 48)), 'utility-shift': px(fontShift('ui', 28)), 'action-shift': px(fontShift('ui', 30)), 'heading-shift': px(fontShift('ui', 48)), 'full-name-shift': px(fontShift('primary', 30)), 'clock-digit': px(metrics ? metrics.digitCell : 0) };
    Object.keys(values).forEach(function (key) { homeEl.style.setProperty('--font-' + key, String(values[key])); });
  }

  function homeState(t) {
    var h = S.c.home, hs = { mode: 'browse', zone: null, i: Math.max(0, ensureSel()), u: -1, lifted: false, from: -1, arr: null, items: h.map(function (id) { return { key: id, kind: 'app', id: id }; }) };
    if (isSettingsDetail(t)) hs.zone = 'preview';
    else if (t.id === 'home') { hs.zone = t.f.zone; hs.u = t.f.u; hs.mi = t.f.mi; hs.pick = t.f.pick || 0; }
    return hs;
  }

  function renderHome(t) {
    if (t.id === 'home') V.home.norm(t);
    var hs = homeState(t);
    renderCaption(t, hs);
    renderSearchPill(hs);
    renderStatusPill(hs);
    renderControlPanel(hs);
    renderUtils(hs);
    if (S.c.layout === 'list') renderList(hs);
    else { photoMode = null; renderDock(hs); }
    /* Painting the folder glass is decoration. If it ever fails on the set it
       must not take the rest of the pass with it: a throw here used to skip the
       sheet and message updates further down, which left Settings and
       "Leave Home?" pinned over Home with Back apparently doing nothing. */
    try { syncFolderGlass(); } catch (e) {}
    renderAppFocusName(hs);
  }

  function clockText() {
    var d = new Date(), h = d.getHours() % 12 || 12, m = d.getMinutes();
    return h + ':' + (m < 10 ? '0' : '') + m;
  }
  function clockHtml() {
    var text = clockText(), metrics = fontMetrics[homeFont()];
    if (!metrics || !metrics.digitCell) return text;
    return text.replace(/[0-9]/g, function (digit) { return '<span class="clock-digit">' + digit + '</span>'; });
  }
  /* The Dock has no caption block: the time pill holds the clock. The List keeps
     its compact right-aligned clock. */
  function renderCaption(t, hs) {
    caption.className = 'caption';
    if (S.c.layout !== 'list') { setHTML(caption, ''); return; }
    var html = '<span class="clock">' + clockHtml() + '</span>';
    if (S.c.apps !== 'icons' && hs.items[hs.i] && (photoLabel(hs.items[hs.i].id, false).size < 88 || photoLabel(hs.items[hs.i].id, false).ellipsis)) html += '<span class="cap-line full-name">' + esc(app(hs.items[hs.i].id).name) + '</span>';
    setHTML(caption, html);
  }

  /* The pill and its menu are clipped plates over a pre-rendered material field, so
     their glass matches the wallpaper behind them without a live blur. The field is
     registered once per measured plate; the pill is right-anchored, so a temperature
     appearing moves its left edge and the field must follow. */
  /* The capsule borrows the Control Center's glass: a still slice of the lights
     behind it, aligned against the stage, so the bar and the panel share one
     material. Flat grounds have nothing to frost, so the plate shows instead. */
  /* The capsule and the stage frost the same poster, so they change together:
     setPillFrost adopts the title the wallpaper has moved to, and the capsule's
     two layers run the stage's own 600 ms cross-fade. A poster whose soft copy
     is still being built is adopted the moment that copy exists, so the glass
     never shows a slice of artwork that is no longer behind it. */
  function setPillFrost(url) {
    url = url || '';
    /* The slice is built from the poster's image, which arrives on its own
       callback. Asking for the same poster again must still re-place the glass:
       that second call is how a slice built after the move is adopted, and
       returning early here left the capsule on its plain plate until the next
       focus change. */
    if (url === pillFrostUrl) { syncPillGlass(); return; }
    pillFrostUrl = url;
    pillGlassKeyReset();
    syncPillGlass();
  }
  /* A pane that frosts the wallpaper samples a prepared JPEG, so it takes the
     same lift the poster tiles take: brightened once through a canvas and cached
     per field. The prepared field shows until that copy exists, and the panes
     re-sample the moment it lands. */
  var paneFields = {};
  function paneField(look) {
    var url = fieldSrc(look.wall, 'soft'), im;
    if (paneFields[url]) return paneFields[url];
    if (paneFields[url] === undefined) {
      paneFields[url] = url;
      im = new Image();
      im.onload = function () {
        try { paneFields[url] = softTile(im, 1280, 0, 0, GLASS_LIFT); }
        catch (e) { paneFields[url] = url; }
        controlGlassKey = '';
        pillGlassKeyReset();
        refreshHomeGlass();
        syncControlGlass(controlOpen);
        syncPillGlass();
      };
      im.src = url;
    }
    return paneFields[url];
  }
  /* The capsule frosts the poster the stage is showing. */
  function pillGlassSrc() {
    var look;
    /* A live poster with no usable canvas tile must not fall back to a blurred
       slice of the wallpaper that is no longer behind the pill. */
    if (pillFrostUrl) return backdropBlursPanel[pillFrostUrl] || '';
    look = S.c;
    if (!look || look.bg !== 'photo') return '';
    return paneField(look);
  }
  function pillGlassClear(el) {
    clearTimeout(el._retire);
    el._retire = 0;
    el.classList.remove('is-live');
    el.style.backgroundImage = '';
    el._src = '';
    el._key = '';
  }
  function pillGlassKeyReset() {
    [statusPillGlass, statusPillGlassNext].forEach(function (el) { if (el) el._key = ''; });
  }
  /* One slice image per layer, moved by background-position, so nothing filters
     live while the capsule animates. */
  function pillGlassPlace(el, src, x, y) {
    var key;
    if (el._src !== src) {
      el.style.backgroundImage = 'url("' + src + '")';
      el._src = src;
      el._key = '';
    }
    key = src + '|' + x + ',' + y;
    if (el._key === key) return;
    el._key = key;
    el.style.backgroundPosition = lensPos(x, y, el.offsetWidth, el.offsetHeight);
  }
  /* The capsule's frost is placed from layout offsets, so it forces a layout
     read. Doing that inside the key handler made the capsule pay for the whole
     stage being dirty before the frame could be painted; it is measured once
     the frame is out instead, and the two layers cross-fade as usual. */
  var pillGlassFrame = 0;
  function schedulePillGlass() {
    if (pillGlassFrame) return;
    pillGlassFrame = window.requestAnimationFrame(function () {
      pillGlassFrame = 0;
      syncPillGlass();
    });
  }
  /* The capsule's width animates, so the box under the frost is a different
     size on every frame of that move. Sampling it once left the slice at the
     width it was taken at: the frost then travelled with the bar as it grew and
     snapped back onto the wallpaper when the settle timer ran, which read as the
     glass tearing every time the pill widened or shrank. Measured per frame, the
     slice stays glued to the wallpaper and the bar simply grows over it. The
     loop is bounded by the box standing still rather than by a timeout, and it
     writes one background position, so a TV pays nothing once the move ends. */
  var pillGlassLoop = 0, pillGlassW = 0, pillGlassStill = 0, pillGlassFrames = 0;
  function pillGlassFollow() {
    var w;
    pillGlassLoop = 0;
    if (!topPill || !statusPillGlass) return;
    w = topPill.offsetWidth;
    if (!w) return;
    if (w === pillGlassW) {
      if (++pillGlassStill >= 2) return;
    } else {
      pillGlassW = w;
      pillGlassStill = 0;
      syncPillGlass();
    }
    if (++pillGlassFrames > 32) return;
    pillGlassLoop = window.requestAnimationFrame(pillGlassFollow);
  }
  function followPillGlass() {
    clearTimeout(pillGlassTimer);
    pillGlassW = 0;
    pillGlassStill = 0;
    pillGlassFrames = 0;
    if (!pillGlassLoop) pillGlassLoop = window.requestAnimationFrame(pillGlassFollow);
  }
  function syncPillGlass() {
    var src, live, next, box, x, y;
    if (!topPill || !statusPillGlass) return;
    live = pillGlassLive || statusPillGlass;
    next = live === statusPillGlass ? statusPillGlassNext : statusPillGlass;
    src = pillGlassSrc();
    if (!src) {
      if (!pillFrostUrl && S.c && S.c.bg !== 'photo') {
        topPill.classList.remove('has-glass');
        pillGlassClear(statusPillGlass);
        if (statusPillGlassNext) pillGlassClear(statusPillGlassNext);
        pillGlassLive = statusPillGlass;
      }
      return;
    }
    topPill.classList.add('has-glass');
    /* A capsule with no layout box (the List layout hides its glass layers) has
       nothing to sample: leave the slice to the sync that follows. */
    if (!next || !topPill.offsetWidth) return;
    /* Measured in layout space, never from a client rect: the capsule scales and
       slides while a sheet opens or closes, and a slice sampled from a
       transformed box stays offset by a few pixels once the bar is back - which
       read as the frost jumping every time something took focus. Layout offsets
       ignore those transforms, so the slice is glued to the wallpaper whatever
       the bar is doing. */
    box = controlOffset(statusPillGlass);
    x = box.x; y = box.y;
    if (live._src === src) { pillGlassPlace(live, src, x, y); return; }
    /* The new slice fades in over the settled one, on the stage's own timing. */
    clearTimeout(next._retire);
    next._retire = 0;
    next.classList.remove('is-live');
    pillGlassPlace(next, src, x, y);
    next.offsetWidth; /* commit opacity 0 before the fade */
    next.classList.add('is-live');
    pillGlassLive = next;
    clearTimeout(live._retire);
    live._retire = setTimeout(function () { pillGlassClear(live); }, 320);
  }
  function renderStatusPill(hs) {
    var focus, pick, wasExpanded;
    if (!statusPill) return;
    focus = !!hs && hs.zone === 'status';
    pick = focus && hs.pick ? hs.pick : 0;
    wasExpanded = !!topPill && topPill.className.indexOf('is-expanded') >= 0;
    statusPill.className = 'status-pill' + (focus ? ' is-focus' : '');
    statusPill.setAttribute('aria-expanded', focus ? 'true' : 'false');
    if (topPill) topPill.classList.toggle('is-expanded', focus);
    if (pillToolCtrl) pillToolCtrl.className = 'pill-tool' + (focus && pick === 0 ? ' is-pick' : '');
    if (pillToolHome) pillToolHome.className = 'pill-tool' + (focus && pick === 1 ? ' is-pick' : '');
    updateStatusPill();
    /* The slice depends on the capsule's box and on what is behind it: the
       measured box only changes with the focus, the armed tool or the layout,
       while the artwork changes with the focused title or the appearance. */
    if (statusPill._sig !== S.c.layout + '|' + pick + '|' + (focus ? 1 : 0) + '|' +
        pillFrostUrl + '|' + S.c.bg + '|' + S.c.wall + '|' + S.c.material) {
      statusPill._sig = S.c.layout + '|' + pick + '|' + (focus ? 1 : 0) + '|' +
        pillFrostUrl + '|' + S.c.bg + '|' + S.c.wall + '|' + S.c.material;
      syncPillGlass();
    }
    /* The capsule's width animates, so the frost keeps following the box for as
       long as the box is still changing size. */
    if (focus !== wasExpanded) followPillGlass();
  }
  function controlTile(c, i) {
    var shape = c.shape === 'hero' ? 'ctrl-hero' : c.shape === 'wide' ? 'ctrl-wide' : c.shape === 'round' ? 'ctrl-round' : 'ctrl-pill';
    var copy = c.shape === 'round' ? '' :
      '<span class="ctrl-copy"><span class="ctrl-label">' + esc(c.label) + '</span>' +
      (c.shape === 'pill' || c.shape === 'wide' ? '<span class="ctrl-sub" data-sub="' + c.key + '">' + esc(c.sub) + '</span>' : '') +
      '</span>';
    return '<button type="button" tabindex="-1" role="menuitem" class="ctrl-tile ' + shape + '" data-z="menu" data-i="' + i +
      '" data-action="ctrl.' + c.key + '" aria-label="' + esc(c.label) + '">' +
      '<span class="ctrl-glass" aria-hidden="true"></span><span class="ctrl-veil" aria-hidden="true"></span>' +
      icon(c.ico) + copy + '</button>';
  }
  function buildControlPanel() {
    if (!controlGrid) return;
    var main = '', rounds = '';
    CONTROLS.forEach(function (c, i) {
      if (c.shape === 'round') rounds += controlTile(c, i);
      else main += controlTile(c, i);
    });
    setHTML(controlGrid, main + '<div class="ctrl-rounds">' + rounds + '</div>');
    updateControlStatus();
  }
  function controlSub(key, text) {
    if (!controlGrid) return;
    var el = controlGrid.querySelector('[data-sub="' + key + '"]');
    if (el && el.textContent !== text) el.textContent = text;
  }
  function controlLabel(key, text) {
    if (!controlGrid || !text) return;
    var el = controlGrid.querySelector('[data-sub="' + key + '"]');
    if (!el) return;
    var label = el.parentNode.querySelector('.ctrl-label');
    if (label && label.textContent !== text) label.textContent = text;
  }
  /* One tile lights up: the glass stays white, the mark takes the accent. */
  function controlOn(key, on) {
    if (!controlGrid) return;
    var el = controlGrid.querySelector('[data-action="ctrl.' + key + '"]');
    if (el) el.classList.toggle('is-on', !!on);
  }
  function updateControlStatus() {
    if (!controlGrid) return;
    var weather = statusWeather(), city = '';
    if (window.CleanFrameStatus) {
      var st = CleanFrameStatus.get();
      city = (st && st.city) ? String(st.city) : '';
    }
    var wifi = radioState.ssid ||
      (radioState.network === 'ETHERNET' ? 'Ethernet' :
       radioState.network === 'WIFI' ? 'Connected' : 'Not connected');
    var bt = radioState.bluetooth === false ? 'Not available' : 'Sound settings';
    var weatherSub = weather.temp ? (weather.label ? weather.temp + ' · ' + weather.label : weather.temp) : 'Tap to update';
    controlSub('wifi', wifi);
    controlSub('bluetooth', bt);
    controlSub('weather', weatherSub);
    controlLabel('weather', city);
    /* A live radio is the panel's only colour: the tile stays white glass and
       the mark turns blue, like the reference's connected Wi-Fi. Tizen exposes
       the network type and whether Bluetooth exists, not a radio switch, so
       that is what "on" means here. */
    controlOn('wifi', !!radioState.ssid || radioState.network === 'WIFI' || radioState.network === 'ETHERNET');
    controlOn('bluetooth', radioState.bluetooth === true);
  }
  function refreshRadios() {
    if (!window.FrameDevice || !FrameDevice.radios) return;
    FrameDevice.radios(function (err, radios) {
      if (err || !radios) return;
      radioState = radios;
      updateControlStatus();
    });
  }
  /* Each tile is its own glass object: the pre-rendered wallpaper blur behind
     that tile, a light tint over it, and the tile's own rounded clip. The blur
     is a still image sampled by background-position, so nothing filters live
     while the panel animates. */
  function controlGlassSrc() {
    /* A poster behind Home is what the panel frosts: the light Control Center
       copy stays legible through the glass. A photo wallpaper uses the field
       the app already prepares for the drawer's material. */
    /* If the scene is a poster, never frost its panes with the wallpaper
       field; on canvas failure they simply use the normal translucent plate. */
    if (backdropUrl) return backdropBlursPanel[backdropUrl] || '';
    var look = S.c;
    if (!look || look.bg !== 'photo') return '';
    return paneField(look);
  }
  /* Where a pane of glass sits on the stage, read from layout offsets rather
     than client rects. A focused tile is scaled and the capsule shrinks while a
     sheet is open, so rects would sample a transformed box and leave the slice
     a few pixels off; offsets ignore all of that. */
  function controlOffset(el) {
    var x = 0, y = 0, n = el;
    while (n && n !== stage) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
    return { x: x, y: y, w: el.offsetWidth, h: el.offsetHeight };
  }
  function syncControlGlass(open) {
    var src, tiles, key, width, height;
    if (!controlPanelEl || !controlGrid) return;
    src = controlGlassSrc();
    controlPanelEl.classList.toggle('has-glass', !!src);
    tiles = controlGrid.querySelectorAll('.ctrl-tile');
    Array.prototype.forEach.call(tiles, function (tile) {
      var glass = tile.querySelector('.ctrl-glass');
      if (!glass) return;
      if (src) {
        if (glass._src !== src) { glass.style.backgroundImage = 'url("' + src + '")'; glass._src = src; }
      } else if (glass._src) {
        glass.style.backgroundImage = '';
        glass._src = '';
      }
    });
    if (!open) return;
    width = controlPanelEl.offsetWidth; height = controlPanelEl.offsetHeight;
    key = src + '|' + width + 'x' + height;
    if (controlGlassKey === key) return;
    controlGlassKey = key;
    Array.prototype.forEach.call(tiles, function (tile) {
      var glass = tile.querySelector('.ctrl-glass'), box;
      if (!glass) return;
      box = controlOffset(tile);
      glass.style.backgroundPosition = lensPos(box.x, box.y, glass.offsetWidth, glass.offsetHeight);
    });
  }
  /* ---------- Folders, as glass ----------
     tvOS draws a folder as a slab of frosted glass: the wallpaper beneath it,
     blurred and lifted, with a white tint and a lit edge. Live blur stays off the
     animation path, so a folder follows the Control Center's rule: the app
     already holds a blurred slice of the poster (`controlGlassSrc`), and the
     folder samples the part of it that sits under the tile (`lensPos`). One
     image, no filter, nothing recomputed per frame - the slice is painted once
     and travels with the tile. */
  function paintGlass(g, x, y, w, h, src) {
    if (!g) return;
    if (!src) {
      if (g._src) { g.style.backgroundImage = ''; g._src = ''; }
      g.classList.remove('is-on');
      return;
    }
    if (g._src !== src) { g.style.backgroundImage = 'url("' + src + '")'; g._src = src; }
    g.style.backgroundPosition = lensPos(x, y, w, h);
    g.classList.add('is-on');
  }
  function syncFolderGlass() {
    var src = controlGlassSrc(), cards, i, g, box, panel, pen, stageW, stageH;
    cards = stage.querySelectorAll('.appletv-card.is-folder-card');
    for (i = 0; i < cards.length; i++) {
      g = cards[i].querySelector('.folder-glass');
      if (!g) continue;
      box = controlOffset(g);
      paintGlass(g, box.x, box.y, box.w, box.h, src);
    }
    if (folderEl && folderEl.classList.contains('is-open') && folderPanelEl) {
      panel = folderPanelEl.querySelector('[data-glass="panel"]');
      if (panel) {
        stageW = stage.offsetWidth; stageH = stage.offsetHeight;
        pen = { x: (stageW - folderPanelEl.offsetWidth) / 2, y: (stageH - folderPanelEl.offsetHeight) / 2 };
        paintGlass(panel, pen.x, pen.y, folderPanelEl.offsetWidth, folderPanelEl.offsetHeight, src);
      }
    }
  }
  /* The ported Control Center borrows the launcher's own glass: the same
     pre-blurred wallpaper slice, positioned as a lens under each tile, so a
     ported capsule is the same material as the panel beside it. */
  window.CleanFrameGlass = { src: controlGlassSrc, lens: lensPos, offset: controlOffset };

  function renderControlPanel(hs) {
    if (!controlPanelEl || !controlGrid) return;
    var open = !!hs && hs.zone === 'statusmenu', mi = open ? hs.mi : -1;
    /* The panel is built the first time it is wanted, not at start: it is hidden
       behind the capsule, and its eight tiles and icons were part of the cold
       start for something the viewer may never open. */
    if (open && !controlGrid.firstChild) buildControlPanel();
    if (open && !controlOpen) {
      refreshRadios();
      /* Paint the radios the last read left behind so the row never opens on
         stale text while the fresh read is in flight. */
      updateControlStatus();
      /* Same one-shot entrance as the Home sheet: the tiles rise into the panel
         as it springs open, then the class goes away. */
      controlPanelEl.classList.add('is-enter');
      clearTimeout(ctrlEnterTimer);
      ctrlEnterTimer = setTimeout(function () {
        if (controlPanelEl) controlPanelEl.classList.remove('is-enter');
      }, 760);
    } else if (!open && controlOpen) {
      clearTimeout(ctrlEnterTimer);
      controlPanelEl.classList.remove('is-enter');
    }
    controlOpen = open;
    /* Either sheet replaces the capsule with the small status row. */
    if (homeTopRight) homeTopRight.classList.toggle('is-panel', open || homeOpen);
    controlPanelEl.classList.toggle('is-open', open);
    controlPanelEl.setAttribute('aria-hidden', open ? 'false' : 'true');
    Array.prototype.forEach.call(controlGrid.querySelectorAll('.ctrl-tile'), function (tile, i) {
      tile.classList.toggle('is-focus', i === mi);
    });
    syncControlGlass(open);
  }

  function utilBtn(z, i, action, inner, extra, name) {
    return '<button type="button" tabindex="-1" class="u' + (extra || '') + '" data-z="' + z + '" data-i="' + i + '" data-action="' + action + '" aria-label="' + esc(name) + '"><span class="u-content">' + inner + '</span></button>';
  }
  function renderUtils(hs) {
    /* Settings, Smart Home and Art Mode moved behind the time pill in the Dock.
       The List keeps its own bottom-right column. */
    if (S.c.layout === 'dock') {
      utilsEl.className = 'utils';
      setHTML(utilsEl, '');
      renderUtilFocusLabel(null);
      renderUtilityLens(null, false);
      return;
    }
    var html = '', style = hs.mode === 'arrange' && S.c.controls !== 'text' ? 'both' : S.c.controls;
    var iconsOnly = style === 'icons', U = utils(), focused = null;
    utilsEl.className = 'utils quiet-utils is-' + style + (hs.zone === 'util' || hs.zone === 'ctl' ? ' is-awake' : '');
    U.forEach(function (u, i) { html += utilBtn('util', i, 'util.' + u, icon(UTIL[u][1], '', true) + '<span class="u-label">' + UTIL[u][0] + '</span>', '', UTIL[u][0]); });
    setHTML(utilsEl, html);
    Array.prototype.forEach.call(utilsEl.querySelectorAll('.u'), function (b) {
      var z = b.getAttribute('data-z'), focus = hs.zone === z && hs.u === Number(b.getAttribute('data-i'));
      b.className = b.className.replace(/\s+is-focus/g, '') + (focus ? ' is-focus' : '');
      if (focus) focused = b;
    });
    renderUtilFocusLabel(iconsOnly ? focused : null);
    renderUtilityLens(focused, iconsOnly);
  }
  function renderUtilFocusLabel(button) {
    var text, key, r, sr, scale, width, x;
    if (!button) { utilFocusLabel.className = 'util-focus-label'; utilFocusKey = ''; return; }
    text = S.err ? 'Not saved. OK tries again.' : button.getAttribute('aria-label');
    key = button.getAttribute('data-action') + '|' + text + '|' + homeFont();
    if (key !== utilFocusKey) {
      utilFocusLabel.className = 'util-focus-label'; utilFocusLabel.textContent = text;
      utilFocusLabel.offsetWidth;
      utilFocusKey = key;
    }
    r = button.getBoundingClientRect(); sr = sceneEl.getBoundingClientRect(); scale = sr.width / 1920 || 1;
    width = Math.ceil(textWidth(text, 28, 500, -.2) + 8); x = (r.left + r.width / 2 - sr.left) / scale - width / 2;
    if (S.c.layout === 'list') x = 1730 - width;
    utilFocusLabel.style.width = width + 'px'; utilFocusLabel.style.left = clamp(x, 112, 1808 - width) + 'px';
    utilFocusLabel.style.top = ((S.c.layout === 'list' ? (r.top + r.height / 2 - sr.top) / scale - 19 : 140) + fontShift('ui', 28)) + 'px';
    utilFocusLabel.className = 'util-focus-label is-on';
  }
  function renderUtilityLens(button, iconsOnly) {
    var r, label, sr, scale, x, y, width, key, el;
    if (!button || S.c.focus !== 'glass') {
      utPlates.forEach(function (plateEl) { plateEl.className = 'ph-plate ut-lens is-outgoing'; });
      utPlateKey = null;
      return;
    }
    r = button.getBoundingClientRect(); sr = sceneEl.getBoundingClientRect(); scale = sr.width / 1920 || 1;
    y = (r.top - sr.top) / scale + 2;
    if (S.c.layout === 'list') {
      label = iconsOnly ? utilFocusLabel : button.querySelector('.u-label');
      x = (label.getBoundingClientRect().left - sr.left) / scale - 24;
      width = 1800 - x;
    } else {
      // Dock icons keep a fixed lens; the separate caption cannot overlap its neighbours.
      x = (r.left - sr.left) / scale; width = r.width / scale;
    }
    key = button.getAttribute('data-action') + '|' + x + '|' + y + '|' + width;
    if (key !== utPlateKey) {
      utPlates[utPlateIndex].className = 'ph-plate ut-lens is-outgoing';
      utPlateIndex = 1 - utPlateIndex; el = utPlates[utPlateIndex];
      el.className = 'ph-plate ut-lens is-preparing';
      el.style.width = width + 'px'; el.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
      fieldTransform(utFields[utPlateIndex], x, y, width, 60);
      el.offsetWidth;
      utPlateKey = key;
    }
    fieldTransform(utFields[utPlateIndex], x, y, width, 60);
    utPlates[utPlateIndex].className = 'ph-plate ut-lens is-current on-focus';
  }
  function renderAppFocusName(hs) {
    var it = hs.items[hs.i], width, x, y, placement;
    if (S.c.apps !== 'icons' || hs.mode !== 'browse' || hs.zone !== 'apps' || !it) { appFocusName.className = 'app-focus-name'; return; }
    appFocusName.textContent = app(it.id).name;
    width = Math.min(S.c.layout === 'list' ? 1056 : 1640, Math.ceil(textWidth(app(it.id).name, S.c.layout === 'list' ? 40 : 36, 500, -.6, 'primary') + 8));
    appFocusName.style.width = width + 'px';
    if (S.c.layout === 'list') {
      x = 280; placement = phFields[photoPlateIndex]._placement;
      y = placement.y + placement.height / 2 - 24;
    } else {
      x = clamp(dockAnchorCenter - width / 2, 140, 1780 - width); y = 932;
    }
    appFocusName.style.left = x + 'px'; appFocusName.style.top = (y + fontShift('primary', S.c.layout === 'list' ? 40 : 36)) + 'px';
    appFocusName.className = 'app-focus-name is-on';
  }

  function dockGeom(n) {
    var m = DOCK_MODES[S.c.apps], vis = Math.max(1, Math.min(5, n)), shelfW = vis * m.pitch - 8, w = shelfW + 32;
    var broad = S.geom === 'broad' && n > 5;
    if (n < 0) { w = 912; shelfW = 880; }
    else if (broad) { w = 1728; shelfW = 1696; }
    return { x: Math.round((1920 - w) / 2), y: 908 - m.th - 32, h: m.th + 32, w: w, shelf: shelfW, vis: vis, broad: broad, empty: n < 0, tw: m.tw, th: m.th, pitch: m.pitch };
  }
  /* Five centred: the window moves one tile when focus passes an edge. Broad: keep a
     148px glimpse of the neighbour, as the current dock does. */
  function dockOffset(n, i, g) {
    var off, left, first, glimpse = g.tw / 2;
    if (g.broad) {
      off = scroll.off * g.pitch; left = i * g.pitch;
      if (left - off < (i > 0 ? glimpse : 0)) off = left - (i > 0 ? glimpse : 0);
      if (left + g.tw - off > g.shelf - (i < n - 1 ? glimpse : 0)) off = left + g.tw - g.shelf + (i < n - 1 ? glimpse : 0);
      off = clamp(off, 0, Math.max(0, n * g.pitch - 8 - g.shelf));
      if (!S.reflow) { scroll.off = off / g.pitch; scroll.first = Math.round(scroll.off); }
      return off;
    }
    first = clamp(scroll.first, 0, Math.max(0, n - g.vis));
    if (i < first) first = i;
    if (i > first + g.vis - 1) first = i - g.vis + 1;
    if (!S.reflow) { scroll.first = first; scroll.off = first; }
    return first * g.pitch;
  }
  function dockTileHtml(it, full) {
    var a, body;
    if (it.kind === 'add') return '<span class="add">' + icon('plus') + '</span><span class="label">' + (full ? 'Home is full' : 'Add app') + '</span>';
    a = app(it.id);
    body = S.c.apps === 'text' ? '' : appMark(a, S.c.apps === 'icons' ? 136 : 120, S.c.apps === 'icons' ? 88 : 72, S.c.apps === 'icons' ? 72 : 58);
    return body + (S.c.apps === 'icons' ? '' : '<span class="label" style="font-size:' + dockLabelSize(a.id) + 'px;top:' + ((S.c.apps === 'text' ? 28 : 128) + fontShift('primary', dockLabelSize(a.id))) + 'px"><span class="label-ink">' + esc(a.name) + '</span></span>') + '<span class="nudge nudge-l">' + icon('left') + '</span><span class="nudge nudge-r">' + icon('right') + '</span>';
  }
  /* A wide label can reach the shelf before its icon. Check the rendered icon box,
     including during the track's 180ms transition, so both disappear together. */
  function syncDockEdges() {
    var broad = S.c.layout === 'dock' && S.geom === 'broad', clip = shelf.getBoundingClientRect(), changes = [];
    Array.prototype.forEach.call(track.querySelectorAll('.tile'), function (tile) {
      var content = tile.querySelector(S.c.apps === 'text' ? '.label-ink' : '.mark'), r = content ? content.getBoundingClientRect() : null;
      var outside = broad && r && (r.right <= clip.left || r.left >= clip.right);
      var cls = tile.className.replace(/\s+is-outside-icon/g, '') + (outside ? ' is-outside-icon' : '');
      if (tile.className !== cls) changes.push({ tile: tile, cls: cls });
    });
    changes.forEach(function (change) { change.tile.className = change.cls; });
  }
  function trackDockEdges() {
    dockEdgeFrame = 0;
    if (S.c.layout !== 'dock' || S.geom !== 'broad') return;
    syncDockEdges();
    if (Date.now() < dockEdgeUntil) dockEdgeFrame = window.requestAnimationFrame(trackDockEdges);
  }


  /* ---------- Apple TV tvOS Multi-Row Dock ---------- */
  /* The dock is now the full app drawer: every app installed on the TV, in the
     order the owner arranged on Home, then the rest alphabetically, six to a row.
     Rows are paged vertically by the existing scroll transform, so the list can
     grow past the old 15-app ceiling. */
  /* The rows are asked for eight times in one render pass - by the backdrop,
     the dwell timer, the prefetch and the dock itself - and each call rebuilt the
     owner order and re-ran the installed-app filter. One key of the inputs that
     can change it makes that a single build per press instead of eight. */
  var atvRowCache = { key: '', rows: null };
  function getAppleTVAppRows() {
    var foldersKey = (S.c.folders || []).map(function (f) { return f.id + ':' + f.apps.join('+'); }).join(';');
    var cacheKey = (catalog.loaded ? '1' : '0') + '|' + S.c.home.join(',') + '|' + ALPHA.join(',') + '|' + foldersKey;
    if (atvRowCache.rows && atvRowCache.key === cacheKey) return atvRowCache.rows;
    var seen = {}, ordered = [], installed = {}, loaded = catalog.loaded, inFolder = {};
    function add(a) { if (a && a.id && !seen[a.id]) { seen[a.id] = true; ordered.push(a); } }
    var i;
    /* An app inside a folder is already on Home, behind the folder's face. It is
       not repeated in the rows below: the drawer is a home screen, not an app
       list with copies. */
    (S.c.folders || []).forEach(function (f) { (f.apps || []).forEach(function (id) { inFolder[id] = true; }); });
    /* Home and Settings are in the saved order now, so they are added by the
       loop below in whatever place they were put. They are never filtered out
       with the TV's apps: they have no package behind them. */
    if (loaded) {
      for (i = 0; i < ALPHA.length; i++) {
        var ia = app(ALPHA[i]);
        if (ia) installed[ia.appId || ia.id] = true;
      }
    }
    for (i = 0; i < S.c.home.length; i++) {
      var ha = app(S.c.home[i]);
      if (!ha) continue;
      if (loaded && !ha.builtin && !ha.folder && !installed[ha.appId || ha.id]) continue;
      add(ha);
    }
    if (!loaded) {
      for (i = 0; i < PRIMARY_APPS.length; i++) if (!inFolder[PRIMARY_APPS[i].id]) add(PRIMARY_APPS[i]);
    } else {
      /* Every app the TV listed belongs in the drawer, even if it was never
         placed on Home. */
      for (i = 0; i < ALPHA.length; i++) if (!inFolder[ALPHA[i]]) add(app(ALPHA[i]));
    }
    var rows = [], perRow = 6;
    for (i = 0; i < ordered.length; i += perRow) rows.push(ordered.slice(i, i + perRow));
    if (!rows.length) rows = [PRIMARY_APPS.slice(0, perRow)];
    atvRowCache.key = cacheKey;
    atvRowCache.rows = rows;
    return rows;
  }

  /* The app's own tile art: full-bleed artwork, its brand wordmark, its native
     icon or its initials. The dock and the opening card share this, so the mark
     that grows out of a tile is the exact mark that fills the screen. */
  /* The folder tile: a 3x3 window of the apps inside, exactly the shape the
     reference shows. Each mini is the app's own card, scaled down through its
     own transform, so a folder needs no second drawing of every icon. On a row
     whose marks are still deferred the folder is left as a bare plate, like any
     other tile: nine decodes must never be pulled in ahead of the first frame. */
  function folderCardHtml(f, skipMark) {
    var members = skipMark ? [] : folderMembers(f), html = '', i, m, art;
    for (i = 0; i < 9; i++) {
      m = members[i];
      if (!m) { html += '<span class="folder-mini"></span>'; continue; }
      /* A mini is the app's own artwork laid flat, not a whole card scaled down.
         A nested card meant nine extra 249x149 layers inside a tile that is
         itself scaled on focus, and that re-rasterising is what made the icons
         inside a focused folder swell and wobble. */
      art = appTileArt(m.brand || m.id, m.name);
      html += art
        ? '<span class="folder-mini"><i class="folder-mini-art" style="background-image:url(\'' + esc(art) + '\')"></i></span>'
        : '<span class="folder-mini"><i class="folder-mini-art is-mark">' + esc(m.name.slice(0, 2).toUpperCase()) + '</i></span>';
    }
    return '<div class="appletv-card is-folder-card">' +
      '<i class="folder-glass" aria-hidden="true"></i>' + html +
      '<span class="appletv-sheen" aria-hidden="true"></span></div>';
  }
  function appCardHtml(a, skipMark) {
    if (a.folder) return folderCardHtml(a, skipMark);
    var brand = a.brand || a.id;
    var art = appTileArt(brand, a.name);
    var logoHtml = '';
    /* A tile two rows below the viewport is drawn as its plate only: its mark is
       added the moment that row comes into range. Nothing is ever seen without
       it, and the launcher does not spend the first second loading every icon in
       the drawer before the first frame. */
    if (skipMark) {
      logoHtml = '';
    } else if (art) {
      /* `decoding="async"` keeps a dock mark's decode off the frame that draws
         the row where the engine honours it, and is ignored where it does not. */
      logoHtml = '<img src="' + esc(art) + '" class="tile-art" alt="" draggable="false" decoding="async">';
    } else if (brand === 'settings') {
      /* Full-bleed plate and gear at the tile's own 5:3 ratio. The square
         `settings.png` used to be forced into a 158x94 box: that squashed the
         gear and left dark card showing around it, so the icon only ever filled
         the middle of the tile. */
      logoHtml = '<img src="assets/icons/settings-tile.png" class="app-logo" style="width:100%;height:100%;object-fit:cover;transform:none;" alt="Settings">';
    } else if (brand === 'home' || brand === 'homecontrol') {
      logoHtml = '<img src="assets/icons/home.png" class="app-logo" style="width:118px;height:118px;" alt="Home">';
    } else if (brand === 'netflix') {
      logoHtml = '<img src="assets/icons/netflix.svg" class="app-logo" style="width:115px;height:115px;" alt="Netflix">';
    } else if (brand === 'youtube') {
      logoHtml = '<img src="assets/icons/youtube.svg" class="app-logo" style="width:145px;height:98px;" alt="YouTube">';
    } else if (brand === 'appletv') {
      logoHtml = '<img src="assets/icons/appletv.svg" class="app-logo" style="width:175px;height:70px;" alt="Apple TV">';
    } else if (brand === 'disneyplus') {
      logoHtml = '<img src="assets/icons/disneyplus.svg" class="app-logo" style="width:175px;height:95px;" alt="Disney+">';
    } else if (brand === 'primevideo') {
      logoHtml = '<img src="assets/icons/primevideo.svg" class="app-logo" style="width:185px;height:56px;" alt="Prime Video">';
    } else if (brand === 'stremio') {
      logoHtml = '<img src="assets/icons/stremio.svg" class="app-logo" style="width:120px;height:120px;" alt="Stremio">';
    } else if (brand === 'hotstar' || brand === 'jiohotstar') {
      /* Full-bleed gradient artwork: fill the tile so its edge colour never
         clashes with the card background. */
      logoHtml = '<img src="assets/icons/jiohotstar.png" class="app-logo" style="width:100%;height:100%;object-fit:cover;transform:none;" alt="JioHotstar">';
    } else if (brand === 'sonyliv') {
      /* Full-bleed artwork as well; fill the tile instead of floating on it. */
      logoHtml = '<img src="assets/icons/sonyliv.png" class="app-logo" style="width:100%;height:100%;object-fit:cover;transform:none;" alt="Sony LIV">';
    } else if (brand === 'applemusic') {
      logoHtml = '<img src="assets/icons/applemusic.svg" class="app-logo" style="width:115px;height:115px;" alt="Apple Music">';
    } else if (brand === 'spotify') {
      logoHtml = '<img src="assets/icons/spotify.svg" class="app-logo" style="width:115px;height:115px;" alt="Spotify">';
    } else if (brand === 'samsungtvplus') {
      logoHtml = '<img src="assets/icons/samsungtvplus.svg" class="app-logo" style="width:160px;height:88px;" alt="TV Plus">';
    } else if (brand === 'moonlight') {
      logoHtml = '<img src="assets/icons/moonlight.svg" class="app-logo" style="width:115px;height:115px;" alt="Moonlight">';
    } else if (brand === 'nuviotv') {
      logoHtml = '<img src="assets/icons/nuviotv.png" class="app-logo" style="width:135px;height:135px;object-fit:contain;" alt="Nuvio">';
    } else if (brand === 'abciview') {
      logoHtml = '<img src="assets/icons/abciview.svg" class="app-logo" style="width:140px;height:88px;" alt="ABC iview">';
    } else if (brand === 'sbs') {
      logoHtml = '<img src="assets/icons/sbs.svg" class="app-logo" style="width:115px;height:88px;" alt="SBS On Demand">';
    } else if (a.icon) {
      logoHtml = '<img src="' + esc(a.icon) + '" class="app-logo" style="width:105px;height:105px;border-radius:24px;" alt="' + esc(a.name) + '">';
    } else {
      var initials = (a.name || 'App').slice(0, 2).toUpperCase();
      if (a.icon) logoHtml = '<img src="' + esc(a.icon) + '" class="app-logo" style="width:104px;height:104px;" alt="' + esc(a.name) + '">';
      else
      logoHtml = '<span style="font-size:54px;font-weight:700;letter-spacing:1px;color:#fff;">' + esc(initials) + '</span>';
    }

    return '<div class="appletv-card appletv-card-' + esc(brand) + (art ? ' has-art' : '') + '">' +
      logoHtml +
      /* A specular sweep that crosses the glass once as the card takes focus:
         the same highlight the reference tiles carry, and cheaper than reading
         the pointer. */
      '<span class="appletv-sheen" aria-hidden="true"></span>' +
    '</div>';
  }

  /* How far a tile sits from the middle of its row, from -1 to 1. The card's
     logo is pushed the opposite way by that much, which is what gives the tile
     its depth: the artwork stays flat and the mark in front of it turns. */
  function renderAppleTVTileHtml(a, r, c, isFocus, n, skipMark) {
    var brand = a.folder ? 'folder' : (a.brand || a.id);
    /* The focus glow is its own layer so it can be faded in instead of being
       repainted: see `.appletv-glow` in style.css. */
    return '<div class="appletv-tile appletv-tile-' + esc(brand) + (a.folder ? ' is-folder' : '') + (isFocus ? ' is-focus' : '') + '" data-z="app" data-row="' + r + '" data-col="' + c + '" data-id="' + esc(a.id) + '">' +
      '<span class="appletv-glow" aria-hidden="true"></span>' +
      appCardHtml(a, skipMark) +
      '<span class="appletv-label">' + esc(a.name) + '</span>' +
    '</div>';
  }

  function renderDock(hs) {
    if (!appletvDockScroll) return;
    var rows = getAppleTVAppRows();
    var curRow = S.appleTvRow || 0;
    var rowApps = rows[curRow] || rows[0];
    var curCol = clamp(S.appleTvCol || 0, 0, rowApps.length - 1);
    var isAppsFocused = (hs.zone === 'apps');

    // Sync selected app for QA / launch
    var curApp = rowApps[curCol];
    if (curApp) setSel(curApp.id);

    /* Marks are built one row past the focused one. A row below that is a plate
       with no artwork until it comes into range, which keeps the drawer's icons
       out of the launcher's first second without ever showing a blank tile. */
    /* Six decodes on the first frame, twelve after it. On the reference set a
       dock mark is a full-bleed photograph, and the row below the focused one
       was being decoded before the launcher had shown anything; that work is
       what the start-up wait was made of. `firstPaintDone` is flipped on the
       first idle slot after the stage is up, and the row fills in then. */
    var artLimit = Math.min(rows.length - 1, curRow + (firstPaintDone ? 1 : 0));
    function rowInner(rApps, r) {
      var html = '', c, isFocus;
      if (r === 0) html += '<div class="appletv-first-row-glass" aria-hidden="true"></div>';
      for (c = 0; c < rApps.length; c++) {
        isFocus = isAppsFocused && (r === curRow) && (c === curCol);
        html += renderAppleTVTileHtml(rApps[c], r, c, isFocus, rApps.length, r > artLimit);
      }
      return html;
    }
    var needsArt = false;
    var existingRows = appletvDockScroll.querySelectorAll('.appletv-row');
    if (existingRows && existingRows.length === rows.length) {
      for (var r = 0; r < rows.length; r++) {
        var rEl = existingRows[r];
        var rowKey = rows[r].map(function (x) { return x.id; }).join(',');
        /* The order changed under a row of the same length (a move, a new folder,
           an app put inside one): its tiles are a different set now, so it is
           rebuilt even though its artwork is already there. Without this, a
           reorder only updated the focus class and the drawer kept the old six
           tiles - the data changed but the icons did not. */
        if (rEl.getAttribute('data-key') !== rowKey) {
          rEl.innerHTML = rowInner(rows[r], r);
          rEl.setAttribute('data-key', rowKey);
          rEl.setAttribute('data-art', r <= artLimit ? '1' : '0');
          if (r > artLimit) needsArt = true;
        } else if (r <= artLimit && rEl.getAttribute('data-art') !== '1') {
          /* This row just came into range: give it its marks. */
          /* Filled only once the drawer has come to rest. Doing it on the next
             tick put six full-bleed marks into a row that was still travelling,
             and rebuilding a row replaces the tiles that carry focus - the flash
             the drawer showed the first time it opened over a poster. */
          if (dockArtDue && !motionFast) {
            rEl.innerHTML = rowInner(rows[r], r);
            rEl.setAttribute('data-art', '1');
          } else {
            needsArt = true;
          }
          /* The rebuilt row owns new elements. The remembered tile is left as it
             is: if it lived in this row it is now detached, and the resolution
             below replaces it with the live one. Clearing the reference instead
             would orphan the tile that still carries focus. */
        }
        var isRowActive = (r === curRow);
        var expectedRowClass = 'appletv-row' + (isRowActive ? ' is-active' : '') + (r === 0 ? ' is-top-row' : '');
        if (rEl.className !== expectedRowClass) rEl.className = expectedRowClass;
      }
    } else {
      var html = '';
      for (var r = 0; r < rows.length; r++) {
        html += '<div class="appletv-row' + (r === curRow ? ' is-active' : '') + (r === 0 ? ' is-top-row' : '') + '" data-row="' + r + '" data-key="' + esc(rows[r].map(function (x) { return x.id; }).join(',')) + '" data-art="' + (r <= artLimit ? 1 : 0) + '">';
        html += rowInner(rows[r], r);
        html += '</div>';
      }
      setHTML(appletvDockScroll, html);
    }

    if (needsArt) scheduleDockArtFill();
    var dockCls = 'appletv-dock-scroll' + (editMode ? ' is-editing' : '');
    if (appletvDockScroll.className !== dockCls) appletvDockScroll.className = dockCls;

    /* Focus and pick-up move one tile at a time. Walking every tile of every row
       on each press wrote a class list and forced a style recalculation for the
       whole drawer on every key, which is what made a held scroll drag on the
       set; two elements are all that can actually change. */
    /* Read the row back from the live list: the full-rebuild path above replaced
       every row element, so `existingRows` can belong to the old tree. */
    var focusRowEl = appletvDockScroll.querySelector('.appletv-row.is-active');
    var focusTiles = focusRowEl ? focusRowEl.querySelectorAll('.appletv-tile') : null;
    setDockFocusTile(isAppsFocused && focusTiles ? focusTiles[curCol] || null : null);
    setDockHeldTile(editMode && holdId ? appletvDockScroll.querySelector('.appletv-tile[data-id="' + holdId + '"]') : null);

    /* The drawer's frost is the poster's own pre-rendered soft copy (bdBlur),
       which the frozen stage class shows. This layer is only the veil over it
       for legibility - no filter, because a live one is recomposited every
       frame on the set and the drawer repaints while it scrolls. */
    if (appletvFullscreenBlur) {
      var blurCls = curRow > 0 ? 'appletv-fullscreen-blur is-visible' : 'appletv-fullscreen-blur';
      if (appletvFullscreenBlur.className !== blurCls) appletvFullscreenBlur.className = blurCls;
    }


    /* The dock's own row sits a 229 px step below the capsule (149 px of tile
       and an 80 px gutter, which is the peek the dock capture shows); every row
       past it is a 260 px step, the grid spacing from Apple's home screen. Kept
       in step with `.appletv-row` in style.css. */
    var scrollY = curRow ? 229 + (curRow - 1) * 260 : 0;
    var scrollT = scrollY ? 'translate3d(0, ' + (-scrollY) + 'px, 0)' : 'translate3d(0, 0, 0)';
    /* Writing the same transform every press still costs a style pass on the
       set; only the frame that actually changes the row touches it. */
    if (appletvDockScroll.style.transform !== scrollT) appletvDockScroll.style.transform = scrollT;

    if (appletvScrollCue) {
      appletvScrollCue.style.display = (curRow > 0 && curRow < rows.length - 1) ? 'flex' : 'none';
    }
  }

  function legacyRenderDock(hs) {
    var items = hs.items, n = items.length, empty = hs.mode !== 'arrange' && !n, g = dockGeom(empty ? -1 : n);
    var anchor = clamp(hs.i, 0, Math.max(0, n - 1)), off = empty ? 0 : dockOffset(n, anchor, g);
    var full = hs.arr ? live(hs.arr.slots).length >= CAP : false, ns = hs.arr ? hs.arr.slots.length : n;
    var tileFocus = hs.zone === 'apps' || hs.zone === 'tiles', tileSel = hs.zone === 'util' || hs.zone === 'act' || hs.zone === 'ctl' || hs.zone === 'preview';
    var focusItem = items[anchor], s, ax, label, width;

    dock.className = 'dock' + (empty ? ' is-empty' : '');
    dock.style.left = g.x + 'px'; dock.style.top = g.y + 'px'; dock.style.width = g.w + 'px'; dock.style.height = g.h + 'px';
    dock.style.setProperty('--tile-w', g.tw + 'px'); dock.style.setProperty('--tile-h', g.th + 'px'); dock.style.setProperty('--dock-h', g.h + 'px');
    dock.style.setProperty('--nudge-top', ((g.th - 48) / 2) + 'px');
    dockAnchorCenter = g.x + 16 + anchor * g.pitch - off + g.tw / 2;
    IMG.mat.style.left = (-g.x) + 'px'; IMG.mat.style.top = (-g.y) + 'px';
    IMG.mat.style.transformOrigin = '960px ' + (g.y + g.h / 2) + 'px';
    matScrim.style.left = (-g.x) + 'px'; matScrim.style.top = (SCRIM_Y - g.y) + 'px';
    matScrim.style.transformOrigin = '960px ' + (g.y + g.h / 2 - SCRIM_Y) + 'px';
    shelf.style.width = g.shelf + 'px';
    shelf.className = 'shelf' + (g.broad && off > 0 ? ' fade-l' : '') + (g.broad && off + g.shelf < n * g.pitch - 8 ? ' fade-r' : '');

    keyed(track, empty ? [] : items, function (el, it, i) {
      var a = it.id ? app(it.id) : null, left = i * g.pitch, focus = tileFocus && i === anchor, sel = tileSel && i === anchor;
      var lifted = hs.lifted && i === anchor, partial = g.broad && (left - off < -1 || left + g.tw - off > g.shelf + 1);
      setContent(el, it.kind + '|' + (it.id || '') + '|' + (it.id ? dockLabelSize(it.id) : full) + '|' + S.c.bg + '|' + S.c.apps + '|' + homeFont(), '<span class="tile-content">' + dockTileHtml(it, full) + '</span>');
      el.className = 'tile k-' + it.kind + (focus ? ' is-focus' : '') + (sel ? ' is-sel' : '') + (lifted ? ' is-lifted' : '') + (partial ? ' is-partial' : '')
        + (a && !a.mark ? ' is-text' : '') + (it.kind === 'add' && full ? ' is-full' : '') + (it.kind === 'app' && S.press === it.id ? ' is-press' : '')
        + (lifted && i === 0 ? ' no-l' : '') + (lifted && i >= ns - 1 ? ' no-r' : '');
      el.style.transform = 'translate3d(' + left + 'px,0,0)';
      el.setAttribute('role', 'button');
      if (a) el.setAttribute('aria-label', a.name);
      if (hs.mode === 'arrange') attrs(el, 'tile', i, 'arrange.' + (it.kind === 'add' ? 'add' : (it.kind === 'ph' ? 'placeholder.' : 'tile.') + it.id));
      else attrs(el, 'app', i, 'home.app.' + it.id);
    });
    track.style.transform = 'translate3d(' + (-off) + 'px,0,0)';
    syncDockEdges();
    if (g.broad) {
      dockEdgeUntil = Date.now() + 220;
      if (!dockEdgeFrame) dockEdgeFrame = window.requestAnimationFrame(trackDockEdges);
    }
    plate.className = 'plate' + (!n || empty || hs.zone === null ? '' : hs.lifted ? ' on-lift' : tileFocus ? ' on-focus' : tileSel ? ' on-sel' : '');
    plate.style.transform = 'translate3d(' + (anchor * g.pitch) + 'px,0,0)';

    cueL.style.left = (g.x - 72) + 'px'; cueR.style.left = (g.x + g.w + 24) + 'px';
    cueL.style.top = cueR.style.top = (g.y + g.h / 2 - 24) + 'px';
    cueL.className = 'cue' + (!g.broad && !empty && scroll.first > 0 ? ' is-on' : '');
    cueR.className = 'cue' + (!g.broad && !empty && scroll.first + g.vis < n ? ' is-on' : '');

    ax = g.x + 16 + anchor * g.pitch - off;
    if (hs.mode === 'arrange' && !hs.lifted && (hs.zone === 'tiles' || hs.zone === 'act') && focusItem && focusItem.kind !== 'add') {
      s = hs.arr.slots[anchor];
      label = (s.removed ? 'Restore ' : 'Remove ') + app(s.id).name; width = actionWidth(label);
      ax = clamp(ax + (g.tw - width) / 2, 112, 1808 - width);
      setHTML(dockAction, '<span>' + esc(label) + '</span>');
      dockAction.className = 'dock-action is-on' + (hs.zone === 'act' ? ' is-focus' : '');
      dockAction.style.width = width + 'px';
      dockAction.style.transform = 'translate3d(' + ax + 'px,0,0)';
      attrs(dockAction, 'act', anchor, 'arrange.' + (s.removed ? 'restore.' : 'remove.') + s.id);
    } else {
      dockAction.className = 'dock-action';
      dockAction.removeAttribute('data-z'); dockAction.removeAttribute('data-action');
    }
    setHTML(dockEmpty, empty ? '<p>No apps on Home</p><button type="button" tabindex="-1" class="btn' + (hs.zone === 'empty' ? ' is-focus' : '') + '" data-z="empty" data-i="0" data-action="home.add-apps">' + icon('plus') + '<span>Add apps</span></button>' : '');
  }

  function photoModeTransition(compact) {
    if (photoMode !== null && photoMode !== compact) {
      var ghost = phScene.cloneNode(true), token = ++photoTransitionToken;
      ghost.removeAttribute('id'); ghost.setAttribute('aria-hidden', 'true');
      Array.prototype.forEach.call(ghost.querySelectorAll('[id],[data-action],[data-z]'), function (el) {
        el.removeAttribute('id'); el.removeAttribute('data-action'); el.removeAttribute('data-z');
      });
      ghost.className = 'ph-scene ph-ghost';
      phScene.parentNode.appendChild(ghost);
      phScene.className = 'ph-scene ph-incoming';
      setTimeout(function () {
        if (ghost.parentNode) ghost.parentNode.removeChild(ghost);
        if (token === photoTransitionToken) phScene.className = 'ph-scene';
      }, 180);
    }
    photoMode = compact;
  }
  /* Each plate keeps a stationary, stage-registered field while its opacity changes.
     Reuse the hidden group for the next label; never animate plate width or position. */
  function renderPhotoPlate(id, width, height, y, state) {
    var key = id + '|' + width + '|' + height + '|' + y, plateEl, fieldEl;
    if (key !== photoPlateKey) {
      phPlates[photoPlateIndex].className = phPlates[photoPlateIndex].className.replace(' is-current', '') + ' is-outgoing';
      photoPlateIndex = 1 - photoPlateIndex;
      plateEl = phPlates[photoPlateIndex]; fieldEl = phFields[photoPlateIndex];
      plateEl.className = 'ph-plate is-preparing';
      plateEl.style.width = width + 'px'; plateEl.style.height = height + 'px';
      plateEl.style.transform = 'translate3d(0,' + y + 'px,0)';
      fieldTransform(fieldEl, 112, y, width, height);
      plateEl.offsetWidth; // Establish zero opacity before the incoming crossfade.
      photoPlateKey = key;
    }
    fieldTransform(phFields[photoPlateIndex], 112, y, width, height);
    phPlates[photoPlateIndex].className = 'ph-plate is-current' + (state ? ' ' + state : '');
  }
  function fieldTransform(el, x, y, width, height) {
    el._placement = { x: x, y: y, width: width, height: height };
    el.style.transformOrigin = (x + width / 2) + 'px ' + (y + height / 2) + 'px';
    el.style.transform = 'translate3d(' + (-x) + 'px,' + (-y) + 'px,0)' + (S.c.bg === 'photo' && S.c.material === 'tint' && !REDUCED_MOTION ? ' scale(1.04)' : '');
  }
  function renderList(hs) {
    var items = hs.items, n = items.length, compact = hs.mode === 'arrange', pitch = compact ? PH_COMPACT_PITCH : PH_PITCH;
    var anchor = clamp(hs.i, 0, Math.max(0, n - 1)), first, off, width, slot, y, s, label, aw, plateState;
    var rowFocus = hs.zone === 'apps' || hs.zone === 'tiles', remembered = hs.zone === 'util' || hs.zone === 'act' || hs.zone === 'ctl' || hs.zone === 'preview';
    photoModeTransition(compact);
    if (compact) {
      first = clamp(scroll.photoArrange, anchor - 7, anchor - 1);
      first = clamp(first, 0, Math.max(0, n - PH_COMPACT_VISIBLE));
      scroll.photoArrange = first;
    } else {
      first = clamp(scroll.photo, anchor - 3, anchor - 1);
      first = clamp(first, 0, Math.max(0, n - PH_FULL));
      scroll.photo = first;
    }
    off = first * pitch; slot = anchor - first;
    width = items[anchor] ? listPlateWidth(items[anchor].id, compact) : 360;
    phList.className = 'ph-list' + (compact ? ' is-compact' : '');
    phList.style.height = PH_HEIGHT + 'px';
    phRows.style.top = (compact ? 72 : 148) + 'px';
    keyed(phRows, items, function (row, it, i) {
      var typography = photoLabel(it.id, compact), focus = rowFocus && i === anchor, lifted = hs.lifted && i === anchor, markImage, body = '';
      if (S.c.apps !== 'text') body += appMark(app(it.id), S.c.apps === 'icons' ? compact ? 64 : 88 : compact ? 60 : 84, S.c.apps === 'icons' ? compact ? 64 : 88 : compact ? 44 : 64, S.c.apps === 'icons' ? compact ? 52 : 72 : compact ? 42 : 54);
      if (S.c.apps !== 'icons') body += '<span class="ph-name" style="font-size:' + typography.size + 'px;top:' + typography.top + 'px">' + esc(app(it.id).name) + '</span>';
      setContent(row, it.id + '|' + typography.size + '|' + S.c.bg + '|' + S.c.apps + '|' + homeFont(), '<span class="ph-group">' + body + '</span><span class="ph-move ph-move-up">' + icon('up') + '</span><span class="ph-move ph-move-down">' + icon('down') + '</span>');
      markImage = row.querySelector('.mark img');
      if (markImage) {
        markImage.onerror = function () { this.style.visibility = 'hidden'; };
        if (markImage.complete && !markImage.naturalWidth) markImage.style.visibility = 'hidden';
      }
      row.className = 'ph-row k-' + it.kind + (focus ? ' is-focus' : '') + (remembered && i === anchor ? ' is-sel' : '') + (lifted ? ' is-lifted' : '')
        + (lifted && i === 0 ? ' no-up' : '') + (lifted && i === n - 1 ? ' no-down' : '')
        + (it.kind === 'app' && S.press === it.id ? ' is-press' : '');
      row.style.width = (compact ? listPlateWidth(it.id, compact) : 1200) + 'px'; row.style.height = pitch + 'px';
      row.style.transform = 'translate3d(0,' + (i * pitch) + 'px,0)';
      row.setAttribute('role', 'button'); row.setAttribute('aria-label', app(it.id).name);
      attrs(row, compact ? 'tile' : 'app', i, compact ? 'arrange.' + (it.kind === 'ph' ? 'placeholder.' : 'tile.') + it.id : 'home.app.' + it.id);
    });
    phRows.style.transform = 'translate3d(0,' + (-off) + 'px,0)';
    y = (compact ? PH_COMPACT_TOP + 2 : PH_TOP + 1) + slot * pitch;
    plateState = !n || hs.zone === null ? '' : hs.lifted ? 'on-lift' : S.c.focus === 'glass' && rowFocus ? 'on-focus' : S.c.focus === 'glass' && remembered ? 'on-sel' : '';
    renderPhotoPlate(items[anchor] ? items[anchor].id : '', width, compact ? 88 : 134, y, plateState);
    if (compact && !hs.lifted && (hs.zone === 'tiles' || hs.zone === 'act') && items[anchor]) {
      s = hs.arr.slots[anchor]; label = (s.removed ? 'Restore ' : 'Remove ') + app(s.id).name; aw = actionWidth(label);
      setHTML(phAction, '<span>' + esc(label) + '</span>');
      phAction.className = 'ph-action is-on' + (hs.zone === 'act' ? ' is-focus' : '');
      phAction.style.width = aw + 'px';
      phAction.style.transform = 'translate3d(' + (112 + width + 24) + 'px,' + (PH_COMPACT_TOP + slot * pitch + 12) + 'px,0)';
      attrs(phAction, 'act', anchor, 'arrange.' + (s.removed ? 'restore.' : 'remove.') + s.id);
    } else { phAction.className = 'ph-action'; phAction.removeAttribute('data-z'); phAction.removeAttribute('data-action'); }
    phEmpty.className = 'ph-empty' + (!compact && !n ? ' is-on' : '');
    setHTML(phEmpty, !compact && !n ? '<p>No apps on Home</p><button type="button" tabindex="-1" class="btn' + (hs.zone === 'empty' ? ' is-focus' : '') + '" data-z="empty" data-i="0" data-action="home.add-apps">' + icon('plus') + '<span>Add apps</span></button>' : '');
  }

  /* Sheets: a frame is built once per view/mode; fill() updates its slots. Persistent
     scrollers let transforms animate. */
  function renderSheet(t, sheet) {
    var v = V[t.id], key;
    sheetEl.hidden = !(sheet || isSettingsDetail(t));
    sheetView.hidden = !sheet;
    if (sheet) sheetView.setAttribute('aria-modal', 'true');
    else sheetView.removeAttribute('aria-modal');
    sceneEl.setAttribute('aria-hidden', sheet || isSettingsDetail(t) ? 'true' : 'false');
    if (!sheet) { sheetView.innerHTML = ''; sheetKey = ''; return; }
    key = t.id + '|' + (t.mode || '') + '|' + (t.msg || '') + '|' + S.variant + '|' + S.c.bg;
    if (key !== sheetKey) {
      sheetView.innerHTML = FRAMES[t.id](t);
      sheetKey = key; slotEls = {};
      Array.prototype.forEach.call(sheetView.querySelectorAll('[data-slot]'), function (el) { slotEls[el.getAttribute('data-slot')] = el; });
    }
    FILLS[t.id](t, slotEls);
  }
  function renderAppearance(t) {
    appearanceEl.hidden = !isSettingsDetail(t);
    if (appearanceEl.hidden) { appearanceEl.removeAttribute('aria-modal'); return; }
    appearanceEl.setAttribute('aria-modal', 'true');
    if (t.id === 'wallpaper') { renderWallpaper(t); return; }
    V.appearance.norm(t);
    appearanceEl.className = 'appearance detail-' + t.group;
    if (t.group && t.group.indexOf('app_manage:') === 0) {
      appearanceTitle.textContent = app(t.group.slice(11)).name;
    } else {
      appearanceTitle.textContent = DETAIL_NAMES[t.group] || 'Settings';
    }
    var at = detailLocation(t), selected = at.item, error = S.lookError, status = '';
    function command(item, inner, cls) {
      var live = item.axis ? aerialValue(item.axis) : null;
      var soundVol = window.CleanFrameAudio && window.CleanFrameAudio.getVolumeLevel ? window.CleanFrameAudio.getVolumeLevel() : 'standard';
      var applied = item.axis === 'soundvol' ? soundVol === item.value :
                    item.axis === 'soundtoggle' ? (window.CleanFrameAudio && !window.CleanFrameAudio.isMuted()) :
                    item.axis && (live !== null && live !== undefined ? live === item.value : S.c[item.axis] === item.value);
      var loading = !!(item.axis && S.pending && S.pending.target[item.axis] === item.value && S.pending.row === item.axis);
      /* Focus is not part of the markup: the pane keeps its rows between moves,
         so only the scroller's transform changes and the list no longer falls
         back to the top before sliding into place on every key press. */
      return '<button type="button" tabindex="-1" class="tvos-row setting-choice' + (cls ? ' ' + cls : '') + (item.disabled ? ' is-disabled' : '') + (applied ? ' is-applied' : '') + (loading ? ' is-loading' : '') + '"'
        + (item.axis ? ' role="radio" aria-checked="' + !!applied + '"' : '') + ' aria-label="' + esc(item.label) + '" aria-disabled="' + !!item.disabled + '" aria-busy="' + loading + '"'
        + ' data-z="detail" data-i="0" data-id="' + item.action + '" data-action="' + item.action + '">' + inner
        + (item.axis && applied ? '<span class="tvos-row-tick" aria-hidden="true">' + icon('check') + '</span>' : '') + '</button>';
    }
    appearanceRows.className = 'appearance-rows';
    setHTML(appearanceBack, '<button type="button" tabindex="-1" class="tvos-back-btn" data-z="detail" data-id="settings.back" data-action="settings.back">' + icon('left') + '<span>Settings</span></button>');
    var previousHtml = appearanceRows._html;
    setHTML(appearanceRows, '<div class="appearance-scroll">' + detailSections(t).map(function (section) {
      return '<section class="tvos-section section-' + section.id + '">'
        + (section.title ? '<div class="tvos-section-header" id="setting-' + section.id + '">' + esc(section.title) + '</div>' : '')
        + '<div class="tvos-section-group"' + (section.items[0].axis ? ' role="radiogroup" aria-label="' + esc(section.title || DETAIL_NAMES[t.group]) + '"' : '') + '>'
        + section.items.map(function (item) {
          var swatch = item.axis === 'bg', body = '';
          if (swatch || item.thumbnail) {
            body += item.value === 'light' || item.value === 'dark'
              ? '<span class="setting-swatch swatch-' + item.value + '" aria-hidden="true"></span>'
              : '<img class="setting-swatch" src="' + WP + S.c.wall + '-thumb.jpg" alt="">';
          }
          body += '<span class="tvos-row-label">' + esc(item.label) + '</span>';
          body += '<span class="tvos-row-right">';
          if (item.value && !item.axis) {
            body += '<span class="tvos-row-value">' + esc(item.value) + '</span>';
          } else if (item.description && !item.axis && !item.disabled) {
            body += '<span class="tvos-row-value">' + esc(item.description) + '</span>';
          }
          if (!item.axis && item.action !== 'settings.back' && !item.disabled) {
            body += icon('right', 'tvos-row-chevron');
          }
          body += '</span>';
          return command(item, body, item.description ? 'has-description' : '');
        }).join('') + '</div>'
        + (section.reason ? '<p class="setting-reason">' + esc(section.reason) + '</p>' : '')
      + '</section>';
    }).join('') + '</div>');
    var rebuilt = previousHtml !== appearanceRows._html;
    /* Toggle focus on the rows already in the DOM. Rebuilding the pane for every
       key press re-created the scroller, so its transform animated from zero to
       the stored offset and the whole list bounced on each move. */
    (function syncAppearanceFocus() {
      var choices = appearanceRows.querySelectorAll('.setting-choice'), back = appearanceBack.querySelector('.tvos-back-btn'), i;
      for (i = 0; i < choices.length; i++) {
        if (choices[i].getAttribute('data-action') === t.f.action) choices[i].classList.add('is-focus');
        else choices[i].classList.remove('is-focus');
      }
      if (back) {
        if (t.f.action === 'settings.back') back.classList.add('is-focus');
        else back.classList.remove('is-focus');
      }
    })();
    if (S.pending) status = '<p>Loading ' + esc(S.pending.row === 'font' ? FONTS[S.pending.target.font].name : 'your choice') + '…</p><p>Back cancels this change.</p>';
    else if (error) {
      status = '<p class="setting-error">' + (error.type === 'save' ? 'Couldn’t save this change.' : error.type === 'font' ? 'Couldn’t load ' + esc(FONTS[error.font].name) + '.' : 'Couldn’t load this appearance.') + ' Your current choice is kept.</p>'
        + command({ action: 'settings.retry', label: 'Try again' }, '<span>Try again</span>', 'setting-retry');
    }
    setHTML(appearanceStatus, status);

    var heroInfo = itemHeroInfo(selected, t.group);
    var heroCardIcon = $('appearanceHeroIcon');
    var heroCardDesc = $('appearanceDesc');
    if (heroCardIcon) setHTML(heroCardIcon, icon(heroInfo.icon || 'settings'));
    if (heroCardDesc) setHTML(heroCardDesc, esc(heroInfo.desc || ''));
    scrollDetail(t, rebuilt);
  }
  var DETAIL_VIEW = 656, detailScroll = {};
  function detailScroller() { return appearanceRows.querySelector('.appearance-scroll'); }
  function scrollDetail(t, instant) {
    var scroller = detailScroller();
    var focused = scroller && scroller.querySelector('.setting-choice.is-focus'), y, top, height, max;
    if (!focused) return;
    /* Measure the real clip box: .appearance-rows is capped at 656 px, and the
       old fixed 740 let the focus settle below the visible edge. */
    var view = appearanceRows.clientHeight || DETAIL_VIEW;
    top = focused.offsetTop;
    height = focused.offsetHeight;
    y = detailScroll[t.group] || 0;
    if (top - y < 0) y = top;
    else if (top + height - y > view) y = top + height - view;
    max = Math.max(0, scroller.scrollHeight - view);
    y = clamp(y, 0, max);
    detailScroll[t.group] = y;
    if (instant) {
      /* A rebuilt pane starts at zero. Park it at the stored offset in the same
         style pass, with the transition off, so opening a group or applying a
         value does not play the scroll animation from the top. */
      scroller.className = 'appearance-scroll is-instant';
      scroller.style.transform = y ? 'translate3d(0,' + (-y) + 'px,0)' : '';
      void scroller.offsetHeight;
      window.requestAnimationFrame(function () {
        if (scroller.parentNode) scroller.className = 'appearance-scroll';
      });
      return;
    }
    scroller.style.transform = y ? 'translate3d(0,' + (-y) + 'px,0)' : '';
  }
  function renderWallpaper(t) {
    V.wallpaper.norm(t);
    appearanceEl.className = 'appearance detail-wallpaper';
    appearanceTitle.textContent = 'Wallpaper';
    appearanceRows.className = 'appearance-rows wallpaper-picker';
    setHTML(appearanceBack, '<button type="button" tabindex="-1" class="setting-choice setting-back' + (t.f.zone === 'back' ? ' is-focus' : '') + '" data-z="wall-back" data-action="wallpaper.back">' + icon('left') + '<span>Background</span></button>');
    setHTML(appearanceRows, '<div class="wallpaper-edge wallpaper-before" aria-hidden="true">' + icon('up') + '</div><div class="wallpaper-list" role="radiogroup" aria-label="Wallpaper"><div class="wallpaper-rows"></div></div><div class="wallpaper-edge wallpaper-after" aria-hidden="true">' + icon('down') + '</div>');
    var rows = appearanceRows.querySelector('.wallpaper-rows'), shown = wall(S.wallShown) || wall(S.c.wall), candidate = WALLS[t.i], status, note, hint;
    keyed(rows, WALLS.map(function (w) { return { key: w.id, wall: w }; }), function (row, item, i) {
      var visible = i >= t.top && i < t.top + WALL_VISIBLE, w = item.wall, image;
      setContent(row, w.id + '|' + visible, '<span class="wallpaper-thumb">' + (visible ? '<img src="' + WP + w.id + '-thumb.jpg" alt="">' : '') + '</span><span class="setting-copy"><span class="setting-name">' + esc(w.name) + '</span></span><span class="setting-tick" aria-hidden="true"></span>');
      row.className = 'setting-choice wallpaper-choice' + (t.f.zone === 'photo' && t.i === i ? ' is-focus' : '') + (w.id === S.c.wall ? ' is-applied' : '');
      row.style.transform = 'translate3d(0,' + (i * WALL_ROW) + 'px,0)'; row.style.visibility = visible ? 'visible' : 'hidden';
      row.setAttribute('role', 'radio'); row.setAttribute('tabindex', '-1'); row.setAttribute('aria-label', w.name);
      row.setAttribute('aria-checked', String(w.id === S.c.wall)); row.setAttribute('aria-posinset', String(i + 1)); row.setAttribute('aria-setsize', String(WALLS.length));
      row.setAttribute('aria-busy', String(t.previewDue === w.id || S.wallPending === w.id));
      attrs(row, 'wall-choice', i, 'wallpaper.choose.' + w.id);
      setHTML(row.querySelector('.setting-tick'), w.id === S.c.wall ? icon('check') : '');
      image = row.querySelector('img');
      if (image && !image._wallBound) {
        image._wallBound = true;
        image.onerror = function () { this.parentNode.className = 'wallpaper-thumb is-missing'; };
        if (image.complete && !image.naturalWidth) image.onerror();
      }
    });
    rows.style.transform = 'translate3d(0,' + (-t.top * WALL_ROW) + 'px,0)';
    appearanceRows.querySelector('.wallpaper-before').className = 'wallpaper-edge wallpaper-before' + (t.top > 0 ? ' is-on' : '');
    appearanceRows.querySelector('.wallpaper-after').className = 'wallpaper-edge wallpaper-after' + (t.top + WALL_VISIBLE < WALLS.length ? ' is-on' : '');
    note = t.previewDue ? 'Preparing ' + candidate.name + '…' : S.wallPending ? (t.applyPending ? 'Applying ' : 'Loading ') + candidate.name + '…' : shown.id === S.c.wall ? 'Applied' : 'Preview';
    if (t.failedId) note = S.err ? 'Couldn’t save ' + wall(t.failedId).name + '.' : 'Couldn’t load ' + wall(t.failedId).name + '.';
    status = '<p class="wallpaper-preview-name"><span>' + esc(shown.name) + '</span><span class="wallpaper-count">' + (wallIndex(shown.id) + 1) + ' of ' + WALLS.length + '</span></p><p class="wallpaper-preview-state' + (t.failedId ? ' setting-error' : '') + '">' + esc(note) + '</p>';
    if (t.failedId) status += '<button type="button" tabindex="-1" class="setting-choice setting-retry' + (t.f.zone === 'retry' ? ' is-focus' : '') + '" data-z="wall-retry" data-action="wallpaper.retry">Try again</button>';
    setHTML(appearanceStatus, status);
    hint = t.f.zone === 'back' ? 'Return to Background' : t.f.zone === 'retry' ? 'Retry this photo' : 'Apply selected photo';
    if (t.f.zone === 'photo' && candidate.id === S.c.wall && !S.pending && !t.failedId) hint = '';
    setHTML(appearanceDesc, hint ? '<span class="remote-key">OK</span><span>' + hint + '</span>' : '');
  }
  /* Keep the retry or membership state on the focused control. The stage-level line
     shares its position without changing the control's identity or key behaviour. */
  function renderFocusStatus(t) {
    if (isSettingsDetail(t)) { focusStatus.className = 'focus-status'; return; }
    /* A move along the dock has nothing to say. Both queries below walk the
       whole stage, and they ran on every key press only to find no target and
       no text; the empty case is now decided before either of them. */
    if (!S.err && !S.note && t.id !== 'arrange' && focusStatus.className === 'focus-status') return;
    var root = isSettingsDetail(top()) ? appearanceEl : sheetEl.hidden ? homeEl : sheetEl, active = root.querySelectorAll('.is-focus[data-action]'), target = null, text = S.err ? 'Not saved. OK tries again.' : '', i, r, sr, scale, x, y, w, action, solid, photoRow = false, photoFree = false;
    Array.prototype.forEach.call(stage.querySelectorAll('.has-local-status'), function (el) { el.className = el.className.replace(/\s+has-local-status/g, ''); });
    for (i = 0; i < active.length; i++) if (renderedAction(active[i])) { target = active[i]; break; }
    if (!text && t.id === 'arrange' && (t.f.zone === 'act' || t.f.zone === 'tiles')) {
      var slot = t.slots[t.f.i];
      if (slot && !slot.removed && t.f.zone === 'act' && S.c.home.length === 1) text = LAST;
    }
    if (!text && S.note === LAST && t.id === 'arrange') text = LAST;
    if (!target || !text) { focusStatus.className = 'focus-status'; return; }
    if (target.parentNode === utilsEl && utilsEl.className.indexOf('is-icons') >= 0) { renderUtilFocusLabel(target); focusStatus.className = 'focus-status'; return; }
    // Photo action pills stay on one line; the header already carries this status.
    if (S.c.layout === 'list' && t.id === 'arrange' && !t.lifted && (t.f.zone === 'act' || t.f.zone === 'tiles')) { focusStatus.className = 'focus-status'; return; }
    photoRow = S.c.layout === 'list' && target.className.indexOf('ph-row') >= 0;
    if (photoRow && phAction.className.indexOf('is-on') >= 0) target = phAction;
    else if (photoRow) photoFree = true;
    target.className += ' has-local-status';
    action = target.getAttribute('data-action');
    r = target.getBoundingClientRect(); sr = stage.getBoundingClientRect(); scale = sr.width / 1920 || 1;
    x = (r.left - sr.left) / scale; y = (r.top - sr.top) / scale; w = r.width / scale;
    if (photoFree) { x = 112 + parseFloat(phPlates[photoPlateIndex].style.width) + 24; y += (r.height / scale - 28) / 2; w = 400; }
    else if (action.indexOf('home.app.') === 0 || action.indexOf('arrange.tile.') === 0 || action.indexOf('arrange.placeholder.') === 0) y += 171;
    else if (action.indexOf('apps.order.') === 0) y += 86;
    else if (action.indexOf('apps.toggle.') === 0 || action.indexOf('apps.add.') === 0) y += 164;
    else if (action.indexOf('layout.') === 0) y += 54;
    else y += action.indexOf('arrange.remove.') === 0 || action.indexOf('arrange.restore.') === 0 ? 43 : 40;
    solid = /(?:^|\s)(?:u|btn|er-rm|dock-action|set-row|ph-action)(?:\s|$)/.test(target.className) && target.parentNode !== utilsEl && target.parentNode.className.indexOf('s-head') < 0;
    if (target === phAction && target.className.indexOf('is-focus') < 0) solid = false;
    focusStatus.className = 'focus-status is-on' + (solid ? ' dark-ink' : '') + (photoFree ? ' photo-status' : '');
    focusStatus.textContent = text;
    focusStatus.style.left = clamp(x + 8, 112, 1808 - Math.min(w - 16, 800)) + 'px';
    focusStatus.style.top = clamp(y, 72, 988) + 'px';
    focusStatus.style.width = Math.min(w - 16, 800) + 'px';
  }
  function headButtons(list, fi, prefix) {
    return list.map(function (b, i) {
      return '<button type="button" tabindex="-1" class="btn' + (i === fi ? ' is-focus' : '') + (b[2] ? ' ' + b[2] : '') + '" data-z="head" data-i="' + i + '" data-action="' + prefix + '.' + b[0] + '" aria-label="' + esc(b[0] === 'undo' ? undoCaption() : b[1]) + '">' + (b[3] ? icon(b[3]) : '') + '<span>' + b[1] + '</span></button>';
    }).join('');
  }
  var FRAMES = {
    apps: function () {
      return '<h2 class="s-title" data-slot="title"></h2><p class="s-sub" data-slot="sub"></p><div class="s-head" data-slot="head"></div>'
        + '<div class="grid-view" data-slot="view"><div class="grid-in" data-slot="grid"></div></div>'
        + '<div class="row-cue grid-before" data-slot="before" aria-hidden="true">' + icon('up') + '</div><div class="row-cue grid-after" data-slot="after" aria-hidden="true">' + icon('down') + '</div>';
    },
    editor: function () {
      return '<h2 class="s-title">Apps on Home</h2><p class="s-sub" data-slot="sub"></p><div class="s-head" data-slot="head"></div>'
        + '<p class="s-label z-home" data-slot="lh"></p><p class="s-label z-other">Not on Home</p>'
        + '<div class="ed-home" data-slot="home"></div><div class="ed-order-break" data-slot="break">Then scroll</div><div class="ed-other-view" data-slot="ov"><div class="ed-other" data-slot="other"></div></div><div class="ed-origin" data-slot="origin"></div>'
        + '<div class="row-cue editor-before" data-slot="otherBefore" aria-hidden="true">' + icon('up') + '</div><div class="row-cue editor-after" data-slot="otherAfter" aria-hidden="true">' + icon('down') + '</div>';
    },
    settings: function () {
      return '<div class="tvos-settings">'
        + '<div class="tvos-header">'
        + '  <h2 class="tvos-title" data-slot="title">Settings</h2>'
        + '</div>'
        + '<div class="tvos-body">'
        + '  <div class="tvos-hero-pane">'
        + '    <div class="tvos-hero-card" data-slot="heroCard">'
        + '      <div class="tvos-hero-icon" data-slot="heroIcon"></div>'
        + '    </div>'
        + '    <p class="tvos-hero-desc" data-slot="heroDesc"></p>'
        + '  </div>'
        + '  <div class="tvos-list-pane">'
        + '    <div class="tvos-sections-scroll" data-slot="list"></div>'
        + '  </div>'
        + '</div>'
        + '</div>';
    },
    message: function (t) {
      var m = messageContent(t);
      return '<h2 class="msg-title">' + esc(m.title) + '</h2><p class="msg-line">' + esc(m.line) + '</p><p class="msg-note">' + esc(m.note) + '</p><div class="msg-acts" data-slot="acts"></div>';
    }
  };
  function gridTileHtml(id) {
    var a = app(id), state = onHome(id) ? badge(true) + '<span>On Home</span>' : '';
    return '<span class="panel-content">' + appMark(a, 120, 72, 58) + '<span class="label">' + esc(a.name) + '</span></span><span class="state">' + state + '</span>';
  }
  var FILLS = {
    apps: function (t, el) {
      var f = t.f, items = appsItems(), n = items.length, rows = Math.ceil(n / COLS), vis = 3, row = Math.floor(f.i / COLS);
      setHTML(el.title, 'All apps');
      setHTML(el.sub, esc(catalog.loading ? 'Loading installed apps…' : catalog.error || (!n ? 'No installed apps found.' : '')));
      setHTML(el.head, headButtons(appsHead(), f.zone === 'head' ? 0 : -1, 'apps'));
      el.head.className = 's-head' + (f.zone === 'head' ? ' is-awake' : '');
      if (f.zone === 'grid') { if (row < t.top) t.top = row; if (row > t.top + vis - 1) t.top = row - vis + 1; }
      t.top = clamp(t.top, 0, Math.max(0, rows - vis));
      keyed(el.grid, items.map(function (id) { return { key: id, id: id }; }), function (tile, it, i) {
        var focus = f.zone === 'grid' && i === f.i;
        setContent(tile, [it.id, app(it.id).name, onHome(it.id)].join('|'), gridTileHtml(it.id));
        tile.className = 'gt' + (focus ? ' is-focus' : '');
        tile.style.transform = 'translate3d(' + ((i % COLS) * GRID_COL) + 'px,' + (Math.floor(i / COLS) * GRID_ROW) + 'px,0)';
        tile.setAttribute('role', 'button'); tile.setAttribute('aria-label', app(it.id).name);
        attrs(tile, 'grid', i, 'apps.open.' + it.id);
      });
      el.grid.style.transform = 'translate3d(0,' + (-t.top * GRID_ROW) + 'px,0)';
      el.view.className = 'grid-view' + (t.top > 0 ? ' more-before' : '') + (rows - t.top > vis ? ' more-after' : '');
      el.before.className = 'row-cue grid-before' + (t.top > 0 ? ' is-on' : '');
      el.after.className = 'row-cue grid-after' + (rows - t.top > vis ? ' is-on' : '');
    },
    editor: function (t, el) {
      var f = t.f, H = t.lifted ? t.lifted.order : S.c.home, O = otherGroups(), list = O.recent.concat(O.rest), full = S.c.home.length >= CAP;
      var entries = [], ys = [], y = 0, yf, minTop, maxTop = 0, rowEnd, before = false, afterRows = false;
      var hint = catalog.error ? catalog.error : catalog.loading ? 'Loading installed apps…' : f.zone === 'head' && f.h === 0 ? undoCaption() : f.zone === 'home' && f.part === 'remove' ? (H.length <= 1 ? LAST : app(H[f.i]).name + ' stays installed.') : '';
      setHTML(el.sub, editStatus(hint, t.lifted ? 'Moving ' + app(t.lifted.id).name + '. OK places it, Back puts it back.' : ''));
      setHTML(el.head, headButtons([['undo', 'Undo', S.undo.length ? '' : 'is-idle', 'undo'], ['done', 'Done', '', 'check']], f.zone === 'head' ? f.h : -1, 'editor'));
      el.head.className = 's-head' + (f.zone === 'head' ? ' is-awake' : '');
      setHTML(el.lh, 'On Home <span class="s-count">' + S.c.home.length + ' of ' + CAP + '</span>');
      el['break'].className = 'ed-order-break' + (H.length > editorCut() ? ' is-on' : '');
      el['break'].style.top = (264 + editorCut() * ED_ROW) + 'px';

      keyed(el.home, H.map(function (id) { return { key: id, id: id }; }), function (row, it, i) {
        var a = app(it.id), here = f.zone === 'home' && i === f.i, lifted = !!t.lifted && i === f.i;
        setContent(row, it.id, '<div class="er-name" role="button"><span class="panel-content"><span class="er-num"></span>' + smallMark(a) + '<span class="er-text">' + esc(a.name) + '</span><span class="er-move">' + icon('updown') + '</span></span></div><div class="er-rm" role="button"><span></span></div>');
        row.className = 'er' + (here ? ' is-active' : '') + (lifted ? ' is-lifted' : '');
        row.style.transform = 'translate3d(' + (lifted ? 16 : 0) + 'px,' + editorHomeY(i) + 'px,0)';
        row.querySelector('.er-num').textContent = String(i + 1);
        row.firstChild.className = 'er-name' + (here && (f.part === 'name' || lifted) ? ' is-focus' : '');
        row.lastChild.className = 'er-rm' + (here && f.part === 'remove' && !lifted ? ' is-focus' : '') + (H.length <= 1 ? ' is-limit' : '');
        row.lastChild.firstChild.textContent = H.length <= 1 ? LAST : 'Remove from Home';
        attrs(row.firstChild, 'name', i, 'editor.move.' + it.id);
        attrs(row.lastChild, 'remove', i, 'editor.remove.' + it.id);
      });
      el.origin.className = 'ed-origin' + (t.lifted && t.lifted.from !== f.i ? ' is-on' : '');
      if (t.lifted) el.origin.style.transform = 'translate3d(0,' + (264 + editorHomeY(t.lifted.from) + 16) + 'px,0)';

      if (O.recent.length) { entries.push({ key: 'sep-recent', sep: 'Recently removed', y: y }); y += ED_SEP; }
      O.recent.forEach(function (id) { entries.push({ key: id, id: id, y: y }); ys.push(y); y += ED_ROW; });
      if (O.recent.length && O.rest.length) { entries.push({ key: 'sep-rest', sep: 'Other installed apps', y: y }); y += ED_SEP; }
      O.rest.forEach(function (id) { entries.push({ key: id, id: id, y: y }); ys.push(y); y += ED_ROW; });
      if (f.zone === 'other' && ys.length) {
        yf = ys[f.j] - (O.recent.length && (f.j === 0 || f.j === O.recent.length) ? ED_SEP : 0);
        if (yf < t.top) t.top = yf;
        if (ys[f.j] + 72 > t.top + ED_VIEW) {
          minTop = ys[f.j] + 72 - ED_VIEW;
          entries.some(function (it) { if (it.y < minTop) return false; t.top = it.y; return true; });
        }
      }
      entries.some(function (it) { if (it.y < Math.max(0, y - ED_VIEW)) return false; maxTop = it.y; return true; });
      t.top = clamp(t.top, 0, maxTop);
      keyed(el.other, entries, function (row, it) {
        var j, focus, a;
        row.style.transform = 'translate3d(0,' + it.y + 'px,0)';
        rowEnd = it.y + (it.sep ? ED_SEP : 72);
        row.style.visibility = it.y >= t.top && rowEnd <= t.top + ED_VIEW ? 'visible' : 'hidden';
        before = before || it.y < t.top; afterRows = afterRows || rowEnd > t.top + ED_VIEW;
        if (it.sep) { setContent(row, 'sep|' + it.sep, esc(it.sep)); row.className = 'eo-sep'; return; }
        j = list.indexOf(it.id); focus = f.zone === 'other' && j === f.j; a = app(it.id);
        setContent(row, it.id, '<span class="panel-content">' + smallMark(a) + '<span class="eo-text">' + esc(a.name) + '</span><span class="eo-verb"></span></span>');
        row.querySelector('.eo-verb').innerHTML = focus ? '<span class="verb' + (full ? ' is-off' : '') + '">' + (full ? 'Home is full' : 'Add to Home') + '</span>' : '';
        row.className = 'eo' + (focus ? ' is-focus' : '');
        row.setAttribute('role', 'button');
        attrs(row, 'other', j, 'editor.add.' + it.id);
      });
      el.other.style.transform = 'translate3d(0,' + (-t.top) + 'px,0)';
      el.ov.className = 'ed-other-view';
      el.otherBefore.className = 'row-cue editor-before' + (before ? ' is-on' : '');
      el.otherAfter.className = 'row-cue editor-after' + (afterRows ? ' is-on' : '');
    },
    settings: function (t, el) {
      var rows = settingsRows(), focused = null, html = '';
      rows.forEach(function (r) {
        if (r.id === t.f.id) focused = r;
      });
      if (!focused && rows.length) { focused = rows[0]; t.f.id = focused.id; }

      var sections = [
        { title: 'PREFERENCES', ids: ['appearance'].concat(LITE ? [] : ['aerial']).concat(['sound']) },
        { title: 'DEVICES & APPS', ids: ['remotes', 'editor', 'smarthome'] },
        { title: 'SYSTEM', ids: ['system'] }
      ];

      sections.forEach(function (sec) {
        var secRows = rows.filter(function (r) { return sec.ids.indexOf(r.id) >= 0; });
        if (!secRows.length) return;
        html += '<div class="tvos-section-header">' + esc(sec.title) + '</div>';
        html += '<div class="tvos-section-group">';
        secRows.forEach(function (r) {
          /* Focus is a class, not markup. The whole list used to be rebuilt on
             every press, which replayed its row entrance on each key and reset
             the pane; now only the highlight changes. */
          html += '<button type="button" tabindex="-1" class="tvos-row" data-z="row" data-i="0" data-id="' + r.id + '" data-action="settings.' + (r.id === 'editor' ? 'editor' : 'group.' + r.id) + '">'
            + '<span class="tvos-row-label">' + esc(r.label) + '</span>'
            + '<span class="tvos-row-right">'
            + '<span class="tvos-row-value">' + esc(r.value) + '</span>'
            + icon('right', 'tvos-row-chevron')
            + '</span>'
            + '</button>';
        });
        html += '</div>';
      });

      setHTML(el.list, html);
      Array.prototype.forEach.call(el.list.querySelectorAll('.tvos-row'), function (row) {
        row.classList.toggle('is-focus', row.getAttribute('data-id') === t.f.id);
      });

      if (focused) {
        if (el.heroIcon) setHTML(el.heroIcon, icon(focused.icon || 'settings'));
        if (el.heroDesc) setHTML(el.heroDesc, esc(focused.desc || ''));
      }

      el.list.style.transform = '';
    },
    message: function (t, el) {
      setHTML(el.acts, messageContent(t).actions.map(function (a, i) {
        return '<button type="button" tabindex="-1" class="btn' + (i === t.f.b ? ' is-focus' : '') + '" data-z="act" data-i="' + i + '" data-action="message.' + a[0] + '"><span>' + a[1] + '</span></button>';
      }).join(''));
    }
  };

  /* ---------- Atomic appearance bundles ---------- */
  var wallToken = 0, committedBundle = null, reflowToken = 0, fontSwitchToken = 0;
  function registeredMaterial(id) { return S.c.bg === 'photo' && S.c.material === 'soft' && !!wall(id); }
  function matSrc(id, material) { return 'assets/materials/' + id + (material === 'soft' ? '-study-soft.jpg' : material === 'tint' ? '-field-clear.jpg' : '-field-frost.jpg'); }
  function fieldSrc(id, material) { return 'assets/materials/' + id + (material === 'soft' ? '-field-blur.jpg' : material === 'tint' ? '-field-clear.jpg' : '-field-frost.jpg'); }
  function makeImg(cls, src) { var im = document.createElement('img'); im.className = cls; im.alt = ''; im._src = src; im.src = src; return im; }
  function whenReady(im, done) {
    var fin = false, timer = setTimeout(function () { finish(false); }, 8000);
    function finish(ok) { if (fin) return; fin = true; clearTimeout(timer); done(ok); }
    function ready() { if (im.decode) im.decode().then(function () { finish(true); }, function () { finish(false); }); else finish(true); }
    if (im.complete) { if (im.naturalWidth) ready(); else finish(false); }
    else { im.onload = ready; im.onerror = function () { finish(false); }; }
  }
  function swapImg(k, im) { var old = IMG[k]; if (old === im) return; im.style.cssText = old.style.cssText; if (old.id) im.id = old.id; old.parentNode.replaceChild(im, old); IMG[k] = im; }
  function bundleKey(look) { return look.wall + '|' + look.material; }
  /* `fast` is the launch path: only the wallpaper and the panel behind it are
     allowed to hold the first frame. The material fields are decoration on top
     of that photograph, so they arrive while the dock is already on screen
     instead of keeping the set on a black stage while they decode. */
  function loadBundle(look, token, done, fast) {
    var imgs = { photo: makeImg('photo', WP + look.wall + '.jpg'), bg: makeImg('sheet-bg', WP + look.wall + '-panel.jpg') }, keys, wait, left, allOk = true;
    imgs.mat = makeImg('mat-img', matSrc(look.wall, look.material));
    imgs.field = makeImg('ph-field-img', fieldSrc(look.wall, look.material));
    imgs.fieldAlt = makeImg('ph-field-img', fieldSrc(look.wall, look.material));
    imgs.utility = makeImg('ph-field-img', fieldSrc(look.wall, look.material));
    imgs.utilityAlt = makeImg('ph-field-img', fieldSrc(look.wall, look.material));
    keys = Object.keys(imgs);
    wait = fast ? ['photo', 'bg'] : keys;
    left = wait.length;
    wait.forEach(function (k) { whenReady(imgs[k], function (ok) {
      allOk = allOk && ok;
      if (--left || token !== wallToken) return;
      done(allOk ? { key: bundleKey(look), imgs: imgs } : null);
    }); });
  }
  function installBundle(bundle, look, previewOnly) {
    if (bundle) {
      Object.keys(bundle.imgs).forEach(function (k) { if (!previewOnly || k !== 'bg') swapImg(k, bundle.imgs[k]); });
      S.bundleKey = bundle.key;
    }
    /* The wallpaper field the glass samples just changed, so the capsule, the
       panel and the Home sheet all rebuild their slices against the new bundle. */
    refreshHomeGlass();
    controlGlassKey = '';
    pillGlassKeyReset();
    syncControlGlass(controlOpen);
    schedulePillGlass();
    S.shown = { bg: look.bg, wall: look.wall, material: look.material, font: look.font };
    phFields.concat(utFields).forEach(function (el) { var p = el._placement; if (p) fieldTransform(el, p.x, p.y, p.width, p.height); });
    S.wallShown = look.wall; S.wallPending = null; S.wallError = null;
  }
  function cleanPatch(patch) {
    var out = {}, k;
    if (!patch || typeof patch !== 'object') throw new Error('look needs an appearance patch');
    for (k in patch) if (patch.hasOwnProperty(k)) {
      if (k === 'wall') { if (!wall(patch[k])) throw new Error('Unknown wallpaper: ' + patch[k]); }
      else if (k === 'font') { if (!FONTS[patch[k]] || patch[k] !== 'manrope' && PRIVATE_FONTS.indexOf(patch[k]) < 0) throw new Error('Unavailable font: ' + patch[k]); }
      else if (!LOOK_VALUES[k] || LOOK_VALUES[k].indexOf(patch[k]) < 0) throw new Error('Invalid appearance value: ' + k);
      out[k] = patch[k];
    }
    return out;
  }
  function cancelLook() { wallToken++; S.pending = null; S.wallPending = null; S.lookError = null; }
  function setLook(patch, options) {
    var opts = options || {}, changes = cleanPatch(patch), target = lookOf(S.c), k, token, needs, needsFont, changed, loadedBundle = null, imageDone, fontDone, failed = false;
    for (k in changes) if (changes.hasOwnProperty(k)) target[k] = changes[k];
    changed = Object.keys(target).some(function (key) { return target[key] !== S.c[key]; });
    cancelLook(); S.err = null; token = wallToken;
    function finish(bundle) {
      var c = next(S.c.home.slice(), S.c.recent.slice()), fontChanged = target.font !== S.c.font, reflow = target.apps !== S.c.apps || target.controls !== S.c.controls || fontChanged, frame, fontFrame;
      Object.keys(target).forEach(function (key) { c[key] = target[key]; });
      S.pending = null; S.wallPending = null;
      if (!opts.transient && changed && !write(c, 'Appearance')) { S.lookError = { type: 'save', patch: changes, row: opts.row || S.appearanceFocus, transient: false }; render(); syncRotation(); return; }
      if (opts.transient) S.c = c;
      if (reflow) { S.reflow = true; frame = ++reflowToken; }
      if (fontChanged) { S.fontSwitch = true; fontFrame = ++fontSwitchToken; }
      installBundle(bundle, target);
      if (bundle) committedBundle = bundle;
      S.lookError = null; S.previewBundle = null;
      render(); syncRotation();
      if (reflow) window.requestAnimationFrame(function () { window.requestAnimationFrame(function () {
        if (frame !== reflowToken) return;
        S.reflow = false; stage.className = stage.className.replace(/\s+is-reflow/g, '');
      }); });
      if (fontChanged) setTimeout(function () {
        if (fontFrame !== fontSwitchToken) return;
        S.fontSwitch = false; stage.className = stage.className.replace(/\s+is-font-switch/g, '');
      }, REDUCED_MOTION ? 130 : 170);
    }
    function fail(type, reason) {
      if (token !== wallToken || failed) return;
      failed = true; S.pending = null; S.wallPending = null;
      if (type === 'load') S.wallError = target.wall;
      S.lookError = { type: type, reason: reason || null, patch: changes, row: opts.row || (type === 'font' ? 'font' : S.appearanceFocus), transient: !!opts.transient, wall: target.wall, font: target.font };
      if (type === 'font') log((opts.startup ? 'font fallback: ' : 'Font kept: ') + (opts.startup ? target.font : FONTS[S.c.font].name) + (opts.startup ? '' : ' (' + reason + ')'));
      if (type === 'font' && opts.startup && target.font !== 'manrope') { setLook({ font: 'manrope' }, { transient: true }); return; }
      render(); syncRotation();
    }
    function complete() {
      if (!imageDone || !fontDone || failed || token !== wallToken) return;
      window.requestAnimationFrame(function () { if (!failed && token === wallToken) finish(loadedBundle); });
    }
    needs = target.bg === 'photo' && S.bundleKey !== bundleKey(target) && (!S.shown || S.shown.bg !== 'photo' || target.wall !== S.c.wall || materialApplies(target));
    needsFont = !fontMetrics[target.font]; imageDone = !needs; fontDone = !needsFont;
    if (!needs && !needsFont) { finish(null); return; }
    S.pending = { patch: changes, target: target, row: opts.row || (needsFont ? 'font' : S.appearanceFocus), transient: !!opts.transient, preview: false };
    if (needs) {
      S.wallPending = target.wall;
      loadBundle(target, token, function (bundle) {
        if (!bundle) { fail('load'); return; }
        loadedBundle = bundle; imageDone = true; complete();
      }, !!opts.startup);
    }
    if (needsFont) ensureFont(target.font, function (ok, reason) {
      if (!ok) { fail('font', reason); return; }
      fontDone = true; complete();
    });
    if (!opts.startup) render();
  }
  function showWall(id, done) {
    var target = lookOf(S.c), token;
    target.bg = 'photo'; target.wall = id;
    cancelLook(); token = wallToken; S.wallError = null;
    S.pending = { patch: { wall: id }, target: target, row: 'bg', preview: true, transient: false }; S.wallPending = id;
    loadBundle(target, token, function (bundle) {
      S.pending = null; S.wallPending = null;
      if (!bundle) { S.wallError = id; done(false); return; }
      S.previewBundle = bundle; installBundle(bundle, target, true); done(true);
    });
    render();
  }
  function restoreLook() {
    cancelLook(); S.previewBundle = null;
    if (S.c.bg === 'photo' && committedBundle && committedBundle.key === bundleKey(S.c)) installBundle(committedBundle, S.c);
    else if (S.c.bg !== 'photo' || S.bundleKey === bundleKey(S.c)) installBundle(null, S.c);
    else setLook({}, { transient: true });
  }

  /* ---------- Lifecycle and remote input ---------- */
  var clockTimer = 0, rotationTimer = 0, activeSince = 0, activeMs = 0, rotationKey = '';
  function rotationActive() { return !document.hidden && top().id === 'home' && S.c.bg === 'photo' && !S.pending && mode().min > 0; }
  function pauseRotation() {
    if (activeSince) { activeMs += Date.now() - activeSince; activeSince = 0; }
    clearTimeout(rotationTimer); rotationTimer = 0;
  }
  function resetRotation() { pauseRotation(); activeMs = 0; rotationKey = ''; }
  function syncRotation() {
    var key = S.c.wall + '|' + S.c.mode;
    pauseRotation();
    if (key !== rotationKey) { activeMs = 0; rotationKey = key; }
    if (!rotationActive()) return;
    activeSince = Date.now();
    rotationTimer = setTimeout(function () {
      pauseRotation(); activeMs = 0;
      if (rotationActive()) setLook({ wall: WALLS[(wallIndex(S.c.wall) + 1) % WALLS.length].id }, { row: 'bg' });
    }, Math.max(10, mode().min * QA.minuteMs - activeMs));
  }
  function updateClock() {
    clearTimeout(clockTimer);
    if (document.hidden) return;
    updateStatusPill();
    if ((top().id === 'home' || isSettingsDetail(top())) && S.c.layout === 'list') renderCaption(top(), homeState(top()));
    clockTimer = setTimeout(updateClock, 60000 - (Date.now() % 60000) + 30);
  }
  function focusStage() { try { stage.focus({ preventScroll: true }); } catch (e) { stage.focus(); } }
  function after() { norm(); render(); syncRotation(); }
  function goScene(name) {
    if (top().id === 'wallpaper') cancelWallpaperTimer(top());
    S.stack = [S.stack[0]]; S.stack[0].f.zone = 'apps'; clearSession(); restoreLook();
    if (name === 'apps') openApps();
    else if (name === 'settings') openSettings();
    else if (name === 'appearance') { openSettings(); top().f.id = 'background'; S.settingsFocus = 'background'; openAppearance('background'); }
    else if (name === 'editor') { openSettings(); openEditor('settings'); }
    after();
  }
  function fit() {
    /* Search draws its own keyboard, so nothing can shrink the viewport under
       the sheet; the stage stays centred and uniformly scaled. The guard below
       is kept for a browser window whose height alone is too short for 16:9. */
    /* At 1:1 the stage carries no transform at all: a scaled layer is rasterised
       once more at the scaled size, and on the TV that costs a full 1920x1080
       re-raster of every surface on the stage for nothing. */
    if (window.innerHeight < 920 && window.innerWidth >= 1920) {
      var s = window.innerWidth / 1920;
      stage.style.transform = s === 1 ? 'none' : 'scale(' + s + ')';
      stage.style.left = '0px';
      stage.style.top = '0px';
      if (window.scrollY !== 0 || window.scrollX !== 0) window.scrollTo(0, 0);
      return;
    }
    var scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    stage.style.transform = scale === 1 ? 'none' : 'scale(' + scale + ')';
    stage.style.left = ((window.innerWidth - 1920 * scale) / 2) + 'px';
    stage.style.top = ((window.innerHeight - 1080 * scale) / 2) + 'px';
  }
  function renderedAction(el) {
    return el.getClientRects().length > 0 && window.getComputedStyle(el).visibility !== 'hidden';
  }
  function focusedAction() {
    var root = isSettingsDetail(top()) ? appearanceEl : sheetEl.hidden ? homeEl : sheetEl, els = root.querySelectorAll('.is-focus[data-action]'), i;
    for (i = 0; i < els.length; i++) if (renderedAction(els[i])) return els[i].getAttribute('data-action');
    return null;
  }
  function activate(action) {
    var root = isSettingsDetail(top()) ? appearanceEl : sheetEl.hidden ? homeEl : sheetEl, els = root.querySelectorAll('[data-action]'), i;
    if (action === 'appearance.bg' && top().id === 'appearance' && top().group === 'background') action = 'background.wallpaper';
    if (action === 'settings.appearance' && top().id === 'settings') action = 'settings.group.background';
    for (i = 0; i < els.length; i++) if (renderedAction(els[i]) && els[i].getAttribute('data-action') === action) { pointAt(els[i]); return true; }
    return false;
  }
  function pointAt(el, ev) {
    var t = top(), v = V[t.id];
    norm();
    if (v.point) v.point(t, el.getAttribute('data-z'), +el.getAttribute('data-i'), el.getAttribute('data-id'), el, ev);
    norm();
    render();
    syncRotation();
  }

  utilsEl.addEventListener('mouseover', function (ev) {
    var b = ev.target, t = top(), z, i;
    if (utilsEl.className.indexOf('quiet-utils') < 0 || t.lifted) return;
    while (b && b !== utilsEl && !(b.getAttribute && b.getAttribute('data-z'))) b = b.parentNode;
    if (!b || b === utilsEl || (ev.relatedTarget && b.contains(ev.relatedTarget))) return;
    z = b.getAttribute('data-z'); i = Number(b.getAttribute('data-i'));
    if ((t.id !== 'home' || z !== 'util') && (t.id !== 'arrange' || z !== 'ctl')) return;
    if (t.f.zone === z && t.f.u === i) return;
    t.f.zone = z; t.f.u = i;
    if (z === 'util') S.lastUtil = i;
    render();
  });
  stage.addEventListener('click', function (ev) {
    var el = ev.target;
    while (el && el !== stage && !(el.getAttribute && el.getAttribute('data-z'))) el = el.parentNode;
    focusStage();
    if (!el || el === stage) return;
    pointAt(el, ev);
  });
  var heldKeys = {};

  /* ---------- Re-arranging Home, the way APL Launcher does it ----------
     A long press on a tile opens a small menu rather than dragging it:
     "Edit Home Screen" puts that app into move mode, "Move to Folder" lists the
     folders (and offers a new one), and a folder's menu can delete it. A short
     OK still opens the app, so nothing changes unless the key is really held. */
  var HOLD_MS = 550, holdTimer = 0, holdCode = 0, holdId = null;
  /* A held OK on this remote is followed by a second press a few milliseconds
     after the release (the set delivers release+press for one physical press).
     That phantom press used to land on the menu the hold had just opened, run
     its first item and drop straight back out - which is why the screen seemed
     to close the instant it appeared. Everything that opens on a hold arms this
     gate, and OK is ignored until it expires. */
  var swallowOk = 0;
  function holdOpened() { swallowOk = Date.now() + 480; }
  var editMode = false;
  function canArrange(id) {
    return top().id === 'home' && S.c.layout === 'dock' && !!id && S.c.home.indexOf(id) >= 0 && S.c.home.length > 1;
  }
  /* The drawer's row/column of an app id. The order saved on Home is not the
     drawer's order - the two built-in tiles come first and an app the TV no
     longer reports is left out - so the position is read back from the rows the
     dock is about to draw. Without this, moving an app changed its data but left
     the highlight on the tile that used to be under it. */
  function focusDockApp(id) {
    var rows = getAppleTVAppRows(), r, c;
    for (r = 0; r < rows.length; r++) {
      c = rows[r].map(function (a) { return a.id; }).indexOf(id);
      if (c >= 0) { S.appleTvRow = r; S.appleTvCol = c; return true; }
    }
    return false;
  }
  function startEdit(id) {
    if (!canArrange(id)) return;
    holdOpened();
    editMode = true;
    holdId = id;
    S.sel = id;
    S.selIdx = S.c.home.indexOf(id);
    S.note = app(id).name + '  \u00b7  arrows to move  \u00b7  OK to set down';
    focusDockApp(id);
    render();
  }
  function leaveEdit() {
    if (holdId) focusDockApp(holdId);
    editMode = false;
    holdId = null;
    S.note = '';
    render();
  }
  function slideSel(step) {
    var i = S.c.home.indexOf(holdId), j = i + step, h;
    if (!step || i < 0 || j < 0 || j >= S.c.home.length) return;
    /* The top row is the dock capsule. Folders belong on the grid below it, so
       a folder can never be moved up into that row. */
    if (folder(holdId) && j < 4) { S.note = 'Folders stay below the top row'; render(); return; }
    h = S.c.home.slice();
    h.splice(i, 1);
    h.splice(j, 0, holdId);
    if (!homeMove(h, holdId, snap())) return;
    S.selIdx = j;
    focusDockApp(holdId);
    render();
  }

  /* ---------- The hold-OK menu ---------- */
  var menuItems = [], menuIndex = 0, menuAnchor = null, menuOpen = false;
  function renderMenu() {
    if (!menuListEl) return;
    var html = '', i, it;
    for (i = 0; i < menuItems.length; i++) {
      it = menuItems[i];
      html += '<button type="button" class="ctx-item' + (i === menuIndex ? ' is-focus' : '') + '" data-i="' + i + '" role="menuitem">' +
        '<span class="ctx-label">' + esc(it.label) + '</span>' +
      '</button>';
    }
    setHTML(menuListEl, html);
  }
  /* The menu floats over the tile it belongs to, and flips above it when the
     bottom of the stage is too close. Measured in stage pixels, not screen
     ones, so it lands on the tile at any preview scale. */
  function placeMenu() {
    var sr, scale = 1, r, cx, top, w = 380, h, stageH = 1080;
    if (!menuEl || !menuAnchor || !menuAnchor.getBoundingClientRect || !sceneEl) return;
    sr = sceneEl.getBoundingClientRect();
    if (sr.width) scale = sr.width / 1920 || 1;
    r = menuAnchor.getBoundingClientRect();
    cx = (r.left + r.width / 2 - sr.left) / scale;
    h = menuEl.offsetHeight || (menuItems.length * 64 + 28);
    top = (r.bottom - sr.top) / scale + 16;
    if (top + h > stageH - 28) top = (r.top - sr.top) / scale - h - 16;
    menuEl.style.left = Math.round(clamp(cx - w / 2, 24, 1920 - w - 24)) + 'px';
    menuEl.style.top = Math.round(clamp(top, 24, Math.max(24, stageH - h - 24))) + 'px';
  }
  function openMenu(items, anchorEl) {
    window.requestAnimationFrame(paintCtxGlass);
    if (!items || !items.length || !menuEl) return false;
    /* Opened by a hold: the phantom press after the release must not choose a
       row before the viewer has seen the menu. */
    holdOpened();
    menuItems = items;
    menuIndex = 0;
    menuAnchor = anchorEl || launchAnchorEl();
    menuOpen = true;
    renderMenu();
    menuEl.hidden = false;
    menuEl.classList.remove('is-open');
    void menuEl.offsetWidth;
    menuEl.classList.add('is-open');
    placeMenu();
    return true;
  }
  function closeMenu() {
    if (!menuOpen) return;
    menuOpen = false;
    menuItems = [];
    menuAnchor = null;
    if (menuEl) { menuEl.classList.remove('is-open'); menuEl.hidden = true; }
  }
  function moveMenu(d) {
    if (!menuItems.length || !menuListEl) return;
    menuIndex = (menuIndex + d + menuItems.length) % menuItems.length;
    var items = menuListEl.querySelectorAll('.ctx-item'), i;
    for (i = 0; i < items.length; i++) {
      if (i === menuIndex) items[i].classList.add('is-focus');
      else items[i].classList.remove('is-focus');
    }
  }
  function menuKey(k) {
    if (k === 'back') { closeMenu(); return; }
    if (k === 'up') { moveMenu(-1); return; }
    if (k === 'down') { moveMenu(1); return; }
    if (k === 'ok') {
      var item = menuItems[menuIndex];
      closeMenu();
      if (item && item.run) item.run();
    }
  }

  /* A new folder starts as a grid tile holding the app it was made from. It is
     placed at the first grid slot even when the app came from the top row, so a
     folder never appears in the dock capsule. */
  function createFolderFor(appId) {
    var at = S.c.home.indexOf(appId), fid, folders, h, before, slot;
    if (at < 0) return;
    fid = 'folder.' + Date.now();
    folders = (S.c.folders || []).slice();
    folders.push({ id: fid, name: folderNameFor([appId]), apps: [appId] });
    h = S.c.home.slice();
    h.splice(at, 1);
    slot = Math.max(4, Math.min(at, h.length));
    h.splice(slot, 0, fid);
    before = snap();
    if (!write(next(h, S.c.recent.slice(), folders), 'New folder')) { S.note = 'Could not save the folder.'; render(); return; }
    S.undo.push({ label: 'New folder', snap: before });
    S.sel = fid;
    S.selIdx = h.indexOf(fid);
    focusDockApp(fid);
    S.note = (folder(fid) || {}).name + ' created  \u00b7  hold OK on an app to add it';
    render();
  }
  function addAppToFolder(folderId, appId) {
    var f = folder(folderId), a = app(appId), folders, h, before;
    if (!f || !a) return;
    if (f.folderApps.indexOf(appId) >= 0) { S.note = a.name + ' is already in ' + f.name; render(); return; }
    folders = (S.c.folders || []).map(function (x) {
      if (x.id === folderId) return { id: x.id, name: x.name, apps: x.apps.concat([appId]).slice(0, FOLDER_MAX) };
      return { id: x.id, name: x.name, apps: x.apps.filter(function (id) { return id !== appId; }) };
    }).filter(function (x) { return x.apps.length; });
    h = S.c.home.filter(function (id) {
      if (id === appId) return false;
      if (String(id).indexOf('folder.') === 0) return folders.some(function (x) { return x.id === id; });
      return true;
    });
    before = snap();
    if (!write(next(h, S.c.recent.slice(), folders), 'Move app to folder')) { S.note = 'Could not save the folder.'; render(); return; }
    S.undo.push({ label: 'Move to folder', snap: before });
    S.note = a.name + ' is in ' + f.name;
    render();
  }
  function deleteFolder(id) {
    var f = folder(id), folders, h, before;
    if (!f) return;
    folders = (S.c.folders || []).filter(function (x) { return x.id !== id; });
    h = [];
    S.c.home.forEach(function (x) {
      if (x !== id) { h.push(x); return; }
      f.folderApps.forEach(function (appId) { if (h.indexOf(appId) < 0) h.push(appId); });
    });
    before = snap();
    if (!write(next(h.slice(0, CAP), S.c.recent.slice(), folders), 'Delete folder')) { S.note = 'Could not delete the folder.'; render(); return; }
    S.undo.push({ label: 'Delete folder', snap: before });
    S.note = 'Folder deleted: its apps are back on Home';
    render();
  }
  /* ---------- Renaming a folder ----------
     A remote can only type on the screen's own keyboard, and that opens for a
     focused field. So the name is edited in a real <input> laid over the stage:
     OK on the keyboard commits, Back cancels, leaving the field commits whatever
     is in it. */
  var renameEl = $('renameEl'), renameInput = $('renameInput'), renameId = null;
  function renameFolder(id) {
    var f = folder(id);
    if (!f || !renameEl || !renameInput) return;
    renameId = id;
    closeMenu();
    renameInput.value = f.name;
    renameEl.hidden = false;
    renameEl.classList.remove('is-open');
    void renameEl.offsetWidth;
    renameEl.classList.add('is-open');
    setTimeout(function () {
      try { renameInput.focus(); renameInput.setSelectionRange(f.name.length, f.name.length); } catch (e) {}
    }, 30);
  }
  function closeRename(commit) {
    var id, name, folders, before, f;
    if (!renameEl || renameEl.hidden) return;
    id = renameId;
    name = renameInput ? renameInput.value.replace(/\s+/g, ' ').trim().slice(0, 40) : '';
    renameId = null;
    renameEl.classList.remove('is-open');
    renameEl.hidden = true;
    if (commit && id && name && folder(id) && folder(id).name !== name) {
      folders = (S.c.folders || []).map(function (x) {
        return x.id === id ? { id: x.id, name: name, apps: x.apps.slice() } : x;
      });
      before = snap();
      if (write(next(S.c.home.slice(), S.c.recent.slice(), folders), 'Rename folder')) {
        S.undo.push({ label: 'Rename folder', snap: before });
        S.note = 'Renamed to ' + name;
      } else {
        S.note = 'Could not rename the folder.';
      }
    }
    if (folderState) { f = folder(folderState.id); if (folderTitleEl && f) folderTitleEl.textContent = f.name; }
    render();
  }
  if (renameInput) {
    renameInput.addEventListener('keydown', function (ev) {
      if (ev.keyCode === 13) { ev.preventDefault(); ev.stopPropagation(); closeRename(true); }
      else if (ev.keyCode === 27 || ev.keyCode === 10009) { ev.preventDefault(); ev.stopPropagation(); closeRename(false); }
    });
    renameInput.addEventListener('blur', function () {
      setTimeout(function () { if (renameEl && !renameEl.hidden) closeRename(true); }, 0);
    });
  }
  function openDockMenu() {
    var id = S.sel, a = app(id), anchor;
    if (!canArrange(id)) return false;
    anchor = document.querySelector('.appletv-tile.is-focus') || launchAnchorEl();
    if (a.folder) {
      openMenu([
        { label: 'Open Folder', run: function () { openFolder(id); } },
        { label: 'Rename Folder', run: function () { renameFolder(id); } },
        { label: 'Edit Home Screen', run: function () { startEdit(id); } },
        { label: 'Delete Folder', run: function () { deleteFolder(id); } }
      ], anchor);
    } else {
      openMenu([
        { label: 'Edit Home Screen', run: function () { startEdit(id); } },
        { label: 'Move to Folder', run: function () { openFolderChooser(a, anchor); } },
        /* A built-in has no drawer entry to come back from, so it is never
           removed from Home; it can still be moved and folded. */
        a.builtin ? null : { label: 'Remove from Home', run: function () { homeRemove(id); } }
      ].filter(function (x) { return !!x; }), anchor);
    }
    return true;
  }
  function openFolderChooser(a, anchor) {
    var items = (S.c.folders || []).map(function (f) {
      return { label: f.name, run: function () { addAppToFolder(f.id, a.id); } };
    });
    items.push({ label: 'New Folder', run: function () { createFolderFor(a.id); } });
    openMenu(items, anchor);
  }
  function openFolderMenu() {
    var f = folderState && folder(folderState.id), members, m, anchor;
    if (!f || !folderGridEl) return false;
    members = folderMembers(f);
    m = members[folderFocusIndex(f)];
    if (!m) return false;
    anchor = folderGridEl.querySelector('.folder-app.is-focus') || folderPanelEl;
    openMenu([
      { label: 'Open ' + m.name, run: function () { folderLaunch(); } },
      { label: 'Rename Folder', run: function () { renameFolder(f.id); } },
      { label: 'Remove from Folder', run: function () { removeAppFromFolder(f.id, m.id); } }
    ], anchor);
    return true;
  }
  function removeAppFromFolder(folderId, appId) {
    var f = folder(folderId), folders, h, gone = false, before, at;
    if (!f) return;
    folders = (S.c.folders || []).map(function (x) {
      if (x.id !== folderId) return { id: x.id, name: x.name, apps: x.apps.slice() };
      return { id: x.id, name: x.name, apps: x.apps.filter(function (id) { return id !== appId; }) };
    }).filter(function (x) { return x.apps.length; });
    if (!folders.some(function (x) { return x.id === folderId; })) {
      /* The last app left: the folder and its slot go, and the app takes that
         slot back, so removing the last member never loses it from Home. */
      gone = true;
      at = S.c.home.indexOf(folderId);
      h = S.c.home.filter(function (x) { return x !== folderId; });
      if (h.indexOf(appId) < 0) h.splice(clamp(at, 0, h.length), 0, appId);
    } else {
      h = S.c.home.slice();
      if (folderState) folderState.i = 0;
    }
    before = snap();
    if (!write(next(h, S.c.recent.slice(), folders), 'Remove app from folder')) { S.note = 'Could not save the folder.'; render(); return; }
    S.undo.push({ label: 'Remove from folder', snap: before });
    S.note = app(appId).name + ' is back on Home';
    if (gone) closeFolder();
    else renderFolder();
    render();
  }

  var lastDpadRepeatTime = 0, lastDpadCode = 0;
  /* A held direction key is stepped by this timer, not by the remote's own
     repeats. The set's repeats arrive without `ev.repeat`, and some builds send
     none at all, so pacing had to move inside the app: press once and it steps
     at a rhythm it controls, release and it stops. The platform's repeats are
     dropped by the gate above, so a hold cannot double-step. */
  var dpadPace = 0, dpadPaceCode = 0, dpadPaceKey = '', dpadPaceView = '';
  /* Timings measured on a set by APL Launcher, which had the same problem: a
     held direction key should not start repeating the instant it is pressed,
     because the first step is the deliberate one. It waits 600 ms, then steps
     every 170 ms. Repeating from the first frame is what made a short press
     overshoot a tile, and a steady 240 ms was slower than the eye expects once
     the hold was clearly intentional. */
  var DPAD_FIRST_MS = 600, DPAD_PACE_MS = 170;
  /* The set's remote repeats faster than a row can settle. At 145 ms the dock was
     restarting its 150 ms travel before the eye saw the previous one land, which
     is the judder a held key produced. 185 ms lets each step finish, so a held
     press reads as a steady glide rather than a stutter; a tap never repeats, so
     a single press is exactly as quick as it was. */
  var MIN_DPAD_REPEAT_MS = 185;
  function stopDpadPace(refresh) {
    if (dpadPace) { clearTimeout(dpadPace); dpadPace = 0; }
    dpadPaceKey = '';
    dpadPaceView = '';
    if (refresh && top() && top().id === 'home' && S.c.layout === 'dock') {
      clearTimeout(dockSettle);
      dockSettle = setTimeout(function () {
        dockSettle = 0;
        if (top() && top().id === 'home' && S.c.layout === 'dock') render();
      }, 120);
    }
  }
  function startDpadPace(code, k) {
    stopDpadPace();
    dpadPaceCode = code;
    dpadPaceKey = k;
    dpadPaceView = top() ? top().id : '';
    function step() {
      dpadPace = 0;
      if (!dpadPaceKey) return;
      /* A launch, a sheet or a view change takes the remote away: a hold must
         never keep stepping into a screen the viewer has moved on from. */
      if (launchActive || editMode || menuOpen || !top() || top().id !== dpadPaceView || V[top().id].sheet) {
        stopDpadPace();
        return;
      }
      press(dpadPaceKey);
      dpadPace = setTimeout(step, DPAD_PACE_MS);
    }
    dpadPace = setTimeout(step, DPAD_FIRST_MS);
  }

  document.addEventListener('keydown', function (ev) {
    var code = ev.keyCode, k = KEYS[code];
    if (code === 9) { ev.preventDefault(); return; }
    /* The remote's Play/Pause is the Control Centre key, as it is on the TV's
       own panel: one press opens the ported panel from Home, another closes it. */
    /* A ported panel that handled the press has already called preventDefault. */
    if ((code === 10252 || code === 67) && !ev.defaultPrevented && !menuOpen && !(ev.target && ev.target.tagName === 'INPUT')) {
      /* 10252 is the remote's Play/Pause; 67 is the C key, which stands in for
         it in a browser preview, where no remote key reaches the page. */
      if ((top().id === 'home' || top().id === 'apps') && window.APL && APL.controlCenter) {
        ev.preventDefault();
        APL.controlCenter.toggle();
        return;
      }
    }
    /* A field is being typed on (a folder's name): the keys belong to it. */
    if (ev.target && ev.target.tagName === 'INPUT') return;
    /* The press that follows a release right after a hold: not a press. */
    if (k === 'ok' && swallowOk) {
      if (Date.now() < swallowOk) { ev.preventDefault(); heldKeys[code] = true; return; }
      swallowOk = 0;
    }
    /* A menu is the topmost layer: it owns the remote until it closes. */
    if (menuOpen) {
      if (!k || ev.metaKey || ev.ctrlKey || ev.altKey) return;
      ev.preventDefault();
      menuKey(k);
      return;
    }
    /* A folder is modal: it owns the remote until it closes, and no direction
       pacing or edit-mode step may run underneath it. */
    if (folderState) {
      if (!k || ev.metaKey || ev.ctrlKey || ev.altKey) return;
      ev.preventDefault();
      if (k === 'ok') {
        /* Tap opens the app; holding OK opens the app's own small menu
           ("Remove from Folder"), the same gesture as the Home Screen. */
        if (ev.repeat || heldKeys[code]) return;
        heldKeys[code] = true;
        holdCode = code;
        holdTimer = setTimeout(function () { holdTimer = 0; openFolderMenu(); }, HOLD_MS);
        return;
      }
      folderKey(k);
      return;
    }
    if (k === 'left' || k === 'right' || k === 'up' || k === 'down') {
      var now = Date.now();
      /* A held key is gated by the clock, not by `ev.repeat`: the set's remote
         delivers its repeats without ever setting that flag, so the interval
         that was supposed to pace a held scroll never applied on the TV and
         every repeat walked the row at the remote's own rate. The gap is
         measured per key, so changing direction quickly is never swallowed. */
      /* The pace loop below owns the held key. A repeat that arrives while it
         runs is the same step a second time - this is what made a hold faster
         than the interval, and uneven with it. */
      if (dpadPace && code === dpadPaceCode) { ev.preventDefault(); return; }
      if (code === lastDpadCode && now - lastDpadRepeatTime < MIN_DPAD_REPEAT_MS) {
        ev.preventDefault();
        return;
      }
      lastDpadCode = code;
      lastDpadRepeatTime = now;
      startDpadPace(code, k);
    }
    /* While the app's card is filling the screen the remote belongs to that
       transition: any press would land on a tile the viewer can no longer see.
       Back still cancels, and a queued launch is dropped with it. */
    if (launchActive) {
      ev.preventDefault();
      if (k === 'back') cancelLaunch();
      return;
    }
    if (!k || ev.metaKey || ev.ctrlKey || ev.altKey) return;
    ev.preventDefault();
    if (editMode) {
      if (k === 'left') slideSel(-1);
      else if (k === 'right') slideSel(1);
      else if (k === 'up') slideSel(-6);
      else if (k === 'down') slideSel(6);
      else if (k === 'ok' || k === 'back') leaveEdit();
      return;
    }
    if ((k === 'ok' || k === 'back') && (ev.repeat || heldKeys[code])) return;
    heldKeys[code] = true;
    /* OK on a dock tile waits for the release: a tap opens the app, a hold opens
       the tile's menu. Every other key still acts the moment it is pressed. */
    if (k === 'ok' && canArrange(S.sel)) {
      holdCode = code;
      holdTimer = setTimeout(function () { holdTimer = 0; openDockMenu(); }, HOLD_MS);
      return;
    }
    press(k);
  });
  document.addEventListener('keyup', function (ev) {
    delete heldKeys[ev.keyCode];
    if (ev.keyCode === dpadPaceCode) stopDpadPace(true);
    if (holdTimer && ev.keyCode === holdCode) {
      clearTimeout(holdTimer);
      holdTimer = 0;
      if (folderState) folderLaunch();
      else press('ok');
    }
  });
  window.addEventListener('blur', function () { heldKeys = {}; stopDpadPace(); });
  window.addEventListener('focus', function () { release(); hideLaunch(); focusStage(); after(); updateClock(); if (window.CleanFrameStatus) CleanFrameStatus.refresh(); });
  document.addEventListener('visibilitychange', function () {
    heldKeys = {};
    stopDpadPace();
    if (document.hidden) { pauseRotation(); pauseDwell(); clearTimeout(clockTimer); }
    else { release(); hideLaunch(); after(); updateClock(); focusStage(); if (window.CleanFrameStatus) CleanFrameStatus.refresh(); }
  });
  window.addEventListener('resize', fit);
  window.addEventListener('scroll', function () {
    if (window.scrollX !== 0 || window.scrollY !== 0) {
      window.scrollTo(0, 0);
    }
  });


  /* Readable browser checks use the real state and actions, without fake outcomes. */
  var NAV = { left: 'left', right: 'right', up: 'up', down: 'down', ok: 'ok', enter: 'ok', back: 'back', escape: 'back' };
  QA.state = function () {
    var out = serialise(S.c), t = top(), item = t.id === 'appearance' ? detailLocation(t).item : null;
    out.committed = S.c; out.shown = S.shown; out.pending = S.pending; out.view = t.id; out.selected = S.sel;
    out.focusAction = focusedAction(); out.writes = S.writes; out.failedWrites = S.failed; out.error = S.err;
    out.catalog = { loading: catalog.loading, loaded: catalog.loaded, error: catalog.error, ids: ALPHA.slice() };
    out.fonts = { available: LOOK_VALUES.font.slice(), loaded: Object.keys(fontMetrics).filter(function (id) { return !fontMetrics[id].fallback; }), baselineFallback: !!(fontMetrics.manrope && fontMetrics.manrope.fallback), error: S.lookError && S.lookError.type === 'font' ? S.lookError : null };
    out.rotation = { activeMs: activeMs + (activeSince ? Date.now() - activeSince : 0), active: !!activeSince };
    out.draft = t.lifted ? { id: t.lifted.id, order: t.lifted.order.slice() } : null;
    out.settingsGroup = t.id === 'wallpaper' ? 'wallpaper' : t.id === 'appearance' ? t.group : null;
    out.focusedChoice = item && item.axis ? { axis: item.axis, value: item.value, action: item.action, disabled: item.disabled } : null;
    out.candidate = out.focusedChoice ? { axis: item.axis, value: item.value, action: item.action, pending: !!S.pending, pendingTarget: S.pending ? S.pending.target : null } : null;
    out.wallpaperPicker = t.id === 'wallpaper' ? { candidate: WALLS[t.i].id, applied: S.c.wall, shown: S.wallShown, pending: t.previewDue || S.wallPending,
      queuedApplying: !!t.applyPending, applyPending: t.applyPending, failed: t.failedId, zone: t.f.zone, top: t.top, visible: WALL_VISIBLE, backdrop: IMG.bg.src } : null;
    out.undo = S.undo.map(function (u) { return u.label; }); out.storageOk = storageOk;
    out.backdrop = { app: backdropApp, url: backdropUrl, active: backdropActive(), wanted: backdropWanted(t), row: S.appleTvRow || 0, col: S.appleTvCol || 0,
      poster: BK.pick ? BK.pick.url : '', fast: !!BK.fast, pending: BK.pending, queued: !!BK.queued,
      catalogue: window.CleanFrameBackdrops ? CleanFrameBackdrops.status() : null };
    return JSON.parse(JSON.stringify(out));
  };
  QA.where = function () {
    var action = focusedAction(), active = stage.querySelectorAll('.is-focus[data-action]'), count = 0, name = '';
    Array.prototype.forEach.call(active, function (el) { if (renderedAction(el)) { count++; if (el.getAttribute('data-action') === action) name = el.getAttribute('aria-label') || el.textContent.replace(/\s+/g, ' ').trim(); } });
    return { view: top().id, settingsGroup: top().id === 'wallpaper' ? 'wallpaper' : top().id === 'appearance' ? top().group : null, focus: name, focusAction: action, focusCount: count, wallpaper: S.wallShown, zone: top().f.zone || null };
  };
  QA.ready = function () { return fontsReady && !S.pending && !!S.shown && S.shown.bg === S.c.bg && S.shown.wall === S.c.wall && S.shown.font === S.c.font; };
  QA.nav = function () { var keys = arguments.length === 1 && Array.isArray(arguments[0]) ? arguments[0] : Array.prototype.slice.call(arguments); keys.forEach(function (key) { if (!NAV[key]) throw new Error('Unknown key'); press(NAV[key]); }); return QA.state(); };
  QA.look = function (patch) { setLook(patch, {}); return QA.state(); };
  QA.scene = function (name) { if (['home', 'apps', 'settings', 'appearance', 'editor'].indexOf(name) < 0) throw new Error('Unknown view'); goScene(name); return QA.state(); };
  QA.activate = function (action) { return activate(action) ? QA.state() : null; };
  QA.actions = function () { var view = isSettingsDetail(top()) ? appearanceEl : sheetEl.hidden ? homeEl : sheetEl; return Array.prototype.filter.call(view.querySelectorAll('[data-action]'), renderedAction).map(function (el) { return el.getAttribute('data-action'); }); };
  /* Drives the sheet exactly as typing on its own keyboard does, so a browser
     check can wait for the catalogue without a real remote. */
  QA.search = function (query) {
    var q = String(query == null ? '' : query);
    if (top().id !== 'search') openSearch();
    searchState.query = q;
    updateSearchField(q);
    triggerSearch(q, 0);
    if (top().id === 'search') renderSearch(top());
    return QA.searchInfo();
  };
  QA.searchInfo = function () {
    var t = top(), f = t.f || {}, cards = searchContentEl ? searchContentEl.querySelectorAll('.search-tile').length : 0;
    return {
      view: t.id, query: searchState.query || '', loading: !!searchState.loading,
      zone: f.zone || null, tab: f.tab || null, key: f.zone === 'keys' ? searchKeyAt(f.tab, f.kr, f.kc) : null,
      caret: !!(searchFieldEl && searchFieldEl.classList.contains('has-query')),
      scopes: (searchState.scopes || []).map(function (r) { return r.name; }),
      suggestions: (searchState.sugs || []).map(function (s) {
        return s.kind === 'title' ? 'title:' + s.item.title : s.kind === 'app' ? 'app:' + s.app.name : 'search:' + s.ref.name;
      }),
      cards: cards, rows: (searchState.rows || []).length,
      rowIndex: f.ri === undefined ? null : f.ri,
      sugCount: (searchState.sugs || []).length,
      focusedScope: document.querySelector('.search-scope.is-focus') ? f.sc : null,
      focusedSuggestion: document.querySelector('.search-sug.is-focus') ? f.si : null,
      focusedCard: document.querySelector('.search-tile.is-focus') ? true : false
    };
  };


  /* The boot wordmark is plain HTML so the first paint is never a black
     rectangle; the first real render takes over and it fades away. */
  function hideBoot() {
    var b = $('boot');
    if (!b) return;
    b.className = 'is-off';
    setTimeout(function () { if (b.parentNode) b.parentNode.removeChild(b); }, 120);
  }

  /* ---------- Start ---------- */
  /* The wordmark is the set's own name, not the launcher's. */
  document.title = PROFILE.name;
  (function () { var boot = $('boot'); var label = boot && boot.querySelector('span'); if (label) label.textContent = PROFILE.name; }());
  cueL.innerHTML = icon('left'); cueR.innerHTML = icon('right');
  initialise();
  norm(); fit(); focusStage();
  /* Paint the dock, capsule and clock before the wallpaper decodes. The stage
     used to stay black until the photo and its panel copy were ready; on the TV
     that wait was the cold-start black screen. */
  render();
  hideBoot();
  /* The next row's marks are filled in as soon as the set has an idle slot - the
     first frame above deliberately left them out. This is not a delay the viewer
     sees: it lands before a Down can ask for that row. */
  idleTask(function () {
    if (firstPaintDone) return;
    firstPaintDone = true;
    if (top() && top().id === 'home') render();
  });
  setLook({}, { transient: true, startup: true });
  updateClock(); syncRotation();
  /* The control panel is built the first time it is opened, and this later pass
     is only a warm-up so that opening it is instant; nothing waits for it. */
  setTimeout(function () {
    idleTask(function () { if (controlGrid && !controlGrid.firstChild) buildControlPanel(); });
  }, 1600);
  if (window.CleanFrameBackdrops) {
    /* Let the first frame land, then ask for the posters. The request used to
       wait 2.4 s and the row another 2.2 s behind that, which is why the focused
       tile sat on the bare wallpaper for the first five seconds; posters are
       fetched one at a time now, so they can start as soon as the dock is up. */
    setTimeout(function () {
      CleanFrameBackdrops.start(function () {
        backdropApp = '';
        if (top() && top().id === 'home') render();
        setTimeout(function () {
          syncBackdropRow();
          /* No timed re-render loop follows any more. It ran a full pass of the
             whole Home screen every 320 ms for the first four seconds, which on
             the set was the "lag" the viewer felt after start. A poster that
             arrives schedules one render from paintPoster, so the only passes
             now are the ones that actually changed something. */
        }, 400);
      });
    }, 900);
  }
  if (window.CleanFrameStatus) {
    CleanFrameStatus.subscribe(function () { updateStatusPill(); updateControlStatus(); });
    /* The status refresh is an IPC round trip. On a timer it landed in the
       middle of the first posters arriving, which is the hitch the set showed a
       few seconds after start; it waits for an idle slot now. */
    setTimeout(function () { idleTask(function () { CleanFrameStatus.refresh(); }); }, 3000);
    setInterval(function () { CleanFrameStatus.refresh(); }, 30 * 60 * 1000);
  }
  /* getAppsInfo is another IPC round trip: it waits for an idle slot after the
     first paint rather than a fixed delay that could land on a render. */
  setTimeout(function () { idleTask(refreshCatalog); }, 1500);
  /* Two clips decoded once the launcher is up, so the first press already has
     its sound. Nothing is read while the first frame is being painted. */
  setTimeout(function () {
    idleTask(function () { if (window.CleanFrameAudio && CleanFrameAudio.warm) CleanFrameAudio.warm(); });
  }, 2400);
  /* The screen saver module and its catalogue are parse work the launcher does
     not need to reach its first frame. They are read in order once the dock is
     up, well before the idle timer or the Settings page could want them. */
  setTimeout(function () {
    /* Lite has no saver in the archive and no row in Settings for it. */
    if (LITE) return;
    var files = ['assets/aerials/catalog.js', 'aerial.js'];
    (function next(i) {
      if (i >= files.length) return;
      var s = document.createElement('script');
      s.src = files[i];
      s.onload = function () {
        /* A Settings page opened in the first seconds would have shown the
           saver as unavailable; it fills in as soon as the module lands. */
        if (top() && top().id === 'appearance' && top().group === 'aerial') render();
        next(i + 1);
      };
      s.onerror = function () { next(i + 1); };
      document.body.appendChild(s);
    })(0);
    /* Off the launcher's own window: the saver is only wanted once the set has
       been left alone, so its module and catalogue are read late and on an idle
       slot rather than a timer that fires while the first key is being handled. */
  }, 6000);
  if (window.location.hash === '#row1') { setTimeout(function () { S.appleTvRow = 1; render(); }, 60); } else if (window.location.hash === '#row2') { setTimeout(function () { S.appleTvRow = 2; render(); }, 60); }
  if (window.location.hash === '#ha') { setTimeout(function () { openHAPanel(); }, 60); }
  if (window.location.hash === '#homeapp') { setTimeout(function () { openHomeApp(); }, 60); }
  if (window.location.hash === '#settings') { setTimeout(function () { openSettings(); }, 60); }
  if (window.location.hash === '#editor') { setTimeout(function () { openEditor('settings'); }, 60); }
  if (window.location.hash.indexOf('#appearance') === 0) {
    var grp = window.location.hash.slice(12) || 'appearance';
    setTimeout(function () { openAppearance(grp); }, 60);
  }
  if (window.location.hash.indexOf('#search') === 0) {
    /* `#search=term` opens the sheet with a query already typed, for browser
       screenshots; plain `#search` opens it empty. */
    var hashTerm = window.location.hash.indexOf('#search=') === 0 ? decodeURIComponent(window.location.hash.slice(8)) : '';
    setTimeout(function () {
      openSearch();
      if (hashTerm) setTimeout(function () { QA.search(hashTerm); }, 120);
    }, 50);
  }
})();
