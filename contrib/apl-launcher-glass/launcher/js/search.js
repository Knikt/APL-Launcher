/* ============================================================
   search.js — Universal Search, and the sheet it lives in.

   One query, four answers: the apps installed on the screen, films and
   shows from Cinemeta (IMDb ids and metahub artwork), and the service
   that actually carries each title in this country once JustWatch has
   answered. A card only names a service when an offer is confirmed: a
   half-loaded answer shows no badge, and a title nothing carries is
   dropped at the end instead of being sent to a library app by
   default. Netflix is Nuvio here on purpose: on this set the Netflix
   app is not installed, and Nuvio opens the same title from its IMDb
   id, so the badge, the card and the click all agree.

   The sheet is the same glass as the Control Center: one frozen,
   pre-blurred backdrop behind it, no filter on the animation path.

   Public surface:
     APL.search.open() / close() / isOpen()
     APL.search.run(query, cb)     headless, for another module
     APL.search.clear()            drop the answer caches
   ============================================================ */
(function (global) {
    "use strict";

    var APL = global.APL;
    if (!APL) return;

    var CINEMETA = "https://v3-cinemeta.strem.io/catalog/";
    var WATCH = "https://apis.justwatch.com/graphql";
    var WATCH_QUERY =
        "query AplSearch($country: Country!, $language: Language!, $filter: TitleFilter, $first: Int!) {" +
        " popularTitles(country: $country, filter: $filter, first: $first, sortBy: POPULAR) {" +
        " edges { node { id objectType content(country: $country, language: $language) {" +
        " title originalReleaseYear externalIds { imdbId } }" +
        " offers(country: $country, platform: WEB, filter: { bestOnly: true }) {" +
        " standardWebURL monetizationType package { clearName technicalName } } } } } }";

    /* When one title streams on several services the tie-break decides which
       app the card offers. Amazon channels (Apple TV, SonyLIV, … bought
       inside Prime Video) are matched to Prime Video on purpose: those play
       inside the Prime app, not the standalone one. */
    var PROVIDER_ORDER = { netflix: 0, primevideo: 1, hotstar: 2, appletv: 3, disneyplus: 4, sonyliv: 5 };
    var PROVIDER_NAMES = {
        netflix: "Netflix", primevideo: "Prime Video", hotstar: "JioHotstar",
        appletv: "Apple TV", disneyplus: "Disney+", sonyliv: "Sony LIV"
    };

    var MAX_MOVIES = 12, MAX_SHOWS = 9, MAX_APPS = 8;
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

    /* ---------- country ---------- */

    function country() {
        if (APL.sys && APL.sys.region) {
            var c = APL.sys.region();
            if (c && /^[A-Za-z]{2}$/.test(c)) return String(c).toUpperCase();
        }
        var lang = global.navigator.language || "";
        var m = /[-_]([A-Za-z]{2})$/.exec(lang);
        if (m) return m[1].toUpperCase();
        var tz = "";
        try { tz = global.Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) {}
        if (tz.indexOf("Kolkata") >= 0 || tz.indexOf("Calcutta") >= 0) return "IN";
        if (tz.indexOf("London") >= 0) return "GB";
        if (tz.indexOf("Sydney") >= 0 || tz.indexOf("Melbourne") >= 0) return "AU";
        if (tz.indexOf("Tokyo") >= 0) return "JP";
        if (tz.indexOf("Dubai") >= 0) return "AE";
        if (tz.indexOf("Singapore") >= 0) return "SG";
        if (tz.indexOf("America/") === 0) return "US";
        return "US";
    }

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

    function cinemeta(kind, q, bucket, limit, cb) {
        var query = String(q || "").trim();
        var key = query.toLowerCase() || "__popular__";
        if (cache[bucket][key]) { cb(clone(cache[bucket][key])); return; }
        var url = CINEMETA + kind + "/top" + (query ? "/search=" + encodeURIComponent(query) : "") + ".json";
        fetchJSON(url, null, function (err, data) {
            var out = [], i, m;
            if (!err && data && data.metas) {
                for (i = 0; i < data.metas.length && out.length < limit; i++) {
                    m = data.metas[i];
                    if (!m || !m.name) continue;
                    out.push({
                        id: m.id || "",
                        title: m.name,
                        year: m.releaseInfo || m.year || "",
                        poster: m.poster || "",
                        type: kind === "movie" ? "movie" : "show",
                        provider: "",
                        webUrl: ""
                    });
                }
            }
            cache[bucket][key] = out;
            cb(clone(out));
        });
    }

    function films(q, cb) { cinemeta("movie", q, "movies", MAX_MOVIES, cb); }
    function shows(q, cb) { cinemeta("series", q, "shows", MAX_SHOWS, cb); }

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
            var key = String(a.key || a.id || "").toLowerCase();
            if (name.indexOf(query) >= 0 || key.indexOf(query) >= 0) out.push(a);
        }
        return out;
    }

    /* ---------- offers ---------- */

    function titleKey(title, year) {
        var clean = String(title || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/^\s+|\s+$/g, "");
        var y = String(year || "").match(/\d{4}/);
        return clean ? clean + "|" + (y ? y[0] : "") : "";
    }

    function titleOnly(title) {
        return String(title || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/^\s+|\s+$/g, "");
    }

    function providerFor(offer) {
        var pkg = offer && offer.package && (offer.package.technicalName || offer.package.clearName) || "";
        var n = String(pkg).toLowerCase();
        if (n.indexOf("amazon") === 0 || n.indexOf("prime video") >= 0) return "primevideo";
        if (n.indexOf("netflix") >= 0) return "netflix";
        if (n.indexOf("hotstar") >= 0 || n.indexOf("jiohotstar") >= 0) return "hotstar";
        if (n.indexOf("disney") >= 0) return "disneyplus";
        if (n.indexOf("itunes") >= 0 || n.indexOf("apple tv") >= 0 || n.indexOf("appletv") >= 0) return "appletv";
        if (n.indexOf("sonyliv") >= 0 || n.indexOf("sony liv") >= 0) return "sonyliv";
        return "";
    }

    function offerRank(offer) {
        var type = String(offer && offer.monetizationType || "").toUpperCase();
        if (type === "FLATRATE" || type === "FREE") return 0;
        if (type === "ADS") return 1;
        if (type === "RENT") return 2;
        if (type === "BUY") return 3;
        return 4;
    }

    function gtiFromUrl(url) {
        var m = /[?&]gti=([^&]+)/.exec(url || "");
        if (!m) return "";
        try { return decodeURIComponent(m[1]); } catch (e) { return m[1]; }
    }

    /* Subscribed first, then free with ads, then rent, then buy; within a
       tier, PROVIDER_ORDER. One offer per service. */
    function chooseOffer(offers) {
        var chosen = {}, order = [], i, offer, provider, candidate, old;
        for (i = 0; i < (offers || []).length; i++) {
            offer = offers[i];
            provider = providerFor(offer);
            if (!provider) continue;
            candidate = {
                provider: provider,
                name: PROVIDER_NAMES[provider] || "",
                url: offer.standardWebURL || "",
                gti: provider === "primevideo" ? gtiFromUrl(offer.standardWebURL) : "",
                rank: offerRank(offer),
                monetizationType: offer.monetizationType || ""
            };
            if (!chosen[provider]) {
                chosen[provider] = candidate;
                order.push(provider);
            } else {
                old = chosen[provider];
                if (candidate.rank < old.rank ||
                    (candidate.rank === old.rank && candidate.gti && !old.gti)) {
                    chosen[provider] = candidate;
                }
            }
        }
        order.sort(function (a, b) {
            var ar = chosen[a].rank, br = chosen[b].rank;
            if (ar !== br) return ar - br;
            return (PROVIDER_ORDER[a] === undefined ? 99 : PROVIDER_ORDER[a]) -
                   (PROVIDER_ORDER[b] === undefined ? 99 : PROVIDER_ORDER[b]);
        });
        return order.length ? chosen[order[0]] : null;
    }

    function emptyOffers() { return { byImdb: {}, byKey: {}, byTitle: {}, loaded: false }; }

    function searchOffers(q, cb) {
        var query = String(q || "").trim();
        var key = country() + "|" + (query.toLowerCase() || "__popular__");
        if (cache.offers[key]) { cb(cache.offers[key]); return; }
        fetchJSON(WATCH, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            timeout: 20000,
            body: JSON.stringify({
                operationName: "AplSearch",
                query: WATCH_QUERY,
                variables: {
                    country: country(),
                    language: "en",
                    filter: query ? { searchQuery: query } : null,
                    first: 50
                }
            })
        }, function (err, data) {
            var watch = emptyOffers(), edges, i, node, content, offers, imdb, byYear, byName, group, bucket, year;
            if (!err && data && data.data && data.data.popularTitles && data.data.popularTitles.edges) {
                edges = data.data.popularTitles.edges;
                for (i = 0; i < edges.length; i++) {
                    node = edges[i] && edges[i].node;
                    if (!node || !node.content) continue;
                    content = node.content;
                    offers = node.offers || [];
                    imdb = content.externalIds && content.externalIds.imdbId;
                    byYear = titleKey(content.title, content.originalReleaseYear);
                    byName = titleOnly(content.title);
                    if (imdb) {
                        if (!watch.byImdb[imdb]) watch.byImdb[imdb] = { offers: [] };
                        watch.byImdb[imdb].offers = watch.byImdb[imdb].offers.concat(offers);
                    }
                    if (byYear) {
                        if (!watch.byKey[byYear]) watch.byKey[byYear] = { offers: [] };
                        watch.byKey[byYear].offers = watch.byKey[byYear].offers.concat(offers);
                    }
                    /* Title-only tier: the catalogue and the popularity page
                       often disagree on the year (re-edits, festival cuts) or
                       rank a sequel first. Offers stay grouped by year so a
                       2005 film called "Severance" cannot inherit the 2022
                       show's offer. */
                    if (byName) {
                        if (!watch.byTitle[byName]) watch.byTitle[byName] = { buckets: {} };
                        group = watch.byTitle[byName];
                        year = String(content.originalReleaseYear || "");
                        if (!group.buckets[year]) group.buckets[year] = { offers: [] };
                        bucket = group.buckets[year];
                        bucket.offers = bucket.offers.concat(offers);
                    }
                }
                watch.loaded = true;
            }
            if (watch.loaded) cache.offers[key] = watch;
            cb(watch);
        });
    }

    function offersByTitle(item, watch) {
        var group = watch.byTitle[titleOnly(item && item.title)], k, best = null, bestDiff = 2, diff, year;
        if (!group) return null;
        var mine = String(item && item.year || "").match(/\d{4}/);
        if (!mine) {
            /* No year to verify: only an unambiguous title is safe. */
            var found = 0, only = null;
            for (k in group.buckets) {
                if (!Object.prototype.hasOwnProperty.call(group.buckets, k)) continue;
                if (group.buckets[k].offers.length) { found++; only = group.buckets[k]; }
            }
            return found === 1 ? only : null;
        }
        if (group.buckets[mine[0]]) return group.buckets[mine[0]];
        for (k in group.buckets) {
            if (!Object.prototype.hasOwnProperty.call(group.buckets, k) || !/^\d{4}$/.test(k)) continue;
            year = Number(k);
            diff = Math.abs(year - Number(mine[0]));
            if (diff <= 1 && diff < bestDiff) { bestDiff = diff; best = group.buckets[k]; }
        }
        return best;
    }

    function offerFor(item, watch) {
        var entry = item && item.id && watch.byImdb[item.id];
        if (!entry) entry = watch.byKey[titleKey(item && item.title, item && item.year)];
        if (!entry) entry = offersByTitle(item, watch);
        return entry ? chooseOffer(entry.offers) : null;
    }

    function applyOffers(list, watch) {
        var loaded = !!(watch && watch.loaded), i, item, offer;
        for (i = 0; i < (list || []).length; i++) {
            item = list[i];
            offer = offerFor(item, watch);
            /* Partial answers carry no badge: a card may only name a service
               once JustWatch has confirmed it. */
            item.provider = offer ? offer.provider : "";
            item.webUrl = offer ? offer.url : "";
            item.gti = offer && offer.provider === "primevideo" ? offer.gti : "";
            item.monetizationType = offer ? offer.monetizationType : "";
            item.confirmed = loaded;
        }
    }

    /* Once availability has loaded, keep only titles with a real offer and
       put the services that matter first. Dropping unmatched cards is what
       stops a search for a JioHotstar title from filling the row with
       lookalikes. */
    function finalize(list, loaded) {
        if (!list) return [];
        if (!loaded) return list;
        var kept = [], i;
        for (i = 0; i < list.length; i++) if (list[i] && list[i].provider) kept.push(list[i]);
        kept.sort(function (a, b) {
            var ar = PROVIDER_ORDER[a.provider], br = PROVIDER_ORDER[b.provider];
            return (ar === undefined ? 99 : ar) - (br === undefined ? 99 : br);
        });
        return kept;
    }

    /* One query: apps at once, catalogue and offers as they arrive, a
       partial render so the sheet is never empty while it waits. */
    function run(q, cb) {
        var out = { query: String(q || "").trim(), apps: localApps(q), movies: [], shows: [], loaded: false };
        var left = 3;
        function step() {
            left--;
            if (left > 0) { cb(out); return; }
            applyOffers(out.movies, out.watch);
            applyOffers(out.shows, out.watch);
            out.movies = finalize(out.movies, out.loaded);
            out.shows = finalize(out.shows, out.loaded);
            out.done = true;
            cb(out);
        }
        out.watch = emptyOffers();
        cb(out);
        films(q, function (list) { out.movies = list; step(); });
        shows(q, function (list) { out.shows = list; step(); });
        searchOffers(q, function (watch) {
            out.watch = watch;
            out.loaded = !!(watch && watch.loaded);
            step();
        });
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
        /* The icon set has no magnifier yet, so the sheet draws its own. */
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

        /* The sheet is the whole stage, so it follows the frozen backdrop
           itself rather than slicing it: when the artwork changes (or goes
           away) the full-frame image and the scrim follow. */
        if (APL.glass) APL.glass.onChange = syncGlass;
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
        var r, c, b, k, i;
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
                out.push({ type: "app", app: answer.apps[i], title: answer.apps[i].name || "", icon: answer.apps[i].icon || "" });
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
            /* An app carries its tile (a 500x300 image), its real icon, or
               nothing at all: never an empty <img>, which showed a broken
               picture where the app should be. */
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
        if (item.provider) {
            var badge = el("span", "srch__badge");
            badge.textContent = PROVIDER_NAMES[item.provider] || item.provider;
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
        emptyEl.textContent = t("Nothing found");

        all = [].slice.call(tabsEl.children)
            .concat([].slice.call(keysEl.children))
            .concat(nodes);
        for (i = 0; i < all.length; i++) if (all[i] === old) at = i;
        /* The answers arrive in three waves and each one redraws the sheet:
           the focus follows the tile the eye is on, or the same index, never
           back to the first tab under the viewer. */
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

    /* One spinner, not a count: a newer query replaces the older one, and
       only the query that is still current may switch it off. */
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

    function appFor(provider) {
        var all = installed(), name = String(PROVIDER_NAMES[provider] || "").toLowerCase(), i, a;
        for (i = 0; i < all.length; i++) {
            a = all[i];
            if (a.key === provider) return a;
            if (String(a.name || "").toLowerCase().indexOf(name) >= 0) return a;
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
        var app = item.provider ? appFor(item.provider) : null;
        if (app) {
            close();
            if (APL.openApp) APL.openApp(app);
            else if (APL.launchApp) APL.launchApp(app.id);
            return;
        }
        if (item.provider) {
            if (APL.toast) APL.toast(t("Install {name} to watch this", { name: PROVIDER_NAMES[item.provider] || item.provider }));
            return;
        }
        if (APL.toast) APL.toast(t("No service carries {title} here", { title: item.title }));
    }

    /* ---------- glass ---------- */

    /* The sheet is the whole stage, so its pane is the frozen backdrop at
       full size: no slicing, no filter. */
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

    /* No Home Screen artwork behind the sheet: a bundled, already-blurred frame
       keeps the glass look instead of a flat scrim. */
    var FALLBACK_ART = "assets/wallpapers/amber-panel.jpg";

    function syncGlass() {
        if (!glassEl) return;
        var src = APL.glass ? APL.glass.src() : "";
        var real = !!src;
        if (!src) src = global.APL_ASSET ? global.APL_ASSET(FALLBACK_ART) : FALLBACK_ART;
        if (glassEl.getAttribute("src") !== src) glassEl.setAttribute("src", src);
        glassEl.hidden = false;
        root.classList.toggle("has-art", real);
    }

    /* ---------- open / close ---------- */

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
