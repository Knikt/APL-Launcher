/* CleanFrame Screen Saver: the aerial gallery.

   A drifting scene fills the stage after the set has been left alone for the
   chosen time, with the time and a place tag in the corner, and any key brings
   the launcher back. The scenes are drawn on one 960x540 canvas stretched to
   the screen: a quarter of the pixels, no video decode, no image filtering and
   no blur on the animation path, so the set is not asked to do more than it
   does while it is idle.

   Preferences live in localStorage beside the rest of the launcher's state and
   are read by the Screen Saver section of Settings. */
(function (root) {
  'use strict';

  var THEME_KEY = 'cleanframe.aerial.theme';
  var IDLE_KEY = 'cleanframe.aerial.idle';
  /* Which of the theme's Apple clips to play. -1 keeps the old behaviour: one
     of them at random each time the saver opens. */
  var CLIP_KEY = 'cleanframe.aerial.clip';
  var W = 960, H = 540;
  /* The four drawn themes and the photo family. The place tag is the pair the
     Apple gallery would print for the same footage. */
  var THEMES = {
    landscape: { name: 'Landscape', place: 'Fiordland, New Zealand' },
    space: { name: 'Space', place: 'Low Earth orbit' },
    underwater: { name: 'Underwater', place: 'Great Barrier Reef' },
    city: { name: 'Cityscapes', place: 'Gold Coast, Australia' },
    photos: { name: 'My Photos', place: 'Your gallery' }
  };
  var ORDER = ['landscape', 'space', 'underwater', 'city', 'photos'];
  var IDLES = [['60', '1 minute'], ['120', '2 minutes'], ['300', '5 minutes'],
    ['600', '10 minutes'], ['0', 'Never']];

  var theme = 'landscape', idle = '300', clip = -1;
  var el = null, canvas = null, ctx = null, clockEl = null, placeEl = null;
  var raf = 0, last = 0, t = 0, on = false, manual = false;
  var idleTimer = 0, clockTimer = 0, scene = null, photoIndex = 0, photoAt = 0, photoImg = null;
  var video = null, videoMode = false, videoTimer = 0, tagTimer = 0, retryTimer = 0, retries = 0;

  function store(key, value) {
    try { root.localStorage.setItem(key, String(value)); } catch (e) {}
  }
  function read(key, fallback) {
    var v;
    try { v = root.localStorage.getItem(key); } catch (e) { v = null; }
    return v === null || v === undefined || v === '' ? fallback : v;
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  /* ---------- Scenes ---------- */

  function stars(n) {
    var out = [], i;
    for (i = 0; i < n; i++) out.push({ x: Math.random() * W, y: Math.random() * H,
      r: 0.4 + Math.random() * 1.5, p: Math.random() * 6.28, s: 0.4 + Math.random() });
    return out;
  }
  function hills(n) {
    var out = [], i, j, pts, base, amp;
    for (i = 0; i < n; i++) {
      pts = []; base = H * (0.52 + i * 0.09); amp = 40 + i * 22;
      for (j = 0; j <= 12; j++) pts.push(base - Math.sin(j * 0.7 + i * 1.9) * amp * (0.4 + 0.6 * Math.random()));
      out.push(pts);
    }
    return out;
  }
  function buildings() {
    var out = [], x = 0, w, h, windows, i;
    while (x < W + 60) {
      w = 26 + Math.random() * 54; h = 70 + Math.random() * 210;
      windows = [];
      for (i = 0; i < 26; i++) windows.push({ x: 6 + Math.random() * (w - 12), y: 10 + Math.random() * (h - 16),
        w: 3 + Math.random() * 4, h: 4 + Math.random() * 6, lit: Math.random() < 0.35, p: Math.random() * 6.28 });
      out.push({ x: x, w: w, h: h, windows: windows });
      x += w + 6 + Math.random() * 14;
    }
    return out;
  }
  function motes(n) {
    var out = [], i;
    for (i = 0; i < n; i++) out.push({ x: Math.random() * W, y: Math.random() * H,
      r: 1 + Math.random() * 3, s: 4 + Math.random() * 10, p: Math.random() * 6.28 });
    return out;
  }

  function newScene() {
    if (theme === 'landscape') return { hills: hills(3), clouds: [0, 1, 2, 3].map(function () {
      return { x: Math.random() * W, y: 60 + Math.random() * 180, r: 90 + Math.random() * 120, s: 6 + Math.random() * 10 };
    }) };
    if (theme === 'space') return { stars: stars(180), neb: [0, 1, 2].map(function (i) {
      return { x: Math.random() * W, y: Math.random() * H, r: 160 + Math.random() * 180, s: 2 + Math.random() * 4, i: i };
    }), shoot: { x: 0, y: 0, at: 0 } };
    if (theme === 'underwater') return { motes: motes(60), shafts: [0, 1, 2, 3, 4] };
    if (theme === 'city') return { buildings: buildings(), stars: stars(50) };
    return {};
  }

  function gradient(y0, y1, stops) {
    var g = ctx.createLinearGradient(0, y0, 0, y1), i;
    for (i = 0; i < stops.length; i++) g.addColorStop(stops[i][0], stops[i][1]);
    return g;
  }

  function drawLandscape(time) {
    ctx.fillStyle = gradient(0, H, [[0, '#0b1420'], [0.42, '#243444'], [0.68, '#7d6a55'], [1, '#1a1a19']]);
    ctx.fillRect(0, 0, W, H);
    /* A sun low on the horizon, breathing very slowly. */
    var sun = ctx.createRadialGradient(W * 0.68, H * 0.58, 0, W * 0.68, H * 0.58, 190);
    sun.addColorStop(0, 'rgba(255,214,160,.55)');
    sun.addColorStop(0.4, 'rgba(232,163,110,.18)');
    sun.addColorStop(1, 'rgba(232,163,110,0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, W, H);
    var c, i;
    for (i = 0; i < scene.clouds.length; i++) {
      c = scene.clouds[i];
      c.x += c.s * 0.016 * (1 + time * 0.02);
      if (c.x - c.r > W) c.x = -c.r;
      var g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r);
      g.addColorStop(0, 'rgba(238,232,225,.16)');
      g.addColorStop(1, 'rgba(238,232,225,0)');
      ctx.fillStyle = g;
      ctx.fillRect(c.x - c.r, c.y - c.r, c.r * 2, c.r * 2);
    }
    for (i = 0; i < scene.hills.length; i++) {
      var pts = scene.hills[i], drift = Math.sin(time * 0.06 + i) * 6;
      ctx.beginPath();
      ctx.moveTo(-40, H);
      for (var j = 0; j < pts.length; j++) ctx.lineTo(j * (W / (pts.length - 1)) - 20 + drift * (i + 1) * 0.4, pts[j]);
      ctx.lineTo(W + 40, H);
      ctx.closePath();
      ctx.fillStyle = ['rgba(22,30,38,.92)', 'rgba(14,20,26,.94)', 'rgba(8,12,16,.96)'][i];
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(0,0,0,.18)';
    ctx.fillRect(0, H - 90, W, 90);
  }

  function drawSpace(time) {
    ctx.fillStyle = gradient(0, H, [[0, '#05060d'], [0.55, '#0a0a18'], [1, '#04040a']]);
    ctx.fillRect(0, 0, W, H);
    var i, n, g;
    for (i = 0; i < scene.neb.length; i++) {
      n = scene.neb[i];
      g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
      g.addColorStop(0, i === 0 ? 'rgba(92,74,150,.20)' : i === 1 ? 'rgba(40,96,140,.16)' : 'rgba(150,70,110,.12)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(n.x - n.r, n.y - n.r, n.r * 2, n.r * 2);
    }
    for (i = 0; i < scene.stars.length; i++) {
      var s = scene.stars[i], tw = 0.45 + 0.55 * Math.abs(Math.sin(time * s.s + s.p));
      ctx.fillStyle = 'rgba(255,255,255,' + (tw * 0.85).toFixed(3) + ')';
      ctx.fillRect(s.x, s.y, s.r, s.r);
    }
    /* One streak every few seconds, so the sky is not completely static. */
    var sh = scene.shoot;
    if (time - sh.at > 7) { sh.at = time; sh.x = W * (0.15 + Math.random() * 0.5); sh.y = H * 0.15; }
    if (time - sh.at < 1.1) {
      var k = (time - sh.at) / 1.1;
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.65 * (1 - k)).toFixed(3) + ')';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(sh.x + k * 220, sh.y + k * 120);
      ctx.lineTo(sh.x + k * 220 - 60, sh.y + k * 120 - 33);
      ctx.stroke();
    }
  }

  function drawUnderwater(time) {
    ctx.fillStyle = gradient(0, H, [[0, '#0a3a4a'], [0.45, '#062430'], [1, '#02080c']]);
    ctx.fillRect(0, 0, W, H);
    var i, j;
    /* Light shafts from the surface, drifting with each other. */
    for (i = 0; i < scene.shafts.length; i++) {
      var x = 90 + i * 200 + Math.sin(time * 0.13 + i) * 40;
      var g = ctx.createLinearGradient(x, 0, x + 90, H);
      g.addColorStop(0, 'rgba(150,236,255,.16)');
      g.addColorStop(1, 'rgba(150,236,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x, 0); ctx.lineTo(x + 60 + i * 8, 0); ctx.lineTo(x + 190 + i * 20, H); ctx.lineTo(x + 60, H);
      ctx.closePath(); ctx.fill();
    }
    /* Caustics: a few crossing sine bands, faint and slow. */
    ctx.strokeStyle = 'rgba(190,244,255,.09)';
    ctx.lineWidth = 2;
    for (j = 0; j < 5; j++) {
      ctx.beginPath();
      for (i = 0; i <= W; i += 24) {
        var y = H * (0.18 + j * 0.17) + Math.sin(i * 0.012 + time * 0.7 + j) * 22;
        if (i === 0) ctx.moveTo(i, y); else ctx.lineTo(i, y);
      }
      ctx.stroke();
    }
    for (i = 0; i < scene.motes.length; i++) {
      var m = scene.motes[i];
      m.y -= m.s * 0.016;
      if (m.y < -10) { m.y = H + 10; m.x = Math.random() * W; }
      ctx.fillStyle = 'rgba(214,245,255,.22)';
      ctx.beginPath();
      ctx.arc(m.x + Math.sin(time * 0.5 + m.p) * 8, m.y, m.r, 0, 6.2832);
      ctx.fill();
    }
  }

  function drawCity(time) {
    ctx.fillStyle = gradient(0, H, [[0, '#101423'], [0.38, '#33304a'], [0.62, '#7a5a52'], [1, '#141317']]);
    ctx.fillRect(0, 0, W, H);
    var i, j, b, w;
    for (i = 0; i < scene.stars.length; i++) {
      w = scene.stars[i];
      ctx.fillStyle = 'rgba(255,255,255,' + (0.15 + 0.25 * Math.abs(Math.sin(time * 0.8 + w.p))).toFixed(3) + ')';
      ctx.fillRect(w.x, w.y * 0.5, w.r, w.r);
    }
    var haze = ctx.createLinearGradient(0, H * 0.55, 0, H);
    haze.addColorStop(0, 'rgba(255,170,110,.16)');
    haze.addColorStop(1, 'rgba(255,170,110,0)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, H * 0.5, W, H * 0.5);
    for (i = 0; i < scene.buildings.length; i++) {
      b = scene.buildings[i];
      ctx.fillStyle = 'rgba(10,11,16,.95)';
      ctx.fillRect(b.x, H - b.h, b.w, b.h);
      for (j = 0; j < b.windows.length; j++) {
        w = b.windows[j];
        if (!w.lit) continue;
        var flick = 0.45 + 0.55 * Math.abs(Math.sin(time * 0.35 + w.p));
        ctx.fillStyle = 'rgba(255,214,150,' + (flick * 0.55).toFixed(3) + ')';
        ctx.fillRect(b.x + w.x, H - b.h + w.y, w.w, w.h);
      }
    }
    ctx.fillStyle = 'rgba(0,0,0,.22)';
    ctx.fillRect(0, H - 60, W, 60);
  }

  function photoList() {
    var list = root.CleanFrameWallpapers || [], out = [], i;
    for (i = 0; i < list.length; i++) if (list[i] && list[i].src) out.push(list[i].src);
    return out.length ? out : ['assets/wallpapers/misty.jpg'];
  }
  function loadPhoto() {
    var src = photoList()[photoIndex % photoList().length], img;
    if (!src) return;
    img = new Image();
    img.onload = function () { if (photoImg !== img) return; };
    img.src = src;
    photoImg = img;
    photoAt = t;
  }
  function drawPhotos(time) {
    ctx.fillStyle = '#05070a';
    ctx.fillRect(0, 0, W, H);
    if (!photoImg || !photoImg.complete || !photoImg.naturalWidth) { loadPhoto(); return; }
    if (time - photoAt > 14) { photoIndex++; loadPhoto(); }
    /* A slow push-in over the whole frame: the wall is a painting that moves. */
    var k = 1.02 + 0.06 * clamp((time - photoAt) / 14, 0, 1);
    var iw = photoImg.naturalWidth, ih = photoImg.naturalHeight;
    var scale = Math.max(W / iw, H / ih) * k;
    var dw = iw * scale, dh = ih * scale;
    var dx = (W - dw) / 2 + Math.sin(time * 0.04) * 10;
    var dy = (H - dh) / 2 + Math.cos(time * 0.035) * 8;
    ctx.drawImage(photoImg, dx, dy, dw, dh);
  }

  function draw(time) {
    if (theme === 'space') drawSpace(time);
    else if (theme === 'underwater') drawUnderwater(time);
    else if (theme === 'city') drawCity(time);
    else if (theme === 'photos') drawPhotos(time);
    else drawLandscape(time);
    /* One soft vignette, painted into the frame: no CSS filter over live
       content, and it also keeps the corner clock legible on any scene. */
    var v = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,.55)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
  }

  /* ---------- Loop ---------- */

  function frame(now) {
    raf = 0;
    if (!on || videoMode) return;
    var dt = last ? Math.min(120, now - last) : 33;
    last = now;
    /* 30 fps is enough for a drift and a third of the work of 60. */
    if (dt < 30) { raf = root.requestAnimationFrame(frame); return; }
    t += dt / 1000;
    draw(t);
    raf = root.requestAnimationFrame(frame);
  }

  function paintClock() {
    if (!clockEl) return;
    var d = new Date(), h = d.getHours(), m = d.getMinutes();
    clockEl.textContent = (h % 12 || 12) + ':' + (m < 10 ? '0' + m : m) + (h >= 12 ? ' PM' : ' AM');
  }

  function build() {
    if (el) return;
    el = document.createElement('div');
    el.className = 'aerial';
    el.id = 'aerial';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML =
      '<canvas class="aerial-canvas" id="aerialCanvas" width="' + W + '" height="' + H + '" aria-hidden="true"></canvas>' +
      /* preload=metadata, not auto: these clips are ~180 MB each with the
         index at the end, so the element should ask for the tail and start,
         not pull the whole file down before the first frame. */
      '<video class="aerial-video" id="aerialVideo" muted playsinline loop preload="metadata" aria-hidden="true"></video>' +
      '<div class="aerial-tag"><span class="aerial-place" id="aerialPlace"></span>' +
      '<span class="aerial-clock" id="aerialClock"></span></div>';
    /* Inside the stage, not the body: the stage is the 1920x1080 surface that
       `fit()` scales to the window, so an overlay hung on the body would be
       laid out at full size and land off the edge of a smaller screen. */
    (document.getElementById('stage') || document.body).appendChild(el);
    /* Geometry and stacking are set here as well as in the stylesheet. The saver
       is the one surface that must cover everything or not exist at all, and a
       stylesheet that did not apply it left an unstyled box in the stage, which
       is how footage ended up looking like it was playing behind the apps. */
    el.style.position = 'absolute';
    el.style.top = '0';
    el.style.right = '0';
    el.style.bottom = '0';
    el.style.left = '0';
    el.style.zIndex = '2000';
    el.style.background = '#000';
    canvas = el.querySelector('.aerial-canvas');
    placeEl = el.querySelector('.aerial-place');
    clockEl = el.querySelector('.aerial-clock');
    el.className = 'aerial';
    /* Present in the stage from the first frame so nothing has to be built when
       the set goes idle, but out of the paint until it is actually started. */
    el.style.display = 'none';
    video = el.querySelector('#aerialVideo');
    if (video) {
      video.muted = true;
      video.defaultMuted = true;
      video.volume = 0;
      video.playsInline = true;
      video.setAttribute('muted', '');
      video.setAttribute('playsinline', '');
      video.setAttribute('webkit-playsinline', '');
      video.setAttribute('autoplay', '');
    }
    try { ctx = canvas.getContext('2d'); } catch (e) { ctx = null; }
    /* The video is the real aerial; the canvas underneath is what the set falls
       back to when the clip cannot be fetched, decoded or started, so the
       gallery is never a black screen. */
    function markPlaying() {
      if (!on) { try { video.pause(); } catch (e) {} return; }
      if (videoMode) return;
      videoMode = true;
      clearTimeout(videoTimer);
      videoTimer = 0;
      video.className = 'aerial-video is-on';
      if (raf) root.cancelAnimationFrame(raf);
      raf = 0;
    }
    video.addEventListener('playing', markPlaying);
    video.addEventListener('timeupdate', function () {
      if (video && video.currentTime > 0 && !videoMode) markPlaying();
    });
    video.addEventListener('canplay', function () {
      if (on && !videoMode) {
        try {
          video.muted = true;
          video.volume = 0;
          var p = video.play();
          if (p && p.catch) p.catch(function () {});
        } catch (e) {}
      }
    });
    video.addEventListener('error', function () { if (on && !videoMode) fallbackCanvas(); });
  }

  function aerials() {
    var all = root.CleanFrameAerials || {};
    return all[theme] || [];
  }

  function startCanvas() {
    scene = newScene();
    if (theme === 'photos') { photoImg = null; loadPhoto(); }
    placeEl.textContent = (THEMES[theme] || THEMES.landscape).place;
    draw(0);
    if (!raf) { last = 0; raf = root.requestAnimationFrame(frame); }
  }

  /* A clip that never starts - no network, an unsupported container, autoplay
     refused - leaves the painted scene in its place rather than a black frame. */
  function fallbackCanvas() {
    clearTimeout(videoTimer);
    videoTimer = 0;
    videoMode = false;
    if (video) {
      try { video.pause(); } catch (e) {}
      video.className = 'aerial-video';
      try { video.removeAttribute('src'); video.load(); } catch (e) {}
    }
    if (!ctx || !on) return;
    startCanvas();
    /* One more try with another clip. These files run from 20 to 150 MB and the
       first byte can miss the window on a busy network; the painted scene
       shows while the retry negotiates, and a set that then stayed on it for
       the whole idle period is not what the gallery is for. */
    if (!retryTimer && retries < 1 && aerials().length > 1) {
      retries++;
      retryTimer = setTimeout(function () {
        retryTimer = 0;
        if (on && !videoMode) playClip();
      }, 4500);
    }
  }

  /* Chooses a clip - the one pinned in Settings, or any of the theme's - and
     hands it to the element. */
  function playClip() {
    var list = aerials();
    if (!list.length) return;
    startVideo(list[clip >= 0 && clip < list.length ? clip : Math.floor(Math.random() * list.length)]);
  }

  /* An engine that cannot decode the container should not be asked to try: on
     a set without QuickTime support the element either stalls or, worse, takes
     the page down with it. Asking the element first turns that into the painted
     scene before a byte is fetched. */
  function canPlayAerial() {
    if (!video || !video.canPlayType) return false;
    try {
      return !!(video.canPlayType('video/quicktime; codecs="avc1.42E01E, mp4a.40.2"') ||
        video.canPlayType('video/quicktime'));
    } catch (e) { return false; }
  }

  function startVideo(entry) {
    var p;
    /* The caption Apple prints over the same clip, when the catalogue has one;
       the gallery title is the fallback. */
    placeEl.textContent = entry.caption || entry.name;
    videoMode = false;
    video.className = 'aerial-video';
    if (video) {
      video.muted = true;
      video.defaultMuted = true;
      video.volume = 0;
      video.playsInline = true;
      video.setAttribute('muted', '');
      video.setAttribute('playsinline', '');
      video.setAttribute('webkit-playsinline', '');
      video.setAttribute('autoplay', '');
    }
    try {
      video.pause();
      video.src = entry.url;
      video.load();
    } catch (e) { fallbackCanvas(); return; }
    clearTimeout(videoTimer);
    /* 15 seconds allows slow Wi-Fi or CDN first-byte negotiation */
    videoTimer = setTimeout(function () { if (on && !videoMode) fallbackCanvas(); }, 15000);
    try {
      video.muted = true;
      video.volume = 0;
      p = video.play();
      if (p && p.catch) {
        p.catch(function () {
          /* On autoplay restriction or transient abort, ensure muted is set and retry once;
             do not bail out immediately to canvas pictures before giving videoTimer or canplay a chance. */
          try {
            video.muted = true;
            video.volume = 0;
            var p2 = video.play();
            if (p2 && p2.catch) p2.catch(function () {});
          } catch (e2) {}
        });
      }
    } catch (e) {}
  }

  function start(byHand) {
    var list;
    build();
    if (!el) return;
    on = true;
    manual = !!byHand;
    t = 0; last = 0;
    paintClock();
    clearInterval(clockTimer);
    clockTimer = setInterval(paintClock, 20000);
    clearTimeout(idleTimer);
    idleTimer = 0;
    el.style.display = 'block';
    el.className = 'aerial is-on';
    el.setAttribute('aria-hidden', 'false');
    retries = 0;
    clearTimeout(retryTimer);
    retryTimer = 0;
    list = aerials();
    if (list.length) playClip();
    else if (ctx) startCanvas();
    else { on = false; el.className = 'aerial'; el.setAttribute('aria-hidden', 'true'); }
  }

  function stop() {
    if (!on) return;
    on = false;
    videoMode = false;
    if (raf) root.cancelAnimationFrame(raf);
    raf = 0;
    clearInterval(clockTimer);
    clockTimer = 0;
    clearTimeout(videoTimer);
    videoTimer = 0;
    clearTimeout(tagTimer);
    tagTimer = 0;
    clearTimeout(retryTimer);
    retryTimer = 0;
    if (video) {
      try { video.pause(); } catch (e) {}
      video.className = 'aerial-video';
      try { video.removeAttribute('src'); video.load(); } catch (e) {}
    }
    if (el) {
      /* Not only a class: a stopped saver is taken out of the paint entirely, so
         a clip that is still winding down can never show through the dock. */
      el.className = 'aerial';
      el.style.display = 'none';
      el.setAttribute('aria-hidden', 'true');
    }
    /* Waking the screen is input: the idle period starts again from here. */
    window.CleanFrameInputAt = Date.now();
    arm();
  }

  /* ---------- Idle ---------- */

  function busy() {
    var ids = ['sheet', 'searchView', 'appearance'], i, node, launch;
    /* A flick or a panel that is up is a live screen: the saver waits. */
    if (window.CleanFrameMotion && window.CleanFrameMotion.busy && window.CleanFrameMotion.busy()) return true;
    for (i = 0; i < ids.length; i++) {
      node = document.getElementById(ids[i]);
      if (node && !node.hidden) return true;
    }
    /* The launch screen sits in the page from the start and is shown by a class,
       never by the hidden attribute, so asking `hidden` here said "busy" for
       ever and the saver never started on its own. */
    launch = document.getElementById('launchScreen');
    if (launch && launch.className.indexOf('is-on') >= 0) return true;
    node = document.getElementById('haPanel');
    if (node && node.className.indexOf('is-on') >= 0) return true;
    return false;
  }

  function arm() {
    clearTimeout(idleTimer);
    idleTimer = 0;
    if (!on && idle !== '0' && !document.hidden) {
      idleTimer = setTimeout(function () {
        idleTimer = 0;
        /* The saver only starts on a screen nothing has touched for the whole
           idle period, measured from the launcher's own input clock. A timer
           alone cannot see a held key, and starting over one is what put the
           saver - and its black ground - over a live screen. */
        var quiet = Date.now() - (window.CleanFrameInputAt || 0);
        if (!on && !document.hidden && !busy() && quiet >= Math.max(15000, +idle * 1000)) start(false);
      }, Math.max(15000, +idle * 1000));
    }
  }
  function poke() {
    if (on) return;
    window.CleanFrameInputAt = Date.now();
    arm();
  }

  /* ---------- Preferences ---------- */

  function get(key) {
    if (key === 'idle') return idle;
    /* A clip only exists inside a theme, so the live value the picker compares
       against names both: "space|3". No clip chosen reads as "". */
    if (key === 'clip') return clip >= 0 ? theme + '|' + clip : '-1';
    return theme;
  }
  function set(key, value) {
    if (key === 'theme') {
      if (!THEMES[value]) return theme;
      theme = value;
      /* A clip belongs to a theme, so changing the theme puts the choice back
         to "any of them" rather than leaving a name that no longer applies. */
      clip = -1;
      store(THEME_KEY, theme);
      store(CLIP_KEY, clip);
    } else if (key === 'clip') {
      /* "theme|index" picks a clip and the theme it belongs to in one go, which
         is what the settings picker sends when a video is chosen from another
         theme's group. A plain number still means "this theme's clip". */
      var pair = String(value).split('|'), list, i;
      if (pair.length === 2 && THEMES[pair[0]]) {
        theme = pair[0];
        store(THEME_KEY, theme);
        list = aerials();
        i = parseInt(pair[1], 10);
      } else {
        list = aerials();
        i = parseInt(value, 10);
      }
      clip = (i >= 0 && i < list.length) ? i : -1;
      store(CLIP_KEY, clip);
    } else {
      value = String(value);
      idle = IDLES.some(function (row) { return row[0] === value; }) ? value : idle;
      store(IDLE_KEY, idle);
    }
    if (!on) arm();
    return key === 'theme' ? theme : idle;
  }
  function themeRows() {
    return ORDER.map(function (id) {
      return { value: id, label: THEMES[id].name, action: 'choice.aerial.' + id };
    });
  }
  /* The theme's own Apple clips, by name, so Settings can point the saver at
     one of them instead of letting it pick. */
  function clipRows() {
    var rows = [{ value: '-1', label: 'Rotate all' }], list = aerials(), i;
    for (i = 0; i < list.length; i++) rows.push({ value: theme + '|' + i, label: list[i].name });
    return rows;
  }
  function idleRows() {
    return IDLES.map(function (row) {
      return { value: row[0], label: row[1], action: 'choice.aerialidle.' + row[0] };
    });
  }

  function readPrefs() {
    var t = read(THEME_KEY, 'landscape'), d = read(IDLE_KEY, '300'), c = parseInt(read(CLIP_KEY, '-1'), 10);
    theme = THEMES[t] ? t : 'landscape';
    idle = IDLES.some(function (row) { return row[0] === String(d); }) ? String(d) : '300';
    clip = (c >= 0 && c < aerials().length) ? c : -1;
  }

  /* The clock and the place stay out of the picture until they are asked for:
     Down brings them up the way the Apple TV shows a caption, and they fade
     again on their own so the footage is never left with type over it. */
  function showTag() {
    if (!el || !on) return;
    el.className = 'aerial is-on show-tag';
    clearTimeout(tagTimer);
    tagTimer = setTimeout(function () {
      tagTimer = 0;
      if (on) el.className = 'aerial is-on';
    }, 8000);
  }

  function init() {
    readPrefs();
    /* Any press wakes the screen and is spent doing it: the key that dismisses
       the saver must not also move the focus behind it. Down is the exception:
       it asks for the caption instead of ending the saver. */
    document.addEventListener('keydown', function (ev) {
      if (!on) {
        /* Belt and braces: a saver left painted without the flag - a start that
           failed half way, a stopped clip still on screen - goes on this press. */
        if (el && el.className.indexOf('is-on') >= 0) {
          el.className = 'aerial';
          el.style.display = 'none';
        }
        poke();
        return;
      }
      ev.preventDefault();
      ev.stopImmediatePropagation();
      if (ev.keyCode === 40) { showTag(); return; }
      stop();
      on = false;
    }, true);
    document.addEventListener('pointermove', poke, true);
    document.addEventListener('pointerdown', poke, true);
    document.addEventListener('click', poke, true);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) arm(); else clearTimeout(idleTimer);
    });
    window.addEventListener('focus', function () {
      if (!on) arm();
    });
    arm();
  }

  root.CleanFrameAerial = {
    get: get,
    set: set,
    /* The clip currently on screen, for the browser checks and for the
       Settings row's subtitle. */
    clip: function () { return { video: videoMode, place: placeEl ? placeEl.textContent : '' }; },
    start: function () { start(true); },
    stop: stop,
    themes: themeRows,
    idles: idleRows,
    clips: clipRows,
    list: ORDER.slice(),
    state: function () { return { on: on, theme: theme, idle: idle, clip: clip, manual: manual }; }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
