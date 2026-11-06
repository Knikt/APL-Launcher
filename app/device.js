/* Public Tizen application APIs. No Mac server, network address or credentials. */
(function () {
  'use strict';
  var IDS = {
    stremio: 'newslO9NqF.stremio', netflix: 'org.tizen.netflix-app',
    disneyplus: 'MCmYXNxgcu.DisneyPlus', youtube: '9Ur5IzDKqV.TizenYouTube',
    appletv: 'com.samsung.tv.aria-video', primevideo: 'org.tizen.primevideo',
    abciview: 'mWK87Xghap.ABCiview', sbs: 'OyE7OuxlUi.SBSOnDemand',
    applemusic: 'org.tizen.apple.apple-music',
    nuviotv: 'NuvioTV001.NuvioTV', hotstar: 'fiZNCxMH9Y.Hotstar',
    sonyliv: 'EUKHUxrGQA.SonyLIV', moonlight: 'MoonLightS.MoonlightWasm',
    /* The visible TV Plus app, not `com.samsung.tv.tvPlusDeeplinker`: the
       deeplinker is a headless handler, so launching it reports success while
       nothing appears on screen. */
    samsungtvplus: 'com.samsung.tv.tvplus'
  };
  var STREAMING = ['as6cYRgkPy.Binge', '73iTZRTc34.Stan', '5b8c3eb16b.BeamCTVDev',
    'KaLitts8bq.tenplaySamsungTizen', 'eYuOiOLYQX.KayoSports', 'Ne2ZsPWdKl.9NOW',
    '3KA0pm7a7V.TubiTV', 'rJeHak5zRg.Spotify', 'icp4AvUPiA.7plus'];
  var CONSUMER_SYSTEM = ['org.tizen.browser', 'com.microsoft.copilot'];
  var EXTRA_BRANDS = {'rJeHak5zRg.Spotify': 'spotify', '5b8c3eb16b.BeamCTVDev': 'hbomax', '3KA0pm7a7V.TubiTV': 'tubi', 'NuvioTV001.NuvioTV': 'nuviotv', 'fiZNCxMH9Y.Hotstar': 'hotstar', 'EUKHUxrGQA.SonyLIV': 'sonyliv', 'MoonLightS.MoonlightWasm': 'moonlight', 'com.samsung.tv.tvplus': 'samsungtvplus', 'com.samsung.tv.tvPlusDeeplinker': 'samsungtvplus', 'newslO9NqF.stremio': 'stremio', 'xvvl3S1TT1.TizenTubeStandalone': 'tizentube', 'AQKO41xyKP.AmazonAlexa': 'alexa', 'com.samsung.tv.cobalt-yttv': 'youtubetv', 'com.samsung.tv.cobalt-ytkids': 'youtubekids', 'org.tizen.browser': 'internet'};
  var INTERNAL = ['adplatform.ADPlayer', 'WykOS4t4F0.cmsWebApp', '25emanual3.emanual',
    'ZODRT12q2l.WebAccountExtension', 'ByJlgt0XeD.CastSettingsApp', 'tv6pbVMQFF.PrivacyChoices'];
  var SELF = 'CfrmLs03B1.CleanFrame';
  /* Packages whose search screen is YouTube's own results list. They answer the
     same results URL/the same search operation as the Samsung YouTube app. */
  var YOUTUBE_APPS = ['9Ur5IzDKqV.TizenYouTube', 'xvvl3S1TT1.TizenTubeStandalone',
    'com.samsung.tv.cobalt-yttv', 'com.samsung.tv.cobalt-yt', 'com.samsung.tv.cobalt-ytkids'];
  var YOUTUBE_BRANDS = ['youtube', 'tizentube', 'youtubetv', 'youtubekids'];
  function api() { return window.tizen && window.tizen.application; }
  function unavailable(done) {
    done({ message: 'Open CleanFrame on the TV to use this control.', detail: 'The web preview cannot control the TV.' });
  }
  function failure(err) {
    return { message: 'The TV could not open this screen.', detail: err && (err.message || err.name) || 'Try again, or press the remote’s Home button to return to CleanFrame.' };
  }
  function bounded(done) {
    var finished = false, timer = setTimeout(function () { finish({ message: 'The TV did not respond. Please try again.' }); }, 8000);
    function finish(err, value) { if (finished) return; finished = true; clearTimeout(timer); done(err, value); }
    return finish;
  }
  function hideSelf() {
    try {
      if (window.tizen && window.tizen.application && window.tizen.application.getCurrentApplication) {
        var currentApp = window.tizen.application.getCurrentApplication();
        if (currentApp) {
          // Immediately exit so the graphics surface is completely destroyed by Tizen compositor,
          // instantly releasing the hardware lock on Movie/Calibrated Picture Mode.
          // Pressing the remote Home button re-launches CleanFrame instantly via native startup assignment.
          try { currentApp.exit(); } catch (eE) {}
        }
      }
    } catch (e) {}
  }
  /* A launch reports success the moment the request is accepted, which is
     before the target window exists on a cold start. Exiting CleanFrame then
     leaves the home role momentarily ownerless, so Tizen restarts its home app
     (CleanFrame) over the app that is still opening: the target flashes once
     and CleanFrame reappears — first launch broken, second launch fine because
     the window is already up. Losing focus happens almost immediately when the
     launch request is accepted, so it is not proof that the target is ready.
     Wait a settle period after CleanFrame leaves the front, cancel if it comes
     back (target failed or the viewer returned Home), and keep a ceiling for
     the case where the firmware never reports visibility. CleanFrame must still
     exit eventually: a persistent web-app home makes Tizen treat it as a
     browser and locks picture modes. */
  var EXIT_SETTLE_MS = 7000;
  var EXIT_CEILING_MS = 20000;
  function exitWhenRaised() {
    var done = false, started = Date.now(), awaySince = 0, iv;
    function stop() {
      if (done) return;
      done = true;
      clearInterval(iv);
      document.removeEventListener('visibilitychange', onShow);
      window.removeEventListener('focus', onShow);
    }
    function go() {
      if (done) return;
      stop();
      hideSelf();
    }
    function onShow() {
      /* The target never took the screen, or the viewer returned Home. */
      if (!document.hidden) stop();
    }
    function tick() {
      var now = Date.now(), away = document.hidden || !document.hasFocus();
      if (away) {
        if (!awaySince) awaySince = now;
        if (now - awaySince >= EXIT_SETTLE_MS) { go(); return; }
      } else if (awaySince) {
        stop();
        return;
      }
      if (now - started >= EXIT_CEILING_MS) go();
    }
    document.addEventListener('visibilitychange', onShow);
    window.addEventListener('focus', onShow);
    if (document.hidden || !document.hasFocus()) awaySince = Date.now();
    iv = setInterval(tick, 250);
  }
  function launchApp(id, done, opts) {
    if (!api()) { unavailable(done); return; }
    var finish = bounded(done);
    var keepSelf = !!(opts && opts.keepSelf);
    function settle() { if (!keepSelf) exitWhenRaised(); finish(null); }
    function attempt(targetId, fallbackId) {
      try {
        api().launch(targetId, function () { settle(); }, function (err) {
          if (fallbackId) { attempt(fallbackId, null); }
          else { finish(failure(err)); }
        });
      } catch (err) {
        if (fallbackId) { attempt(fallbackId, null); }
        else { finish(failure(err)); }
      }
    }
    var FALLBACK = {
      'com.samsung.tv.tvPlusDeeplinker': 'com.samsung.tv.tvplus',
      'com.samsung.tv.tvplus': 'com.samsung.tv.tvPlusDeeplinker',
      '9Ur5IzDKqV.TizenYouTube': 'com.samsung.tv.cobalt-yt'
    };
    /* Samsung's own apps do not keep one id: Samsung TV Plus is
       com.samsung.tv.tvplus on some sets, its deeplinker on others, and a store
       number (3201907018807 or similar) on others again, which is why a tile
       can sit there and refuse to open. When every known id has refused, the
       installed list is asked for the app by the name the set shows, and the id
       it answers with is launched instead. */
    var NAMES = {
      'com.samsung.tv.tvplus': /^(samsung\s*)?tv\s*plus$/i,
      'com.samsung.tv.tvPlusDeeplinker': /^(samsung\s*)?tv\s*plus$/i
    };
    function byName(re, next) {
      if (!re || !api().getAppsInfo) { next(); return; }
      try {
        api().getAppsInfo(function (list) {
          var i, a;
          for (i = 0; i < list.length; i++) {
            a = list[i];
            if (!a || !a.id || a.show === false || a.id === SELF) continue;
            if (re.test(String(a.name || '').trim())) { next(a.id); return; }
          }
          next();
        }, function () { next(); });
      } catch (e) { next(); }
    }
    /* An app that is already open comes back as it was, video included. Without
       SkipReload the screen reloads the whole web app, which is the long black
       pause when returning to Netflix or YouTube - the same fix APL Launcher
       applies before it launches anything. */
    function resume(target, next) {
      var app = api();
      if (!app.getAppsContext) { next(); return; }
      try {
        app.getAppsContext(function (list) {
          var i, running = false;
          for (i = 0; i < list.length; i++) if (list[i] && list[i].appId === target) { running = true; break; }
          if (!running) { next(); return; }
          try {
            var ctl = new tizen.ApplicationControl('http://tizen.org/appcontrol/operation/default', null, null, null,
              [new tizen.ApplicationControlData('SkipReload', ['Yes'])]);
            app.launchAppControl(ctl, target, function () { settle(); }, function () { next(); });
          } catch (e) { next(); }
        }, function () { next(); });
      } catch (e) { next(); }
    }
    byName(NAMES[id] || null, function (found) {
      var target = found && found !== id ? found : id;
      resume(target, function () { attempt(target, target === id ? (FALLBACK[id] || null) : null); });
    });
  }
  /* Samsung's own shell apps have shipped under several ids across firmwares, and the
     id differs between regions. Try the known ids, then fall back to matching the
     installed-app list by name so we never guess a single hard-coded id. */
  var SYSTEM_CANDIDATES = {
    home: ['com.samsung.tv.csfs', 'com.samsung.tv.csfs.home', 'com.samsung.tv.home'],
    settings: ['com.samsung.tv.coba.setting', 'com.samsung.tv.settings', 'com.samsung.tv.settings.menu'],
    /* Samsung ships each settings screen as its own app on this firmware, so the
       Wi-Fi and Bluetooth tiles land on the network list and the sound/speaker
       list instead of the top of the menu. The main settings app stays in each
       list as the fallback, so a firmware without the sub-app still opens
       something useful. */
    network: ['com.samsung.tv.coba.setting.networksettings', 'com.samsung.tv.coba.setting', 'com.samsung.tv.settings'],
    bluetooth: ['com.samsung.tv.coba.setting.btspeakerlist', 'com.samsung.tv.coba.setting.sound', 'com.samsung.tv.coba.setting', 'com.samsung.tv.settings']
  };
  /* Only these two kinds can be found by name: every Samsung settings sub-app is
     called "Setting" in the installed-app list, so the specific screens can be
     reached by id only. */
  var SYSTEM_NAME = { home: /^(samsung\s+)?home$/i, settings: /^((tv|picture|sound)\s+)?settings?$/i };
  function launchSystem(kind, done) {
    if (!api()) { unavailable(done); return; }
    var finish = bounded(done);
    var queue = (SYSTEM_CANDIDATES[kind] || []).slice();
    var lastErr = null;

    function launchId(id) {
      try { api().launch(id, function () { finish(null); }, function (err) { finish(failure(err)); }); }
      catch (e) { finish(failure(e)); }
    }
    function discover() {
      var re = SYSTEM_NAME[kind];
      if (!re) { finish(failure(lastErr || { message: 'The TV did not offer this screen.' })); return; }
      try {
        api().getAppsInfo(function (list) {
          var found = null;
          for (var i = 0; i < list.length; i++) {
            var a = list[i];
            if (!a || !a.id || a.id === SELF || INTERNAL.indexOf(a.id) >= 0) continue;
            if (re.test((a.name || '').trim())) { found = a.id; break; }
          }
          if (!found) { finish(failure(lastErr || { message: 'The TV did not offer this screen.' })); return; }
          launchId(found);
        }, function (err) { finish(failure(err)); });
      } catch (e) { finish(failure(e)); }
    }
    function next() {
      if (!queue.length) { discover(); return; }
      var id = queue.shift();
      try {
        api().launch(id, function () { finish(null); }, function (err) { lastErr = err; next(); });
      } catch (e) { lastErr = e; next(); }
    }
    next();
  }
  function launch(brand, done) {
    if (!IDS[brand]) { done({message: 'This app has no launch target.'}); return; }
    launchApp(IDS[brand], done);
  }
  function art(done) {
    if (!api()) { unavailable(done); return; }
    var finish = bounded(done);
    try {
      var data = [new tizen.ApplicationControlData('mode', ['fullscreen']), new tizen.ApplicationControlData('requester', ['mobile'])];
      var control = new tizen.ApplicationControl('http://tizen.org/appcontrol/operation/default', null, null, null, data);
      api().launchAppControl(control, 'org.tizen.art-app', function () { finish(null); }, function (err) { finish(failure(err)); });
    } catch (err) { finish(failure(err)); }
  }
  /* ---------- Vetro ----------
     Samsung's own screens (Home, Settings) ignore an app-control launch from a
     web app: the app starts and stays *behind* the launcher, which is what
     "Settings opened behind the apps" looks like. APL Launcher hit the same wall
     and goes through Vetro - the small root service on the set that runs a
     command for us at 127.0.0.1:8099. A no-cors POST is enough: the answer is
     not needed to raise a screen, only to know the request left the app. */
  var VETRO = 'http://127.0.0.1:8099';
  function vetroRun(cmd, done) {
    var settled = false;
    function finish(sent) { if (settled) return; settled = true; if (done) done(sent); }
    try {
      if (!window.fetch) { finish(false); return; }
      window.fetch(VETRO + '/exec', {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'content-type': 'text/plain' },
        body: JSON.stringify({ cmd: cmd })
      }).then(function () { finish(true); }, function () { finish(false); });
    } catch (e) { finish(false); }
    /* A refused connection rejects, so this only covers a socket that accepted
       the request and then hung; either way the screen has had its command. */
    setTimeout(function () { finish(true); }, 1500);
  }
  /* Vetro is the only path that actually raises these two; the app-control
     launch stays as the fallback for a set where Vetro is not running. */
  function vetroSystem(cmd, kind, done) {
    vetroRun(cmd, function (sent) {
      if (sent) { if (done) done(null); return; }
      launchSystem(kind, done);
    });
  }
  function home(done) { vetroSystem('app_launcher -s com.samsung.tv.csfs >/dev/null 2>&1', 'home', done); }
  function settings(done) { vetroSystem('app_launcher -s org.tizen.menu >/dev/null 2>&1', 'settings', done); }
  /* The control panel's two radio tiles: the TV's own screen for each list. */
  function network(done) { launchSystem('network', done); }
  function bluetooth(done) { launchSystem('bluetooth', done); }
  /* Samsung Universal Search sends provider payloads as app-control data. Prime
     Video's payload is the catalogue GTI, passed as {"values":"amzn1.dv.gti..."}
     with the default operation. This is the one third-party deep link we have
     verified; the app's own web URL is not used for this path. */
  function launchPrimeTitle(gti, done) {
    if (!api()) { unavailable(done); return; }
    var finish = bounded(done);
    try {
      var data = [new tizen.ApplicationControlData('PAYLOAD', [JSON.stringify({ values: gti })])];
      var control = new tizen.ApplicationControl('http://tizen.org/appcontrol/operation/default', null, null, null, data);
      api().launchAppControl(control, IDS.primevideo, function () {
        exitWhenRaised();
        finish(null);
      }, function () {
        launchApp(IDS.primevideo, finish);
      });
    } catch (e) {
      launchApp(IDS.primevideo, finish);
    }
  }
  function launchMedia(provider, title, extra, done) {
    if (!api()) { unavailable(done); return; }
    var finish = bounded(done);
    var p = (provider || 'primevideo').toLowerCase();
    var appId = IDS[p] || p;
    var fallbackId = (p === 'disneyplus') ? IDS.hotstar : (p === 'samsungtvplus' ? 'com.samsung.tv.tvplus' : null);
    var term = (title || '').trim();
    var contentId = (extra && extra.id) ? String(extra.id) : '';
    var webUrl = (extra && /^https?:\/\//i.test(String(extra.webUrl || ''))) ? String(extra.webUrl) : '';
    var dataArr = [];
    var uri = null;
    /* The library apps' own routes, in the spellings their parsers use. These
       are collected before the payload below so the rungs can be built from
       them, which is why the collector is declared here. */
    var schemeVariants = [];

    if (p === 'primevideo' && extra && extra.gti) {
      launchPrimeTitle(String(extra.gti), finish);
      return;
    }

    /* The app is handed the title's own page and the ids that go with it, so an
       app that honours a link lands on that title rather than on its search
       list. Only Prime's GTI payload and the Nuvio/Stremio imdb routes are
       verified on the reference TV; Apple TV and SonyLIV ignore a title link
       and answer their home screen, so their search step stays in the chain and
       remains the last resort. */
    var titleType = (extra && extra.type === 'series') ? 'series' : 'movie';
    var titleId = contentId;
    if (!titleId) {
      var idMatch = /\/title\/(\d+)/.exec(webUrl) || /\/detail\/(\d+)/.exec(webUrl) ||
        /\/(\d{6,})(?:[\/?#]|$)/.exec(webUrl) || /(umc\.[a-z0-9.]+)/i.exec(webUrl);
      if (idMatch) titleId = idMatch[1];
    }
    /* An offer without a page still gets the service's own title address, built
       from its id, so the view control carries the title rather than the search
       list. */
    if (!webUrl && titleId) {
      if (p === 'netflix') webUrl = 'https://www.netflix.com/title/' + titleId;
      /* Hotstar became JioHotstar and the old host redirects, which a TV app
         that reads the link itself does not follow - it answers its home
         screen. The current host is the one to hand it. */
      else if (p === 'hotstar') webUrl = 'https://www.jiohotstar.com/in/watch/' + titleId;
      else if (p === 'sonyliv') webUrl = 'https://www.sonyliv.com/detail/' + titleId;
    }
    /* SonyLIV and JioHotstar address a title by a numeric id, and their pages
       carry more than one - a show's own id and the episode's. Both are offered
       in page order, because each app answers "content not found" for the wrong
       one instead of falling back to the other itself. */
    var titleIds = [];
    if (titleId) titleIds.push(titleId);
    var idNumbers = String(webUrl).match(/\d{6,}/g) || [];
    for (var idNumber = 0; idNumber < idNumbers.length && titleIds.length < 3; idNumber++) {
      if (titleIds.indexOf(idNumbers[idNumber]) < 0) titleIds.push(idNumbers[idNumber]);
    }
    /* Each service's own in-app address. These schemes are not registered with
       Tizen, so they can only travel as application-control data; the rung that
       sends them is tried after the link and before the app's search screen. */
    var schemeUri = '';
    if (titleId) {
      if (p === 'appletv') schemeUri = 'com.apple.tv://' + titleType + '/' + titleId;
      else if (p === 'sonyliv') schemeUri = 'sonyliv://content/' + titleId;
      else if (p === 'hotstar') schemeUri = 'hotstar://content/' + titleId;
      else if (p === 'netflix') schemeUri = 'netflix://title/' + titleId;
    }

    if ((p === 'nuviotv' || p === 'stremio') && contentId && contentId.indexOf('tt') === 0) {
      var sType = (extra && extra.type === 'series') ? 'series' : 'movie';
      uri = (p === 'nuviotv' ? 'nuvio:///detail/' : 'stremio:///detail/') + sType + '/' + contentId;
      /* The library app's own route is the one thing that decides whether it
         opens the title, and the triple-slash form is not the only spelling in
         use. Every shape goes in, along with the bare IMDb id, so whichever one
         this build of the app parses finds it. */
      var schemes = [uri,
        (p === 'nuviotv' ? 'nuvio://detail/' : 'stremio://detail/') + sType + '/' + contentId,
        (p === 'nuviotv' ? 'nuvio:///detail/' : 'stremio:///detail/') + contentId,
        (p === 'nuviotv' ? 'nuvio://' : 'stremio://') + contentId];
      try {
        dataArr.push(new tizen.ApplicationControlData('payload', [JSON.stringify({ url: uri, imdb: contentId, id: contentId, type: sType })]));
        dataArr.push(new tizen.ApplicationControlData('PAYLOAD', [JSON.stringify({ values: JSON.stringify({ imdb: contentId, url: uri, id: contentId, type: sType }) })]));
        dataArr.push(new tizen.ApplicationControlData('url', [uri]));
        dataArr.push(new tizen.ApplicationControlData('imdb', [contentId]));
        for (var sc = 0; sc < schemes.length; sc++) {
          dataArr.push(new tizen.ApplicationControlData('link', [schemes[sc]]));
          dataArr.push(new tizen.ApplicationControlData('deepLink', [schemes[sc]]));
        }
      } catch (e) {}
      for (var sv = 0; sv < schemes.length; sv++) addSchemeVariant(schemes[sv]);
    } else if (p === 'primevideo') {
      uri = webUrl || 'https://app.primevideo.com/search?phrase=' + encodeURIComponent(term);
      try {
        var pvPayload = JSON.stringify({
          values: JSON.stringify({
            search: term,
            query: term,
            phrase: term,
            url: uri
          })
        });
        dataArr.push(new tizen.ApplicationControlData('PAYLOAD', [pvPayload]));
        dataArr.push(new tizen.ApplicationControlData('searchTerm', [term]));
      } catch (e) {}
    } else if (p === 'netflix') {
      /* Prefer the offer's own title URL (…/title/81215527) over the search
         page: the view control carries the exact title to the app when it
         accepts the URL, and the search operation below still catches it when
         it does not. */
      uri = webUrl || 'https://www.netflix.com/search?q=' + encodeURIComponent(term);
      try {
        var nflxPayload = JSON.stringify({
          action: 'search',
          query: term,
          url: uri,
          id: titleId
        });
        dataArr.push(new tizen.ApplicationControlData('PAYLOAD', [nflxPayload]));
        dataArr.push(new tizen.ApplicationControlData('query', [term]));
      } catch (e) {}
    } else if (p === 'hotstar') {
      uri = webUrl || 'https://www.jiohotstar.com/in/explore?search_query=' + encodeURIComponent(term);
      try {
        dataArr.push(new tizen.ApplicationControlData('payload', [JSON.stringify({ query: term, search_query: term, url: uri, id: titleId, type: titleType })]));
        dataArr.push(new tizen.ApplicationControlData('PAYLOAD', [JSON.stringify({ values: JSON.stringify({ url: uri, id: titleId, type: titleType }) })]));
        /* The names a player's own deep-link reader looks for, alongside the
           wrapper Samsung documents. One of them is the key its router parses. */
        dataArr.push(new tizen.ApplicationControlData('deeplink', [uri]));
        dataArr.push(new tizen.ApplicationControlData('link', [uri]));
      } catch (e) {}
    } else if (p === 'appletv') {
      uri = webUrl || 'https://tv.apple.com/search?term=' + encodeURIComponent(term);
      try {
        dataArr.push(new tizen.ApplicationControlData('url', [uri]));
        dataArr.push(new tizen.ApplicationControlData('PAYLOAD', [JSON.stringify({ values: JSON.stringify({ url: uri, id: titleId, type: titleType }) })]));
      } catch (e) {}
    } else if (p === 'sonyliv') {
      uri = webUrl || 'https://www.sonyliv.com/search?query=' + encodeURIComponent(term);
      try {
        dataArr.push(new tizen.ApplicationControlData('payload', [JSON.stringify({ query: term, url: uri, id: titleId, type: titleType })]));
        dataArr.push(new tizen.ApplicationControlData('PAYLOAD', [JSON.stringify({ values: JSON.stringify({ search: term, url: uri, id: titleId, type: titleType }) })]));
        dataArr.push(new tizen.ApplicationControlData('deeplink', [uri]));
        dataArr.push(new tizen.ApplicationControlData('link', [uri]));
      } catch (e) {}
    } else if (p === 'disneyplus') {
      uri = webUrl || 'https://www.disneyplus.com/search?q=' + encodeURIComponent(term);
      try {
        dataArr.push(new tizen.ApplicationControlData('url', [uri]));
        dataArr.push(new tizen.ApplicationControlData('PAYLOAD', [JSON.stringify({ values: JSON.stringify({ search: term, url: uri, id: titleId, type: titleType }) })]));
      } catch (e) {}
    } else if (p === 'youtube') {
      if (extra && extra.videoId) {
        uri = 'https://www.youtube.com/watch?v=' + encodeURIComponent(extra.videoId);
      } else if (contentId && contentId.indexOf('tt') < 0) {
        uri = 'https://www.youtube.com/watch?v=' + encodeURIComponent(contentId);
      } else {
        uri = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(term);
      }
      try {
        dataArr.push(new tizen.ApplicationControlData('payload', [JSON.stringify({ url: uri, videoId: (extra && extra.videoId) || '' })]));
        dataArr.push(new tizen.ApplicationControlData('deeplink', [uri]));
        dataArr.push(new tizen.ApplicationControlData('link', [uri]));
      } catch (e) {}
    }

    /* The bare link under the universal-search wrapper. Samsung's Smart Hub
       Preview documents `values` as a string, and the partners that read it
       hand the link straight to their own router, so it is tried before the
       app's search screen. Apps that ignore it simply fail and fall through. */
    var plainValues = (uri && /^https?:/i.test(uri)) ? JSON.stringify({ values: uri }) : '';
    if (uri && /^https?:/i.test(uri)) {
      try {
        dataArr.push(new tizen.ApplicationControlData('http://tizen.org/appcontrol/data/url', [uri]));
      } catch (eUrl) {}
    }
    /* Every address this title answers on, in the order they are worth trying.
       An app that takes a link opens its own router with it, so the address has
       to be the one that service actually serves: a rebrand moves it, and a
       search page is a different shape from a title page. Each gets its own
       rung, because the control that Tizen accepts first ends the ladder. */
    function addSchemeVariant(target) {
      if (target && schemeVariants.indexOf(target) < 0) schemeVariants.push(target);
    }
    var uris = [];
    function addUri(candidate) {
      if (!candidate || !/^https?:\/\//i.test(candidate) || uris.indexOf(candidate) >= 0) return;
      uris.push(candidate);
    }
    addUri(uri);
    if (p === 'hotstar') {
      if (titleId) addUri('https://www.jiohotstar.com/in/watch/' + titleId);
      addUri('https://www.jiohotstar.com/in/explore?search_query=' + encodeURIComponent(term));
    } else if (p === 'sonyliv') {
      if (titleId) addUri('https://www.sonyliv.com/detail/' + titleId);
      addUri('https://www.sonyliv.com/search?query=' + encodeURIComponent(term));
    } else if (p === 'youtube') {
      if (extra && extra.videoId) addUri('https://youtu.be/' + encodeURIComponent(extra.videoId));
      addUri('https://www.youtube.com/results?search_query=' + encodeURIComponent(term));
    }

    function attempt(targetId, secId) {
      var steps = [], step = 0;

      function fail(err) {
        if (step < steps.length) {
          steps[step++]();
          return;
        }
        if (secId) attempt(secId, null);
        else finish(failure(err));
      }

      function plainLaunch() {
        try {
          api().launch(targetId, function () { hideSelf(); finish(null); }, function (err2) {
            fail(err2);
          });
        } catch (e2) {
          fail(e2);
        }
      }

      function defaultControl() {
        if (!dataArr.length) { fail(); return; }
        try {
          var defControl = new tizen.ApplicationControl(
            'http://tizen.org/appcontrol/operation/default',
            null,
            null,
            null,
            dataArr
          );
          api().launchAppControl(defControl, targetId, function () {
            exitWhenRaised();
            finish(null);
          }, function (errDef) {
            fail(errDef);
          });
        } catch (eDef) {
          fail(eDef);
        }
      }

      function valuesControl() {
        if (!plainValues) { fail(); return; }
        try {
          var bare = new tizen.ApplicationControl(
            'http://tizen.org/appcontrol/operation/default',
            null,
            null,
            null,
            [new tizen.ApplicationControlData('PAYLOAD', [plainValues])]
          );
          api().launchAppControl(bare, targetId, function () {
            exitWhenRaised();
            finish(null);
          }, function (errValues) {
            fail(errValues);
          });
        } catch (eValues) {
          fail(eValues);
        }
      }

      /* A custom scheme cannot go in the control's URI (Tizen rejects an
         unregistered scheme), so it travels in the data keys instead. */
      /* A custom scheme cannot go in the control's URI, so it travels in the
         data keys. Each spelling gets its own rung for the library apps, whose
         route parser is what decides whether the title opens. */
      function schemeStepFor(target) {
        return function () {
          if (!target) { fail(); return; }
          try {
            var schemeData = [
              new tizen.ApplicationControlData('http://tizen.org/appcontrol/data/url', [target]),
              new tizen.ApplicationControlData('url', [target])
            ];
            var schemeControlObj = new tizen.ApplicationControl(
              'http://tizen.org/appcontrol/operation/default',
              null,
              null,
              null,
              schemeData
            );
            api().launchAppControl(schemeControlObj, targetId, function () {
              exitWhenRaised();
              finish(null);
            }, function (errScheme) {
              fail(errScheme);
            });
          } catch (eScheme) {
            fail(eScheme);
          }
        };
      }
      function schemeControl() { schemeStepFor(schemeUri)(); }
      var schemeSteps = [];
      for (var sv2 = 0; sv2 < schemeVariants.length; sv2++) schemeSteps.push(schemeStepFor(schemeVariants[sv2]));

      /* SonyLIV advertises `search.format` as {"assetId":"%%CONTENT_ID%%"} in
         its own package, so the id travels under that name; the generic names
         go along with it for the apps that read one of those instead. */
      function assetStep(candidateId) {
        return function () {
          if (!candidateId) { fail(); return; }
          try {
            var asset = { type: titleType, assetId: candidateId, id: candidateId, contentId: candidateId };
            var assetData = [
              new tizen.ApplicationControlData('PAYLOAD', [JSON.stringify({ values: JSON.stringify(asset) })]),
              new tizen.ApplicationControlData('assetId', [candidateId]),
              new tizen.ApplicationControlData('contentId', [candidateId])
            ];
            var assetControlObj = new tizen.ApplicationControl(
              'http://tizen.org/appcontrol/operation/default',
              null,
              null,
              null,
              assetData
            );
            api().launchAppControl(assetControlObj, targetId, function () {
              exitWhenRaised();
              finish(null);
            }, function (errAsset) {
              fail(errAsset);
            });
          } catch (eAsset) {
            fail(eAsset);
          }
        };
      }
      var assetSteps = [];
      for (var assetIndex = 0; assetIndex < titleIds.length; assetIndex++) {
        assetSteps.push(assetStep(titleIds[assetIndex]));
      }

      function appSearchControl() {
        if (!term) { fail(); return; }
        try {
          var searchData = [new tizen.ApplicationControlData('http://tizen.org/appcontrol/data/text', [term])];
          var searchControl = new tizen.ApplicationControl(
            'http://tizen.org/appcontrol/operation/search',
            null,
            null,
            null,
            searchData
          );
          api().launchAppControl(searchControl, targetId, function () {
            exitWhenRaised();
            finish(null);
          }, function (errSearch) {
            fail(errSearch);
          });
        } catch (eSearch) {
          fail(eSearch);
        }
      }

      /* A view rung per address. `targetUri` may be a custom scheme that Tizen
         would reject in the control's own URI field, so only http(s) travels
         there; the rest go in the data keys. */
      function viewStepFor(targetUri) {
        return function () {
          if (!(dataArr.length > 0 || targetUri || uri)) { fail(); return; }
          try {
            var launchUri = (targetUri && /^https?:/i.test(targetUri)) ? targetUri :
              ((uri && /^https?:/i.test(uri)) ? uri : null);
            var control = new tizen.ApplicationControl(
              'http://tizen.org/appcontrol/operation/view',
              launchUri,
              null,
              null,
              dataArr.length ? dataArr : null
            );
            api().launchAppControl(control, targetId, function () {
              exitWhenRaised();
              finish(null);
            }, function (errView) {
              fail(errView);
            });
          } catch (e1) {
            fail(e1);
          }
        };
      }
      function viewControl() { viewStepFor(uri)(); }
      var viewSteps = [];
      for (var u = 0; u < uris.length; u++) viewSteps.push(viewStepFor(uris[u]));

      /* Neither Apple TV nor SonyLIV acts on the assetId payload its own
         package advertises: Apple TV ignores it on the visible app and its
         hidden search entry shows nothing, while SonyLIV answers "content not
         found" for both movie and series ids. Both keep the URL/search route
         that at least opens the app reliably. */
      /* Apple TV and SonyLIV answer their home screen to every link shape tried
         so far, so they get every remaining rung: the title page, the bare
         wrapper, their own in-app scheme, the id under the name their package
         advertises, the JSON wrapper, their search screen, then a plain launch. */
      if (p === 'nuviotv' || p === 'stremio') {
        /* The library apps are the one pair that really do open an exact title,
           so every spelling of their own route is tried before the generic
           payload that names it as data. */
        steps = [viewControl].concat(schemeSteps).concat([valuesControl, defaultControl, appSearchControl, plainLaunch]);
      } else if (p === 'appletv') {
        steps = viewSteps.concat([valuesControl, schemeControl, assetStep(titleId), defaultControl, appSearchControl, plainLaunch]);
      } else if (p === 'sonyliv' || p === 'hotstar') {
        /* Both open their own home screen when handed a link, and that launch
           reports success, so a rung after it never runs. Their id rungs go
           first - deepest link first - then their scheme, then each address
           they may serve the title on, then the generic shapes. */
        steps = assetSteps.concat([schemeControl]).concat(viewSteps).concat([valuesControl, defaultControl, appSearchControl, plainLaunch]);
      } else if (p === 'netflix') {
        steps = viewSteps.concat([valuesControl, schemeControl, defaultControl, appSearchControl, plainLaunch]);
      } else {
        steps = viewSteps.concat([valuesControl, defaultControl, appSearchControl, plainLaunch]);
      }
      fail();
    }

    attempt(appId, fallbackId);
  }
  /* Read-only radio status for the control panel. A Tizen app cannot switch
     Wi-Fi or Bluetooth, so the panel reports what the TV exposes and opens
     Samsung's own settings for changes. */
  function radios(done) {
    var out = { network: '', ssid: '', bluetooth: null };
    var sys = window.tizen && window.tizen.systeminfo;
    var pending = 0, finished = false;
    function finish() {
      if (finished) return;
      pending--;
      if (pending <= 0) { finished = true; done(null, out); }
    }
    function read(name, apply) {
      try {
        pending++;
        sys.getPropertyValue(name, function (value) { apply(value); finish(); }, finish);
      } catch (e) { finish(); }
    }
    if (!sys) { done(null, out); return; }
    try {
      out.bluetooth = !!sys.getCapability('http://tizen.org/feature/network.bluetooth');
    } catch (eBluetooth) {}
    read('NETWORK', function (net) {
      if (net && net.networkType) out.network = String(net.networkType);
    });
    read('WIFI_NETWORK', function (wifi) {
      if (wifi && wifi.ssid) out.ssid = String(wifi.ssid);
    });
    if (!pending && !finished) { finished = true; done(null, out); return; }
    setTimeout(function () {
      if (finished) return;
      finished = true;
      done(null, out);
    }, 3000);
  }
  function launchYouTube(videoId, done) {
    if (!api()) { unavailable(done); return; }
    var finish = bounded(done);
    var ytId = IDS.youtube;
    if (!videoId) { launchApp(ytId, done); return; }
    try {
      var url = 'https://www.youtube.com/watch?v=' + encodeURIComponent(videoId);
      var data = [new tizen.ApplicationControlData('payload', ['{"url":"' + url + '"}'])];
      var control = new tizen.ApplicationControl('http://tizen.org/appcontrol/operation/view', url, null, null, data);
      api().launchAppControl(control, ytId, function () { exitWhenRaised(); finish(null); }, function () {
        launchApp(ytId, done);
      });
    } catch (e) {
      launchApp(ytId, done);
    }
  }
  /* YouTube search cannot be read cross-origin by a TV web app. Try the
     results URL through the view control first: the app accepts a normal
     youtube.com address on this TV, while its generic search operation only
     raised the home screen. The search operation and a plain launch remain
     fallbacks. */
  function launchYouTubeSearch(term, done, targetId) {
    if (!api()) { unavailable(done); return; }
    var finish = bounded(done);
    var ytId = targetId || IDS.youtube;
    var text = (term || '').trim();
    if (!text) { launchApp(ytId, done); return; }
    var url = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(text);

    function plainLaunch() { launchApp(ytId, finish); }
    function searchControl() {
      try {
        var data = [new tizen.ApplicationControlData('http://tizen.org/appcontrol/data/text', [text])];
        var control = new tizen.ApplicationControl('http://tizen.org/appcontrol/operation/search', null, null, null, data);
        api().launchAppControl(control, ytId, function () { exitWhenRaised(); finish(null); }, plainLaunch);
      } catch (e) {
        plainLaunch();
      }
    }
    try {
      var payload = [new tizen.ApplicationControlData('payload', [JSON.stringify({ url: url })])];
      var view = new tizen.ApplicationControl('http://tizen.org/appcontrol/operation/view', url, null, null, payload);
      api().launchAppControl(view, ytId, function () { exitWhenRaised(); finish(null); }, searchControl);
    } catch (e) {
      searchControl();
    }
  }
  /* An installed app with no verified search route of its own. Try the standard
     search operation first, then a default-operation payload carrying the term,
     then a plain launch: the app still opens, and only the query is lost. */
  function genericSearch(appId, text, done) {
    if (!api()) { unavailable(done); return; }
    var finish = bounded(done);
    var term = (text || '').trim();
    if (!appId) { finish({ message: 'This app has no launch target.' }); return; }
    if (!term) { launchApp(appId, finish); return; }

    function plainLaunch() { launchApp(appId, finish); }
    function payloadControl() {
      try {
        var data = [
          new tizen.ApplicationControlData('http://tizen.org/appcontrol/data/text', [term]),
          new tizen.ApplicationControlData('PAYLOAD', [JSON.stringify({ values: JSON.stringify({
            search: term, query: term, phrase: term, searchTerm: term
          }) })]),
          new tizen.ApplicationControlData('searchTerm', [term])
        ];
        var control = new tizen.ApplicationControl('http://tizen.org/appcontrol/operation/default',
          null, null, null, data);
        api().launchAppControl(control, appId, function () { exitWhenRaised(); finish(null); }, plainLaunch);
      } catch (e) {
        plainLaunch();
      }
    }
    try {
      var searchData = [new tizen.ApplicationControlData('http://tizen.org/appcontrol/data/text', [term])];
      var search = new tizen.ApplicationControl('http://tizen.org/appcontrol/operation/search',
        null, null, null, searchData);
      api().launchAppControl(search, appId, function () { exitWhenRaised(); finish(null); }, payloadControl);
    } catch (e2) {
      payloadControl();
    }
  }
  /* One door for the Search sheet: hand the typed term to the app's own search
     screen. YouTube has its dedicated results route, a known streaming app
     reuses the verified launchMedia routes, and anything else falls back to the
     generic search operation. */
  function search(ref, term, done) {
    if (!ref) { done({ message: 'That app is not installed.' }); return; }
    var brand = String(ref.brand || ref.id || '');
    var appId = ref.appId || IDS[brand] || IDS[ref.id] || '';
    var text = (term || '').trim();
    var i;
    for (i = 0; i < YOUTUBE_BRANDS.length; i++) {
      if (brand.toLowerCase() === YOUTUBE_BRANDS[i]) {
        if (!api()) { unavailable(done); return; }
        launchYouTubeSearch(text, done, appId || IDS.youtube);
        return;
      }
    }
    for (i = 0; i < YOUTUBE_APPS.length; i++) {
      if (appId === YOUTUBE_APPS[i]) {
        if (!api()) { unavailable(done); return; }
        launchYouTubeSearch(text, done, appId);
        return;
      }
    }
    if (IDS[brand] && brand !== 'youtube') {
      launchMedia(brand, text, {}, done);
      return;
    }
    genericSearch(appId, text, done);
  }
  /* Hand an address to the set's browser. The Home tile opens the owner's own
     Home Assistant kiosk this way, so the dashboard keeps its own login and
     layout and the launcher never has to render it. */
  function openUrl(url, done) {
    var finish, control, tz = window.tizen, data;
    if (!url) { done({ message: 'No address is configured for this app.' }); return; }
    finish = bounded(done);
    if (tz && tz.ApplicationControl && api()) {
      try {
        data = [new tz.ApplicationControlData('http://tizen.org/appcontrol/data/url', [url])];
        control = new tz.ApplicationControl('http://tizen.org/appcontrol/operation/view', url, null, null);
        api().launchAppControl(control, 'org.tizen.browser', function () { exitWhenRaised(); finish(null); },
          function () {
            /* Some firmwares refuse the view operation on a browser launch: try
               the plain app-control shape before giving up. */
            try {
              var plain = new tz.ApplicationControl('http://tizen.org/appcontrol/operation/default', null, null, null, data);
              api().launchAppControl(plain, 'org.tizen.browser', function () { exitWhenRaised(); finish(null); }, function (err) { finish(failure(err)); });
            } catch (err) { finish(failure(err)); }
          });
        return;
      } catch (errOpen) {}
    }
    try {
      window.open(url, '_blank');
      finish(null);
    } catch (errWindow) { finish(failure(errWindow)); }
  }
  function apps(done) {
    if (!api()) { unavailable(done); return; }
    var finish = bounded(done);
    try {
      api().getAppsInfo(function (list) {
        var known = {}, seen = {}, result = [];
        Object.keys(IDS).forEach(function (brand) { known[IDS[brand]] = brand; });
        list.forEach(function (a) {
          var primary = !!known[a.id], stream = STREAMING.indexOf(a.id) >= 0;
          var consumer = /^[A-Za-z0-9]{10}\.[A-Za-z0-9_-]+$/.test(a.id) || CONSUMER_SYSTEM.indexOf(a.id) >= 0 || EXTRA_BRANDS[a.id];
          if (a.id === SELF || INTERNAL.indexOf(a.id) >= 0 || seen[a.id] || !a.name || (!primary && !stream && !EXTRA_BRANDS[a.id] && (!a.show || !consumer))) return;
          /* A leftover install of an older CleanFrame package must not show up as
             a second "CleanFrame" app in the drawer. */
          if (a.id !== SELF && /^cleanframe$/i.test(String(a.name).trim())) return;
          if (!primary && !EXTRA_BRANDS[a.id] && /(?:service|worker|preview|promotion|plugin|launcher|test|sdk|^ep[ -]|factory|daemon|enginefs|network\s+service)/i.test(a.name + ' ' + a.id)) return;
          if (/-dummy$/.test(a.id) || a.id === 'com.samsung.tv.cobalt-yt') return;
          seen[a.id] = true;
          result.push({ appId: a.id, name: a.name, brand: known[a.id] || EXTRA_BRANDS[a.id] || '', icon: a.iconPath || '', rank: primary ? Object.keys(IDS).indexOf(known[a.id]) : (stream ? 20 : 30) });
        });
        result.sort(function (a, b) { return a.rank - b.rank || a.name.toLowerCase().localeCompare(b.name.toLowerCase()); });
        finish(null, result);
      }, function (err) { finish(failure(err)); });
    } catch (err) { finish(failure(err)); }
  }
  window.FrameDevice = { launch: launch, launchApp: launchApp, launchMedia: launchMedia, search: search, launchYouTube: launchYouTube, launchYouTubeSearch: launchYouTubeSearch, art: art, home: home, settings: settings, network: network, bluetooth: bluetooth, apps: apps, radios: radios, openUrl: openUrl };
}());
