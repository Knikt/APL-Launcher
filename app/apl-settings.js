/* ============================================================
   settings.js — the Settings app, Apple TV–style split view:
   large icon on the left (+ description of the selected row),
   list on the right, selected row in white, values on the right.
   OK enters a submenu / changes a value; Back goes up a level.
   ============================================================ */
(function (global) {
    "use strict";

    var APL = global.APL, sys = APL.sys;
    var root, titleEl, cardEl, descEl, pathEl, listEl, wrapEl, nav;
    var levels = [];
    var listY = 0;
    var isOpen = false;

    function el(tag, cls, html) {
        var e = document.createElement(tag);
        if (cls) e.className = cls;
        if (html !== undefined) e.innerHTML = html;
        return e;
    }

    function buildDom() {
        root = el("section", "apl-settings");
        root.appendChild(el("div", "apl-settings__bg"));
        titleEl = el("h1", "apl-settings__title");
        var hero = el("div", "apl-settings__hero");
        cardEl = el("div", "apl-settings__card");
        descEl = el("p", "apl-settings__desc");
        pathEl = el("p", "apl-settings__path");
        hero.appendChild(cardEl); hero.appendChild(descEl); hero.appendChild(pathEl);
        var wrap = wrapEl = el("div", "apl-settings__listwrap");
        listEl = el("div", "apl-settings__list");
        wrap.appendChild(listEl);
        root.appendChild(titleEl); root.appendChild(hero); root.appendChild(wrap);
        APL.layer().appendChild(root);

        nav = new APL.Nav({
            onFocus: onFocus,
            onSelect: onSelect,
            onBack: back,
            onKey: onKey
        });
    }

    function cur() { return levels[levels.length - 1]; }

    /* ---------- values shown on the right ---------- */
    function onOff(v) { return v ? APL.t("On") : APL.t("Off"); }

    function valueHtml(item) {
        switch (item.type) {
            case "info": return item.get();
            case "toggle": return onOff(sys.pref(item.key));
            case "choice":
                var v = item.read ? item.read() : sys.pref(item.key);
                for (var i = 0; i < item.options.length; i++) if (item.options[i][0] === v) return item.options[i][1];
                return String(v);
            case "volume":
                var vol = sys.audio.getVolume();
                return '<span class="apl-srow__bar"><i style="width:' + vol + '%"></i></span>' + vol;
            case "mute": return onOff(sys.audio.isMute());
            case "hide": return (sys.pref("hiddenApps").indexOf(item.id) === -1) ? APL.t("Visible") : APL.t("Hidden");
            case "tvmode":
                return sys.tvItem("pictureMode").then(function (it) { return it ? sys.pictureModeName(it.value) : APL.t("Unavailable"); },
                                                      function () { return APL.t("Unavailable"); });
            case "game":
                return sys.game.get().then(function (g) { return onOff(g.on); }, function () { return APL.t("Unavailable"); });
            case "flag": return sys.pref("aerialHidden").indexOf(item.token) === -1 ? APL.t("Show") : APL.t("Hide");
            case "service": return APL.services && APL.services.isCut(item.group) ? APL.t("Blocked") : APL.t("Active");
            case "native":
                return sys.native.get(item.id).then(function (n) { return nativeText(item, n); }, function () { return APL.t("Unavailable"); });
            default: return "";
        }
    }

    /* Screen setting: a slider, or the list of its values. */
    function nativeText(item, n) {
        if (item.options) {
            for (var i = 0; i < item.options.length; i++) if (item.options[i][0] === n) return item.options[i][1];
            return String(n);
        }
        var d = sys.native.info(item.id);
        var pct = Math.round(100 * (n - d.min) / Math.max(1, d.max - d.min));
        return '<span class="apl-srow__bar"><i style="width:' + pct + '%"></i></span>' + (item.format ? item.format(n) : n);
    }
    function nativeChoice(item, row) {
        var L = cur();
        sys.native.get(item.id).then(function (n) {
            // Two values: OK switches straight from one to the other
            if (item.options.length === 2) {
                var next = item.options[0][0] === n ? item.options[1] : item.options[0];
                sys.native.set(item.id, next[0]).then(function () { refreshRow(row); }, function (e) { APL.toast(e.message); });
                return;
            }
            var at = 0;
            var opts = item.options.map(function (o, k) {
                if (o[0] === n) at = k;
                return { type: "nativeoption", id: item.id, label: o[1], v: o[0], selected: o[0] === n, desc: item.desc };
            });
            levels.push({ node: { label: item.label, icon: L.node.icon, children: opts }, index: at });
            render("fwd");
        }, function (e) { APL.toast(e.message); });
    }
    /* Slider: the value shown changes right away, the write goes out after the last key press. */
    var nativeTimer = null;
    function nativeSlide(item, row, direction) {
        var d = sys.native.info(item.id), slot = row.querySelector(".apl-srow__value");
        function step(steps) {
            item._value = Math.max(d.min, Math.min(d.max, item._value + steps * (d.step || 1)));
            slot.innerHTML = nativeText(item, item._value);
            clearTimeout(nativeTimer);
            nativeTimer = setTimeout(function () {
                sys.native.set(item.id, item._value).catch(function (e) {
                    APL.toast(e.message);
                    item._value = undefined;
                    fillValue(row);
                });
            }, 350);
        }
        if (item._value !== undefined) { step(direction); return; }
        // Value not read yet: key presses add up while waiting for the screen's answer
        item._steps = (item._steps || 0) + direction;
        if (item._reading) return;
        item._reading = true;
        sys.native.get(item.id).then(function (v) {
            var steps = item._steps;
            item._reading = false;
            item._steps = 0;
            item._value = v;
            step(steps);
        }, function (e) { item._reading = false; item._steps = 0; APL.toast(e.message); });
    }

    function accessory(item) {
        if (item.type === "menu" || item.type === "choice" || item.type === "tvmode" || (item.type === "native" && item.options && item.options.length > 2)) return APL.icon("chevron", 26, 2.4);
        if (item.type === "nativeoption" && item.selected) return APL.icon("check", 28, 2.6);
        if (item.type === "samsung") return APL.icon("external", 24, 2);
        if ((item.type === "option" || item.type === "tvoption") && item.selected) return APL.icon("check", 28, 2.6);
        return "";
    }

    function tvHtml(item, v) {
        if (v === null || v === undefined) return APL.t("Unavailable");
        var it = item._meta || { min: 0, max: 50 };
        var pct = Math.round(100 * (v - it.min) / Math.max(1, it.max - it.min));
        return '<span class="apl-srow__bar"><i style="width:' + pct + '%"></i></span>' + v;
    }

    function fillValue(row) {
        var item = row._item;
        if (item.type === "tv") {
            var slot0 = row.querySelector(".apl-srow__value");
            slot0.textContent = "…";
            sys.tvItem(item.id).then(function (it) {
                item._meta = it;
                slot0.innerHTML = tvHtml(item, it ? (it.target !== undefined ? it.target : it.value) : null);
            }, function () { slot0.textContent = APL.t("Unavailable"); });
            return;
        }
        var v = valueHtml(item);
        var slot = row.querySelector(".apl-srow__value");
        if (v && typeof v.then === "function") {
            slot.textContent = "…";
            v.then(function (txt) { slot.innerHTML = txt; });
        } else {
            slot.innerHTML = v === undefined || v === null ? "" : v;
        }
    }

    function makeRow(item) {
        var row = el("div", "apl-srow" + (item.type === "info" ? " apl-srow--info" : ""));
        row._item = item;
        row.appendChild(el("span", "apl-srow__label", ""));
        row.firstChild.textContent = item.label;
        row.appendChild(el("span", "apl-srow__value"));
        row.appendChild(el("span", "apl-srow__acc", accessory(item)));
        fillValue(row);
        return row;
    }

    function render(enterDir) {
        var L = cur(), node = L.node;
        titleEl.textContent = node.label;
        // Top level of Settings: Apple's large Settings icon, as on tvOS.
        if (levels.length === 1) {
            // The drawn Settings icon: sharp at any size and no image to ship
            cardEl.innerHTML = APL.settingsArt(430);
        } else {
            cardEl.innerHTML = APL.icon(node.icon || "gear", 250, 1.3);
        }
        cardEl.classList.toggle("is-app", levels.length === 1);
        listEl.innerHTML = "";
        listY = 0;
        listEl.style.transform = "translateY(0)";
        // Section titles ("VIDEO", "AUDIO"…): shown, never selectable
        var rows = [];
        node.children.forEach(function (item) {
            if (item.type === "section") {
                var h = el("div", "apl-srow__section");
                h.textContent = item.label;
                listEl.appendChild(h);
                return;
            }
            var r = makeRow(item);
            listEl.appendChild(r);
            rows.push(r);
        });
        // Entry animation on the container: the list keeps its own
        // transform for scrolling (otherwise the animation blocks it).
        if (enterDir) {
            wrapEl.classList.remove("is-enter-fwd", "is-enter-back");
            void wrapEl.offsetWidth;
            wrapEl.classList.add(enterDir === "back" ? "is-enter-back" : "is-enter-fwd");
        }
        var want = L.index || 0;        // setTiles refocuses the 1st row: keep the position we want
        nav.setTiles(rows);
        nav.focus(Math.min(want, rows.length - 1));
    }

    /* ---------- focus ---------- */
    function ensureVisible(row) {
        // Margins to stay out of the list's top / bottom fade zones.
        var view = 880, top = row.offsetTop, h = row.offsetHeight;
        if (top + listY < 30) listY = -top + 30;
        else if (top + h + listY > view - 80) listY = view - 80 - top - h;
        listEl.style.transform = "translateY(" + listY + "px)";
    }

    function onFocus(i, row) {
        cur().index = i;
        ensureVisible(row);
        var item = row._item;
        descEl.textContent = item.desc || (item.type === "menu" ? "" : "");
        pathEl.style.display = "none";
    }

    function refreshRow(row) { fillValue(row); row.querySelector(".apl-srow__acc").innerHTML = accessory(row._item); }

    function onSelect(i, row) {
        var item = row._item, L = cur();
        switch (item.type) {
            case "menu":
                L.index = i;
                levels.push({ node: item, index: 0 });
                render("fwd");
                break;
            case "choice":
                L.index = i;
                var sel = item.read ? item.read() : sys.pref(item.key), selIndex = 0;
                var opts = item.options.map(function (o, k) {
                    if (o[0] === sel) selIndex = k;
                    return { type: "option", label: o[1], v: o[0], key: item.key, apply: item.apply,
                             read: item.read, write: item.write, selected: o[0] === sel, desc: item.desc };
                });
                levels.push({ node: { label: item.label, icon: L.node.icon, children: opts }, index: selIndex });
                render("fwd");
                break;
            case "option":
                /* A row backed by the app itself (light / dark / photo) writes
                   through its own function; the rest are launcher preferences. */
                if (item.write) item.write(item.v);
                else sys.setPref(item.key, item.v);
                if (item.apply) item.apply(item.v);
                back();
                break;
            case "toggle":
                sys.setPref(item.key, !sys.pref(item.key));
                refreshRow(row);
                break;
            case "flag":
                var off = sys.pref("aerialHidden").slice(), at = off.indexOf(item.token);
                if (at === -1) off.push(item.token); else off.splice(at, 1);
                sys.setPref("aerialHidden", off);
                refreshRow(row);
                break;
            case "mute":
                sys.audio.setMute(!sys.audio.isMute());
                refreshRow(row);
                break;
            case "hide":
                var hidden = sys.pref("hiddenApps").slice();
                var k = hidden.indexOf(item.id);
                if (k === -1) hidden.push(item.id); else hidden.splice(k, 1);
                sys.setPref("hiddenApps", hidden);
                refreshRow(row);
                if (APL.reloadApps) APL.reloadApps();
                break;
            case "samsung":
                sys.openSamsungSettings().catch(function (e) { APL.toast(e.message); });
                break;
            case "tvmode":
                L.index = i;
                sys.tvItem("pictureMode").then(function (it) {
                    var curMode = it ? it.value : null, at = 0;
                    var modes = sys.PICTURE_MODES.map(function (m, n) {
                        if (m[0] === curMode) at = n;
                        return { type: "tvoption", label: m[1], v: m[0], selected: m[0] === curMode, desc: item.desc };
                    });
                    levels.push({ node: { label: item.label, icon: L.node.icon, children: modes }, index: at });
                    render("fwd");
                }, function (e) { APL.toast(e.message); });
                break;
            case "tvoption":
                sys.setPictureMode(item.v).then(function () {
                    APL.toast(APL.t("Picture Mode: {mode}", { mode: item.label }), true);
                    back();
                }, function (e) { APL.toast(e.message); });
                break;
            case "game":
                sys.game.get().then(function (g) {
                    return sys.game.set(!g.on);
                }).then(function (g) {
                    APL.toast(g.pending ? APL.t("Game Mode requested: it will turn on as soon as you switch to HDMI or USB-C")
                                        : (g.on ? APL.t("Game Mode on") : APL.t("Game Mode off")), true);
                    refreshRow(row);
                }, function (e) { APL.toast(e.message); });
                break;
            case "native":
                L.index = i;
                if (item.options) nativeChoice(item, row);
                break;
            case "nativeoption":
                sys.native.set(item.id, item.v).then(function () { back(); }, function (e) { APL.toast(e.message); });
                break;
            case "service":
                if (APL.services) APL.services.toggle(item.group).then(function () { refreshRow(row); });
                break;
            case "action":
                item.run();
                break;
            default: break;
        }
    }

    function onKey(code) {
        var row = nav.current();
        if (row && row._item.type === "native" && !row._item.options && (code === APL.KEY.LEFT || code === APL.KEY.RIGHT)) {
            nativeSlide(row._item, row, code === APL.KEY.RIGHT ? 1 : -1);
            return true;
        }
        if (row && row._item.type === "tv" && (code === APL.KEY.LEFT || code === APL.KEY.RIGHT)) {
            var item = row._item;
            sys.tvAdjust(item.id, code === APL.KEY.RIGHT ? 1 : -1, function (nv) {
                row.querySelector(".apl-srow__value").innerHTML = tvHtml(item, nv);
            }).catch(function (e) { APL.toast(e.message); });
            return true;
        }
        if (!row || row._item.type !== "volume") return false;
        if (code === APL.KEY.LEFT || code === APL.KEY.RIGHT) {
            sys.audio.setVolume(sys.audio.getVolume() + (code === APL.KEY.RIGHT ? 1 : -1));
            fillValue(row);
            return true;
        }
        return false;
    }

    function back() {
        if (levels.length > 1) { levels.pop(); render("back"); }
        else close();
    }

    /* ---------- open / close ---------- */
    /* sectionLabel: the English name of a top-level menu ("Connection"), translated or not. */
    function open(sectionLabel) {
        if (!root) buildDom();
        levels = [{ node: APL.settingsTree(), index: 0 }];
        if (sectionLabel) {
            var kids = levels[0].node.children;
            for (var i = 0; i < kids.length; i++) {
                if ((kids[i].label === sectionLabel || kids[i].label === APL.t(sectionLabel)) && kids[i].type === "menu") {
                    levels[0].index = i;
                    levels.push({ node: kids[i], index: 0 });
                    break;
                }
            }
        }
        render();
        /* The same frost the app drawer uses: the stage's own pre-blurred copy
           of the poster behind the screen (`bdBlur`), with a scrim deep enough
           to keep white rows readable. No filter - the blur is already in the
           image, so nothing is recomposited per frame. */
        var bgEl = root.firstChild;
        var bl = document.getElementById("bdBlur");
        var src = bl && bl.getAttribute("src");
        if (src && bl.naturalWidth) {
            bgEl.style.backgroundImage = 'linear-gradient(160deg, rgba(8, 16, 36, 0.52), rgba(5, 9, 20, 0.74)), url("' + src + '")';
            bgEl.style.backgroundSize = "cover, cover";
            bgEl.style.backgroundPosition = "center, center";
            bgEl.style.backgroundRepeat = "no-repeat, no-repeat";
            root.classList.add("is-frosted");
        } else {
            bgEl.style.backgroundImage = "";
            root.classList.remove("is-frosted");
        }
        root.classList.add("is-open");
        document.body.classList.add("has-settings");
        APL.pushNav(nav);
        isOpen = true;
    }

    function close() {
        if (!root) return;
        root.classList.remove("is-open");
        document.body.classList.remove("has-settings");
        APL.popNav(nav);
        isOpen = false;
    }

    APL.settings = { open: open, close: close, isOpen: function () { return isOpen; } };
})(window);
