/* ============================================================
   launcher.js — tvOS Home Screen.

   Three states, driven only by where the focus is:
     shelf : focus in the dock (top row). The app's artwork fills
             the whole screen, the 2nd row peeks out at the bottom.
     grid  : focus in a lower row. Everything moves up, the artwork
             becomes a blurred background, the app's name shows under its icon.
     full  : ▲ from the dock (if the app has artwork). The interface slides
             off the screen; ▼ / Back brings it back, OK opens the app.
   ============================================================ */
(function (global) {
    "use strict";

    var APL = global.APL;
    /* The top row: exactly these six, in this order. Control Centre is not one
       of them (the remote's ⏯ key opens it, and Settings has a row for it),
       and neither is a second Home tile: Home *is* the Home Assistant app.
       An app that is not installed simply leaves a gap, nothing invented. */
    var DOCK = [
        { key: "netflix", re: /netflix/i },
        { key: "stremio", re: /stremio/i },
        { key: "samsungplus", re: /samsung ?tv ?plus/i },
        { key: "apl.homeassistant" },
        { key: "disneyplus", re: /disney/i },
        { key: "appletv", re: /apple ?tv/i }
    ];
    var dockSize = DOCK.length;         /* render() sets it to what is really there */
    var DOCK_TOP = 783;          // dock position in the shelf state
    var GRID_DOCK_TOP = 64;      // dock position once the grid has moved up
    var ROWS_TOP = 1052;         // top of the 2nd row inside .home
    var FULL_SHIFT = 430;        // shift that moves the dock off the screen

    var apps = [];          // apps shown (hidden apps excluded)
    var allApps = [];       // all apps, including Settings and Sources
    var tiles = [];
    var nav = null;
    var mode = "shelf";
    var bgActive = null;
    var dom = {};

    function $(id) { return document.getElementById(id); }

    function cacheDom() {
        dom.body = document.body;
        dom.bgA = $("bgA");
        dom.bgB = $("bgB");
        dom.bgBlur = $("bgBlur");
        dom.home = $("home");
        dom.row0 = $("row0");
        dom.rows = $("rows");
        dom.hint = $("hint");
        dom.shelfInfo = $("shelfInfo");
        dom.shelfTitle = $("shelfTitle");
        dom.shelfMeta = $("shelfMeta");
        dom.clock = $("clock");
        dom.toast = $("toast");
        dom.boot = $("boot");
        bgActive = dom.bgA;
    }

    /* ---------- colours ---------- */
    function rgba(hex, a) {
        var h = (hex || "#2a2a2e").replace("#", "");
        if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
        return "rgba(" + parseInt(h.substr(0,2),16) + "," + parseInt(h.substr(2,2),16) + "," +
               parseInt(h.substr(4,2),16) + "," + a + ")";
    }

    /* Top Shelf artwork: the app's image, otherwise an abstract
       tvOS-style wallpaper tinted with the app's colour. */
    /* Dominant colour: the one sampled from the Tizen icon, otherwise the accent. */
    function brandColour(app) { return app.edge || app.accent || "#3a4a8a"; }

    /* The dock, plus the storefronts the viewer expects a poster for, always
       take the catalogue's artwork. Everything else keeps what it already
       had: a backdrop the viewer chose is never replaced. */
    /* Apple TV is named here as well as by its dock slot: the slot check alone
       depends on when the dock was rebuilt, and Apple TV is the one app that
       showed its flat colour instead of a poster. */
    var POSTER_NAME = /samsung ?tv ?plus|disney|hbo ?max|apple ?tv|(^|\W)max(\W|$)/i;

    function wantsPoster(app) {
        var i = apps.indexOf(app);
        if (i >= 0 && i < dockSize) return true;
        if (POSTER_NAME.test(String(app.name || ""))) return true;
        /* Any service the catalogue knows (Samsung TV Plus, ARTE, Disney+,
           HBO Max, Netflix, Stremio…) gets its own poster, in the dock or in
           the drawer. */
        return !!(APL.appArt && APL.appArt.known && APL.appArt.known(app));
    }
    /* Which title an app is showing right now. The pool is asked for the same
       index everywhere — the layer, the corner slate and the rotation all read
       this, so the name on screen always belongs to the poster on screen. */
    var rotIndex = {};
    function artFor(app) {
        if (!app || APL.sys.pref("cleanFrameBackdrops") === false) return null;
        /* YouTube keeps the app's own approach: its CleanFrame picture, never a
           storefront title. */
        if (/youtube|tizentube/i.test(String(app.name || ""))) return null;
        if (!APL.appArt || !APL.appArt.next) return null;
        return APL.appArt.next(app, rotIndex[app.id] || 0);
    }
    function posterFor(app) { return wantsPoster(app) ? artFor(app) : null; }

    /* Control Centre, Search, Settings and the app menu sit over the artwork:
       while one is up the wall stays still, or the lenses would be baked from
       a poster that has already slid away. */
    function overlayOpen() {
        return !!document.querySelector(".cc.is-open, .srch.is-open, .settings.is-open, .set.is-open, .appmenu.is-open, .profiles.is-open");
    }
    function backdropFor(app) {
        /* The YouTube family keeps the artwork CleanFrame gave it: the
           catalogue's own YouTube backdrop, then its packaged tile. */
        if (/youtube|tizentube/i.test(String(app.name || ""))) {
            var tube = backdropPick(app);
            if (tube && tube.url) return "#000 center / cover no-repeat url('" + tube.url + "')";
            return "#000 center / cover no-repeat url('" + asset("assets/backdrops/youtube.svg") + "')";
        }
        var art = wantsPoster(app) ? posterFor(app) : null;
        if (art && art.url) return "#000 center / cover no-repeat url('" + art.url + "')";
        if (app.bg) return "#000 center / cover no-repeat url('" + app.bg + "')";
        var pick = backdropPick(app);
        if (pick && pick.url) return "#000 center / cover no-repeat url('" + pick.url + "')";
        /* Nothing found for it: the CleanFrame wallpaper, unless it is turned
           off in Settings, in which case the app's own glow stands in. */
        if (APL.sys.pref("cleanFrameWallpaper") !== false)
            return "#0b0d12 center / cover no-repeat url('" + staticBackdrop().bg + "')";
        // No artwork provided: a generated brand card (same style as the
        // catalog backgrounds) — a glow in the app's colour on a dark background.
        var a = brandColour(app);
        return "radial-gradient(60% 70% at 50% 44%, " + rgba(a, 0.42) + ", rgba(0,0,0,0) 70%)," +
               "radial-gradient(110% 80% at 50% 115%, " + rgba(a, 0.22) + ", rgba(0,0,0,0) 60%)," +
               "#07080c";
    }

    /* CleanFrame's own dynamic backdrops (backdrops.js): the storefront's
       trending title for this app, cached for six hours and already the right
       size, so a tile that has no artwork of its own still shows a real frame.
       Settings › CleanFrame Backdrops turns it off. */
    function backdropKey(app) {
        var n = String(app.name || "").toLowerCase();
        if (/netflix/.test(n)) return "netflix";
        if (/prime/.test(n)) return "primevideo";
        if (/hotstar/.test(n)) return "hotstar";
        if (/apple ?tv/.test(n)) return "appletv";
        if (/sony ?liv/.test(n)) return "sonyliv";
        if (/stremio/.test(n)) return "stremio";
        if (/nuvio/.test(n)) return "nuvio";
        return "";
    }
    function backdropPick(app) {
        if (!APL.sys || APL.sys.pref("cleanFrameBackdrops") === false) return null;
        /* The YouTube family keeps the artwork CleanFrame gave it. */
        if (/youtube|tizentube/i.test(String(app.name || ""))) return { url: asset("assets/backdrops/youtube.svg") };
        /* The poster catalogue first: the same JustWatch trending list
           Universal Search reads, one title per service, rebuilt every six
           hours. */
        if (APL.appArt && APL.appArt.pick) {
            var art = APL.appArt.pick(app);
            if (art && art.url) return art;
        }
        var B = global.CleanFrameBackdrops, key = backdropKey(app);
        if (!B || !B.pick || !key) return null;
        try { return B.pick(key); } catch (e) { return null; }
    }

    /* Logo + name in the centre, like the provided artwork (sharp Tizen icon, never blurred). */
    function brandCard(app) {
        var card = document.createElement("div");
        card.className = "brandcard";
        if (app.shelfHtml) {
            card.innerHTML = app.shelfHtml;               // Settings, Sources: large tvOS icon
        } else if (app.icon) {
            var img = document.createElement("img");
            img.className = "brandcard__icon";
            img.alt = "";
            img.onerror = function () {
                if (!img._vetro) { img._vetro = true; img.src = vetroIcon(app.id); return; }
                img.remove();
            };
            img.src = app.icon;
            card.appendChild(img);
        }
        var name = document.createElement("div");
        name.className = "brandcard__name";
        name.textContent = app.name;
        card.appendChild(name);
        return card;
    }

    /* Grid background, as on tvOS: the Top Shelf image, frozen and blurred.
       It is drawn ONCE into a tiny canvas (the blur costs nothing),
       which the screen stretches: no blur is recomputed while navigating. */
    var blurCanvas = null, blurToken = 0;
    function blurLayer() {
        if (blurCanvas) return blurCanvas;
        blurCanvas = document.createElement("canvas");
        var ctx = blurCanvas.getContext("2d");
        var filters = ctx && "filter" in ctx;
        /* Half the screen, not a quarter: the drawer's ground is blurred, not
           blown up, so a 480-wide canvas stretched over 1920 was reading as
           an enlarged photograph. */
        blurCanvas.width = filters ? 960 : 96;
        blurCanvas.height = filters ? 540 : 54;
        blurCanvas._filters = filters;
        blurCanvas.className = "bgblur__canvas";
        dom.bgBlur.appendChild(blurCanvas);
        return blurCanvas;
    }
    var blurDrawn = "";
    function setBlur(src, app) {
        if (!dom.bgBlur) return;
        /* Already prepared for this artwork: the drawer opens on the picture
           that is there, with nothing recomputed. */
        if (src && src === blurDrawn && blurCanvas && blurCanvas.style.opacity === "1") return;
        var token = ++blurToken;
        if (!src) {
            /* No artwork of its own: paint the pane from the app's backdrop and
               still build the canvas, so the drawer never lands on an empty
               layer waiting for the next focus. */
            var own = backdropFor(app);
            dom.bgBlur.style.background = own;
            var mm = /url\("?([^"')]+)/.exec(own || "");
            if (!mm) { blurLayer(); if (blurCanvas) blurCanvas.style.opacity = "1"; return; }
            src = mm[1];
        }
        var img = new Image();
        img.onload = function () {
            if (token !== blurToken) return;              // another image was requested in the meantime
            var c = blurLayer(), ctx = c.getContext("2d"), w = c.width, h = c.height;
            var m = c._filters ? 28 : 0;                  // margin: no dark edge from the blur
            ctx.clearRect(0, 0, w, h);
            /* Blur only. Saturation boosted the picture and read as brightness. */
            if (c._filters) ctx.filter = "blur(18px)";
            // "cover": the image fills the canvas without being distorted
            var r = Math.max((w + 2 * m) / img.naturalWidth, (h + 2 * m) / img.naturalHeight);
            var dw = img.naturalWidth * r, dh = img.naturalHeight * r;
            ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
            c.style.opacity = "1";
            blurDrawn = src;
            dom.bgBlur.style.background = "#05060a";
        };
        img.onerror = function () { if (token === blurToken) dom.bgBlur.style.background = backdropFor(app); };
        img.src = src;
    }

    /* The blurred background is only prepared when entering the grid: computing it on
       every move in the dock was what made navigation stutter. */
    var blurWanted = null;
    function wantBlur(src, app) {
        blurWanted = { src: src, app: app };
        if (mode === "grid") flushBlur();
    }
    function flushBlur() {
        if (!blurWanted) {
            /* Nothing queued: draw the drawer's ground from the artwork that
               is on screen right now, so entering the grid always has one. */
            var m = bgActive && /url\("?([^"')]+)/.exec(bgActive.style.background || "");
            if (!m) return;
            blurWanted = { src: m[1], app: apps[lastFocus] };
        }
        var b = blurWanted;
        blurWanted = null;
        setBlur(b.src, b.app);
    }

    /* An image is only shown once decoded: the fade starts without a hitch. */
    function whenDecoded(src, then) {
        if (!src) { then(); return; }
        var im = new Image();
        im.src = src;
        if (im.decode) im.decode().then(then, then);
        else { im.onload = then; im.onerror = then; }
    }

    /* Drawing a full-screen image takes 100 ms on the M8, whatever the effect: the dock
       backgrounds stay ready in invisible layers, and switching between them redraws nothing. */
    var layers = {};
    function layerFor(app) {
        if (layers[app.id]) return layers[app.id];
        var l = document.createElement("div");
        l.className = "bg";
        /* The top row always has a CleanFrame backdrop, even for an app whose
           artwork has not been found yet: a lit dock, and a photograph for the
           glass to slice, instead of a flat glow. */
        /* backdropFor already knows the order: the app's own artwork, then the
           poster catalogue, then our wallpaper (or the app's glow). */
        l.style.background = backdropFor(app);
        /* The name card is the fallback for an app with no artwork at all; a
           poster already says what the app is. */
        if (!app.bg && !posterFor(app)) l.appendChild(brandCard(app));
        l.dataset.app = app.id;
        dom.bgA.parentNode.insertBefore(l, dom.bgA);
        layers[app.id] = l;
        return l;
    }
    /* After a change of order or artwork: layers to rebuild (the one on screen goes after the fade). */
    function dropLayers() {
        Object.keys(layers).forEach(function (id) {
            var l = layers[id];
            if (!l) return;
            if (l === bgActive) l._stale = true;
            else if (l.parentNode) l.parentNode.removeChild(l);
        });
        layers = {};
        /* Anything left over from an earlier arrangement goes now, so the
           stage never accumulates blind black layers behind the artwork. */
        var all = document.querySelectorAll(".bg"), k;
        for (k = 0; k < all.length; k++) {
            if (all[k] === bgActive || all[k] === dom.bgA || all[k] === dom.bgB) continue;
            if (all[k].parentNode) all[k].parentNode.removeChild(all[k]);
        }
    }
    /* The poster catalogue arrives after the first paint (the network call is
       in flight while the dock is already up): rebuild the cached layers and
       put the one behind the focused tile back on screen. */
    function refreshBackdrops() {
        bgActive.dataset.app = "";          // the layer about to go is the stale one
        dropLayers();
        if (apps[lastFocus]) setBackdrop(apps[lastFocus]);
    }

    function showLayer(next, app) {
        next.dataset.app = app.id;
        if (next === bgActive) return;
        if (app.bg) motion(next); else next.classList.remove("is-motion");
        /* The new layer starts invisible and fades up over the old one: without
           this the incoming picture covers it in one frame and the change reads
           as a cut, however long the opacity transition is. */
        next.style.opacity = "0";
        void next.offsetWidth;
        next.classList.add("is-active");
        next.style.opacity = "";
        var old = bgActive;
        old.classList.remove("is-active");
        setTimeout(function () {
            if (old && old.parentNode && old !== bgActive) old.parentNode.removeChild(old);
        }, 700);
        bgActive = next;
    }

    var backdropToken = 0;
    /* Settings > Dynamic Backdrops off: the ground stays on one wallpaper
       instead of following the app you focus. */
    function staticBackdrop() {
        return { id: "__static", bg: asset("assets/wallpapers/amber.jpg"),
                 bgBlur: asset("assets/wallpapers/amber-panel.jpg") };
    }
    /* A fresh layer for every artwork, so the old one fades out under the new
       one: the dock crossfades exactly like the grid does. */
    function buildLayer(app, art) {
        var l = document.createElement("div");
        l.className = "bg";
        l.dataset.app = app.id;
        l.dataset.art = (art && art.url) || app.bg || "";
        /* The poster wins over everything while it is on screen: an app with a
           bundled brand image (Apple TV) was showing that instead of its
           title, so its backdrop never changed. */
        l.style.background = (art && art.url) ? 'url("' + art.url + '")' : backdropFor(app);
        /* The name card is only for an app with nothing behind it at all: over
           a poster or a CleanFrame photograph it would cover the picture. */
        if (!app.bg && !art && !backdropPick(app)) l.appendChild(brandCard(app));
        return l;
    }
    function setBackdrop(app) {
        if (APL.sys.pref("dynamicBackdrops") === false) app = staticBackdrop();
        var art = posterFor(app);
        /* The drawer's blurred ground is made from the artwork actually on
           screen, poster included, so it is never a flat colour. */
        wantBlur((art && art.url) || app.bgBlur || app.bg, app);
        var token = ++backdropToken;
        var key = (art && art.url) || app.bg || "";
        if (bgActive.dataset.app === app.id && bgActive.dataset.art === key) {
            captionText(art);
            if (apps.indexOf(app) < dockSize) scheduleRotate(app); else stopRotate();
            return;
        }
        var paint = function () {
            if (token !== backdropToken) return;          // another app was selected meanwhile
            var next = buildLayer(app, art);
            var after = (bgActive === dom.bgA || bgActive === dom.bgB) ? bgActive : bgActive.nextSibling;
            bgActive.parentNode.insertBefore(next, after);
            showLayer(next, app);
            layers[app.id] = next;
            captionText(art);
            /* Reposition the lenses on this frame (cheap), then re-bake the
               slice once the new poster has decoded: the pill and the dock
               never trail the artwork. */
            if (APL.glass && APL.glass.paint) APL.glass.paint();
            if (APL.glass && APL.glass.refresh) APL.glass.refresh();
            if (apps.indexOf(app) < dockSize) scheduleRotate(app); else stopRotate();
        };
        whenDecoded(art && art.url ? art.url : app.bg, paint);
    }

    /* An app's real icon, served by Vetro (fallback when the Tizen path can't be read). */
    function vetroIcon(id) { return "http://127.0.0.1:8099/apps/icon?appId=" + encodeURIComponent(id); }

    /* Slow camera move over the Top Shelf image, like Apple TV's animated backgrounds.
       Off by default: at rest on the M8 it takes more than one core by itself (135%, versus
       16% without it), and the images change every 9 s, so it never stops. */
    var motionN = 0;
    function motion(layer) {
        layer.classList.remove("is-motion", "is-motion-a", "is-motion-b");
        if (!APL.sys.pref("bgMotion")) return;
        void layer.offsetWidth;
        layer.classList.add("is-motion", (++motionN % 2) ? "is-motion-a" : "is-motion-b");
    }

    /* ---------- what is on screen ---------- */
    var capBox = null;
    function capBoxEl() {
        if (capBox) return capBox;
        capBox = document.createElement("div");
        capBox.className = "bgcap";
        document.body.appendChild(capBox);
        return capBox;
    }
    /* The corner slate names the film or series, not the app: the app's name
       is already on its tile. */
    function captionText(art) {
        var el = capBoxEl();
        if (!art || !art.title) { el.classList.remove("is-visible"); return; }
        el.innerHTML = "";
        el.appendChild(document.createTextNode(art.title));
        var meta = [];
        if (art.year) meta.push(art.year);
        if (art.rating) meta.push("\u2605 " + art.rating);
        if (meta.length) {
            var m = document.createElement("span");
            m.className = "bgcap__met";
            m.textContent = meta.join("  \u00b7  ");
            el.appendChild(m);
        }
        el.classList.add("is-visible");
    }
    function noteArt(app) {
        captionText(APL.sys.pref("dynamicBackdrops") === false ? null : artFor(app));
    }

    /* A single app left in focus for ten seconds slides on to the next title
       in its list: the wall keeps moving without a key press. */
    var rotTimer = 0, rotN = 0, ROTATE_MS = 10000;
    function stopRotate() {
        global.clearTimeout(rotTimer);
        rotTimer = 0;
        rotN = 0;
    }
    function scheduleRotate(app) {
        stopRotate();
        if (!app || !bgActive || APL.sys.pref("bgRotate") === false) return;
        rotTimer = global.setTimeout(function () { rotate(app); }, ROTATE_MS);
    }
    function rotate(app) {
        /* A pane or the app drawer is open: hold the wall still and look again
           in a moment, so the glass and the blurred drawer never trail a
           picture that has already moved. */
        if (overlayOpen() || mode === "grid") { rotTimer = global.setTimeout(function () { rotate(app); }, 2000); return; }
        if (!APL.appArt || !APL.appArt.next) return;
        rotIndex[app.id] = (rotIndex[app.id] || 0) + 1;
        var art = artFor(app);
        if (!art || !art.url || !bgActive) return;
        var next = buildLayer(app, art);
        next.className = "bg is-slide";           /* the idle change slides */
        bgActive.parentNode.insertBefore(next, bgActive.nextSibling);
        void next.offsetWidth;
        next.classList.add("is-in", "is-active");
        var old = bgActive;
        bgActive = next;
        layers[app.id] = next;
        captionText(art);
        /* The pill, the dock and the drawer follow the new picture at once. */
        if (mode === "grid") setBlur(art.url, app);
        if (APL.glass && APL.glass.paint) APL.glass.paint();
        if (APL.glass && APL.glass.refresh) APL.glass.refresh();
        global.setTimeout(function () {
            /* The slide is over: the layer is a plain backdrop again, so moving
               focus on to it crossfades instead of sliding a second time. */
            next.classList.remove("is-slide", "is-in");
            old.classList.remove("is-active");
            if (old.parentNode) old.parentNode.removeChild(old);
        }, 950);
        rotTimer = global.setTimeout(function () { rotate(app); }, ROTATE_MS);
    }

    /* ---------- tiles ---------- */
    function letter(name) {
        var el = document.createElement("div");
        el.className = "tile__letter";
        el.textContent = (name || "?").trim().charAt(0).toUpperCase();
        return el;
    }

    /* A Tizen icon is often a square with a background: its edge colour
       is extended over the whole tile for a full-bleed tvOS look. */
    function bleedIconColour(img, card, app) {
        try {
            var c = document.createElement("canvas");
            c.width = c.height = 8;
            var ctx = c.getContext("2d");
            ctx.drawImage(img, 0, 0, 8, 8);
            var d = ctx.getImageData(0, 0, 1, 1).data;
            if (d[3] > 200) {
                card.style.background = "rgb(" + d[0] + "," + d[1] + "," + d[2] + ")";
                app.edge = "#" + [d[0], d[1], d[2]].map(function (v) { return ("0" + v.toString(16)).slice(-2); }).join("");
                // The background shown for this app takes its icon's real colour.
                if (bgActive && bgActive.dataset.app === app.id) bgActive.style.background = backdropFor(app);
            }
        } catch (e) { /* image from another origin: keep the default colour */ }
    }

    function makeTile(app, row) {
        var tile = document.createElement("div");
        tile.className = "tile";
        tile.dataset.row = row;

        var card = document.createElement("div");
        card.className = "tile__card";

        if (app.tileHtml) {
            card.innerHTML = app.tileHtml;
        } else if (app.tile) {
            // inline style: a url() inside a CSS variable would be resolved from css/
            card.style.background = "#111 center / cover no-repeat url('" + app.tile + "')";
        } else if (app.icon) {
            // No logo in the catalog: the app's real, sharp icon, until
            // genart.js makes its tile.
            card.style.background = app.accent || "linear-gradient(160deg, #3b3f4a 0%, #1b1d23 100%)";
            card.classList.add("tile__card--icon");
            var img = document.createElement("img");
            img.className = "tile__icon" + (app.autoIcon ? " tile__icon--app" : "");
            img.alt = "";
            img.onload = function () { bleedIconColour(img, card, app); };
            img.onerror = function () {
                if (!img._vetro) { img._vetro = true; img.src = vetroIcon(app.id); return; }
                card.removeChild(img); card.appendChild(letter(app.name));
            };
            img.src = app.icon;
            card.appendChild(img);
        } else {
            card.style.background = app.accent || "#2a2a2e";
            card.appendChild(letter(app.name));
        }

        var label = document.createElement("div");
        label.className = "tile__label";
        label.textContent = app.name;

        tile.appendChild(card);
        tile.appendChild(label);
        return tile;
    }

    /* ---------- states ---------- */
    function setMode(m) {
        mode = m;
        dom.body.classList.remove("mode-shelf", "mode-grid", "mode-full");
        dom.body.classList.add("mode-" + m);
        layout();
    }

    function layout() {
        var y = 0;
        if (mode === "full") {
            y = FULL_SHIFT;
        } else if (mode === "grid") {
            y = -(DOCK_TOP - GRID_DOCK_TOP);
            // Scroll if the selected row goes off the screen.
            var el = nav && nav.current();
            if (el && el.dataset.row !== "0") {
                var visibleTop = ROWS_TOP + el.offsetTop + y;
                var limit = 1080 - 230;              // icon + name + bottom margin
                if (visibleTop > limit) y -= (visibleTop - limit);
            }
        }
        dom.home.style.transform = "translateY(" + y + "px)";
    }

    /* ---------- live Top Shelf ---------- */
    var liveTimer = null, liveRotate = null;

    /* The artwork is loaded before being shown: an image that can't be found is skipped
       (on to the next item) instead of leaving a black screen. */
    function setLiveBackdrop(app, item, n, items, tries) {
        if (item.bad) { if (items && (tries || 0) < items.length) setLiveBackdrop(app, items[(n + 1) % items.length], (n + 1) % items.length, items, (tries || 0) + 1); return; }
        if (item.ok) { swapLive(app, item, n); return; }
        var im = new Image();
        function shown() { item.ok = true; if (apps[nav.index] === app && mode !== "grid") swapLive(app, item, n); }
        im.onload = function () { if (im.decode) im.decode().then(shown, shown); else shown(); };
        im.onerror = function () { item.bad = true; if (apps[nav.index] === app) setLiveBackdrop(app, item, n, items, tries); };
        im.src = item.bg;
    }
    function swapLive(app, item, n) {
        var tag = app.id + "#" + n;
        if (bgActive.dataset.app === tag) return;
        var next = (bgActive === dom.bgA) ? dom.bgB : dom.bgA;
        next.innerHTML = "";
        next.style.background = "#000 center / cover no-repeat url('" + item.bg + "')";
        next.dataset.app = tag;
        motion(next);
        wantBlur(item.bgSmall || null, app);
        next.classList.add("is-active");
        bgActive.classList.remove("is-active");
        bgActive = next;
        shelfInfo(item);
    }

    /* Title and rating of the Top Shelf film or series (videos and games have none). */
    function shelfInfo(item) {
        var has = !!(item && item.type);
        dom.shelfInfo.classList.toggle("is-visible", has);
        if (!has) return;
        dom.shelfTitle.textContent = item.title;
        dom.shelfMeta.textContent = APL.live.metaOf(item);
    }

    /* A new full-screen image costs 100 ms: as rarely as possible, and never while navigating. */
    var LIVE_ROTATE_MS = 20000;
    function stopLive() {
        clearTimeout(liveTimer); clearInterval(liveRotate);
        liveTimer = liveRotate = null;
    }

    /* After a short pause on the app, its current content is loaded. */
    function startLive(app) {
        stopLive();
        if (!APL.live || !APL.live.hasSource(app)) return;
        liveTimer = setTimeout(function () {
            APL.live.itemsNow(app).then(function (items) {
                if (!items || apps[nav.index] !== app) return;
                if (APL.widgets && APL.widgets.isShowing()) return;   // hidden by the cards: nothing to draw
                var n = 0;
                setLiveBackdrop(app, items[0], 0, items, 0);
                liveRotate = setInterval(function () {
                    if (mode === "grid") return;                 // paused under the grid
                    if (apps[nav.index] !== app) { stopLive(); return; }
                    n = (n + 1) % items.length;
                    setLiveBackdrop(app, items[n], n, items, 0);
                }, LIVE_ROTATE_MS);
            });
        }, 650);
    }

    var bgTimer = null, lastFocus = 0;
    function onFocus(i, el) {
        lastFocus = i;
        var app = apps[i], inDock = el.dataset.row === "0", fromGrid = mode === "grid";
        if (mode !== "full") setMode(inDock ? "shelf" : "grid");
        else layout();
        if (APL.widgets) APL.widgets.show(inDock ? app : null, fromGrid);
        if (!inDock) flushBlur();
        // In the grid, as on tvOS: the Top Shelf artwork freezes and becomes
        // the blurred background; it no longer changes from one app to the next (and nothing to decode).
        if (!inDock) { clearTimeout(bgTimer); stopRotate(); return; }
        var live = APL.live && APL.live.hasSource(app);
        dom.hint.classList.toggle("is-visible", (!!app.bg || live) && APL.sys.pref("showHint"));
        if (live && bgActive.dataset.app && bgActive.dataset.app.indexOf(app.id + "#") === 0) return;   // already shown
        if (bgActive.dataset.app === app.id) return;
        shelfInfo(null);
        // Full-screen artwork changed a fraction of a second after the focus: when
        // scrolling fast, a large image isn't decoded on every press.
        clearTimeout(bgTimer);
        var swap = function () { setBackdrop(app); startLive(app); };
        if (!bgActive.dataset.app) swap(); else bgTimer = setTimeout(swap, 170);
    }

    function launch(i) {
        var el = tiles[i];
        el.classList.add("is-pressed");
        setTimeout(function () { el.classList.remove("is-pressed"); }, 160);
        if (!apps[i].virtual || apps[i].web) APL.sys.profiles.noteLaunch(apps[i].id);   // profile history
        if (apps[i].web && APL.sys.PREVIEW) { toast(APL.t("Preview: on your TV, “{name}” would open in Internet ({url})", { name: apps[i].name, url: apps[i].url.replace(/^https:\/\/|\/$/g, "") })); return; }
        if (apps[i].virtual) { apps[i].run(); return; }
        if (APL.sys.PREVIEW) { toast(APL.t("Preview: on your TV, “{name}” would open now", { name: apps[i].name })); return; }
        showVeil();
        var id = apps[i].id;
        if (TUBE.test(apps[i].name)) { launchTube(id); return; }
        APL.launchApp(id).catch(function (err) { hideVeil(); toast(err.message || APL.t("Couldn't open the app")); });
    }

    /* When an app opens: the screen dims right away, the app appears over it.
       The veil goes away on returning Home, or by itself if the app couldn't open. */
    var veilTimer = null, veilHeldUntil = 0;
    function showVeil() {
        var v = $("veil");
        if (!v) { v = document.createElement("div"); v.id = "veil"; v.className = "veil"; document.body.appendChild(v); }
        v.classList.add("is-on");
        clearTimeout(veilTimer);
        veilTimer = setTimeout(hideVeil, Math.max(5000, veilHeldUntil - Date.now()));
    }
    function hideVeil() {
        if (Date.now() < veilHeldUntil) return;
        clearTimeout(veilTimer);
        var v = $("veil");
        if (v) v.classList.remove("is-on");
    }
    /* TizenTube from cold: the launcher comes back to the front while TizenBrew restarts (instead
       of the Samsung home screen) and stays black until then. */
    APL.holdVeil = function (ms) { veilHeldUntil = Date.now() + ms; showVeil(); };

    /* TizenTube replaces Samsung's YouTube app: that one must be closed first,
       otherwise TizenTube can get stuck or give way to Samsung's YouTube (same
       fix as "Fix TizenTube" in Vetro). With no answer from Vetro within 1.5 s,
       it launches anyway. */
    var TUBE = /^(TizenTube|TizenBrew)$/;
    var SAMSUNG_YOUTUBE = ["com.samsung.tv.cobalt-yt", "111299001912"];
    function launchTube(id) {
        var done = false;
        function go() {
            if (done) return;
            done = true;
            (id ? APL.launchApp(id) : APL.launchTizenTube()).catch(function (err) { hideVeil(); toast(err.message || APL.t("Couldn't open the app")); });
        }
        // Most of the time Samsung's YouTube isn't running: nothing to close, TizenTube opens right away
        APL.sys.runningApps().then(function (ids) {
            var open = SAMSUNG_YOUTUBE.filter(function (a) { return ids.indexOf(a) !== -1; });
            if (!open.length) { go(); return; }
            APL.sys.vetroPost("/exec", { cmd: open.map(function (a) { return "app_launcher -k " + a + " >/dev/null 2>&1"; }).join("; ") + "; true" })
                .then(function () { setTimeout(go, 300); }, go);
            setTimeout(go, 1500);
        }, go);
    }

    /* Settings › Apps: closes the apps left open behind the launcher. Only Home Screen apps
       and the big video apps: never a screen service. TizenTube stays ready (20 s from cold). */
    var KEEP_OPEN = /^(APLauncher\.|apl\.launcher\.|xvvl3S1bvH\.|vetrotvapp)/;
    var VIDEO_APPS = ["org.tizen.netflix-app", "org.tizen.primevideo", "HEPsqFNie0.tvplusstandalone"];   // their tile carries a different id
    function memoryLeft() {
        return APL.sys.exec("awk '/MemAvailable|SwapFree/{s+=$2} END{print s}' /proc/meminfo").then(function (r) { return parseInt(r.output, 10) || 0; });
    }
    APL.freeMemory = function () {
        return APL.sys.runningApps().then(function (ids) {
            var known = allApps.filter(function (a) { return !a.virtual; }).map(function (a) { return a.id; }).concat(VIDEO_APPS);   // not Samsung's YouTube: it comes back by itself within 25 s
            var open = ids.filter(function (id) { return known.indexOf(id) !== -1 && !KEEP_OPEN.test(id); });
            if (!open.length) { toast(APL.t("No apps to close"), true); return; }
            return memoryLeft().then(function (before) {
                var cmd = open.map(function (id) { return "app_launcher -k " + id + " >/dev/null 2>&1"; }).join("; ") + "; sleep 1";
                return APL.sys.exec(cmd).then(memoryLeft).then(function (after) {
                    var freed = Math.max(0, Math.round((after - before) / 1024));
                    toast(open.length > 1 ? APL.t("{n} apps closed: {mb} MB freed", { n: open.length, mb: freed }) : APL.t("{n} app closed: {mb} MB freed", { n: open.length, mb: freed }), true);
                });
            });
        }).catch(function (e) { toast(e.message); });
    };

    /* Once per full power-on: at start-up the system opens these apps by itself, and also the
       services turned off in Settings (they then stay closed, apart from a few). Tried on the M8:
       from 400 to 770 MB of available memory. The file in /tmp disappears on restart. It waits for the
       launcher to be in front, in the background: never an app that was just opened, and Home always responds. */
    var BOOT_CLOSE = VIDEO_APPS.concat(["MCmYXNxgcu.DisneyPlus", "com.samsung.tv.home.media", "com.samsung.tv.mycontents", "com.samsung.tv.quicklaunch",
                                        "org.tizen.browser", "com.samsung.tv.bixbycapsuleviewer", "org.tizen.art-app", "com.samsung.tv.aria-video",
                                        "com.samsung.tv.cobalt-yt"]);
    var bootCleaned = false;
    function bootCleanup() {
        if (bootCleaned || document.hidden || APL.sys.PREVIEW || !APL.sys.pref("bootCleanup")) return;
        bootCleaned = true;
        var frame = /LS03/i.test(APL.sys.product().model || "");      // The Frame: Art Mode needs art-app
        var ids = BOOT_CLOSE.filter(function (id) { return !(frame && id === "org.tizen.art-app"); })
                            .concat(Object.keys(APL.sys.pref("servicesCut") || {}));
        APL.sys.exec("[ -f /tmp/apl-cleaned ] || { touch /tmp/apl-cleaned; (" + ids.map(function (id) {
            return "app_launcher -k " + id;
        }).join("; ") + ") >/dev/null 2>&1 & }; true").catch(function () { bootCleaned = false; });
    }

    /* The system repeats a key after 350 ms, and the remote only "releases" it after 250 to
       340 ms: on a busy screen, in every app, a short press sometimes counted twice.
       The setting is lost on restart: it is set again at every launch, as soon as Vetro answers. */
    function slowKeyRepeat(tries) {
        if (APL.sys.PREVIEW) return;
        APL.sys.exec("enlightenment_info -key_repeat set 600 0 >/dev/null 2>&1; true").catch(function () {
            if (tries > 0) setTimeout(function () { slowKeyRepeat(tries - 1); }, 15000);
        });
    }

    /* ---------- misc ---------- */
    /* info = secondary message, hidden when "Do Not Disturb" is on */
    function toast(msg, info) {
        if (info && APL.sys.pref("dnd")) return;
        dom.toast.textContent = msg;
        dom.toast.classList.add("is-visible");
        clearTimeout(toast._t);
        toast._t = setTimeout(function () { dom.toast.classList.remove("is-visible"); }, 2600);
    }

    function startClock() {
        function tick() {
            var d = new Date(), h = d.getHours(), m = String(d.getMinutes()).padStart(2, "0");
            var text = APL.sys.pref("clock24") ? String(h).padStart(2, "0") + ":" + m : ((h % 12) || 12) + ":" + m;
            if (dom.clock.textContent !== text) dom.clock.textContent = text;
        }
        tick();
        setInterval(tick, 10000);
        APL.sys.onPref("clock24", tick);
    }

    function render() {
        var keep = nav && nav.index >= 0 ? apps[nav.index] && apps[nav.index].id : null;
        dropLayers();
        allApps.forEach(function (a) { if (a.folder && APL.folders.byId(a.folder)) a.tileHtml = APL.folders.tileHtml(APL.folders.byId(a.folder)); });
        // The Smart Hub tile starts hidden, once per profile: shown from Settings › Apps › Show on Home Screen
        if (!APL.sys.pref("smartHubTileSet")) {
            var hide = APL.sys.pref("hiddenApps").slice();
            if (hide.indexOf(SAMSUNG_HOME_TILE) === -1) hide.push(SAMSUNG_HOME_TILE);
            APL.sys.setPref("smartHubTileSet", true);
            APL.sys.setPref("hiddenApps", hide);
        }
        apps = allApps.filter(function (a) {
            if (APL.sys.pref("hiddenApps").indexOf(a.id) !== -1 || APL.folders.holding(a.id)) return false;
            return !a.folder || APL.folders.byId(a.folder);
        });

        /* The top row holds the six in DOCK, but their order inside it is the
           saved order: move one on the Home Screen and it stays moved. */
        var picked = [];
        DOCK.forEach(function (d) {
            for (var i = 0; i < apps.length; i++) {
                var a = apps[i];
                if (picked.indexOf(a) !== -1) continue;
                if (a.id === d.key || (a.key && a.key === d.key) || (d.re && d.re.test(a.name || ""))) { picked.push(a); break; }
            }
        });
        /* Without a chosen layout the top row is DOCK's six. Once anything has
           been arranged, the first six of the saved order are the dock — so an
           app brought up from the drawer stays in the top row. */
        var savedOrder = APL.sys.pref("appOrder") || [], dock;
        if (savedOrder.length) {
            dock = apps.slice(0, DOCK.length);
            /* Home keeps its place: a saved layout made before this rule must
               not push the Home app out of the dock. */
            var homeApp = null, h;
            for (h = 0; h < apps.length; h++) if (/^apl\.homeassistant$/.test(apps[h].id)) homeApp = apps[h];
            if (homeApp && dock.indexOf(homeApp) === -1) {
                dock = dock.slice(0, DOCK.length - 1).concat([homeApp]);
            }
        } else dock = picked.filter(function (a) { return apps.indexOf(a) !== -1; });
        dockSize = dock.length;
        /* Seven in the dock share the same strip: the row is told, and CSS makes
           the tiles narrower instead of letting one hang off the glass. */
        if (dom.row0) dom.row0.classList.toggle("is-seven", dockSize > 6);
        apps = dock.concat(apps.filter(function (a) {
            return dock.indexOf(a) === -1 && a.id !== "apl.controlcenter";
        }));
        dom.row0.innerHTML = "";
        dom.rows.innerHTML = "";
        tiles = apps.map(function (app, i) {
            var row = i < dockSize ? 0 : 1 + Math.floor((i - dockSize) / 6);
            var t = makeTile(app, row);
            (row === 0 ? dom.row0 : dom.rows).appendChild(t);
            return t;
        });
        if (!nav) createNav();
        // Same app as before; if it has gone (deleted, hidden), the same position.
        var want = nav && nav.index >= 0 ? Math.min(nav.index, apps.length - 1) : 0;
        for (var i = 0; i < apps.length; i++) if (apps[i].id === keep) want = i;
        bgActive.dataset.app = "";
        nav.setTiles(tiles);
        nav.focus(want);
    }

    function createNav() {
        var K = APL.KEY;
        nav = new APL.Nav({
            onFocus: onFocus,
            onSelect: function (i) { launch(i); },
            onLongPress: function (i, el) { if (!editing) openAppMenu(i, el); },
            // The tile reacts as soon as it's pressed: the remote's delay no longer shows
            onHoldStart: function (i) { if (tiles[i]) tiles[i].classList.add("is-pressed"); },
            onHoldCancel: function (i) { if (tiles[i]) tiles[i].classList.remove("is-pressed"); },
            onEdge: function (dir) {
                // ▲ from the dock: the "Continue Watching" cards if the app has any…
                if (dir === "up" && mode === "shelf" && APL.widgets && APL.widgets.focusCards()) return;
                // … otherwise full screen (only if the app has artwork)
                var a = apps[nav.index];
                if (dir === "up" && mode === "shelf" && (a.bg || (APL.live && APL.live.hasSource(a)))) setMode("full");
            },
            onKey: function (code) {
                if (editing) return editKey(code);
                if (mode !== "full") return false;
                // In full screen: ◀ ▶ change app, ▼ / Back return, OK opens.
                if (code === K.DOWN || code === K.RETURN || code === K.ESC || code === K.BACKSPACE) { setMode("shelf"); return true; }
                if (code === K.UP) return true;
                return false;
            },
            onBack: function () {
                // Already on the first tile: stay there. Exiting left a black screen.
                if (nav.index !== 0) { nav.focus(0); }
            }
        });
        nav.attach();
    }

    function asset(p) { return global.APL_ASSET ? global.APL_ASSET(p) : p; }

    /* Apps built into the launcher, like Settings on Apple TV. */
    function virtualApps() {
        return [
            // The house: CleanFrame's own Home Assistant app, with the HomeKit mark.
            { id: "apl.homeassistant", name: APL.t("Home"), virtual: true, accent: "#ff9f0a", eyebrow: "MAISON",
              tile: asset("images/apps/homekit-tile.png"), bg: asset("images/bg-homekit.jpg"),
              bgBlur: asset("images/blur/homekit.jpg"),
              run: openHomeAssistant },
            // TizenTube: its own tile, without going through TizenBrew's screen
            { id: "apl.tizentube", name: "TizenTube", virtual: true, needs: "xvvl3S1bvH.TizenBrewStandalone", accent: "#1fb6e6", eyebrow: "VIDÉO",
              tile: APL.TIZENTUBE_ART.tile, bg: APL.TIZENTUBE_ART.bg, bgBlur: APL.TIZENTUBE_ART.bgBlur, live: "youtube",
              run: function () { showVeil(); launchTube(null); } },
            // Apple's Settings icon (images/apps/settings-*, made by tools/art)
            { id: "apl.settings", name: APL.t("Settings"), virtual: true, accent: "#8e8e93", eyebrow: "SYSTÈME",
              tile: asset("images/apps/settings-tile.png"), bg: asset("images/apps/settings-bg.jpg"),
              bgBlur: asset("images/blur/settings.jpg"),
              run: function () { APL.settings.open(); } },
            { id: "apl.sources", name: "Sources", virtual: true, accent: "#2c5cc5", eyebrow: "SYSTÈME",
              tileHtml: '<div class="vtile vtile--sources">' + APL.icon("source", 92, 1.6) + '</div>',
              shelfHtml: '<div class="brandcard__glyph vtile--sources">' + APL.icon("source", 180, 1.3) + '</div>',
              run: function () { APL.openSources(); } },
            // Samsung's own home, as a shortcut tile: the remote's Home key stays with Samsung.
            // Hidden like any app (Settings › Apps › Show on Home Screen, or hold OK › Hide App).
            { id: SAMSUNG_HOME_TILE, name: "Smart Hub", virtual: true, accent: "#1428a0", eyebrow: "SYSTÈME",
              tileHtml: '<div class="vtile vtile--samsunghome">' + APL.icon("apps", 92, 1.6) + '</div>',
              shelfHtml: '<div class="brandcard__glyph vtile--samsunghome">' + APL.icon("apps", 180, 1.3) + '</div>',
              run: openSamsungHome }
        ];
    }

    /* CleanFrame's Home Assistant app: the house as an app, so a light is one
       press away instead of a browser tab. Falls back to the dashboard the
       private client points at, and says so when neither is here. */
    function openHomeAssistant() {
        if (global.CleanFrameHomeApp && global.CleanFrameHomeApp.open) { global.CleanFrameHomeApp.open(); return; }
        var ha = global.CleanFrameHA;
        if (ha && ha.dashboard && APL.sys && APL.sys.openUrl) { APL.sys.openUrl(ha.dashboard); return; }
        toast(APL.t("The Home Assistant app is not in this build"));
    }

    /* Samsung's home ignores a plain app-control launch (Vetro's dock found the same): the platform's
       own app_launcher, as root through Vetro, shows it. The overlay is told first, or it would put the
       launcher back over it within a second ("Return to the Launcher"). */
    var SAMSUNG_HOME_TILE = "apl.samsunghome";
    function openSamsungHome() {
        if (APL.sys.PREVIEW) { toast(APL.t("Opens Samsung's Smart Hub on the screen")); return; }
        // The overlay opens it itself (it reaches Vetro on its own, without the bridge) and then
        // leaves it on screen; without the overlay, the launcher asks Vetro.
        if (APL.overlay && APL.overlay.isInstalled() && APL.overlay.openSamsungHome) { APL.overlay.openSamsungHome(); return; }
        APL.sys.vetroPost("/exec", { cmd: "/usr/bin/app_launcher -s com.samsung.tv.csfs >/dev/null 2>&1 &" })
            .catch(function () { toast(APL.t("Vetro is not responding")); });
    }

    function boot() {
        cacheDom();
        /* The drawer's blurred ground exists from the start: it is painted when
           the artwork changes, so opening the grid never waits for a canvas. */
        try { blurLayer(); } catch (e) {}
        dom.hint.querySelector(".hint__text").textContent = APL.t("Press ▲ for full screen");   // index.html only has the English text
        startClock();
        APL.sys.registerKeys();
        /* The backdrop catalogue loads in the background: six hours in the
           cache, nothing fetched while the row moves. */
        if (APL.appArt && APL.appArt.start) {
            APL.appArt.start(function () {
                if (APL.reloadApps) APL.reloadApps();
                refreshBackdrops();
            });
        }
        if (global.CleanFrameBackdrops && global.CleanFrameBackdrops.start) {
            try { global.CleanFrameBackdrops.start(); } catch (e) {}
            setTimeout(function () { if (APL.reloadApps) APL.reloadApps(); }, 6000);
        }
        document.body.classList.toggle("reduce-motion", !!APL.sys.pref("reduceMotion"));
        APL.sys.onPref("reduceMotion", function (v) { document.body.classList.toggle("reduce-motion", !!v); });
        applyPerf();
        APL.sys.onPref("visualEffects", applyPerf);
        applyTheme();
        APL.sys.onPref("appearance", applyTheme);
        /* The backdrop switches redraw the wall at once: off means the app's own
           artwork, on means the catalogue poster. */
        function backdropsChanged() {
            dropLayers();
            if (typeof refreshBackdrops === "function") refreshBackdrops();
            else if (bgActive) setBackdrop(apps[nav.index] || apps[0]);
        }
        APL.sys.onPref("cleanFrameBackdrops", backdropsChanged);
        APL.sys.onPref("dynamicBackdrops", backdropsChanged);
        APL.sys.profiles.onChange(applyTheme);
        setInterval(applyTheme, 60000);
        APL.loadApps().then(function (list) {
            buildList(list);
            watchPackages();
            setTimeout(preloadDock, 400);
            // Then a background search for missing artwork (new apps included)
            setTimeout(function () { if (APL.autoArt) APL.autoArt.run(allApps, render); }, 3500);
            showCcHint();
            render();
            if (APL.overlay) APL.overlay.start();
            slowKeyRepeat(8);
            setTimeout(bootCleanup, 25000);
            global.APL_BOOT_OK = true;          // the version (installed or updated) starts fine
            if (requestedAction()) runAction(requestedAction());   // opened for a specific reason: TizenTube, App Switcher…
            setTimeout(function () { dom.boot.classList.add("is-hidden"); }, 120);
        });
    }

    /* Full list: the dock (your apps, Settings, Sources), then your websites,
       Vetro, App Store, Samsung TV Plus and the rest in alphabetical order. */
    var virtuals = null;
    function buildList(list) {
        var favs = list.filter(function (a) { return a.favorite; });
        var FIRST = ["Vetro", "App Store", "Samsung TV Plus"];
        var rank = function (a) { if (a.web) return -1; var i = FIRST.indexOf(a.name); return i === -1 ? 99 : i; };
        var rest = list.filter(function (a) { return !a.favorite; }).concat(APL.webApps ? APL.webApps() : []).sort(function (a, b) {
            return rank(a) - rank(b) || a.name.localeCompare(b.name, APL.locale, { sensitivity: "base" });
        });
        virtuals = virtuals || virtualApps();
        var usable = virtuals.filter(function (v) { return !v.needs || list.some(function (a) { return a.id === v.needs; }); });
        var tube = usable.filter(function (v) { return v.id === "apl.tizentube"; });
        defaultOrder = tube.concat(favs, usable.filter(function (v) { return tube.indexOf(v) === -1; }), rest, APL.folders.all().map(APL.folders.asApp));
        allApps = applySavedOrder(defaultOrder);
        // Artwork already found automatically (kept on the screen): right away
        if (APL.autoArt) APL.autoArt.applyCached(allApps);
    }

    /* An app installed, updated or deleted (by APL Launcher Setup, the App Store…):
       the grid updates by itself, without restarting the launcher. */
    var pkgTimer = null;
    function watchPackages() {
        var pm = global.tizen && global.tizen.package;
        if (!pm || typeof pm.setPackageInfoEventListener !== "function") return;
        function again() {
            clearTimeout(pkgTimer);
            pkgTimer = setTimeout(function () {
                APL.loadApps().then(function (list) {
                    var focused = apps[nav.index] && apps[nav.index].id;
                    buildList(list);
                    render();
                    for (var i = 0; i < apps.length; i++) if (apps[i].id === focused) { nav.focus(i); break; }
                    if (APL.autoArt) setTimeout(function () { APL.autoArt.run(allApps, render); }, 1500);
                });
            }, 1500);
        }
        try { pm.setPackageInfoEventListener({ oninstalled: again, onupdated: again, onuninstalled: again }); } catch (e) {}
    }

    /* ---------- chosen layout (Edit Home Screen) ---------- */
    var defaultOrder = [];
    function applySavedOrder(list) {
        var saved = APL.sys.pref("appOrder") || [];
        if (!saved.length) return list.slice();
        var pos = {};
        saved.forEach(function (id, i) { pos[id] = i; });
        // A layout from before these tiles: TizenTube first, Overscan in place of Internet
        if (!("apl.tizentube" in pos)) pos["apl.tizentube"] = -1;
        var browser = saved.indexOf("org.tizen.browser");
        if (browser !== -1 && !("org.apps2samsung.overscan" in pos)) pos["org.apps2samsung.overscan"] = browser;
        // Only once: AquaPlay moves up into the dock (its widgets show there) in place of TizenBrew,
        // which the TizenTube tile replaces
        var AQUA = "AquaPlay02.AquaPlay", BREW = "xvvl3S1bvH.TizenBrewStandalone", moved = false;
        if (!APL.sys.pref("aquaInDock") && BREW in pos && list.some(function (a) { return a.id === AQUA; })) {
            var brewAt = pos[BREW];
            pos[BREW] = AQUA in pos ? pos[AQUA] : 100000;
            pos[AQUA] = brewAt;
            moved = true;
        }
        // Only once: Stremio moves up into the dock, after AquaPlay (its widgets only show there)
        var STREMIO = "IkWsFHtOY9.Stremio", moveStremio = !APL.sys.pref("stremioInDock") && list.some(function (a) { return a.id === STREMIO; });
        if (moveStremio) pos[STREMIO] = (AQUA in pos ? pos[AQUA] : 0) + 0.5;
        // Known apps in their place; new apps at the end, as on tvOS.
        var ordered = list.map(function (a, i) { return { a: a, k: (a.id in pos) ? pos[a.id] : 100000 + i }; })
                          .sort(function (x, y) { return x.k - y.k; })
                          .map(function (x) { return x.a; });
        if (moved || moveStremio) APL.sys.setPref("appOrder", ordered.map(function (a) { return a.id; }));
        if (moved) APL.sys.setPref("aquaInDock", true);
        if (moveStremio) APL.sys.setPref("stremioInDock", true);
        return ordered;
    }
    function saveOrder() { APL.sys.setPref("appOrder", allApps.map(function (a) { return a.id; })); }

    /* ---------- "hold OK" menu (as on tvOS) ---------- */
    var PROTECTED = /^(vetrotvapp|APLauncher\.|xvvl3S1bvH\.|com\.samsung\.|org\.tizen\.|samsung\.)/i;   // xvvl3S1bvH: TizenBrew

    function openAppMenu(i, el) {
        var app = apps[i];
        if (!app) return;
        var anchor = el.querySelector(".tile__card") || el;
        var items = [{ label: APL.t("Edit Home Screen"), icon: "grid", run: function () { startEdit(app.id); } },
                     { label: APL.t("Move Left"), icon: "grid", run: function () { moveApp(app.id, -1); } },
                     { label: APL.t("Move Right"), icon: "grid", run: function () { moveApp(app.id, 1); } }];
        if (app.folder) {
            items.unshift({ label: APL.t("Rename"), icon: "grid", run: function () { APL.folders.askName(app.folder); } });
            items.push({ label: APL.t("Delete Folder"), icon: "trash", destructive: true, run: function () {
                APL.folders.destroy(app.folder);
                APL.foldersChanged();
                toast(APL.t("Folder deleted: its apps are back on the Home Screen"), true);
            } });
            APL.contextMenu.open(anchor, items);
            return;
        }
        items.push({ label: APL.t("Move to Folder"), icon: "grid", run: function () { chooseFolder(app, anchor); } });
        if (app.id !== "apl.settings") {
            items.push({ label: APL.t("Hide App"), icon: "eyeOff", run: function () { hideApp(app); } });
        }
        if (!app.virtual && !PROTECTED.test(app.id)) {
            items.push({ label: APL.t("Delete App"), icon: "trash", destructive: true, run: function () { confirmDelete(app); } });
        }
        APL.contextMenu.open(el.querySelector(".tile__card") || el, items);
    }

    function chooseFolder(app, anchor) {
        var items = APL.folders.all().map(function (f) {
            return { label: f.name, icon: "grid", run: function () { APL.folders.addTo(f.id, app.id); APL.foldersChanged(); toast(APL.t("“{app}” is in “{folder}”", { app: app.name, folder: f.name }), true); } };
        });
        items.push({ label: APL.t("New Folder"), icon: "grid", run: function () {
            var at = allApps.indexOf(app), f = APL.folders.create(app.id);
            allApps.splice(at, 0, APL.folders.asApp(f));
            APL.foldersChanged();
            toast(APL.t("“{name}” created: hold OK on it to rename it", { name: f.name }), true);
        } });
        APL.contextMenu.open(anchor, items);
    }

    /* After a folder change: the Home Screen follows, and the layout is kept. */
    APL.foldersChanged = function () {
        allApps = allApps.filter(function (a) { return !a.folder || APL.folders.byId(a.folder); });
        saveOrder();
        render();
    };

    /* Open an app as the Home Screen knows it (folder, App Switcher…). */
    APL.openApp = function (app) {
        if (app.virtual) { app.run(); return; }
        APL.sys.profiles.noteLaunch(app.id);
        showVeil();
        APL.launchApp(app.id).catch(function (err) { hideVeil(); toast(err.message || APL.t("Couldn't open the app")); });
    };
    APL.makeTile = makeTile;

    function hideApp(app) {
        var hidden = APL.sys.pref("hiddenApps").slice();
        if (hidden.indexOf(app.id) === -1) hidden.push(app.id);
        APL.sys.setPref("hiddenApps", hidden);
        render();
        toast(APL.t("“{name}” is hidden — Settings › Apps to show it again", { name: app.name }));
    }

    function confirmDelete(app) {
        APL.alert({
            title: APL.t("Delete “{name}”?", { name: app.name }),
            message: APL.t("The app and its data will be deleted from the screen. You can reinstall it from the App Store."),
            buttons: [
                { label: APL.t("Delete"), destructive: true, run: function () { deleteApp(app); } },
                { label: APL.t("Cancel") }
            ],
            focus: 1                       // "Cancel" by default: no deleting by mistake
        });
    }

    function dropApp(id) {
        allApps = allApps.filter(function (a) { return a.id !== id; });
        saveOrder();
        render();
    }

    /* Deletion through Vetro (it refuses system and protected apps), then
       a real check in the list of installed apps. */
    function deleteApp(app) {
        if (APL.sys.PREVIEW) { dropApp(app.id); toast(APL.t("“{name}” was deleted (preview)", { name: app.name })); return; }
        toast(APL.t("Deleting “{name}”…", { name: app.name }));
        APL.sys.vetroPost("/components/action", { appId: app.id, action: "uninstall" }).catch(function () {});
        var tries = 0;
        (function check() {
            setTimeout(function () {
                APL.isInstalled(app.id).then(function (still) {
                    if (!still) { dropApp(app.id); toast(APL.t("“{name}” was deleted", { name: app.name })); return; }
                    if (++tries < 8) { check(); return; }
                    toast(APL.t("Couldn't delete “{name}” (system app, or Vetro stopped). You can hide it.", { name: app.name }));
                });
            }, 2500);
        })();
    }

    /* ---------- Edit Home Screen: the app jiggles, the arrows move it ---------- */
    var editing = null;

    function markMoving() {
        tiles.forEach(function (t, k) { t.classList.toggle("is-moving", !!editing && apps[k].id === editing); });
    }

    function startEdit(id) {
        editing = id;
        document.body.classList.add("is-editing");
        markMoving();
        toast(APL.t("Move the app with the arrows, then press OK"), true);
    }

    function endEdit() {
        editing = null;
        document.body.classList.remove("is-editing");
        markMoving();
        saveOrder();
    }

    /* One move, shared by the arrows of Edit Home Screen and by the menu, so a
       tile can always be put where it belongs. */
    function moveApp(id, step) {
        var k, i = -1;
        for (k = 0; k < apps.length; k++) if (apps[k].id === id) i = k;
        if (i < 0) return false;
        var j = i + step;
        if (j < 0 || j >= apps.length) { if (APL.sound) APL.sound.edge(); return false; }
        var visible = apps.slice();
        visible.splice(j, 0, visible.splice(i, 1)[0]);
        var hidden = allApps.filter(function (a) { return visible.indexOf(a) === -1; });
        allApps = visible.concat(hidden);
        saveOrder();                 // kept even if something re-renders
        render();
        /* Stay on the tile that moved, so it is seen to arrive. */
        for (k = 0; k < apps.length; k++) if (apps[k].id === id) { nav.focus(k); break; }
        if (APL.sound) APL.sound.tick();
        return true;
    }

    function editKey(code) {
        var K = APL.KEY;
        if (code === K.ENTER || code === K.RETURN || code === K.ESC || code === K.BACKSPACE) {
            endEdit();
            if (APL.sound) APL.sound.select();
            return true;
        }
        var step = { 37: -1, 39: 1, 38: -6, 40: 6 }[code];
        if (!step) return true;                        // other keys ignored while editing
        moveApp(editing, step);
        markMoving();
        return true;
    }

    /* Home button: closes whatever is open and goes back to the 1st app.
       Returns false if already on the Home Screen (2nd press = Control Center). */
    APL.goHome = function () {
        var closed = false;
        if (APL.screensaver && APL.screensaver.isActive()) { APL.screensaver.stop(); closed = true; }
        if (APL.alert && APL.alert.isOpen && APL.alert.isOpen()) { APL.alert.close(); closed = true; }
        if (APL.contextMenu && APL.contextMenu.isOpen()) { APL.contextMenu.close(); closed = true; }
        if (APL.sources && APL.sources.isOpen()) { APL.sources.close(); closed = true; }
        if (APL.profilesUI && APL.profilesUI.isOpen()) { APL.profilesUI.close(); closed = true; }
        if (APL.settings && APL.settings.isOpen()) { APL.settings.close(); closed = true; }
        if (APL.controlCenter && APL.controlCenter.isOpen()) { APL.controlCenter.close(); closed = true; }
        if (APL.widgets && APL.widgets.leaveCards()) closed = true;
        if (editing) { endEdit(); closed = true; }
        if (mode === "full") { setMode("shelf"); closed = true; }
        if (nav && nav.index > 0) { nav.focus(0); closed = true; }
        return closed;
    };

    /* Open an app from elsewhere (a profile's recent apps) */
    APL.launchById = function (id) {
        for (var i = 0; i < apps.length; i++) if (apps[i].id === id) { nav.focus(i); launch(i); return; }
        APL.sys.profiles.noteLaunch(id);
        APL.launchApp(id).catch(function (err) { toast(err.message || APL.t("Couldn't open the app")); });
    };

    /* Profile change: its layout and its hidden apps */
    APL.sys.profiles.onChange(function () {
        if (!defaultOrder.length) return;
        var keep = allApps;
        allApps = applySavedOrder(defaultOrder.filter(function (d) { return keep.indexOf(d) !== -1; }));
        nav.index = 0;
        render();
    });

    APL.refreshArt = function () { if (APL.autoArt) APL.autoArt.refresh(allApps, render); };
    APL.restyleArt = function () { if (APL.autoArt) APL.autoArt.restyle(allApps, render); };

    APL.resetHomeOrder = function () {
        APL.sys.setPref("appOrder", []);
        allApps = applySavedOrder(defaultOrder.filter(function (d) {
            return allApps.some(function (a) { return a.id === d.id; });
        }));
        render();
    };

    /* Dock backgrounds prepared in advance: the Top Shelf changes without a hitch. */
    function preloadDock() {
        apps.slice(0, dockSize).forEach(layerFor);
    }

    /* Appearance: light, dark, or following the sun (sunrise and sunset computed for France). */
    function isNight(d) {
        var day = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);
        var lat = 48.85 * Math.PI / 180, decl = 23.44 * Math.PI / 180 * Math.sin(2 * Math.PI * (284 + day) / 365);
        var half = Math.acos(-Math.tan(lat) * Math.tan(decl)) * 12 / Math.PI;
        var noon = 12 - d.getTimezoneOffset() / 60 - 2.35 / 15, h = d.getHours() + d.getMinutes() / 60;
        return h < noon - half || h > noon + half;
    }
    function applyTheme() {
        var a = APL.sys.pref("appearance");
        var light = a === "light" || (a === "auto" && !isNight(new Date()));
        document.body.classList.toggle("theme-light", light);
        if (APL.overlay) APL.overlay.setTheme(light);
    }

    /* Performance mode: no real-time blur or glass (which made the screen lag). */
    function applyPerf() {
        document.body.classList.toggle("perf", !APL.sys.pref("visualEffects"));
    }

    /* Tip shown on the first start-ups. */
    function showCcHint() {
        var n = APL.sys.pref("ccHintCount");
        if (n >= 3) return;
        APL.sys.setPref("ccHintCount", n + 1);
        setTimeout(function () {
            toast(APL.t("Tip: ⏯ opens Control Center"));
        }, 2500);
    }

    /* Home button (sent here by Vetro): if already on the Home Screen for a while,
       another press opens / closes Control Center, like the TV button on Apple TV. */
    var lastShown = Date.now(), switcherOnShow = false;
    document.addEventListener("visibilitychange", function () {
        if (document.hidden) return;
        lastShown = Date.now();
        hideVeil();
        setTimeout(bootCleanup, 25000);
        if (switcherOnShow) { switcherOnShow = false; if (APL.switcher) APL.switcher.open(); }
    });
    var lastHome = 0;
    /* The native Control Center (overlay/) asks for a launcher page: Settings, Connection… */
    function requestedAction() {
        try {
            var data = global.tizen.application.getCurrentApplication().getRequestedAppControl().appControl.data || [];
            for (var i = 0; i < data.length; i++) if (data[i].key === "apl_action") return data[i].value[0];
        } catch (e) {}
        return "";
    }
    function runAction(action) {
        if (action === "controlcenter") { if (APL.controlCenter) APL.controlCenter.toggle(); return; }
        if (APL.controlCenter && APL.controlCenter.isOpen()) APL.controlCenter.close();
        if (action === "switcher") {
            if (document.hidden) switcherOnShow = true;
            else if (APL.switcher && !APL.switcher.isOpen()) APL.switcher.open();
        }
        else if (action === "settings") APL.settings.open();
        else if (action === "connexions") APL.settings.open(APL.t("Connection"));
        else if (action === "alexa") APL.services.alexaMic();
        else if (action.indexOf("open:") === 0) openById(action.substr(5));   // "Alexa, turn on…"
    }
    function openById(id) {
        for (var i = 0; i < allApps.length; i++) if (allApps[i].id === id) { APL.goHome(); APL.openApp(allApps[i]); return; }
    }
    global.addEventListener("appcontrol", function () {
        var action = requestedAction();
        if (action) { lastShown = Date.now(); runAction(action); return; }
        // Two quick presses on Home: the App Switcher, as on Apple TV
        var quick = Date.now() - lastHome < 800;
        lastHome = Date.now();
        // The second press often arrives before the Home Screen is back on screen
        if (quick && document.hidden) { switcherOnShow = true; return; }
        if (quick && !document.hidden && APL.switcher && !APL.switcher.isOpen()) {
            if (APL.controlCenter && APL.controlCenter.isOpen()) APL.controlCenter.close();
            APL.switcher.open();
            return;
        }
        if (!document.hidden && Date.now() - lastShown > 1500) {
            if (APL.switcher && APL.switcher.isOpen()) { APL.switcher.close(); return; }
            if (APL.screensaver && APL.screensaver.isActive()) { APL.screensaver.stop(); return; }
            if (APL.settings && APL.settings.isOpen()) APL.settings.close();
            if (APL.controlCenter && APL.controlCenter.isOpen()) APL.controlCenter.close();
        } else {
            lastShown = Date.now();
        }
    });

    APL.toast = function (m, info) { toast(m, info); };
    APL.allApps = function () { return allApps; };
    APL.reloadApps = function () { render(); };
    APL.openSources = function () { if (APL.sources) APL.sources.open(); };

    /* Control Center: Play/Pause or the red key (C on the keyboard in the PC preview). */
    APL.addHotkey(function (code) {
        var K = APL.KEY;
        if (code === K.MEDIA_PLAY_PAUSE || code === K.RED || (APL.sys.PREVIEW && code === 67)) {
            if (APL.controlCenter) APL.controlCenter.toggle();
            return true;
        }
        return false;
    });

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
    else boot();

})(window);
