/* ============================================================
   sources.js — choose a source (HDMI, USB-C…) the Apple TV way,
   without Samsung's own source screen.
   Ported from APL Launcher for TizenOS (MIT, c 2026 Knikt); the
   transport is CleanFrame's Vetro client and the tiles carry the
   launcher's own glass.

   One tile per input of the screen, plus "AirPlay" (iPhone, iPad, Mac).
   OK switches straight to the input. Hold OK: choose the connected device
   (Switch 2, Steam Deck, PS5…) — its tile then takes that device's logo.
   ============================================================ */
(function (global) {
    "use strict";

    var APL = global.APL, sys = APL.sys;
    var root, row, titleEl, hintEl, nav, cards = [], isOpen = false, picking = null;
    var DEVICES = global.APL_DEVICES || [];

    function deviceByKey(k) {
        for (var i = 0; i < DEVICES.length; i++) if (DEVICES[i].key === k) return DEVICES[i];
        return null;
    }
    /* Name announced by the screen (if available) → known device */
    function guess(name) {
        var n = String(name || "").toLowerCase();
        if (!n) return null;
        for (var i = 0; i < DEVICES.length; i++) {
            var m = DEVICES[i].match || [];
            for (var j = 0; j < m.length; j++) { try { if (new RegExp(m[j], "i").test(n)) return DEVICES[i]; } catch (e) {} }
        }
        return null;
    }

    var LABEL = { HDMI: "HDMI", PC: "PC", DVI: "DVI", DP: "USB-C", USBC: "USB-C", AV: "AV", COMP: APL.t("Component"), SCART: APL.t("SCART") };

    function el(tag, cls, html) {
        var e = global.document.createElement(tag);
        if (cls) e.className = cls;
        if (html !== undefined) e.innerHTML = html;
        return e;
    }

    /* The screen's inputs: the ones Tizen announces, otherwise the Smart Monitor
       M8's HDMI 1 and USB-C. */
    function inputs() {
        var list = [];
        try {
            var tw = global.tizen && global.tizen.tvwindow;
            if (tw && tw.getAvailableSources) {
                list = tw.getAvailableSources().filter(function (s) { return LABEL[s.type]; })
                    .map(function (s) { return { type: s.type, number: s.number || 1, label: s.name || s.label || "" }; });
            }
        } catch (e) {}
        if (!list.length) list = [{ type: "HDMI", number: 1 }, { type: "USBC", number: 1 }];
        var hdmiCount = list.filter(function (s) { return s.type === "HDMI"; }).length;
        var chosen = sys.pref("sourceDevices") || {};
        return list.map(function (s) {
            var hdmi = s.type === "HDMI", id = s.type + s.number;
            var port = LABEL[s.type] + (hdmi && hdmiCount > 1 ? " " + s.number : "");
            var dev = chosen[id] === "none" ? null : (deviceByKey(chosen[id]) || guess(s.label));
            return {
                id: id, port: port, device: dev,
                name: dev ? APL.t(dev.name) : port,
                sub: dev ? port : hdmi ? APL.t("Hold OK to choose the device") : s.type === "USBC" || s.type === "DP" ? APL.t("Laptop, Mac, tablet") : "",
                icon: hdmi ? "hdmi" : s.type === "USBC" || s.type === "DP" ? "usbc" : "source",
                /* Samsung numbering: HDMI 1 to 4 = 13 to 16; on the Smart
                   Monitor M8, USB-C answers to 14 ("HDMI 2"). */
                sourceType: hdmi ? 12 + (s.number || 1) : s.type === "USBC" || s.type === "DP" ? 14 : -1
            };
        });
    }

    function extras() {
        return [
            { name: "AirPlay", sub: APL.t("iPhone, iPad, Mac"), icon: "airplay",
              run: function () { if (APL.controlCenter && APL.controlCenter.openAirPlay) APL.controlCenter.openAirPlay(); } }
        ];
    }

    function switchTo(c) {
        if (sys.PREVIEW) { APL.toast(APL.t("Preview: on your TV, the screen would switch to {name}", { name: c.name })); return; }
        if (c.sourceType < 0) { APL.toast(APL.t("This input isn't supported on this screen")); return; }
        APL.toast(APL.t("Switching to {name}…", { name: c.name }), true);
        sys.switchSource(c.sourceType, c.port).catch(function (e) { APL.toast(e.message); });
    }

    function cardHtml(c) {
        var art = c.device
            ? '<span class="apl-src__art" style="background-image:url(\'' + c.device.tile + '\')"></span>'
            : '<span class="apl-src__art apl-src__art--glass"><span class="apl-src__ico">' + APL.icon(c.icon, 64, 1.7) + '</span></span>';
        return art + '<span class="apl-src__name"></span><span class="apl-src__sub"></span>';
    }

    /* The launcher's glass, inside every card: the same pre-blurred wallpaper
       slice the control tiles carry, positioned as a lens. */
    function paintGlass() {
        var g = global.CleanFrameGlass, src, nodes, i, n, layer, box;
        if (!g || !row) return;
        src = g.src();
        nodes = [].slice.call(row.querySelectorAll(".apl-src"));
        for (i = 0; i < nodes.length; i++) {
            n = nodes[i];
            layer = n.querySelector(".apl-src__glass");
            if (!layer) {
                layer = el("i", "apl-src__glass");
                n.insertBefore(layer, n.firstChild);
            }
            if (!src) { layer.style.backgroundImage = ""; layer._src = ""; layer.classList.remove("is-on"); continue; }
            if (layer._src !== src) { layer.style.backgroundImage = 'url("' + src + '")'; layer._src = src; }
            box = g.offset(layer);
            layer.style.backgroundPosition = g.lens(box.x, box.y, layer.offsetWidth, layer.offsetHeight);
            layer.classList.add("is-on");
        }
    }

    function buildDom() {
        root = el("section", "apl-src-page");
        root.appendChild(el("div", "apl-src-page__dim"));
        titleEl = el("h1", "apl-src-page__title");
        root.appendChild(titleEl);
        row = el("div", "apl-src-page__row");
        root.appendChild(row);
        hintEl = el("p", "apl-src-page__hint");
        root.appendChild(hintEl);
        APL.layer().appendChild(root);
        nav = new APL.Nav({
            onSelect: function (i) {
                if (picking) { choose(i); return; }
                var c = cards[i];
                close();
                if (c.run) c.run(); else switchTo(c);
            },
            onLongPress: function (i) { if (!picking && cards[i] && cards[i].id) pick(cards[i]); },
            onBack: function () { if (picking) { picking = null; render(); } else close(); }
        });
    }

    function fill(list, focus) {
        row.innerHTML = "";
        var tiles = list.map(function (c) {
            var t = el("div", "apl-src" + (picking ? " apl-src--small" : ""), cardHtml(c));
            t.querySelector(".apl-src__name").textContent = c.name;
            t.querySelector(".apl-src__sub").textContent = c.sub || "";
            row.appendChild(t);
            return t;
        });
        row.classList.toggle("is-picking", !!picking);
        root.classList.toggle("is-picking", !!picking);
        nav.setTiles(tiles);
        nav.focus(Math.max(0, Math.min(focus || 0, tiles.length - 1)));
        paintGlass();
    }

    function render(focus) {
        cards = inputs().concat(extras());
        titleEl.textContent = "Sources";
        hintEl.textContent = APL.t("OK: switch to the input · Hold OK: choose the connected device · Back: Home");
        fill(cards, focus);
    }

    /* Choose the device connected to an input (Switch 2, Steam Deck, PS5…) */
    function pick(c) {
        picking = c;
        titleEl.textContent = APL.t("What's connected to {port}?", { port: c.port });
        hintEl.textContent = APL.t("OK to choose · Back to cancel");
        cards = DEVICES.map(function (d) { return { device: d, name: APL.t(d.name), sub: "", key: d.key }; })
            .concat([{ device: null, icon: c.icon, name: APL.t("Nothing Specific"), sub: APL.t("Show “{port}”", { port: c.port }), key: "none" }]);
        var cur = (sys.pref("sourceDevices") || {})[c.id], at = 0;
        cards.forEach(function (x, i) { if (x.key === cur) at = i; });
        fill(cards, at);
    }
    function choose(i) {
        var map = {}, prev = sys.pref("sourceDevices") || {}, name = picking.port;
        Object.keys(prev).forEach(function (k) { map[k] = prev[k]; });
        map[picking.id] = cards[i].key;
        sys.setPref("sourceDevices", map);
        var id = picking.id;
        picking = null;
        render();
        cards.forEach(function (x, k) { if (x.id === id) nav.focus(k); });
        APL.toast(cards[i] && cards[i].device ? APL.t("{device} on {port}", { device: APL.t(cards[i].device.name), port: name }) : APL.t("Input updated"), true);
    }

    function open() {
        if (!root) buildDom();
        picking = null;
        render(0);
        root.classList.add("is-open");
        APL.pushNav(nav);
        isOpen = true;
    }

    function close() {
        if (!isOpen) return;
        picking = null;
        root.classList.remove("is-open");
        APL.popNav(nav);
        isOpen = false;
    }

    APL.sources = { open: open, close: close, isOpen: function () { return isOpen; } };
})(window);
