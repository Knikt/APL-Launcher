/* ============================================================
   glass.js — pre-blurred glass for the launcher's chrome.

   The panels used backdrop-filter. On a Tizen set that is the most
   expensive thing on screen: the blur is re-run every time a tile
   scales on focus or a panel slides in. This freezes the backdrop
   once per artwork (a 48x27 copy upscaled to a 480x270 tile, so the
   downscale itself is the blur, enlarged a quarter and a quarter
   brighter), then shows the slice that sits under each surface. Opening a panel, moving focus or changing the
   artwork then only changes background-position: nothing filters,
   and nothing is drawn per frame.

     src()      the frozen backdrop in use ("" when there is none)
     lens(x,y)  the background-position for a stage point
     offset(el) stage rectangle of an element, ignoring transforms
     paint()    re-slice every surface now
     refresh()  re-read the artwork, then paint (debounced)
     setSource(url)  force an artwork (a page that is not the Home
                     Screen, e.g. a fixed backdrop); release() undoes it.
     onChange(fn)    called with the new backdrop ("" when there is
                     none), for a sheet that shows it full-frame.

   Everything is behind body.glass, added here, so the skin can be
   switched off and the old translucent fills come straight back.
   ============================================================ */
(function (global) {
    "use strict";

    var APL = global.APL = global.APL || {};

    var BAKE_W = 480, BAKE_H = 270;      /* 1/4 of the stage */
    var TINY_W = 48, TINY_H = 27;        /* 1/40: two steps down, no filter */
    var ZOOM = 1.25;                     /* the backdrop is enlarged behind the glass */
    var LIGHT = 1.05;                    /* 5 % brighter: the pane reads as lit, not washed out */

    /* Every surface that should read as a lens. Add a selector here and it
       gets the material, with no other change. The profile row in Control
       Center is deliberately NOT one: a circle that small only shows a
       smear, and it sits next to the avatar that must stay flat. */
    var TARGETS = [
        ".dock",
        ".status",            /* the clock and avatar pill */
        ".cc__t",
        ".scard__art--glass"
    ];

    var baked = "";          /* data URL of the frozen backdrop */
    var bakedFrom = "";      /* the artwork it was made from */
    var forced = "";         /* setSource() override */
    var timer = 0, empty = 0;
    var settle = 0;          /* second look, once the new backdrop has faded in */
    var body = null;

    function $(id) { return document.getElementById(id); }

    function urlOf(el) {
        if (!el) return "";
        var bg = global.getComputedStyle(el).backgroundImage || "";
        var m = /url\(["']?([^"')]+)["']?\)/.exec(bg);
        return m ? m[1] : "";
    }

    /* The artwork on screen. A generated brand card has no URL (it is a
       gradient), and those keep the plain translucent fill: an empty
       answer is a valid answer. */
    function scene() {
        /* The layer actually on screen: the dock keeps one prepared .bg per app,
           and those are the ones that carry the artwork, not #bgA/#bgB. */
        return urlOf(document.querySelector(".bg.is-active")) ||
               urlOf($("bgA")) || urlOf($("bgB")) || urlOf($("bgBlur"));
    }

    /* The pane for each artwork is rendered once and kept, so a picture that
       comes back (the ten-second rotation, a step back along the row) is shown
       on a slice that is already made: nothing is drawn on the frame that
       changes the backdrop. */
    var cache = {}, order = [], CACHE_MAX = 12;
    function remember(src, data) {
        if (!src || !data) return;
        if (!cache[src]) order.push(src);
        cache[src] = data;
        while (order.length > CACHE_MAX) delete cache[order.shift()];
    }

    /* Two canvases, both off the animation path. The second is the only
       "blur": drawing 48x27 into 480x270 is a 10x upscale, which the
       compositor smooths for free. */
    function draw(img) {
        /* The glass enlarges what sits behind it by a quarter: sample the
           middle 80% of the artwork, so every slice is a 1.25x crop of the
           backdrop and the edges of the pane never show the pixels the
           surface used to sit on. */
        var iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
        var sw = iw / ZOOM, sh = ih / ZOOM;

        var tiny = document.createElement("canvas");
        tiny.width = TINY_W;
        tiny.height = TINY_H;
        tiny.getContext("2d").drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, 0, 0, TINY_W, TINY_H);

        var out = document.createElement("canvas");
        out.width = BAKE_W;
        out.height = BAKE_H;
        var c = out.getContext("2d");
        c.imageSmoothingEnabled = true;
        if ("imageSmoothingQuality" in c) c.imageSmoothingQuality = "high";
        /* Brightness is baked once here: no filter, no redraw, on the TV's
           animation path. */
        if ("filter" in c) c.filter = "brightness(" + LIGHT + ")";
        c.drawImage(tiny, 0, 0, BAKE_W, BAKE_H);
        return out.toDataURL("image/jpeg", 0.72);
    }

    var rendering = {};
    /* One render per artwork, however many ask for it: a bake finishing after
       the focus moved on still answers everybody, and nothing is dropped. */
    function render(src, cb) {
        if (cache[src]) { cb(cache[src]); return; }
        if (rendering[src]) { rendering[src].push(cb); return; }
        rendering[src] = [cb];
        function finish(data) {
            var list = rendering[src] || [], i;
            delete rendering[src];
            if (data) remember(src, data);
            for (i = 0; i < list.length; i++) { try { list[i](data); } catch (e) {} }
        }
        var img = new global.Image();
        img.onload = function () {
            var data = "";
            try { data = draw(img); } catch (e) { data = ""; }
            finish(data);
        };
        img.onerror = function () { finish(""); };
        /* A poster from the catalogue lives on images.justwatch.com: without
           this the canvas is tainted, toDataURL throws, and every lens would
           quietly disappear behind remote artwork. */
        if (!/^(data:|blob:)/i.test(src)) img.crossOrigin = "anonymous";
        img.src = src;
    }

    var wanted = "";         /* the artwork that should be on screen right now */

    function bake(src, done) {
        if (!src) { drop(); return; }
        wanted = src;
        if (src === bakedFrom && baked) { paint(); if (done) done(); return; }
        render(src, function (data) {
            /* A render that lands after the focus has moved on is kept for next
               time, not shown. Without this a fast scroll shows panes out of
               order, and each late one is a jump the eye catches at once. */
            if (data && data !== baked && src === wanted) {
                baked = data;
                bakedFrom = src;
                forget();
                paint();
                notify();
            }
            if (done) done();
        });
    }

    /* The pane for a picture that is about to be shown (the next title of the
       app in focus): made now, so the change lands on a ready slice. */
    function prefetch(src) {
        if (src && !cache[src] && src !== bakedFrom) render(src, function () {});
    }

    /* No artwork: hide every lens and leave the CSS fills in charge. */
    function drop() {
        var list = document.querySelectorAll(TARGETS.join(",")), i, l;
        baked = "";
        bakedFrom = "";
        wanted = "";
        for (i = 0; i < list.length; i++) {
            l = list[i].__cgLayer;
            if (l) l.classList.remove("is-on");
            list[i].__cgKey = "";
        }
        notify();
    }

    function notify() {
        if (typeof api.onChange === "function") api.onChange(baked);
    }

    function forget() {
        var list = document.querySelectorAll(TARGETS.join(",")), i;
        for (i = 0; i < list.length; i++) list[i].__cgKey = "";
    }

    /* The layer is inserted, never written into the surface's own
       background: the tiles keep their tint, their ::after sheen and the
       white plate on focus, and the text simply sits above it. */
    function layerFor(el) {
        var l = el.__cgLayer;
        if (l && l.parentNode === el) return l;
        l = document.createElement("i");
        l.className = "cg__glass";
        l.setAttribute("aria-hidden", "true");
        el.insertBefore(l, el.firstChild);
        el.__cgLayer = l;
        el.__cgKey = "";
        return l;
    }

    /* Stage rectangle from layout offsets. A focused tile is scaled and a
       panel slides in, so a client rect would sample the transformed box
       and leave the slice a few pixels off; offsets ignore all of that. */
    function offset(el) {
        var x = 0, y = 0, n = el;
        while (n && n !== body && n !== document.documentElement) {
            x += n.offsetLeft;
            y += n.offsetTop;
            n = n.offsetParent;
        }
        return { x: x, y: y, w: el.offsetWidth, h: el.offsetHeight };
    }

    function lens(x, y) { return (-x) + "px " + (-y) + "px"; }

    function paint() {
        if (!baked) return;
        var list = document.querySelectorAll(TARGETS.join(",")), i, el, r, key, l;
        for (i = 0; i < list.length; i++) {
            el = list[i];
            if (!el.offsetWidth || el.offsetHeight < 4) continue;
            r = offset(el);
            /* The artwork is part of the key, so a new picture re-slices even when
               the surface has not moved. */
            key = r.x + "," + r.y + "," + r.w + "," + r.h + ":" + baked.length + ":" + baked.slice(-24);
            l = el.__cgLayer;
            if (el.__cgKey === key && l && l.parentNode === el && l.classList.contains("is-on")) continue;
            el.__cgKey = key;
            l = layerFor(el);
            if (l.__src !== baked) {
                /* The pane is already rendered (see the cache above): one style
                   write, laid over the old pane, which leaves on the next frame.
                   Nothing fades over anything and nothing is ever empty, so the
                   dock and the pill cannot shimmer. */
                var n = document.createElement("i");
                n.className = "cg__glass is-on";
                n.setAttribute("aria-hidden", "true");
                n.__src = baked;
                n.style.backgroundImage = 'url("' + baked + '")';
                n.style.setProperty("--gx", (-r.x) + "px");
                n.style.setProperty("--gy", (-r.y) + "px");
                el.insertBefore(n, l.parentNode === el ? l.nextSibling : el.firstChild);
                el.__cgLayer = n;
                (function (old) {
                    global.setTimeout(function () { if (old && old.parentNode) old.parentNode.removeChild(old); }, 32);
                })(l);
                continue;
            }
            l.style.setProperty("--gx", (-r.x) + "px");
            l.style.setProperty("--gy", (-r.y) + "px");
            l.classList.add("is-on");
        }
    }

    /* Bake the picture now and call back once the pane is ready, so the caller can
       swap the picture and the glass in the same frame (launcher.js setPoster). */
    function prepare(src, done) {
        if (!done) { if (src) bake(src); return; }
        var called = false;
        function call() { if (called) return; called = true; done(); }
        if (!src) { call(); return; }
        if (src === bakedFrom && baked) { call(); return; }
        bake(src, call);
        /* A bake can fail (artwork without CORS, no canvas): the picture must
           still change, so the caller is never left waiting for it. */
        global.setTimeout(call, 450);
    }

    function refresh() {
        global.clearTimeout(timer);
        timer = global.setTimeout(function () {
            var src = forced || scene();
            /* Nothing behind (a generated brand card, a channel with no poster):
               the pane goes, so the dock and the Control Center never keep the
               last app's backdrop. Not on the spot, though: a poster that lands a
               frame later would blank the dock for a moment. One look after 240 ms
               decides, and a bake starting in between cancels it. */
            global.clearTimeout(empty);
            if (!src) {
                empty = global.setTimeout(function () { if (!scene()) drop(); }, 240);
                return;
            }
            bake(src);
        }, 120);
        /* The backdrop of the app being focused fades in after the key, so the
           first look can still see the app before it: look again once the
           fade is done, or the lens would keep the old artwork. */
        global.clearTimeout(settle);
        settle = global.setTimeout(sync, 520);
    }

    /* Bake again only when the artwork really changed. */
    function sync() {
        var src = forced || scene();
        if (src && src !== bakedFrom) bake(src);
    }

    function setSource(url) { forced = url || ""; refresh(); }

    /* The sheet on a page with no Home Screen behind it: release() really does
       drop the lens, unlike moving focus. */
    function release() {
        forced = "";
        global.clearTimeout(timer);
        timer = global.setTimeout(function () { if (scene()) refresh(); else drop(); }, 120);
    }

    var api = {
        src: function () { return baked; },
        lens: lens,
        offset: offset,
        paint: paint,
        prepare: prepare,
        prefetch: prefetch,
        refresh: refresh,
        setSource: setSource,
        release: release
    };
    APL.glass = api;

    /* A page that opens over the Home Screen re-slices after its own layout
       has settled: one call, and its panes carry the material. */
    APL.glassAfter = function (el) {
        global.setTimeout(function () {
            paint();
            if (el && el.classList) el.classList.add("has-glass");
        }, 0);
    };

    /* Settings > Liquid Glass. `perf`, the screen's own light mode, wins:
       it exists to keep the set smooth. */
    function wanted() {
        if (!APL.sys || !APL.sys.pref) return true;
        var v = APL.sys.pref("liquidGlass");
        return v === undefined ? true : !!v;
    }

    function apply() {
        body = document.body;
        if (!body) return;
        /* No perf gate any more: this material is a picture, not a live filter. The
           screen's light mode keeps the plain fills (glass.css hides the panes). */
        var on = wanted();
        body.classList.toggle("glass", on);
        if (!on) { baked = ""; bakedFrom = ""; wanted = ""; drop(); return; }
        refresh();
        wire();
    }

    /* Wired once, and only while the skin is on. */
    var wired = false;
    function wire() {
        if (wired) return;
        wired = true;
        refresh();
        /* The first artwork lands late, and a page that opens over the Home
           Screen asks again once it has: three cheap looks, then silence. */
        [900, 1800, 3000].forEach(function (ms) { global.setTimeout(refresh, ms); });
        document.addEventListener("keydown", refresh, true);
        /* A redrawn tile gets its layer back, and a backdrop that has just
           finished fading gets sliced in place of the one before it. */
        document.addEventListener("keyup", function () { paint(); sync(); }, true);
        document.addEventListener("transitionend", function () { paint(); sync(); }, true);
        /* Surfaces rebuilt while the glass is on (Control Center redraws its
           tiles on every move) get their lens back within a frame: no flash of
           the plain fill, no glass that appears and is gone again. */
        if (global.MutationObserver) {
            var observer = new global.MutationObserver(function () {
                global.clearTimeout(observer._t);
                observer._t = global.setTimeout(paint, 40);
            });
            observer.observe(body, { childList: true, subtree: true });
        }
        global.addEventListener("resize", paint);
    }

    function start() {
        apply();
        if (APL.sys && APL.sys.onPref) APL.sys.onPref("liquidGlass", apply);
        /* The pref store and the screen settle at their own pace, and this used
           to bail out here for good if the class was not on the body yet: one
           boot-order race and the glass never came on at all, which is what
           "it renders and is stable later" looked like. Look again instead. */
        [120, 900, 1800].forEach(function (ms) { global.setTimeout(apply, ms); });
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
    else start();
})(window);
