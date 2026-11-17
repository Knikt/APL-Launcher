/* ============================================================
   search.js — Search over the apps, films and shows.

   Laid out like the Apple TV's own search: a field over a six-column
   keyboard (abc / ABC / #+-) on the left, and the answers as rows of
   wide cards under a heading on the right. The apps installed on the
   screen are one of those rows, beside the films and the series, so a
   search finds "Netflix" and "Dune" in the same place.

   Films and shows come from TMDB, in the interface's language, with the
   service that carries each one in the screen's own region (TMDB's watch
   providers). The key is the one the Top Shelf already uses
   (keys.local.js); without it the sheet still searches and opens apps.

   The backdrop is the drawer's own blur - the 192 px canvas the launcher
   keeps of the wall - so the sheet sits on the same soft frost as the
   rest of the interface, with no filter running on the stage.

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

    function el(tag, cls, text) {
        var e = document.createElement(tag);
        if (cls) e.className = cls;
        if (text !== undefined) e.textContent = text;
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
            xhr.send(null);
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
        var reg = region();
        var ck = (query.toLowerCase() || "__popular__") + "|" + reg;
        if (cache[bucket][ck]) { cb(clone(cache[bucket][ck])); return; }
        if (!key()) { cb([]); return; }
        /* Nothing typed: what is popular on the services this region has, not
           the world's trending, which is neither here nor necessarily here. */
        var url = query
            ? TMDB + "/search/" + media + "?api_key=" + encodeURIComponent(key()) +
              "&language=" + encodeURIComponent(language()) + "&include_adult=false&query=" + encodeURIComponent(query)
            : TMDB + "/discover/" + media + "?api_key=" + encodeURIComponent(key()) +
              "&language=" + encodeURIComponent(language()) + "&sort_by=popularity.desc" +
              "&watch_region=" + reg + "&with_watch_monetization_types=flatrate&vote_count.gte=20";
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
                        /* A wide card, like the Apple TV's rows: the backdrop
                           when TMDB has one, the poster otherwise. */
                        art: r.backdrop_path ? IMG + "w780" + r.backdrop_path
                             : (r.poster_path ? IMG + "w342" + r.poster_path : ""),
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

    var root, fieldEl, fieldTextEl, spinEl, tabsEl, modesEl, keysEl, rowsEl, emptyEl, glassEl, nav;
    var isOpen = false, query = "", tab = "all", mode = "abc", answer = null, seq = 0, typing = 0;
    var TABS = [
        { k: "all", label: "All" },
        { k: "movies", label: "Movies" },
        { k: "shows", label: "Shows" },
        { k: "apps", label: "Apps" }
    ];
    var MODES = [
        { k: "abc", label: "abc" },
        { k: "ABC", label: "ABC" },
        { k: "num", label: "#+-" }
    ];
    /* Six columns, letters then digits, as on the Apple TV's keyboard. */
    var KEYS_ROWS = {
        abc: ["abcdef", "ghijkl", "mnopqr", "stuvwx", "yz1234", "567890"],
        ABC: ["ABCDEF", "GHIJKL", "MNOPQR", "STUVWX", "YZ1234", "567890"],
        num: ["123456", "7890-+", "!?@#&*", "()/.,'"]
    };

    function mag(size) {
        return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" ' +
            'stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">' +
            '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.4 15.4 21 21"/></svg>';
    }

    function buildDom() {
        root = el("section", "srch");
        root.appendChild(el("div", "srch__scrim"));
        glassEl = el("img", "srch__glass");
        glassEl.setAttribute("alt", "");
        glassEl.setAttribute("aria-hidden", "true");
        glassEl.hidden = true;
        root.appendChild(glassEl);

        var sheet = el("div", "srch__sheet");

        /* The bar across the top: the tabs in one glass pill, the magnifier
           on its own at the right, as the Apple TV has them. */
        var top = el("div", "srch__top");
        top.appendChild(el("span", "srch__brand", t("Search")));
        var bar = el("div", "srch__nav");
        tabsEl = el("div", "srch__tabs");
        bar.appendChild(tabsEl);
        var mark = el("span", "srch__mark");
        mark.innerHTML = mag(30);
        bar.appendChild(mark);
        top.appendChild(bar);
        sheet.appendChild(top);

        var body = el("div", "srch__body");
        var left = el("div", "srch__left");

        fieldEl = el("div", "srch__field");
        var glyph = el("span", "srch__glyph");
        glyph.innerHTML = mag(34);
        fieldEl.appendChild(glyph);
        fieldTextEl = el("span", "srch__text");
        fieldEl.appendChild(fieldTextEl);
        fieldEl.appendChild(el("i", "srch__caret"));
        spinEl = el("span", "srch__spin");
        spinEl.hidden = true;
        fieldEl.appendChild(spinEl);
        left.appendChild(fieldEl);

        modesEl = el("div", "srch__modes");
        left.appendChild(modesEl);

        keysEl = el("div", "srch__keys");
        left.appendChild(keysEl);
        body.appendChild(left);

        var right = el("div", "srch__right");
        rowsEl = el("div", "srch__rows");
        right.appendChild(rowsEl);
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
                reveal(node);
            }
        });

        buildTabs();
        buildModes();
        buildKeys();
        paintField();
    }

    /* The rows are one row deep, as on the Apple TV: moving along a row
       slides it under the heading instead of leaving the sheet. */
    function reveal(node) {
        if (!node || !node._item) return;
        var row = node.parentNode;
        if (row && row.classList && row.classList.contains("srch__row")) {
            var nr = node.getBoundingClientRect(), rr = row.getBoundingClientRect();
            var scale = row.clientWidth ? rr.width / row.clientWidth : 1;
            if (!scale) scale = 1;
            if (nr.left < rr.left) row.scrollLeft += (nr.left - rr.left) / scale;
            else if (nr.right > rr.right) row.scrollLeft += (nr.right - rr.right) / scale;
        }
        var right = document.querySelector(".srch__right");
        if (!right) return;
        var cr = node.getBoundingClientRect(), br = right.getBoundingClientRect();
        var k = right.clientHeight ? br.height / right.clientHeight : 1;
        if (!k) k = 1;
        if (cr.top < br.top) right.scrollTop += (cr.top - br.top) / k - 8;
        else if (cr.bottom > br.bottom) right.scrollTop += (cr.bottom - br.bottom) / k + 8;
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

    function buildModes() {
        var i, b;
        modesEl.innerHTML = "";
        for (i = 0; i < MODES.length; i++) {
            b = el("div", "srch__mode");
            b.textContent = MODES[i].label;
            b._mode = MODES[i].k;
            if (MODES[i].k === mode) b.classList.add("is-active");
            modesEl.appendChild(b);
        }
    }

    function buildKeys() {
        var rows = KEYS_ROWS[mode] || KEYS_ROWS.abc, r, c, b, k, grid;
        keysEl.innerHTML = "";
        grid = el("div", "srch__grid");
        for (r = 0; r < rows.length; r++) {
            for (c = 0; c < rows[r].length; c++) {
                k = rows[r].charAt(c);
                b = el("div", "srch__key", k);
                b._key = k;
                grid.appendChild(b);
            }
        }
        keysEl.appendChild(grid);
        var foot = el("div", "srch__foot");
        b = el("div", "srch__key srch__key--space", t("SPACE"));
        b._key = " ";
        foot.appendChild(b);
        b = el("div", "srch__key srch__key--icon");
        b.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
            'stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M20 5H9l-6 7 6 7h11a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1Z"/>' +
            '<path d="m13 9 5 6M18 9l-5 6"/></svg>';
        b._key = "\b";
        foot.appendChild(b);
        b = el("div", "srch__key srch__key--clear", t("CLEAR"));
        b._key = "__clear";
        foot.appendChild(b);
        keysEl.appendChild(foot);
    }

    function paintField() {
        if (!fieldTextEl) return;
        if (query) {
            fieldTextEl.textContent = query;
            fieldTextEl.classList.remove("is-empty");
        } else {
            fieldTextEl.textContent = t("Search");
            fieldTextEl.classList.add("is-empty");
        }
    }

    /* ---------- the rows on the right ---------- */

    function appCards() {
        var out = [], i, a, list = (answer && answer.apps) || [];
        for (i = 0; i < list.length; i++) {
            a = list[i];
            out.push({ type: "app", app: a, title: a.name || "", year: "", providerName: "" });
        }
        return out;
    }

    function sectionsFor() {
        var out = [], q = query ? query : "";
        if (!answer) return out;
        /* The opened sheet is the Apple TV's: the two trending rows, nothing
           else. Apps join the answer once something is typed, or on their
           own tab, so a search always finds them. */
        if (tab === "apps" || (tab === "all" && q)) {
            out.push({ title: t("Apps"), items: appCards() });
        }
        if (tab === "all" || tab === "movies") {
            out.push({ title: q ? t("Movies") : t("Trending Movies"), items: answer.movies || [] });
        }
        if (tab === "all" || tab === "shows") {
            out.push({ title: q ? t("TV Shows") : t("Trending TV Shows"), items: answer.shows || [] });
        }
        return out;
    }

    function cardFor(item) {
        var card = el("div", "srch__card");
        var art = el("div", "srch__art");
        var img = el("img");
        img.setAttribute("alt", "");
        img.setAttribute("loading", "lazy");
        if (item.type === "app") {
            var app = item.app || {};
            art.className = "srch__art srch__art--app";
            if (app.tile) { img.src = app.tile; art.appendChild(img); }
            else if (app.icon) {
                img.className = "srch__icon--app";
                img.src = app.icon;
                img.onerror = function () { if (img.parentNode) img.parentNode.removeChild(img); };
                art.appendChild(img);
            } else if (app.tileHtml) {
                var wrap = el("span", "srch__vtile");
                wrap.innerHTML = app.tileHtml;
                art.appendChild(wrap);
            } else if (APL.icon) {
                var g = el("span", "srch__glyph");
                g.innerHTML = APL.icon("apps", 96, 1.5);
                art.appendChild(g);
            }
        } else if (item.art) {
            img.src = item.art;
            art.appendChild(img);
        } else {
            art.textContent = String(item.title || "").charAt(0);
        }
        card.appendChild(art);

        var cap = el("div", "srch__cap");
        var name = el("span", "srch__name", item.title || "");
        cap.appendChild(name);
        if (item.year) cap.appendChild(el("span", "srch__year", item.year));
        var label = item.providerName || PROVIDER_NAMES[item.provider] || "";
        if (label) cap.appendChild(el("span", "srch__badge", label));
        card.appendChild(cap);

        card._item = item;
        return card;
    }

    function rebuild() {
        var sections = sectionsFor(), old = nav.tiles[nav.index], at = 0, cards = [], all, i, j, s, sec, head, row;
        rowsEl.innerHTML = "";
        for (i = 0; i < sections.length; i++) {
            s = sections[i];
            if (!s.items.length) continue;
            sec = el("div", "srch__section");
            head = el("div", "srch__h", s.title);
            sec.appendChild(head);
            row = el("div", "srch__row");
            for (j = 0; j < s.items.length; j++) {
                var card = cardFor(s.items[j]);
                row.appendChild(card);
                cards.push(card);
            }
            row.scrollLeft = 0;
            sec.appendChild(row);
            rowsEl.appendChild(sec);
        }
        emptyEl.hidden = cards.length > 0 || !answer || !answer.done;
        emptyEl.textContent = (answer && answer.note) || t("Nothing found");

        all = [].slice.call(tabsEl.children)
            .concat([].slice.call(modesEl.children))
            .concat([].slice.call(keysEl.querySelectorAll(".srch__key")))
            .concat(cards);
        for (i = 0; i < all.length; i++) if (all[i] === old) at = i;
        if (!old) at = 0;
        nav.setTiles(all);
        nav.focus(at);
        syncGlass();
    }

    /* ---------- typing ---------- */

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

    function busy(on) {
        if (spinEl) spinEl.hidden = !on;
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
        if (node._mode) { mode = node._mode; buildModes(); buildKeys(); rebuild(); return; }
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

    /* A title's page inside the service, where the service takes one. These
       are the apps' own search links: TMDB has no Netflix or Prime id, so the
       exact title is what the app is handed, and it opens on that title. */
    var DEEP = {
        netflix: function (item) { return "nflx://www.netflix.com/search?q=" + encodeURIComponent(item.title); },
        jiohotstar: function (item) { return "hotstar://search?q=" + encodeURIComponent(item.title); },
        youtube: function (item) { return "vnd.youtube://results?search_query=" + encodeURIComponent(item.title); }
    };

    function openDeep(app, item) {
        var uri = DEEP[app.key] ? DEEP[app.key](item) : "";
        var tz = global.tizen;
        if (!uri || !tz || !tz.application || !tz.application.launchAppControl) return false;
        try {
            var ctrl = new tz.ApplicationControl("http://tizen.org/appcontrol/operation/view", uri, null, null);
            tz.application.launchAppControl(ctrl, app.id,
                function () { close(); },
                function () { close(); if (APL.openApp) APL.openApp(app); });
            return true;
        } catch (e) { return false; }
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
            if (openDeep(app, item)) return;
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

    /* ---------- the backdrop ---------- */

    /* The drawer's blur: the 192 px canvas the launcher keeps of the wall for
       its own panels. Soft, and already drawn - nothing is filtered here. */
    function blurSrc() {
        var c = document.querySelector(".bgblur__canvas");
        if (!c) return "";
        try { return c.toDataURL("image/png"); } catch (e) { return ""; }
    }

    function wallSrc() {
        var wall = document.querySelector(".bg img");
        try {
            if (wall && wall.naturalWidth >= 1280) return wall.currentSrc || wall.src || "";
        } catch (e) {}
        return "";
    }

    /* The drawer's canvas is the wall at 192 px with no blur of its own (the
       drawer blurs it in CSS). Here the blur is baked once into a 320 px
       canvas, so the sheet gets the same frost with no filter on the stage. */
    function baked(wall, canvas) {
        var w = 320, h = 180, c = document.createElement("canvas"), ctx;
        c.width = w;
        c.height = h;
        ctx = c.getContext("2d");
        if (!ctx) return "";
        try { ctx.filter = "blur(9px)"; } catch (e) {}
        try {
            if (wall) ctx.drawImage(wall, 0, 0, w, h);
            else if (canvas) ctx.drawImage(canvas, 0, 0, w, h);
        } catch (e) { return ""; }
        try { return c.toDataURL("image/png"); } catch (e) { return ""; }
    }

    function syncGlass() {
        if (!glassEl) return;
        /* The Control Center's own material: the picture already baked and
           frosted by glass.js. Nothing is filtered or drawn here. */
        var src = APL.glass && APL.glass.src ? (APL.glass.src() || "") : "";
        if (!src) {
            var wall = document.querySelector(".bg img"), wallOk = false;
            try { wallOk = !!(wall && wall.naturalWidth >= 1280); } catch (e) {}
            src = baked(wallOk ? wall : null, document.querySelector(".bgblur__canvas")) || blurSrc();
        }
        if (src && glassEl.getAttribute("src") !== src) glassEl.setAttribute("src", src);
        glassEl.hidden = !src;
        root.classList.toggle("has-art", !!src);
    }

    /* ---------- the magnifier at the top left ---------- */

    /* launcher.css draws it and hides it behind a panel: in full screen it
       reads "▲ Search", where ▲ opens the sheet. */
    function addHint() {
        if (document.querySelector(".search-hint")) return;
        var h = el("div", "search-hint");
        h.innerHTML = '<span class="search-hint__chevron"></span>' + (APL.icon ? APL.icon("search", 30, 2.4) : "");
        h.appendChild(el("span", "search-hint__text", APL.t("Search")));
        document.body.appendChild(h);
    }
    if (document.body) addHint();
    else document.addEventListener("DOMContentLoaded", addHint);

    /* ---------- open / close ---------- */

    /* A USB keyboard, and the desktop preview, type straight into the field:
       the on-screen keys stay for the remote. */
    function onType(e) {
        var k = e.key;
        if (!isOpen || !k || k.length !== 1) return;
        if (k === " ") type(" ");
        else if (/[a-z0-9]/i.test(k)) type(k.toLowerCase());
        else return;
        /* Caught before the navigation sees it: a letter is the field's, not
           a step through the tabs or a select. */
        e.preventDefault();
        e.stopPropagation();
    }

    function open() {
        if (!root) buildDom();
        if (isOpen) { nav.focus(nav.index < 0 ? 0 : nav.index); return; }
        isOpen = true;
        query = "";
        tab = "all";
        mode = "abc";
        answer = null;
        paintField();
        buildTabs();
        buildModes();
        buildKeys();
        root.classList.add("is-open");
        document.body.classList.add("has-search");
        APL.pushNav(nav);
        document.addEventListener("keydown", onType, true);
        search("");
        nav.focus(0);
                    syncGlass();
            if (APL.glassAfter) APL.glassAfter(root);
    }

    function close() {
        if (!isOpen) return;
        isOpen = false;
        seq++;                                       /* drop answers still in flight */
        document.removeEventListener("keydown", onType, true);
        root.classList.remove("is-open");
        document.body.classList.remove("has-search");
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
