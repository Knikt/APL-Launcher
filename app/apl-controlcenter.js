/* ============================================================
   controlcenter.js — Control Center in the style of tvOS 26 / 27.

   Glass tiles float at the top right, over the Home Screen:
     Sleep (large square) · Wi-Fi · Do Not Disturb
     Audio (sound output: screen, AirPods…) · Sleep Timer
     ○ Game Mode (direct)  ○ Accessibility  ○ AirPlay and iPhone  ○ Sources
     Brightness (real, through Vetro)
     Screen Saver · Settings
   "Audio" opens the list of outputs: the screen's speakers and paired
   Bluetooth devices (AirPods, headphones, speakers), connected with one
   click, and the search to pair new ones, right here.
   "AirPlay and iPhone" explains screen mirroring and the iPhone as a
   remote.

   Opening: Play/Pause, holding Home or the red button (C on the keyboard
   in the preview). Closing: the same button or Back.
   ============================================================ */
(function (global) {
    "use strict";

    var APL = global.APL, sys = APL.sys, K = APL.KEY;
    var root, panel, timeEl, avatarEl, viewport, body, captionEl, nav, glassTimer = 0;
    var items = [], view = "main", lastMainIndex = 1, scrollY = 0;
    var isOpen = false;

    var TIMERS = [0, 15, 30, 60, 90, 120];
    var ALL = APL.t("All Settings"), CNX = ALL + " › " + APL.t("Connection");

    function el(tag, cls, html) {
        var e = document.createElement(tag);
        if (cls) e.className = cls;
        if (html !== undefined) e.innerHTML = html;
        return e;
    }

    function samsung(path, hint) {
        return function () {
            sys.openSamsungSettings(path).then(function () {
                close();
                APL.toast(hint || APL.t("Samsung settings opened — {path}", { path: path }), true);
            }, function (e) { APL.toast(e.message); });
        };
    }
    function openSettings(section) { return function () { close(); APL.settings.open(section); }; }

    function remaining() {
        var at = sys.pref("sleepAt");
        if (!at) return APL.t("Not set");
        return Math.max(1, Math.round((at - Date.now()) / 60000)) + " min";
    }

    /* ---------- Bluetooth (AirPods, headphones, speakers) ----------
       The screen has no BlueZ on D-Bus: the list, the search and pairing go through
       the Tizen API (tizen.bluetooth), the sound connection through Samsung's Bluetooth
       manager (root command through Vetro). */
    var BT_MGR = "gdbus call --system --dest com.samsung.tv.bt.connectionmanager --object-path /com/samsung/tv/bt/connectionmanager --method ";
    var BT_ADDR = /^[0-9A-F]{2}(:[0-9A-F]{2}){5}$/i;
    var AUDIO_NAME = /airpods|beats|buds|casque|headphone|headset|écouteur|ecouteur|enceinte|speaker|soundbar|barre de son|sony|bose|jbl|marshall|sennheiser/i;
    var PHONE_NAME = /airpods|buds|casque|headphone|headset|écouteur|ecouteur|beats/i;
    var bt = { list: null, at: 0, failed: false, busy: false };
    var scan = { on: false, found: {}, pairing: null };
    var keepFocus = false;                     // after a connection: focus stays on the same row

    // PC preview: examples (not real devices)
    var MOCK_BT = [
        { address: "mock1", name: "AirPods Pro", kind: "headphones", connected: false, battery: 95 },
        { address: "mock2", name: APL.t("Soundbar"), kind: "speaker", connected: false, battery: null }
    ];
    var MOCK_SCAN = [{ address: "mock3", name: APL.t("Demo AirPods"), kind: "headphones" }];

    function adapter() {
        try { return global.tizen.bluetooth.getDefaultAdapter(); } catch (e) { return null; }
    }

    /* Bluetooth class: 4 = audio and video; 1, 2 and 6 = headset, hands-free kit, headphones. */
    function kindOf(d) {
        var cls = d.deviceClass || {}, name = d.name || "";
        if (PHONE_NAME.test(name) || (cls.major === 4 && (cls.minor === 1 || cls.minor === 2 || cls.minor === 6))) return "headphones";
        if (cls.major === 4 || AUDIO_NAME.test(name)) return "speaker";
        return null;                                         // sound only (not controllers, keyboards…)
    }
    function devOf(d) {
        return { address: d.address, name: d.name || APL.t("Bluetooth device"), kind: kindOf(d),
                 connected: !!d.isConnected, bonded: !!d.isBonded, battery: null };
    }

    function btRefresh(force) {
        if (sys.PREVIEW) { bt.list = MOCK_BT; bt.failed = false; return Promise.resolve(bt.list); }
        if (!force && bt.list && Date.now() - bt.at < 15000) return Promise.resolve(bt.list);
        return new Promise(function (resolve, reject) {
            var a = adapter();
            if (!a) { reject(new Error("unavailable")); return; }
            a.getKnownDevices(resolve, reject);
        }).then(function (list) {
            // Paired devices only: the screen's list also keeps those seen during a search
            bt.list = list.map(devOf).filter(function (d) { return d.kind && d.bonded; });
            bt.at = Date.now(); bt.failed = false;
            // Who receives the sound: Samsung's manager knows, not Tizen's "isConnected"
            return sys.exec(BT_MGR + "org.tizen.btapp.ApiInterface.get_connected_bt_speaker_info 2>&1").then(function (r) {
                var on = String(r.output || "").toUpperCase();
                bt.list.forEach(function (d) { d.connected = on.indexOf(d.address.toUpperCase()) !== -1; });
                return bt.list;
            }, function () { return bt.list; });
        }).catch(function () { bt.failed = true; bt.list = bt.list || []; return bt.list; });
    }

    /* Waits for the device to reach the wanted state: Bluetooth answers within a few seconds. */
    function btWait(address, connected, tries) {
        return btRefresh(true).then(function () {
            var now = (bt.list || []).filter(function (d) { return d.address === address; })[0];
            if (!!(now && now.connected) === connected || tries <= 0) return now;
            return new Promise(function (r) { setTimeout(r, 1500); }).then(function () { return btWait(address, connected, tries - 1); });
        });
    }

    function btDone() {
        bt.busy = false;
        if (isOpen && view === "audio") { keepFocus = true; render(); keepFocus = false; }
    }

    function btConnect(dev) {
        bt.busy = true;
        APL.toast(APL.t("Connecting to “{name}”…", { name: dev.name }), true);
        // replace_current_bluetooth_speaker returns 0 but does nothing when no device is already connected
        sys.exec(BT_MGR + "org.tizen.btapp.ApiInterface.buds_switching_connect " + dev.address + " 2>&1").catch(function () {}).then(function () {
            return btWait(dev.address, true, 10);
        }).then(function (now) {
            if (now && now.connected) APL.toast(APL.t("Sound on “{name}”", { name: now.name }), true);
            else APL.toast(APL.t("“{name}” isn't responding: open the case or turn on the headphones, then try again.", { name: dev.name }));
            btDone();
        });
    }

    function btDisconnect(dev) {
        bt.busy = true;
        APL.toast(APL.t("Disconnecting “{name}”…", { name: dev.name }), true);
        // buds_switching_disconnect returns 12 and disconnects nothing
        sys.exec(BT_MGR + "org.tizen.btapp.ApiInterface.disconnect_last_btspk_list 2>&1").catch(function () {}).then(function () {
            return btWait(dev.address, false, 6);
        }).then(function (now) {
            if (now && now.connected) APL.toast(APL.t("“{name}” is still connected: try again in a moment.", { name: dev.name }));
            else APL.toast(APL.t("Sound on the screen's speakers"), true);
            btDone();
        });
    }

    function btToggle(dev) {
        if (bt.busy) return;
        if (sys.PREVIEW) {
            MOCK_BT.forEach(function (d) { d.connected = d === dev ? !d.connected : false; });
            APL.toast(dev.connected ? APL.t("Sound on “{name}”", { name: dev.name }) : APL.t("“{name}” disconnected", { name: dev.name }), true);
            render(); return;
        }
        if (!BT_ADDR.test(dev.address)) return;
        if (dev.connected) btDisconnect(dev); else btConnect(dev);
    }

    /* Forget a device (long press on its row): it will need to be paired again. */
    function btForget(dev) {
        if (!dev || sys.PREVIEW) return;
        APL.alert({
            title: APL.t("Forget “{name}”?", { name: dev.name }),
            message: APL.t("You'll need to pair it again to use it."),
            buttons: [
                { label: APL.t("Cancel") },
                { label: APL.t("Forget"), destructive: true, run: function () {
                    var a = adapter();
                    if (!a) return;
                    a.destroyBonding(dev.address, function () {
                        APL.toast(APL.t("“{name}” forgotten", { name: dev.name }), true);
                        btRefresh(true).then(function () { if (isOpen && view === "audio") render(); });
                    }, function (e) { APL.toast(APL.t("Couldn't forget this device: {error}", { error: e.message })); });
                } }
            ],
            focus: 0
        });
    }

    /* ---------- search and pairing, right here ---------- */
    function paintPair() { if (isOpen && view === "pair") render(); }

    function scanStop() {
        if (!scan.on) return;
        scan.on = false;
        var a = adapter();
        if (a) { try { a.stopDiscovery(function () {}, function () {}); } catch (e) {} }
    }

    function scanStart() {
        scan.found = {};
        if (sys.PREVIEW) {
            scan.on = false;
            MOCK_SCAN.forEach(function (d) { scan.found[d.address] = d; });
            paintPair();
            return;
        }
        var a = adapter();
        if (!a) { APL.toast(APL.t("Bluetooth unavailable on this screen")); return; }
        function ended() { scan.on = false; paintPair(); }
        try {
            scan.on = true;
            a.discoverDevices({
                onstarted: function () { paintPair(); },
                ondevicefound: function (d) {
                    if (d.isBonded || !d.name) return;               // already paired: it is in the Audio list
                    var dev = devOf(d);
                    if (!dev.kind || scan.found[dev.address]) return;
                    scan.found[dev.address] = dev;
                    paintPair();
                },
                ondevicedisappeared: function () {},
                onfinished: ended
            }, function (e) { ended(); APL.toast(APL.t("Search failed: {error}", { error: e.message })); });
        } catch (e) { ended(); APL.toast(APL.t("Search failed: {error}", { error: e.message })); }
    }

    function btPair(dev) {
        if (scan.pairing) return;
        if (sys.PREVIEW) { APL.toast(APL.t("Preview: “{name}” would be paired", { name: dev.name }), true); return; }
        var a = adapter();
        if (!a || !BT_ADDR.test(dev.address)) return;
        scan.pairing = dev.address;
        scanStop();
        APL.toast(APL.t("Pairing “{name}”…", { name: dev.name }), true);
        try {
            a.createBonding(dev.address, function (d) {
                scan.pairing = null;
                var done = devOf(d);
                APL.toast(APL.t("“{name}” is paired", { name: done.name }), true);
                btRefresh(true).then(function () {
                    if (isOpen && view === "pair") show("audio");
                    btConnect(done);
                });
            }, function (e) {
                scan.pairing = null;
                APL.toast(APL.t("“{name}” couldn't be paired: put it back in pairing mode, then try again. ({error})", { name: dev.name, error: e.message }));
                paintPair();
            });
        } catch (e) {
            scan.pairing = null;
            APL.toast(APL.t("Pairing failed: {error}", { error: e.message }));
        }
    }

    /* ---------- Game Mode ---------- */
    var gameState = { on: false, pending: false, busy: false };
    function gameRefresh() {
        return sys.game.get().then(function (g) {
            gameState.on = g.on;
            gameState.pending = !!g.pending;
            if (isOpen && view === "main") refresh();
        }, function () {});
    }
    function gameToggle() {
        if (gameState.busy) return;
        gameState.busy = true;
        var want = !gameState.on;
        APL.toast(want ? APL.t("Turning on Game Mode…") : APL.t("Turning off Game Mode…"), true);
        sys.game.set(want).then(function (g) {
            gameState.busy = false;
            gameState.on = g.on;
            gameState.pending = !!g.pending;
            if (g.pending) APL.toast(APL.t("Game Mode requested: it will turn on as soon as you switch to HDMI or USB-C"), true);
            else APL.toast(g.on ? APL.t("Game Mode on") : APL.t("Game Mode off"), true);
            if (isOpen) refresh();
            // Game Mode has its own brightness: the slider picks up the screen's
            nav.tiles.forEach(function (t) {
                if (t._item.type === "backlight") sys.tvItem("backlight").then(function (m) { if (m) drawBacklight(t, m.value, m); }, function () {});
            });
        }, function (e) {
            gameState.busy = false;
            APL.toast(e.message);
        });
    }

    function speakersToTv() {
        var on = (bt.list || []).filter(function (d) { return d.connected; });
        if (!on.length) { APL.toast(APL.t("Sound is already coming from the screen"), true); return; }
        on.forEach(btToggle);
    }

    function outputName() {
        var on = (bt.list || []).filter(function (d) { return d.connected; })[0];
        return on ? on.name : APL.t("TV Speakers");
    }

    /* ---------- views ---------- */
    function mainItems() {
        return [
            { cls: "big", icon: "power", title: APL.t("Sleep"),
              select: function () { sys.sleepNow().catch(function (e) { APL.toast(e.message); }); } },
            { cls: "pill", icon: "wifi", title: "Wi-Fi", tint: "#0a84ff",
              sub: function () { var n = sys.network(); return n.connected ? (n.type === "Wi-Fi" ? n.ssid : n.type) : APL.t("Disconnected"); },
              on: function () { return sys.network().connected; }, select: openSettings(APL.t("Connection")) },
            { cls: "pill", icon: "moon", title: APL.t("Do Not Disturb"), tint: "#5e5ce6",
              sub: function () { return sys.pref("dnd") ? APL.t("On") : APL.t("Off"); },
              on: function () { return sys.pref("dnd"); }, select: function () { sys.setPref("dnd", !sys.pref("dnd")); } },
            { cls: "pill", icon: "source", title: APL.t("Sources"), sub: function () { return APL.t("HDMI, USB-C, AirPlay"); },
              select: function () { close(); if (APL.sources) APL.sources.open(); } },
            { cls: "pill", icon: "gear", title: APL.t("Settings"), sub: function () { return APL.t("All settings"); },
              select: openSettings() },
            { cls: "pill", icon: "airplayAudio", title: "Audio", sub: outputName, select: function () { show("audio"); } },
            { cls: "pill", icon: "timer", title: APL.t("Sleep Timer"), tint: "#ff9f0a", sub: remaining,
              on: function () { return !!sys.pref("sleepAt"); },
              select: function () {
                  var i = TIMERS.indexOf(sys.pref("sleepTimer"));
                  var next = TIMERS[(i + 1) % TIMERS.length];
                  sys.armSleepTimer(next);
                  APL.toast(next ? APL.t("Going to sleep in {n} min", { n: next }) : APL.t("Sleep Timer off"), true);
              } },
            { cls: "slider", type: "backlight", icon: "sun", title: APL.t("Brightness") }
        ];
    }

    function audioItems() {
        var list = bt.list || [], out = [{ cls: "head", title: "Audio" }];
        var phones = list.filter(function (d) { return d.kind === "headphones"; });
        var speakers = list.filter(function (d) { return d.kind === "speaker"; });
        var any = list.some(function (d) { return d.connected; });
        function devRow(d) {
            return { cls: "row", icon: d.kind === "headphones" ? "headphones" : "speaker", title: d.name,
                     sub: function () { return (d.connected ? APL.t("Connected") : APL.t("Not connected")) + (d.battery != null ? " · " + d.battery + " %" : ""); },
                     check: function () { return d.connected; }, select: function () { btToggle(d); },
                     hold: function () { btForget(d); } };
        }
        if (phones.length) {
            out.push({ cls: "section", title: APL.t("Headphones") });
            phones.forEach(function (d) { out.push(devRow(d)); });
        }
        out.push({ cls: "section", title: APL.t("Speakers") });
        out.push({ cls: "row", icon: "display", title: APL.t("TV Speakers"), sub: function () { return APL.t("Samsung screen"); },
                   check: function () { return !any; }, select: speakersToTv });
        speakers.forEach(function (d) { out.push(devRow(d)); });
        out.push({ cls: "section", title: bt.failed ? APL.t("Bluetooth list unavailable") : APL.t("Other Devices") });
        out.push({ cls: "row", icon: "bluetooth", title: APL.t("Pair AirPods or Headphones…"),
                   sub: function () { return APL.t("Searches for nearby devices"); },
                   select: function () { show("pair"); } });
        return out;
    }

    function pairItems() {
        var out = [{ cls: "head", title: APL.t("Pair a Device") }];
        var found = Object.keys(scan.found).map(function (k) { return scan.found[k]; });
        out.push({ cls: "section", title: scan.on ? APL.t("Searching…") : APL.t("Devices Found") });
        found.forEach(function (d) {
            out.push({ cls: "row", icon: d.kind === "headphones" ? "headphones" : "speaker", title: d.name,
                       sub: function () { return scan.pairing === d.address ? APL.t("Pairing…") : APL.t("OK to pair"); },
                       select: function () { btPair(d); } });
        });
        if (!found.length && !scan.on) {
            out.push({ cls: "row", icon: "bluetooth", title: APL.t("No Devices Found"),
                       sub: function () { return APL.t("Make sure it's in pairing mode"); } });
        }
        out.push({ cls: "section", title: APL.t("AirPods: case open, button on the back held down") });
        out.push({ cls: "row", icon: "bluetooth", title: scan.on ? APL.t("Searching…") : APL.t("Search Again"),
                   sub: function () { return APL.t("Takes a few dozen seconds"); },
                   select: function () { if (!scan.on) scanStart(); } });
        return out;
    }

    function airplayItems() {
        return [
            { cls: "head", title: APL.t("AirPlay and iPhone") },
            { cls: "section", title: APL.t("From iPhone") },
            { cls: "row", icon: "split", title: APL.t("Mirror the Screen"),
              sub: function () { return APL.t("Control Center › Screen Mirroring › this screen"); } },
            { cls: "row", icon: "airplay", title: APL.t("Send a Video or Photos"),
              sub: function () { return APL.t("AirPlay button in the app, then choose this screen"); } },
            { cls: "row", icon: "remote", title: APL.t("iPhone as a Remote"),
              sub: function () { return APL.t("Home app: add the screen, then Control Center › Remote"); } },
            { cls: "row", icon: "lock", title: APL.t("Connection Code"),
              sub: function () { return APL.t("The screen shows it when the iPhone connects · set it in: Require Code"); },
              select: samsung(CNX + " › " + APL.t("Apple AirPlay Settings") + " › " + APL.t("Require Code")) },
            { cls: "section", title: APL.t("On the Screen") },
            { cls: "row", icon: "gear", title: APL.t("AirPlay and HomeKit Settings"),
              sub: function () { return APL.t("Screen name, passcode, HomeKit"); },
              select: samsung(CNX + " › " + APL.t("Apple AirPlay Settings")) }
        ];
    }

    /* The launcher's own glass, painted inside every tile and behind the panel:
       a pre-blurred slice of the wallpaper positioned as a lens (main.js owns
       the painting). Nothing is filtered live, so the panel costs no blur while
       the tiles animate. */
    function paintGlass() {
        var g = global.CleanFrameGlass;
        if (!g || !panel) return;
        var src = g.src(), nodes, i, n, layer, box;
        root.classList.toggle("has-glass", !!src);
        nodes = [].slice.call(panel.querySelectorAll(".apl-cc__t"));
        for (i = 0; i < nodes.length; i++) {
            n = nodes[i];
            layer = n.querySelector(".apl-cc__glass");
            if (!layer) {
                layer = document.createElement("i");
                layer.className = "apl-cc__glass";
                n.insertBefore(layer, n.firstChild);
            }
            if (!src) { layer.style.backgroundImage = ""; layer._src = ""; layer.classList.remove("is-on"); continue; }
            if (layer._src !== src) { layer.style.backgroundImage = 'url("' + src + '")'; layer._src = src; }
            box = g.offset(layer);
            layer.style.backgroundPosition = g.lens(box.x, box.y, layer.offsetWidth, layer.offsetHeight);
            layer.classList.add("is-on");
        }
    }

    function show(v) {
        if (view === "main") lastMainIndex = nav.index;
        view = v;
        if (v === "audio") { render(); paintGlass(); btRefresh(true).then(function () { if (isOpen && view === "audio") render(); }); return; }
        render();
        paintGlass();
        if (v === "pair") scanStart();
    }

    /* ---------- rendering ---------- */
    /* A tile is redrawn whenever a value arrives from the screen, and each
       redraw replaces its contents - so the glass layer is lifted out and put
       back at the bottom, instead of being thrown away with the rest. */
    function fill(t, html) {
        var layer = t.querySelector(".apl-cc__glass");
        t.innerHTML = html;
        if (layer) t.insertBefore(layer, t.firstChild);
    }

    function draw(it, t) {
        if (it.cls === "avatar") return;
        var on = it.on && it.on();
        t.classList.toggle("is-on", !!on);
        if (it.tint) t.style.setProperty("--tint", it.tint);
        if (it.cls === "slider") { drawBacklight(t, null, null); return; }
        if (it.cls === "round") { fill(t, APL.icon(it.icon, 44, 1.9)); return; }
        if (it.cls === "big") {
            fill(t, '<span class="apl-cc__bigico">' +
                APL.icon(it.icon, 92, 1.7).replace('<svg ', '<svg style="width:92px;height:92px" ') +
                '</span><span class="apl-cc__title">' + it.title + '</span>');
            return;
        }
        var check = it.check ? '<span class="apl-cc__check">' + (it.check() ? APL.icon("check", 30, 2.6) : "") + '</span>' : "";
        fill(t, '<span class="apl-cc__ico">' + APL.icon(it.icon, it.cls === "row" ? 32 : 38, 2) + '</span>' +
            '<span class="apl-cc__txt"><span class="apl-cc__title">' + it.title + '</span>' +
            (it.sub ? '<span class="apl-cc__sub">' + it.sub() + '</span>' : '') + '</span>' + check);
    }

    function drawBacklight(t, v, meta) {
        var pct = (v === null || !meta) ? 0 : Math.round(100 * (v - meta.min) / Math.max(1, meta.max - meta.min));
        fill(t, '<span class="apl-cc__ico">' + APL.icon("sun", 38, 2) + '</span>' +
            '<span class="apl-cc__bar"><i style="width:' + pct + '%"></i></span>' +
            '<span class="apl-cc__val">' + (v === null ? "—" : v) + '</span>');
    }

    function render() {
        var keep = nav.index;                  // Bluetooth search: the list grows, focus stays in place
        items = view === "main" ? mainItems() : view === "audio" ? audioItems() : view === "pair" ? pairItems() : airplayItems();
        body.innerHTML = "";
        body.className = "apl-cc__body apl-cc__body--" + view;
        scrollY = 0;
        body.style.transform = "translateY(0)";
        var focusables = [], rounds = null;
        captionEl = null;
        items.forEach(function (it) {
            if (it.cls === "head") {
                var h = el("div", "apl-cc__sheethead", APL.icon("chevron", 30, 2.6) + "<span></span>");
                h.lastChild.textContent = it.title;
                body.appendChild(h);
                return;
            }
            if (it.cls === "section") {
                var s = el("div", "apl-cc__section");
                s.textContent = it.title;
                body.appendChild(s);
                return;
            }
            var t = el("div", "apl-cc__t apl-cc__t--" + it.cls);
            t._item = it;
            t.appendChild(el("i", "apl-cc__glass"));
            draw(it, t);
            if (it.cls === "round") {
                if (!rounds) { rounds = el("div", "apl-cc__rounds"); body.appendChild(rounds); }
                rounds.appendChild(t);
            } else {
                if (rounds && it.cls !== "round") { body.appendChild(captionEl = el("div", "apl-cc__caption")); rounds = null; }
                body.appendChild(t);
            }
            focusables.push(t);
        });
        focusables.forEach(function (t) {
            if (t._item.type === "backlight") {
                sys.tvItem("backlight").then(function (m) {
                    if (m) drawBacklight(t, m.target !== undefined ? m.target : m.value, m);
                }, function () {});
            }
        });
        if (view === "main") {
            // The avatar at the top right: the household's profiles
            avatarEl._item = { cls: "avatar", title: APL.t("Profiles"), select: function () { close(); if (APL.profilesUI) APL.profilesUI.open(); } };
            focusables.unshift(avatarEl);
        }
        nav.setTiles(focusables);
        var start = view === "main" ? Math.min(lastMainIndex, focusables.length - 1) : 0;
        // Audio sub-panel: the connected device first, as on tvOS
        if (view === "audio" && !keepFocus) focusables.forEach(function (t, i) { if (t._item.check && t._item.check() && !start) start = i; });
        if (view === "pair" || keepFocus) start = Math.min(keep || 0, focusables.length - 1);
        nav.focus(start);
        /* Every render rebuilds the tiles, so the glass is put back under them -
           now, and again once the frame has settled, because the values that
           arrive from the screen redraw their own tile after this call. */
        paintGlass();
        scheduleGlass();
    }

    function scheduleGlass() {
        clearTimeout(glassTimer);
        glassTimer = setTimeout(paintGlass, 60);
    }

    function captionOf(it) {
        if (it.cls !== "round") return "";
        return it.sub ? it.title + " · " + it.sub() : it.title;
    }

    function refresh() {
        nav.tiles.forEach(function (t) { if (t._item.type !== "backlight") draw(t._item, t); });
        if (captionEl && nav.current()) captionEl.textContent = captionOf(nav.current()._item);
        var d = new Date(), h = d.getHours(), m = String(d.getMinutes()).padStart(2, "0");
        timeEl.textContent = sys.pref("clock24") ? String(h).padStart(2, "0") + ":" + m : ((h % 12) || 12) + ":" + m;
        if (APL.profilesUI) APL.profilesUI.paint(avatarEl, sys.profiles.current());
    }

    function ensureVisible(t) {
        var view = 900, top = t.offsetTop, h = t.offsetHeight;
        if (top + scrollY < 0) scrollY = -top + 10;
        else if (top + h + scrollY > view) scrollY = view - top - h;
        body.style.transform = "translateY(" + scrollY + "px)";
    }

    function buildDom() {
        root = el("section", "apl-cc");
        root.appendChild(el("div", "apl-cc__dim"));
        panel = el("div", "apl-cc__panel");
        var head = el("header", "apl-cc__head");
        timeEl = el("div", "apl-cc__time");
        var icons = el("div", "apl-cc__heads");
        /* The three small options beside the profile: search, the Home
           centre, and the settings sheet. Bound by data-ccopt below, so they
           work from the first open rather than only once this DOM is built. */
        [["search", "search", "Search"], ["home", "home", "Home"], ["settings", "sliders", "Settings"]]
            .forEach(function (o) {
                var b = el("span", "apl-cc__mini", APL.icon(o[1], 22, 2));
                b.setAttribute("role", "button");
                b.setAttribute("aria-label", o[2]);
                b.setAttribute("data-ccopt", o[0]);
                icons.appendChild(b);
            });
        avatarEl = el("span", "apl-cc__avatar");
        avatarEl.setAttribute("role", "button");
        avatarEl.setAttribute("aria-label", "Profiles");
        avatarEl.setAttribute("data-ccopt", "profiles");
        icons.appendChild(avatarEl);
        head.appendChild(timeEl); head.appendChild(icons);
        viewport = el("div", "apl-cc__viewport");
        body = el("div", "apl-cc__body");
        viewport.appendChild(body);
        panel.appendChild(head); panel.appendChild(viewport);
        root.appendChild(panel);
        APL.layer().appendChild(root);



        nav = new APL.Nav({
            onFocus: function (i, t) {
                ensureVisible(t);
                if (captionEl) captionEl.textContent = captionOf(t._item);
            },
            onSelect: function (i, t) {
                var it = t._item;
                if (it.type === "backlight") {
                    sys.tvItem("backlight").then(function (m) { if (!m || !m.writable) APL.toast(APL.t("Brightness unavailable right now")); },
                                                 function (e) { APL.toast(e.message); });
                    return;
                }
                if (it.select) it.select();
                if (isOpen && nav.tiles.indexOf(t) !== -1) refresh();
            },
            canHold: function (i) { var t = nav.tiles[i]; return !!(t && t._item && t._item.hold); },
            onLongPress: function (i, t) { if (t._item.hold) t._item.hold(); },
            onBack: function () {
                if (view === "pair") { scanStop(); show("audio"); return; }
                if (view !== "main") { view = "main"; render(); return; }
                close();
            },
            onKey: function (code) {
                var t = nav.current(), it = t && t._item;
                if (it && it.type === "backlight" && (code === K.LEFT || code === K.RIGHT)) {
                    sys.tvAdjust("backlight", code === K.RIGHT ? 2 : -2, function (v, meta) { drawBacklight(t, v, meta); })
                        .catch(function (e) { APL.toast(e.message); });
                    return true;
                }
                return false;
            }
        });
    }

    function open() {
        /* The Home centre and this sheet are alternatives, never a stack. */
        if (global.CleanFrameSettings && CleanFrameSettings.closeControl) CleanFrameSettings.closeControl();
        if (!root) buildDom();
        view = "main";
        lastMainIndex = 2;                      // Wi-Fi (after the avatar and Sleep): never "Sleep" by mistake
        render();
        refresh();
        root.classList.add("is-open");
        document.body.classList.add("has-cc");
        paintGlass();
        APL.pushNav(nav);
        isOpen = true;
        btRefresh(false).then(function () { if (isOpen && view === "main") refresh(); });
        gameRefresh();
        sys.readSleepTimer().then(function () { if (isOpen && view === "main") refresh(); });
    }

    function close() {
        if (!isOpen) return;
        scanStop();
        root.classList.remove("is-open");
        document.body.classList.remove("has-cc");
        APL.popNav(nav);
        isOpen = false;
    }

    setInterval(function () { if (isOpen) refresh(); }, 15000);

    /* Play/Pause closes the panel even while its own focus engine owns the
       remote: a hotkey is handled ahead of the active screen. */
    if (APL.addHotkey) {
        APL.addHotkey(function (code) {
            if (code !== 10252 || !isOpen) return false;
            close();
            return true;
        });
    }

    /* The capsule's small Control Centre button lives outside this module's
       DOM, so it is bound here, once, rather than when the sheet is built. */
    document.addEventListener('click', function (e) {
        var n = e.target;
        while (n && n !== document.body) {
            if (n.getAttribute && n.getAttribute('data-ccopt')) {
                var what = n.getAttribute('data-ccopt');
                e.preventDefault(); e.stopPropagation();
                close();
                /* A frame is too early: this sheet's own close path runs after
                   it and closes the panel again. Wait for the sheet to settle. */
                setTimeout(function () {
                    var set = global.CleanFrameSettings;
                    if (!set) return;
                    if (what === 'profiles') { if (APL.profilesUI) APL.profilesUI.open(); return; }
                    if (what === 'home' && set.home) set.home();
                    else if (what === 'search' && set.search) set.search();
                    else if (what === 'settings' && set.open) set.open();
                }, 260);
                return;
            }
            if (n.id === 'pillCC') {
                e.preventDefault(); e.stopPropagation();
                /* Open only: the capsule hides while the sheet is up, and a
                   second handler on the same press must not close it again. */
                if (!document.querySelector('.apl-cc.is-open')) APL.controlCenter.open();
                return;
            }
            n = n.parentNode;
        }
    }, true);

    APL.controlCenter = {
        open: open, close: close, isOpen: function () { return isOpen; }, glass: paintGlass,
        toggle: function () { if (isOpen) close(); else open(); },
        openAirPlay: function () { open(); show("airplay"); },
        openAudio: function () { open(); show("audio"); }
    };
})(window);
