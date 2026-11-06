/* ============================================================
   profiles.js — the household's profiles, as on Apple TV.
   Ported from APL Launcher for TizenOS (MIT, c 2026 Knikt), with
   CleanFrame's storage in place of their bridge.

   At the top right of the Control Center: one circle per person (their
   colour, their avatar), a check mark on the active profile, "+" to add
   someone. Each profile keeps its own Home Screen — order, folders,
   wallpaper and look — because switching swaps the launcher's own saved
   state for that profile's saved state.

   OK: switch profile. Hold OK: avatar, name, colour, delete.
   Opens from the Control Center and from Settings.
   ============================================================ */
(function (global) {
    "use strict";

    var APL = global.APL;
    var KEY = "cleanframe.profiles.v1";
    var SLOT = "cleanframe.profile.";
    var COLORS = ["#ff9f0a", "#30d158", "#0a84ff", "#bf5af2", "#ff375f", "#64d2ff", "#ffd60a", "#ac8e68"];
    var PEOPLE = ["baby-light", "boy-light", "child-medium-dark", "girl-dark", "girl-medium", "man-bald-medium-dark", "man-beard-medium-light", "man-blonde-hair-medium-light", "man-curly-hair-dark", "man-light", "man-medium-light", "man-red-hair-medium-light", "man-white-hair-light", "old-man-medium", "old-woman-medium-light", "person-beard-medium", "person-dark", "woman-blonde-hair-light", "woman-curly-hair-medium-dark", "woman-dark", "woman-medium", "woman-red-hair-light", "woman-white-hair-medium", "woman-with-headscarf-medium"];
    var ANIMALS = ["cat-face", "dog-face", "fox", "panda", "koala", "lion", "tiger-face", "monkey-face", "unicorn", "bear", "hamster", "frog", "alien", "robot", "ghost", "rabbit-face"];
    var AVATARS = PEOPLE.concat(ANIMALS);

    var root = null, grid = null, nav = null, isOpen = false, store = null;
    var listeners = [];

    function load(k, fallback) {
        try { var v = JSON.parse(global.localStorage.getItem(k) || "null"); return v || fallback; } catch (e) { return fallback; }
    }
    function save(k, v) { try { global.localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
    function initial(name) { return (String(name || "").trim().charAt(0) || "?").toUpperCase(); }
    function avatarSrc(k) { return "assets/avatars/" + k + ".png"; }

    /* Pastel behind an avatar, as on Apple TV */
    function pastel(hex) {
        var h = String(hex || "#0a84ff").replace("#", ""), out = "#";
        for (var i = 0; i < 3; i++) {
            var v = parseInt(h.substr(i * 2, 2), 16);
            out += ("0" + Math.round(v + (255 - v) * 0.55).toString(16)).slice(-2);
        }
        return out;
    }

    /* ---------- the household ---------- */
    function boot() {
        store = load(KEY, null);
        if (!store || !store.list || !store.list.length) {
            store = { current: "p1", list: [{ id: "p1", name: APL.t("Me"), color: COLORS[2] }] };
            save(KEY, store);
            /* The launcher's current state becomes the first profile's. */
            var key = stateKey();
            if (key) save(SLOT + "p1", global.localStorage.getItem(key) || "");
        }
        return store;
    }
    function stateKey() {
        return global.CleanFrameProfiles && global.CleanFrameProfiles.stateKey ? global.CleanFrameProfiles.stateKey() : null;
    }
    function current() {
        var s = boot();
        for (var i = 0; i < s.list.length; i++) if (s.list[i].id === s.current) return s.list[i];
        return s.list[0];
    }
    function list() { return boot().list.slice(); }

    function switchTo(id) {
        var s = boot();
        if (id === s.current) return false;
        var key = stateKey();
        if (key) save(SLOT + s.current, global.localStorage.getItem(key) || "");
        s.current = id;
        save(KEY, s);
        var mine = load(SLOT + id, null);
        if (key && mine) { try { global.localStorage.setItem(key, mine); } catch (e) {} }
        /* The launcher reads its state once at start, so a switch is a restart
           of the app's own state rather than a half-applied repaint. */
        if (global.CleanFrameProfiles && global.CleanFrameProfiles.reload) global.CleanFrameProfiles.reload();
        else global.location.reload();
        return true;
    }

    function add(name) {
        var s = boot(), n = 1, id;
        do { id = "p" + (++n); } while (s.list.some(function (p) { return p.id === id; }));
        var p = { id: id, name: name || APL.t("Profile {n}", { n: s.list.length + 1 }), color: COLORS[s.list.length % COLORS.length] };
        s.list.push(p);
        save(KEY, s);
        return p;
    }
    function update(id, fields) {
        var s = boot();
        s.list.forEach(function (p) { if (p.id === id) Object.keys(fields).forEach(function (k) { p[k] = fields[k]; }); });
        save(KEY, s);
        listeners.forEach(function (fn) { fn(current()); });
        paint();
    }
    function remove(id) {
        var s = boot();
        if (s.list.length < 2) return false;
        s.list = s.list.filter(function (p) { return p.id !== id; });
        try { global.localStorage.removeItem(SLOT + id); } catch (e) {}
        if (s.current === id) {
            s.current = s.list[0].id;
            var key = stateKey();
            var mine = load(SLOT + s.current, null);
            if (key && mine) { try { global.localStorage.setItem(key, mine); } catch (e) {} }
            if (global.CleanFrameProfiles && global.CleanFrameProfiles.reload) { save(KEY, s); global.CleanFrameProfiles.reload(); return true; }
        }
        save(KEY, s);
        paint();
        return true;
    }
    function onChange(fn) { listeners.push(fn); }

    /* ---------- the badge on the pill ---------- */
    function paintAvatar(node, p) {
        if (!node) return;
        node.className = node.className.replace(/\s*has-photo/g, "");
        node.style.background = "radial-gradient(circle at 35% 28%, rgba(255,255,255,0.45), rgba(255,255,255,0) 55%), " + p.color;
        if (p.avatar) {
            node.classList.add("has-photo");
            node.innerHTML = '<img class="apl-pf-photo" alt="" src="' + avatarSrc(p.avatar) + '">';
        } else node.textContent = initial(p.name);
    }
    /* paint(node, profile) is the ported screens' calling shape; with no node
       it refreshes the launcher's own badges (the capsule, and the Control
       Center header when it is built). */
    function paint(node, p) {
        var who = p || current();
        if (node) { paintAvatar(node, who); return; }
        paintAvatar(global.document.getElementById("statusPillAvatar"), who);
        paintAvatar(global.document.querySelector(".apl-cc__avatar"), who);
    }

    /* ---------- the panel ---------- */
    function el(tag, cls, html) {
        var e = global.document.createElement(tag);
        if (cls) e.className = cls;
        if (html !== undefined) e.innerHTML = html;
        return e;
    }

    function buildDom() {
        root = el("section", "apl-pf");
        root.appendChild(el("div", "apl-pf__dim"));
        var panel = el("div", "apl-pf__panel");
        var head = el("div", "apl-pf__head", '<h2 class="apl-pf__title">' + APL.t("Who's Watching?") + '</h2>');
        grid = el("div", "apl-pf__grid");
        panel.appendChild(head);
        panel.appendChild(grid);
        root.appendChild(panel);
        APL.layer().appendChild(root);
        nav = new APL.Nav({
            onSelect: function (i, t) { if (t._run) t._run(); },
            onLongPress: function (i, t) { if (t._profile) menu(t._profile, t); },
            onBack: close
        });
    }

    function render(focusId) {
        grid.innerHTML = "";
        var tiles = [], cur = current(), focus = 0;
        list().forEach(function (p) {
            var t = el("div", "apl-pf__item" + (p.id === cur.id ? " is-current" : ""));
            var av = el("span", "apl-pf__avatar");
            paintAvatar(av, p);
            t.appendChild(av);
            if (p.id === cur.id) t.appendChild(el("span", "apl-pf__check", APL.icon("check", 22, 3)));
            var name = el("span", "apl-pf__name");
            name.textContent = p.name;
            t.appendChild(name);
            t._profile = p;
            t._run = function () { choose(p); };
            if (p.id === (focusId || cur.id)) focus = tiles.length;
            grid.appendChild(t); tiles.push(t);
        });
        var add = el("div", "apl-pf__item apl-pf__item--add", '<span class="apl-pf__avatar">' + APL.icon("plus", 52, 2.2) + '</span><span class="apl-pf__name">' + APL.t("Add") + '</span>');
        add._run = addProfile;
        grid.appendChild(add); tiles.push(add);
        nav.setTiles(tiles);
        nav.focus(focus);
    }

    function choose(p) {
        if (p.id === current().id) { close(); return; }
        close();
        APL.toast(APL.t("Hello, {name}!", { name: p.name }), true);
        switchTo(p.id);
    }

    function addProfile() {
        var p = add();
        rename(p, function () { chooseAvatar(p); });
    }

    /* Choose an avatar: the people, then the 3D animals */
    function chooseAvatar(p) {
        var box = el("div", "apl-pf-picker", '<h2 class="apl-pf-picker__title">' + APL.t("Choose Your Avatar") + '</h2><div class="apl-pf-picker__scroll"><div class="apl-pf-picker__grid"></div></div>');
        var g = box.querySelector(".apl-pf-picker__grid"), tiles = [], at = 0;
        AVATARS.forEach(function (k, i) {
            var t = el("div", "apl-pf-picker__item");
            t.style.background = pastel(COLORS[i % COLORS.length]);
            t.innerHTML = '<img alt="" src="' + avatarSrc(k) + '">';
            t._key = k; t._color = COLORS[i % COLORS.length];
            if (k === p.avatar) at = i;
            g.appendChild(t); tiles.push(t);
        });
        APL.layer().appendChild(box);
        var ROW = 158;
        var pick = new APL.Nav({
            onFocus: function (i, t) {
                g.style.transform = "translateY(" + (-Math.max(0, Math.round(t.offsetTop / ROW) - 2) * ROW) + "px)";
            },
            onSelect: function (i, t) { update(p.id, { avatar: t._key, color: t._color }); done(); },
            onBack: done
        });
        function done() {
            APL.popNav(pick);
            if (box.parentNode) box.parentNode.removeChild(box);
            if (isOpen) render(p.id);
        }
        pick.setTiles(tiles);
        pick.focus(at);
        APL.pushNav(pick);
    }

    /* Rename: the screen's own keyboard opens for the field, as in the port */
    function rename(p, then) {
        var box = el("div", "apl-pf-prompt", '<div class="apl-pf-prompt__box"><h2 class="apl-pf-prompt__title">' + APL.t("Profile Name") + '</h2>' +
            '<input class="apl-pf-prompt__input" type="text" maxlength="20"><p class="apl-pf-prompt__hint">' + APL.t("OK to confirm · Back to cancel") + '</p></div>');
        APL.layer().appendChild(box);
        var input = box.querySelector("input"), done = false;
        input.value = p.name;
        function finish(ok) {
            if (done) return;
            done = true;
            var v = input.value.trim();
            if (ok && v) update(p.id, { name: v });
            if (box.parentNode) box.parentNode.removeChild(box);
            if (isOpen) render(p.id);
            if (then) then();
        }
        input.addEventListener("keydown", function (e) {
            if (e.keyCode === 13) { e.preventDefault(); e.stopPropagation(); finish(true); }
            else if (e.keyCode === 27 || e.keyCode === 10009) { e.preventDefault(); e.stopPropagation(); finish(false); }
        });
        input.addEventListener("blur", function () { setTimeout(function () { finish(true); }, 0); });
        setTimeout(function () { input.focus(); try { input.select(); } catch (e) {} }, 50);
    }

    /* The hold menu: avatar, name, colour, and the way out */
    function menu(p, anchor) {
        var box = el("div", "apl-pf-menu");
        var items = [
            { label: APL.t("Choose Avatar"), run: function () { chooseAvatar(p); } },
            { label: APL.t("Rename"), run: function () { rename(p); } },
            { label: APL.t("Change Color"), run: function () {
                var k = (COLORS.indexOf(p.color) + 1) % COLORS.length;
                update(p.id, { color: COLORS[k] });
            } }
        ];
        if (list().length > 1) items.push({ label: APL.t("Delete Profile"), destructive: true, run: function () {
            APL.alert({
                title: APL.t("Delete “{name}”?", { name: p.name }),
                message: APL.t("Its Home Screen layout and history will be erased."),
                buttons: [{ label: APL.t("Delete"), destructive: true, run: function () { remove(p.id); render(); } },
                          { label: APL.t("Cancel") }],
                focus: 1
            });
        } });
        var tiles = [], focus = 0;
        items.forEach(function (it) {
            var r = el("div", "apl-pf-menu__row" + (it.destructive ? " is-destructive" : ""));
            r.textContent = it.label;
            r._run = it.run;
            box.appendChild(r); tiles.push(r);
        });
        APL.layer().appendChild(box);
        var mnav = new APL.Nav({
            onSelect: function (i, t) { cleanup(); t._run(); },
            onBack: cleanup
        });
        function cleanup() {
            APL.popNav(mnav);
            if (box.parentNode) box.parentNode.removeChild(box);
            render(p.id);
        }
        mnav.setTiles(tiles);
        mnav.focus(focus);
        APL.pushNav(mnav);
    }

    function open() {
        if (!root) buildDom();
        paint();
        render();
        root.classList.add("is-open");
        global.document.body.classList.add("has-profiles");
        APL.pushNav(nav);
        isOpen = true;
    }
    function close() {
        if (!isOpen) return;
        root.classList.remove("is-open");
        global.document.body.classList.remove("has-profiles");
        APL.popNav(nav);
        isOpen = false;
    }

    /* The store the ported Control Center and Settings read (their `sys.profiles`). */
    APL.profiles = {
        current: current, list: list, switchTo: switchTo, add: add, update: update,
        remove: remove, onChange: onChange, colors: COLORS, paint: paint
    };
    /* The panel, under the name the ported screens open. */
    APL.profilesUI = {
        open: open, close: close, isOpen: function () { return isOpen; },
        paint: paint, chooseAvatar: chooseAvatar, list: list, current: current
    };

    boot();
    if (global.document.readyState === "loading") global.document.addEventListener("DOMContentLoaded", paint);
    else paint();
})(window);
