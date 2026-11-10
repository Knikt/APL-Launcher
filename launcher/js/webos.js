/* ============================================================
   webos.js — APL Launcher on LG TVs (webOS): the platform layer.

   Loaded first, and does nothing anywhere else (Samsung, the PC preview).
   On an LG TV it sets APL.platform, which the shared code asks instead of
   Tizen's APIs: apps.js (the apps, opening them), system.js (sound,
   network, picture… through webos-system.js), preview.js (not a preview).

   What a Developer Mode app may do on its own, through luna:
     open an app (com.webos.applicationManager/launch), sound up/down and
     mute, read the network, the model, the sound output.
   What it may not (LG keeps it for its partners): list the installed apps,
   read the app in front, set the volume, change input, turn off.
   Those go through the TV's own remote-control API (the one LG's phone
   remote uses), relayed by the launcher's webOS service
   (webos/service/): the TV asks once, on screen, whether to allow it.

   The remote: Back is 461 on LG and 10009 on Samsung. LG's codes are
   turned into Samsung's here, before anything else sees them, so the rest
   of the launcher reads the same keys on both.
   ============================================================ */
(function (global) {
    "use strict";

    var S = global.webOSSystem || global.PalmSystem;
    if (global.tizen || !global.PalmServiceBridge || !S) return;

    var APL = global.APL = global.APL || {};
    var APP_ID = "com.knikt.apllauncher";
    var SVC = "luna://com.knikt.apllauncher.service/";
    var KEY_STORE = "apl.webos.key", APPS_STORE = "apl.webos.apps";

    function load(k, fallback) { try { var v = JSON.parse(global.localStorage.getItem(k) || "null"); return v === null ? fallback : v; } catch (e) { return fallback; } }
    function save(k, v) { try { global.localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
    function t(s, vars) { return APL.t ? APL.t(s, vars) : String(s).replace(/\{(\w+)\}/g, function (m, k) { return vars && k in vars ? vars[k] : m; }); }

    /* ---------- the TV ---------- */
    var device = {};
    try { device = JSON.parse(S.deviceInfo || "{}") || {}; } catch (e) { device = {}; }
    var model = String(device.modelName || "").replace(/\..*$/, "");
    /* OLED: what the TV says (panelType), otherwise LG's model names (OLED55G56LS, OLED65C4…) */
    var oled = device.panelType ? /OLED/i.test(String(device.panelType)) : /^OLED/i.test(model);
    document.documentElement.className += " is-webos";
    /* 4K: LG draws the page in 3840 x 2160 (appinfo.json, tools/make-webos.py) and the launcher keeps its
       1920 x 1080 layout, zoomed to the page: everything is drawn at the panel's own sharpness. The glass
       follows (it reads layout offsets), and so do the arrows (they compare positions). */
    function fitPage() {
        var z = Math.round(100 * (global.innerWidth || 1920) / 1920) / 100;
        document.documentElement.style.zoom = z > 1.01 ? String(z) : "";
        global.APL_HIRES = z > 1.01;              // the Top Shelf asks for its pictures in their full size (liveshelf.js)
    }
    fitPage();
    global.addEventListener("resize", fitPage);
    /* The scrim is drawn at a quarter of the size, then scaled up (launcher.css): scaled only once drawn, so
       the browser keeps that small drawing (a layer with will-change: transform isn't drawn again at a new scale) */
    function scrimUp() {
        var s = document.querySelector(".scrim");
        if (!s) return;
        global.requestAnimationFrame(function () { global.setTimeout(function () { s.classList.add("is-up"); }, 300); });
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", scrimUp); else scrimUp();

    /* ---------- luna ---------- */
    var live = [];          // bridges waiting for their answer: a bridge nobody holds can be collected before it answers
    function luna(uri, params, onMsg) {
        var b = new global.PalmServiceBridge();
        live.push(b);
        b.onservicecallback = function (txt) {
            var m = {};
            try { m = JSON.parse(txt); } catch (e) {}
            if (!b._sub) { var i = live.indexOf(b); if (i !== -1) live.splice(i, 1); }
            if (onMsg) onMsg(m);
        };
        b._sub = !!(params && params.subscribe);
        b.call(uri, JSON.stringify(params || {}));
        return b;
    }
    function lunaOnce(uri, params, ms) {
        return new Promise(function (resolve, reject) {
            var done = false;
            var timer = setTimeout(function () { if (!done) { done = true; reject(new Error(t("The TV didn't answer"))); } }, ms || 15000);
            luna(uri, params, function (m) {
                if (done) return;
                done = true; clearTimeout(timer);
                if (m && m.returnValue === false) reject(new Error(m.errorText || t("The TV refused")));
                else resolve(m || {});
            });
        });
    }
    function endSub(b) {
        if (!b) return;
        try { b.cancel(); } catch (e) {}
        var i = live.indexOf(b); if (i !== -1) live.splice(i, 1);
    }

    /* ---------- the TV's remote-control API, through the service ---------- */
    var state = "idle", stateFns = [], conn = null, key = load(KEY_STORE, "");
    function setState(s) {
        if (!s || s === state) return;
        state = s;
        stateFns.forEach(function (fn) { try { fn(s); } catch (e) {} });
    }
    function connect() {
        if (conn) return;
        conn = luna(SVC + "connect", { subscribe: true, key: key || undefined }, function (m) {
            if (m.returnValue === false) {
                // The service isn't there (an old package) or refused us: try again later
                endSub(conn); conn = null;
                setState("error");
                setTimeout(connect, 15000);
                return;
            }
            if (m.key && m.key !== key) { key = m.key; save(KEY_STORE, key); }
            setState(m.state);
        });
    }
    /* Waits for the TV's answer to the question on screen (or for the key it already gave). */
    var readyWaiters = [];
    stateFns.push(function (s) {
        if (s !== "registered" && s !== "refused") return;
        var w = readyWaiters; readyWaiters = [];
        w.forEach(function (fn) { fn(s); });
    });
    function ready(ms) {
        connect();
        if (state === "registered") return Promise.resolve();
        return new Promise(function (resolve, reject) {
            var timer = setTimeout(function () { reject(new Error(t("LG Connect Apps didn't answer"))); }, ms || 20000);
            readyWaiters.push(function (s) {
                clearTimeout(timer);
                if (s === "registered") resolve(); else reject(new Error(t("The TV refused APL Launcher")));
            });
        });
    }
    function ssap(uri, payload, ms) {
        return ready(ms && ms > 20000 ? ms : 20000).then(function () {
            return lunaOnce(SVC + "request", { uri: uri, payload: payload || {} }, ms || 20000);
        }).then(function (m) { return m.payload || {}; });
    }
    /* onMsg(payload) at each answer; returns a function that ends it. */
    function ssapSub(uri, payload, onMsg) {
        var b = null, ended = false, retry = null;
        function start() {
            if (ended) return;
            ready(600000).then(function () {
                if (ended) return;
                b = luna(SVC + "subscribe", { subscribe: true, uri: uri, payload: payload || {} }, function (m) {
                    if (m.returnValue === false) {          // the connection closed: again in a while
                        endSub(b); b = null;
                        if (!ended) retry = setTimeout(start, 10000);
                        return;
                    }
                    if (m.payload) onMsg(m.payload);
                });
            }, function () { if (!ended) retry = setTimeout(start, 30000); });
        }
        start();
        return function () { ended = true; clearTimeout(retry); endSub(b); };
    }
    function button(name) {
        return ready().then(function () { return lunaOnce(SVC + "button", { name: name }); });
    }
    function service(method, params) { return lunaOnce(SVC + method, params || {}); }

    /* ---------- opening apps (luna: no question asked) ---------- */
    function launch(id, params) {
        return lunaOnce("luna://com.webos.applicationManager/launch", { id: id, params: params || {} }).then(function () {});
    }

    /* ---------- the apps: LG's launch points (the apps in LG's own home bar) ---------- */
    var SELF = new RegExp("^" + APP_ID.replace(/\./g, "\\.") + "(\\.|$)");
    /* Not apps people open from a home screen: LG's own panels and helpers */
    var HIDE = /^(com\.webos\.app\.(home|homeconnect|notificationcenter|voice|igallery|accountmanagement|quicksettings|livemenu|channeledit|tvhotkey|inputcommon|factorywin|membership|scheduler|onboarding|crashreport|tips|care365)|com\.webos\.exampleapp)/i;
    var appsCache = load(APPS_STORE, null);
    /* The TV gives icons on https://127.0.0.1:3001 (its own certificate: refused by this page), and the
       sharper 192 px one as a file of the app: the launcher's service serves them, the file first, with
       the header that lets the launcher read their colours (its Top Shelf art is made from them, as on
       Samsung). The apps' own backgrounds are not used: often a store banner or a screenshot, where
       Samsung's version shows its catalogue artwork or its sheets of light. */
    var ART = "http://127.0.0.1:8767/";
    function iconUrl(lp) {
        var u = String(lp.largeIcon || lp.icon || ""), xl = String(lp.extraLargeIcon || "");
        var ok = /^https?:\/\/127\.0\.0\.1:300[01]\/resources\//.test(u), okXl = /^\/media\/cryptofs\/apps\/.*\.(png|jpe?g|webp)$/i.test(xl);
        if (!ok && !okXl) return null;
        return ART + "icon?" + (ok ? "u=" + encodeURIComponent(u) : "") + (okXl ? (ok ? "&" : "") + "xl=" + encodeURIComponent(xl) : "");
    }
    /* A website pinned to LG's home bar is named after its page ("Accueil - FRAnime #1 DE L'ANIME…"):
       the site's own name instead (franime.fr: FRAnime, which the catalogue knows) */
    function siteName(lp) {
        var host = String((lp.params && lp.params.target) || "").replace(/^[a-z]+:\/\//i, "").split(/[\/?#:]/)[0].toLowerCase();
        var parts = host.split(".").filter(function (x) { return x && !/^(www\d*|m|v\d+|tv)$/.test(x); });
        var name = parts.length > 1 ? parts[parts.length - 2] : parts[0];
        return name ? name.charAt(0).toUpperCase() + name.slice(1) : String(lp.title || "");
    }
    function fromLaunchPoints(lps) {
        var seen = {}, out = [];
        (lps || []).forEach(function (lp) {
            var id = String(lp.id || ""), launchId = id;
            if (!id || SELF.test(id) || HIDE.test(id)) return;
            var site = lp.lptype === "bookmark";
            // One more launch point of an app (a website pinned from the browser): its own id, with its address
            if (site || seen[id]) {
                if (!lp.launchPointId) return;
                id = "lp." + lp.launchPointId;
            }
            if (seen[id]) return;
            seen[id] = true;
            out.push({
                id: id,
                launchId: launchId,
                name: site ? siteName(lp) : String(lp.title || id),
                icon: site ? null : iconUrl(lp),          // a site's icon is a tiny favicon: its letter and colour instead
                accent: lp.bgColor || null,
                removable: !site && lp.removable === true,      // LG lets it be deleted (Delete App, rooted TV)
                params: lp.params && Object.keys(lp.params).length ? lp.params : null
            });
        });
        return out;
    }
    function fetchApps() {
        return ssap("ssap://com.webos.applicationManager/listLaunchPoints", {}, 30000).then(function (p) {
            var list = fromLaunchPoints(p.launchPoints);
            if (list.length) { appsCache = list; save(APPS_STORE, list); }
            return list;
        });
    }
    /* LG's own panels and promotions start hidden, once per profile, as Samsung's Smart Hub tile does: a
       launcher shows as little of the TV's own interface as it can. Settings › Home Screen › Show on Home
       Screen brings any of them back. Live TV, the browser, the media player and LG's store stay. */
    var LG_OWN = ["com.webos.app.camera", "com.webos.app.storagemanager", "com.webos.app.multiviewsettings", "fr.public.value",
                  "com.webos.app.sportsteamsettings", "com.webos.app.lglink-full", "com.palmdts.devmode", "com.webos.app.lifeonscreen",
                  "com.webos.app.lgchannels", "com.lgtvod.app", "com.twin.app.audiochannel", "com.twin.app.gamingportal",
                  "epoxyaisports", "shortcutcopilot"];
    function hideLgOwn(list) {
        var sys = APL.sys;
        if (!sys || !sys.profiles || !list.length) return;
        var who = sys.profiles.current().id, done = sys.pref("lgHiddenFor") || [];
        if (done.indexOf(who) !== -1) return;
        var hidden = (sys.pref("hiddenApps") || []).slice();
        list.forEach(function (a) { if (LG_OWN.indexOf(a.id) !== -1 && hidden.indexOf(a.id) === -1) hidden.push(a.id); });
        sys.setPref("hiddenApps", hidden);
        sys.setPref("lgHiddenFor", done.concat([who]));
    }
    /* At start-up the list kept from last time comes at once, and the TV's own list replaces it as
       soon as it answers. The first time (no answer from the TV yet), Settings and Sources only. */
    var appsChanged = null;
    function loadApps(decorate, order) {
        function done(list) {
            hideLgOwn(list);
            return order(list.map(function (a) {
                var d = decorate(a);
                d.params = a.params;
                d.removable = !!a.removable;
                return d;
            }));
        }
        if (appsCache && appsCache.length) {
            fetchApps().then(function (list) {
                if (JSON.stringify(list) !== JSON.stringify(appsChanged || [])) {
                    appsChanged = list;
                    if (APL.refreshHome && JSON.stringify(list) !== JSON.stringify(load(APPS_STORE + ".shown", null))) {
                        save(APPS_STORE + ".shown", list);
                        APL.refreshHome();
                    }
                }
            }, function () {});
            save(APPS_STORE + ".shown", appsCache);
            return Promise.resolve(done(appsCache));
        }
        return new Promise(function (resolve) {
            var settled = false;
            function finish(list) { if (settled) return; settled = true; save(APPS_STORE + ".shown", list); resolve(done(list)); }
            fetchApps().then(finish, function () { finish([]); });
            // The question on screen: the Home Screen does not wait for it, it fills in once allowed
            setTimeout(function () {
                if (settled) return;
                finish([]);
                fetchApps().then(function () { if (APL.refreshHome) APL.refreshHome(); }, function () {});
            }, 6000);
        });
    }
    function launchApp(id) {
        var a = null;
        (appsCache || []).forEach(function (x) { if (x.id === id) a = x; });
        return launch(a && a.launchId || id, a && a.params).catch(function (e) {
            throw new Error(t("Couldn't open the app") + (e && e.message ? " (" + e.message + ")" : ""));
        });
    }
    function isInstalled(id) {
        if (!appsCache) return Promise.resolve(false);
        return Promise.resolve(appsCache.some(function (a) { return a.id === id; }));
    }
    /* A website: LG's Web Browser (com.webos.app.browser) opens it */
    function openUrl(url) {
        if (!/^https?:\/\//.test(url)) return Promise.reject(new Error(t("Invalid address")));
        return launch("com.webos.app.browser", { target: url });
    }

    /* ---------- the remote ---------- */
    /* LG -> Samsung codes. Back 461; LG's ⏸ (19) is the play/pause key, which opens the Control Center
       on the Home Screen. Colours, arrows, OK, numbers and ▶ are the same on both. */
    var MAP = { 461: 10009, 19: 10252 };
    function remap(e) {
        var to = MAP[e.keyCode];
        if (!to || e._apl) return;
        e.stopImmediatePropagation();
        e.preventDefault();
        var ev;
        try {
            ev = new KeyboardEvent(e.type, { bubbles: true, cancelable: true, repeat: !!e.repeat, key: e.key, code: e.code });
        } catch (x) {
            ev = document.createEvent("Event");
            ev.initEvent(e.type, true, true);
        }
        try {
            Object.defineProperty(ev, "keyCode", { get: function () { return to; } });
            Object.defineProperty(ev, "which", { get: function () { return to; } });
        } catch (x) {}
        ev._apl = true;
        (e.target || document.body).dispatchEvent(ev);
    }
    global.addEventListener("keydown", remap, true);
    global.addEventListener("keyup", remap, true);

    /* Opened again while running (its icon in LG's home bar): to the front, and like Home on Samsung,
       the Home Screen at rest (launcher.js, "appcontrol"). */
    /* A request with the launch (the service, for the Guide button): {apl_action, from}. The app
       that was in front comes back when the Control Center is left with Back (P.ccBack, controlcenter.js),
       as the Control Center drawn over apps does on Samsung. */
    var pendingAction = "", returnTo = "", returnAt = 0;
    /* The params of THIS launch only (the event's detail): webOSSystem.launchParams keeps the last ones given,
       and a plain Home press then replayed "controlcenter" */
    document.addEventListener("webOSRelaunch", function (e) {
        var p = e && e.detail && typeof e.detail === "object" ? e.detail : {};
        pendingAction = typeof p.apl_action === "string" ? p.apl_action : "";
        returnAt = Date.now();
        returnTo = pendingAction === "controlcenter" && p.from && !SELF.test(p.from) && !/^com\.webos\.app\.home$/.test(p.from) ? String(p.from) : "";
        try { if (S.activate) S.activate(); } catch (e) {}
        var ev;
        try { ev = new Event("appcontrol"); } catch (x) { ev = document.createEvent("Event"); ev.initEvent("appcontrol", false, false); }
        global.dispatchEvent(ev);
    });

    /* ---------- the question on screen ---------- */
    /* The TV asks about a remote-control app, not about APL Launcher by name: the Home Screen says what it
       is, and fills in once it is allowed. */
    var asked = false;
    stateFns.push(function (s) {
        if (s === "prompt" && !asked) {
            asked = true;
            if (APL.toast) APL.toast(t("The TV asks whether to allow a remote app: that's APL Launcher. Choose Allow to see your apps."));
        }
        if (s === "registered" && asked) {
            asked = false;
            if (APL.toast) APL.toast(t("Thank you: APL Launcher can now show your apps."), true);
        }
    });

    connect();

    APL.platform = {
        name: "webos",
        /* The dock's first apps (when installed), as FAVORITES on Samsung: YouTube in TizenTube's place */
        favorites: ["youtube.leanback.v4", "com.knikt.apltv", "app.hotiptv", "netflix"],
        model: model,
        oled: oled,
        device: device,
        luna: luna, lunaOnce: lunaOnce, endSub: endSub,
        ssap: ssap, ssapSub: ssapSub, button: button, service: service,
        state: function () { return state; },
        onState: function (fn) { stateFns.push(fn); },
        reconnect: function () { if (conn) { endSub(conn); conn = null; } state = "idle"; connect(); },
        launch: launch,
        loadApps: loadApps, launchApp: launchApp, isInstalled: isInstalled, openUrl: openUrl,
        cachedApps: function () { return appsCache || []; },
        /* A new version is out (updater.js, once per version): how to get it on this TV. With the Homebrew
           Channel, from its list (and its repository added first, prefilled); without it, APL Launcher Setup. */
        updateNotice: function (v) {
            var HBC = "org.webosbrew.hbchannel", REPO = "https://raw.githubusercontent.com/Knikt/APL-Launcher/main/webos/repo/apps.json";
            var hbc = (appsCache || []).some(function (a) { return a.id === HBC; });
            var notes = "";      // version.json's notes are in English: the steps only
            if (hbc) {
                APL.alert({
                    title: t("APL Launcher {v} is available", { v: v.version }),
                    message: notes + t("To install it: open the Homebrew Channel, choose APL Launcher, then Update. Not in its list yet? Add APL Launcher's repository first, then install it from the list. Your settings, the root and your fonts are kept."),
                    buttons: [
                        { label: t("Open the Homebrew Channel"), run: function () { launch(HBC).catch(function () {}); } },
                        { label: t("Add the Repository"), run: function () { launch(HBC, { launchMode: "addRepository", url: REPO }).catch(function () {}); } },
                        { label: t("Later") }
                    ]
                });
            } else {
                APL.alert({
                    title: t("APL Launcher {v} is available", { v: v.version }),
                    message: notes + t("To install it, run APL Launcher Setup again on your PC (Your TV › LG). Your settings are kept."),
                    buttons: [{ label: t("OK") }]
                });
            }
        },
        /* Delete App: on a rooted TV, the apps LG lets you delete (webos/service "remove", up to 40 s) */
        canDelete: function (app) { return !!(app && app.removable && APL.platform.rooted); },
        deleteApp: function (app) {
            var a = null;
            (appsCache || []).forEach(function (x) { if (x.id === app.id) a = x; });
            return lunaOnce(SVC + "remove", { id: a && a.launchId || app.id }, 60000).then(function () {
                appsCache = (appsCache || []).filter(function (x) { return x.id !== app.id; });
                save(APPS_STORE, appsCache);
                fetchApps().catch(function () {});
            });
        },
        /* The App Switcher leaves out LG's own apps that the TV keeps preloaded (LG Channels): never opened by you */
        notInSwitcher: function (id) { return LG_OWN.indexOf(id) !== -1; },
        blurAhead: true,                      // the grid's blurred picture prepared before the grid opens (launcher.js)
        gridTint: true,                       // the grid's darkening drawn into that picture (launcher.js, launcher.css)
        directGlass: true,                    // panes kept, their picture an <img>, their shade an opacity (glass.js)
        cardPics: true,                       // a card's glow as a small picture (launcher.js cardBack)
        noFrost: true,                        // no picture under the dock's pane (launcher.js frost)
        focusLayers: true,                    // a tile's focus shadow and sheen as layers (launcher.js makeTile)
        takeAction: function () { var a = pendingAction; pendingAction = ""; return a; },
        ccBack: function () { var id = returnTo; returnTo = ""; if (id && Date.now() - returnAt < 600000) launch(id).catch(function () {}); }
    };
})(window);
