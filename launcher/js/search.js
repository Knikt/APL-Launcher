/* ============================================================
   search.js — Search over the apps, films and shows.

   One query, three answers: the apps installed on the screen, the films
   and the series TMDB finds for it, and the service that carries each one
   in this country (TMDB's watch providers for the screen's own region).
   A card names a service only when TMDB lists one there; a title with no
   offer stays in the row without a badge, and OK on it says which app
   would be needed instead of opening something else.

   Apps sit with the films and shows, in the All tab and in their own.

   Films and shows need the TMDB key the Top Shelf already uses
   (keys.local.js). Without it the sheet still searches and opens apps.

   The sheet is one frozen backdrop behind a scrim — no live filter. The
   picture it draws is the full-size one from the wall: the baked glass is
   a small image, and stretched over the whole stage it read as pixelated.

   Public surface:
     APL.search.open() / close() / isOpen()
     APL.search.run(query, cb)     headless, for another module
     APL.search.clear()            drop the answer caches
   ============================================================ */
(function (global) {
    "use strict";

    var APL = global.APL;
    if (!APL) return;

    var KEYS = global.APL_KEYS || {};
    var TMDB = "https://api.themoviedb.org/3";
    var IMG = "https://image.tmdb.org/t/p/";

    /* When one title is on several services the tie-break decides which app
       the card offers: the one this launcher is most likely to have. */
    var PROVIDER_ORDER = { netflix: 0, primevideo: 1, hotstar: 2, appletv: 3, disneyplus: 4, sonyliv: 5, hbomax: 6 };
    var PROVIDER_NAMES = {
        netflix: "Netflix", primevideo: "Prime Video", hotstar: "JioHotstar",
        appletv: "Apple TV", disneyplus: "Disney+", sonyliv: "Sony LIV", hbomax: "HBO Max"
    };

    var MAX_MOVIES = 12, MAX_SHOWS = 9, MAX_APPS = 8, MAX_OFFERS = 14;
    var cache = { movies: {}, shows: {}, offers: {}, apps: {} };

    function t(s, v) { return APL.t ? APL.t(s, v) : s; }

    function el(tag, cls) {
        var e = document.createElement(tag);
        if (cls) e.className = cls;
        return e;
    }

    /* ---------- transport ---------- */

    function fetchJSON(url, opts, cb) {
        var done = false;
        function finish(err, data) {
            if (done) return;
            done = true;
            cb(err, data);
        }
        try {
            var xhr = new global.XMLHttpRequest();
            xhr.open((opts && opts.method) || "GET", url, true);
            xhr.timeout = (opts && opts.timeout) || 7000;
            if (opts && opts.headers) {
                for (var k in opts.headers) {
                    if (Object.prototype.hasOwnProperty.call(opts.headers, k)) xhr.setRequestHeader(k, opts.headers[k]);
                }
            }
            xhr.onreadystatechange = function () {
                if (xhr.readyState !== 4) return;
                if (xhr.status >= 200 && xhr.status < 300) {
                    try { finish(null, JSON.parse(xhr.responseText)); }
                    catch (e) { finish(e, null); }
                } else {
                    finish(new Error("HTTP " + xhr.status), null);
                }
            };
            xhr.ontimeout = function () { finish(new Error("timeout"), null); };
            xhr.onerror = function () { finish(new Error("network"), null); };
            xhr.send((opts && opts.body) || null);
        } catch (e) { finish(e, null); }
    }

    /* ---------- region and language ---------- */

    function region() {
        try {
            if (APL.live && APL.live.region) {
                var r = APL.live.region();
                if (r && /^[A-Za-z]{2}$/.test(r)) return String(r).toUpperCase();
            }
        } catch (e) {}
        var lang = global.navigator.language || "";
        var m = /[-_]([A-Za-z]{2})$/.exec(lang);
        return m ? m[1].toUpperCase() : "US";
    }

    function language() { return APL.locale || "en-US"; }

    function key() { return String(KEYS.tmdb || ""); }

    /* ---------- catalogue ---------- */

    function clone(list) {
        var copy = [], i, k;
        for (i = 0; i < (list || []).length; i++) {
            var item = {};
            for (k in list[i]) {
                if (Object.prototype.hasOwnProperty.call(list[i], k)) item[k] = list[i][k];
            }
            copy.push(item);
        }
        return copy;
    }

    /* TMDB: a search in the interface's language, or the day's trending
       titles when nothing is typed yet, so the sheet is never empty. */
    function titles(media, q, bucket, limit, cb) {
        var query = String(q || "").trim();
        var ck = query.toLowerCase() || "__trending__";
        if (cache[bucket][ck]) { cb(clone(cache[bucket][ck])); return; }
        if (!key()) { cb([]); return; }
        var url = query
            ? TMDB + "/search/" + media + "?api_key=" + encodeURIComponent(key()) +
              "&language=" + encodeURIComponent(language()) + "&include_adult=false&query=" + encodeURIComponent(query)
            : TMDB + "/trending/" + media + "/day?api_key=" + encodeURIComponent(key()) +
              "&language=" + encodeURIComponent(language());
        fetchJSON(url, null, function (err, data) {
            var out = [], list = (data && data.results) || [], i, r, year;
            if (!err) {
                for (i = 0; i < list.length && out.length < limit; i++) {
                    r = list[i];
                    if (!r || r.media_type === "person") continue;
                    if (query && r.media_type && r.media_type !== media) continue;
                    if (!r.title && !r.name) continue;
                    year = String(r.release_date || r.first_air_date || "").slice(0, 4);
                    out.push({
                        id: "tmdb-" + media + "-" + r.id,
                        tmdbId: r.id,
                        media: media,
                        title: r.title || r.name || "",
                        year: year,
                        poster: r.poster_path ? IMG + "w342" + r.poster_path : "",
                        type: media === "movie" ? "movie" : "show",
                        provider: "",
                        providerName: ""
                    });
                }
            }
            cache[bucket][ck] = out;
            cb(clone(out));
        });
    }

    function sameTitle(item) {
        return String(item && item.title || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/^\s+|\s+$/g, "") +
            "|" + String(item && item.year || "");
    }

    function films(q, cb) { titles("movie", q, "movies", MAX_MOVIES, cb); }
    function shows(q, cb) { titles("tv", q, "shows", MAX_SHOWS, cb); }

    function installed() {
        if (typeof APL.allApps === "function") return APL.allApps() || [];
        if (APL.apps && typeof APL.apps.all === "function") return APL.apps.all() || [];
        return [];
    }

    function localApps(q) {
        var all = installed(), query = String(q || "").trim().toLowerCase(), out = [], i, a;
        if (!all.length) return out;
        if (!query) return all.slice(0, MAX_APPS);
        for (i = 0; i < all.length && out.length < MAX_APPS; i++) {
            a = all[i];
            var name = String(a.name || "").toLowerCase();
            var id = String(a.key || a.id || "").toLowerCase();
            if (name.indexOf(query) >= 0 || id.indexOf(query) >= 0) out.push(a);
        }
        return out;
    }

    /* ---------- offers ---------- */

    function providerKey(name) {
        var n = String(name || "").toLowerCase();
        if (n.indexOf("netflix") >= 0) return "netflix";
        if (n.indexOf("prime video") >= 0 || n.indexOf("amazon") >= 0) return "primevideo";
        if (n.indexOf("hotstar") >= 0 || n.indexOf("jio") >= 0) return "hotstar";
        if (n.indexOf("disney") >= 0) return "disneyplus";
        if (n.indexOf("apple tv") >= 0) return "appletv";
        if (n.indexOf("sony") >= 0 && n.indexOf("liv") >= 0) return "sonyliv";
        if (n === "max" || n.indexOf("hbo") >= 0) return "hbomax";
        return "";
    }

    /* Subscribed first, then free, then with ads, then rent, then buy;
       within a tier, PROVIDER_ORDER. One offer per title. */
    function pickOffer(results) {
        var tiers = ["flatrate", "free", "ads", "rent", "buy"], i, j, list, best = null, bestRank = 1e9;
        for (i = 0; i < tiers.length; i++) {
            list = (results && results[tiers[i]]) || [];
            for (j = 0; j < list.length; j++) {
                if (!list[j] || !list[j].provider_name) continue;
                var pk = providerKey(list[j].provider_name);
                var order = PROVIDER_ORDER[pk];
                var rank = i * 100 + (order === undefined ? 90 : order);
                if (rank < bestRank) {
                    bestRank = rank;
                    best = { provider: pk, name: list[j].provider_name };
                }
            }
        }
        return best;
    }

    function offersFor(item, cb) {
        var reg = region();
        var ck = item.media + ":" + item.tmdbId + "|" + reg;
        if (Object.prototype.hasOwnProperty.call(cache.offers, ck)) { cb(cache.offers[ck]); return; }
        if (!key()) { cb(null); return; }
        fetchJSON(TMDB + "/" + item.media + "/" + item.tmdbId + "/watch/providers?api_key=" +
                  encodeURIComponent(key()), null, function (err, data) {
            var entry = null;
            if (!err && data && data.results && data.results[reg]) entry = pickOffer(data.results[reg]);
            cache.offers[ck] = entry;
            cb(entry);
        });
    }

    /* ---------- one query ---------- */

    /* Apps at once, then the catalogue, then the services: the sheet paints
       twice instead of once per answer, which a television can feel. */
    function run(q, cb) {
        var out = {
            query: String(q || "").trim(),
            apps: localApps(q),
            movies: [],
            shows: [],
            done: false,
            loaded: false,
            note: key() ? "" : t("Add a TMDB key to search films and shows")
        };
        cb(out);
        if (!key()) { out.done = true; cb(out); return out; }

        var left = 2;
        films(q, function (list) { out.movies = list; if (!--left) after(); });
        shows(q, function (list) { out.shows = list; if (!--left) after(); });

        function after() {
            /* "Dune" is a film and a series: TMDB answers both, and the same
               title on two cards reads as a duplicate. The film wins, because
               that is what the search found first. */
            var filmKeys = {}, i;
            for (i = 0; i < out.movies.length; i++) filmKeys[sameTitle(out.movies[i])] = 1;
            out.shows = out.shows.filter(function (s) { return !filmKeys[sameTitle(s)]; });
            var all = out.movies.concat(out.shows).slice(0, MAX_OFFERS);
            cb(out);
            if (!all.length) { out.loaded = out.done = true; cb(out); return; }
            var waiting = all.length, first = true;
            for (i = 0; i < all.length; i++) pick(all[i]);
            function pick(item) {
                offersFor(item, function (offer) {
                    item.provider = offer ? offer.provider : "";
                    item.providerName = offer ? offer.name : "";
                    waiting--;
                    if (waiting <= 0) { out.loaded = out.done = true; cb(out); return; }
                    /* One repaint halfway, as the first answers land, so a slow
                       region does not leave the row badgeless until the end. */
                    if (first && waiting <= all.length / 2) { first = false; cb(out); }
                });
            }
        }
        return out;
    }

    /* ---------- the sheet ---------- */

    var root, fieldTextEl, spinEl, tabsEl, keysEl, gridEl, emptyEl, glassEl, nav;
    var isOpen = false, query = "", tab = "all", answer = null, seq = 0, typing = 0, spinOn = 0;
    var TABS = [
        { k: "all", label: "All" },
        { k: "movies", label: "Movies" },
        { k: "shows", label: "Shows" },
        { k: "apps", label: "Apps" }
    ];
    var ROWS = ["abcdefghi", "jklmnopqr", "stuvwxyz", "0123456789"];

    function buildDom() {
        root = el("section", "srch");
        root.appendChild(el("div", "srch__scrim"));
        glassEl = el("img", "srch__glass");
        glassEl.setAttribute("alt", "");
        glassEl.setAttribute("aria-hidden", "true");
        glassEl.hidden = true;
        root.appendChild(glassEl);

        var sheet = el("div", "srch__sheet");
        var head = el("div", "srch__head");
        var mark = el("span", "srch__mark");
        /* The icon set has no magnifier, so the sheet draws its own. */
        mark.innerHTML = '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" ' +
            'stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">' +
            '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.4 15.4 21 21"/></svg>';
        head.appendChild(mark);
        var field = el("span", "srch__field");
        fieldTextEl = el("span", "srch__text");
        field.appendChild(fieldTextEl);
        field.appendChild(el("i", "srch__caret"));
        head.appendChild(field);
        spinEl = el("span", "srch__spin");
        spinEl.hidden = true;
        head.appendChild(spinEl);
        sheet.appendChild(head);

        var body = el("div", "srch__body");
        var left = el("div", "srch__left");
        tabsEl = el("div", "srch__tabs");
        left.appendChild(tabsEl);
        keysEl = el("div", "srch__keys");
        left.appendChild(keysEl);
        body.appendChild(left);

        var right = el("div", "srch__right");
        gridEl = el("div", "srch__grid");
        right.appendChild(gridEl);
        emptyEl = el("div", "srch__empty");
        emptyEl.hidden = true;
        right.appendChild(emptyEl);
        body.appendChild(right);

        sheet.appendChild(body);
        root.appendChild(sheet);
        document.body.appendChild(root);

        nav = new APL.Nav({
            onSelect: function (i, node) { activate(node); },
            onKey: function (code) {
                if (code === 8 || code === 461) { type("\b"); return true; }
                return false;
            },
            onBack: close,
            onFocus: function (i, node) {
                var list = nav.tiles, k;
                for (k = 0; k < list.length; k++) list[k].classList.toggle("is-focused", k === i);
                if (node && node._item) syncGlass();
            }
        });

        buildTabs();
        buildKeys();
        paintField();
    }

    function buildTabs() {
        var i, b;
        tabsEl.innerHTML = "";
        for (i = 0; i < TABS.length; i++) {
            b = el("div", "srch__tab");
            b.textContent = t(TABS[i].label);
            b._tab = TABS[i].k;
            if (TABS[i].k === tab) b.classList.add("is-active");
            tabsEl.appendChild(b);
        }
    }

    function buildKeys() {
        var r, c, b, k;
        keysEl.innerHTML = "";
        for (r = 0; r < ROWS.length; r++) {
            for (c = 0; c < ROWS[r].length; c++) {
                k = ROWS[r].charAt(c);
                b = el("div", "srch__key");
                b.textContent = k;
                b._key = k;
                keysEl.appendChild(b);
            }
        }
        b = el("div", "srch__key srch__key--space");
        b.textContent = t("Space");
        b._key = " ";
        keysEl.appendChild(b);
        b = el("div", "srch__key srch__key--wide");
        b.textContent = t("Delete");
        b._key = "\b";
        keysEl.appendChild(b);
        b = el("div", "srch__key srch__key--wide");
        b.textContent = t("Clear");
        b._key = "__clear";
        keysEl.appendChild(b);
    }

    function paintField() {
        if (!fieldTextEl) return;
        if (query) {
            fieldTextEl.textContent = query;
            fieldTextEl.classList.remove("is-empty");
        } else {
            fieldTextEl.textContent = t("Search apps, films, shows");
            fieldTextEl.classList.add("is-empty");
        }
    }

    function chosen() {
        var out = [], i;
        if (!answer) return out;
        if (tab === "all" || tab === "apps") {
            for (i = 0; i < answer.apps.length; i++) {
                out.push({ type: "app", app: answer.apps[i], title: answer.apps[i].name || "" });
            }
        }
        if (tab === "all" || tab === "movies") out = out.concat(answer.movies || []);
        if (tab === "all" || tab === "shows") out = out.concat(answer.shows || []);
        return out;
    }

    function tileFor(item) {
        var node = el("div", "srch__tile"), art = el("span", "srch__art"), img = el("img");
        img.setAttribute("alt", "");
        if (item.type === "app") {
            /* An app carries its own tile or icon, or a drawn glyph: never an
               empty <img>, which showed a broken picture where it should be. */
            var app = item.app || {};
            art.className = "srch__art srch__art--app";
            if (app.tile) {
                img.className = "srch__icon--tile";
                img.src = app.tile;
                art.appendChild(img);
            } else if (app.icon) {
                img.className = "srch__icon--app";
                img.src = app.icon;
                img.onerror = function () { if (img.parentNode) img.parentNode.removeChild(img); };
                art.appendChild(img);
            } else if (app.tileHtml) {
                var wrap = el("span", "srch__vtile");
                wrap.innerHTML = app.tileHtml;
                art.appendChild(wrap);
            } else if (APL.icon) {
                var glyph = el("span", "srch__glyph");
                glyph.innerHTML = APL.icon("apps", 96, 1.5);
                art.appendChild(glyph);
            }
        } else {
            if (item.poster) { img.src = item.poster; art.appendChild(img); }
            else art.textContent = String(item.title || "").charAt(0);
        }
        node.appendChild(art);
        var cap = el("span", "srch__cap");
        var name = el("span", "srch__name");
        name.textContent = item.title || "";
        cap.appendChild(name);
        /* Two films can share a name (Dune, 1984 and 2021): the year is what
           tells them apart in the row. */
        if (item.year) {
            var yr = el("span", "srch__year");
            yr.textContent = item.year;
            cap.appendChild(yr);
        }
        var label = item.providerName || PROVIDER_NAMES[item.provider] || "";
        if (label) {
            var badge = el("span", "srch__badge");
            badge.textContent = label;
            cap.appendChild(badge);
        }
        node.appendChild(cap);
        node._item = item;
        return node;
    }

    function rebuild() {
        var list = chosen(), i, old = nav.tiles[nav.index], at = 0, nodes = [], all, prev = nav.index;
        gridEl.innerHTML = "";
        for (i = 0; i < list.length; i++) {
            nodes.push(tileFor(list[i]));
            gridEl.appendChild(nodes[nodes.length - 1]);
        }
        emptyEl.hidden = nodes.length > 0 || !answer || !answer.done;
        emptyEl.textContent = (answer && answer.note) || t("Nothing found");

        all = [].slice.call(tabsEl.children)
            .concat([].slice.call(keysEl.children))
            .concat(nodes);
        for (i = 0; i < all.length; i++) if (all[i] === old) at = i;
        /* The answers arrive in waves and each one redraws the sheet: the focus
           follows the tile the eye is on, or the same index, never back to the
           first tab under the viewer. */
        if (!old) at = Math.max(0, Math.min(prev, all.length - 1));
        nav.setTiles(all);
        nav.focus(at);
        syncGlass();
    }

    function type(k) {
        if (k === "__clear") query = "";
        else if (k === "\b") query = query.slice(0, -1);
        else if (k === " ") { if (query) query += " "; }
        else query += k;
        paintField();
        schedule();
    }

    function schedule() {
        global.clearTimeout(typing);
        typing = global.setTimeout(function () { search(query); }, 320);
    }

    /* One spinner, not a count: a newer query replaces the older one, and only
       the query that is still current may switch it off. */
    function busy(on) {
        spinOn = on ? 1 : 0;
        if (spinEl) spinEl.hidden = !spinOn;
    }

    function search(q) {
        var id = ++seq;
        busy(true);
        if (!answer) answer = { apps: [], movies: [], shows: [], done: false };
        run(q, function (out) {
            if (id !== seq) return;                 /* a newer query owns the sheet */
            answer = out;
            rebuild();
            if (out.done) busy(false);
        });
    }

    function activate(node) {
        if (!node) return;
        if (node._key) { type(node._key); return; }
        if (node._tab) { tab = node._tab; buildTabs(); rebuild(); return; }
        if (node._item) openItem(node._item);
    }

    /* ---------- opening a result ---------- */

    function appFor(item) {
        var all = installed(), want = String(item.providerName || PROVIDER_NAMES[item.provider] || "").toLowerCase(), i, a;
        for (i = 0; i < all.length; i++) {
            a = all[i];
            if (item.provider && a.key === item.provider) return a;
            if (want && String(a.name || "").toLowerCase().indexOf(want) >= 0) return a;
        }
        return null;
    }

    function openItem(item) {
        if (item.type === "app") {
            close();
            if (APL.openApp) APL.openApp(item.app);
            else if (APL.launchApp) APL.launchApp(item.app.id);
            return;
        }
        var app = appFor(item);
        if (app) {
            close();
            if (APL.openApp) APL.openApp(app);
            else if (APL.launchApp) APL.launchApp(app.id);
            return;
        }
        if (APL.toast) {
            if (item.providerName || item.provider) {
                APL.toast(t("Install {name} to watch this", { name: item.providerName || PROVIDER_NAMES[item.provider] }));
            } else {
                APL.toast(t("No service carries {title} here", { title: item.title }));
            }
        }
    }

    /* ---------- glass ---------- */

    /* The sheet is the whole stage, so its backdrop is the picture itself at
       full size: the launcher's baked glass is a 480 px blur, and stretched
       over the stage it read as pixelated. The scrim does the darkening. */
    function syncGlass() {
        if (!glassEl) return;
        var src = "", wall = document.querySelector(".bg img");
        try {
            if (wall && wall.naturalWidth >= 1280 && (wall.currentSrc || wall.src)) src = wall.currentSrc || wall.src;
        } catch (e) {}
        if (!src && APL.glass) src = APL.glass.src() || "";
        if (src && glassEl.getAttribute("src") !== src) glassEl.setAttribute("src", src);
        glassEl.hidden = !src;
        root.classList.toggle("has-art", !!src);
    }

    /* ---------- open / close ---------- */

    /* A USB keyboard, and the desktop preview, type straight into the field:
       the on-screen keys stay for the remote. */
    function onType(e) {
        var k = e.key;
        if (!isOpen || !k || k.length !== 1) return;
        if (k === " ") type(" ");
        else if (/[a-z0-9]/i.test(k)) type(k.toLowerCase());
        else return;
        e.preventDefault();
    }

    function open() {
        if (!root) buildDom();
        if (isOpen) { nav.focus(nav.index < 0 ? 0 : nav.index); return; }
        isOpen = true;
        query = "";
        tab = "all";
        answer = null;
        paintField();
        buildTabs();
        root.classList.add("is-open");
        APL.pushNav(nav);
        document.addEventListener("keydown", onType);
        search("");
        nav.focus(0);
        syncGlass();
        if (APL.glassAfter) APL.glassAfter(root);
    }

    function close() {
        if (!isOpen) return;
        isOpen = false;
        seq++;                                       /* drop answers still in flight */
        document.removeEventListener("keydown", onType);
        root.classList.remove("is-open");
        APL.popNav(nav);
    }

    APL.search = {
        open: open,
        close: close,
        isOpen: function () { return isOpen; },
        run: function (q, cb) { return run(q, cb); },
        clear: function () { cache = { movies: {}, shows: {}, offers: {}, apps: {} }; }
    };
})(window);
