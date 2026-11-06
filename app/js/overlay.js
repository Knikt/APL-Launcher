/* ============================================================
   overlay.js — the link with APL Overlay (overlay/ folder), the native app
   that shows Control Center on top of a video.

   The Pause, Samsung TV Plus and Prime Video keys go to the overlay (Vetro
   rules): see overlay/Program.cs. The launcher starts it hidden so that it
   responds right away, and passes it the theme, the "Return to the Launcher"
   setting and the delay for closing background apps.

   The Home key belongs to Samsung. Earlier setup runs could hand it to the
   overlay or to the launcher (the physical_63 rule); that rule is removed at
   every start, so pressing Home opens Samsung's own Home Screen again. With no
   overlay installed the other keys go back to Samsung too, and an alert says
   what was changed.
   ============================================================ */
(function (global) {
    "use strict";

    var APL = global.APL, sys = APL.sys;
    var OVERLAY = "apl.launcher.overlay", LAUNCHER = "APLauncher.Home", HOME_RULE = "physical_63";
    var installed = false, light = false;

    /* The apps the Echo can open: "Name=app:id", Home Screen first (the first ones
       are used the most). No ";" or "=" in a name, and few enough apps to stay readable
       in the Alexa app. */
    var ALEXA_APPS = 16;
    var IDLE_MINUTES = 10;          // an app in the background for this long is closed
    function alexaList() {
        return ((APL.allApps && APL.allApps()) || []).filter(function (a) {
            return !a.folder && a.id !== "apl.settings" && a.id !== "apl.sources";
        }).slice(0, ALEXA_APPS).map(function (a) {
            return String(a.name).replace(/[;=]/g, " ") + "=app:" + a.id;
        }).join(";");
    }

    /* The Home Screen apps, which the overlay closes when they stay in the background (overlay/IdleApps.cs):
       never a service. A virtual tile counts as the app it opens (TizenTube: TizenBrew). */
    function homeApps() {
        return ((APL.allApps && APL.allApps()) || []).map(function (a) {
            return a.folder ? "" : a.virtual ? (a.needs || "") : a.id;
        }).filter(function (id) { return /^[A-Za-z0-9_.-]+$/.test(id); }).join(";");
    }

    function send() {
        if (!installed || sys.PREVIEW) return;
        try {
            var T = global.tizen;
            var data = [new T.ApplicationControlData("apl_action", ["stay"]),
                        new T.ApplicationControlData("apl_theme", [light ? "light" : "dark"]),
                        new T.ApplicationControlData("apl_return", [sys.pref("homeReturn") ? "1" : "0"]),
                        new T.ApplicationControlData("apl_alexa_on", [sys.pref("alexaBridge") ? "1" : "0"]),
                        new T.ApplicationControlData("apl_alexa", [alexaList()]),
                        new T.ApplicationControlData("apl_idle", [sys.pref("idleClose") ? String(IDLE_MINUTES) : "0"]),
                        new T.ApplicationControlData("apl_apps", [homeApps()]),
                        new T.ApplicationControlData("apl_lang", [APL.lang || "en"])];
            var ctl = new T.ApplicationControl("http://tizen.org/appcontrol/operation/default", null, null, null, data);
            T.application.launchAppControl(ctl, OVERLAY, function () {}, function () {});
        } catch (e) {}
    }

    /* The Smart Hub tile: the overlay opens Samsung's home and leaves it on screen until something
       else comes in front (overlay/Program.cs, apl_action samsung_home). */
    function openSamsungHome() {
        if (!installed || sys.PREVIEW) return;
        try {
            var T = global.tizen;
            var ctl = new T.ApplicationControl("http://tizen.org/appcontrol/operation/default", null, null, null,
                                               [new T.ApplicationControlData("apl_action", ["samsung_home"])]);
            T.application.launchAppControl(ctl, OVERLAY, function () {}, function () {});
        } catch (e) {}
    }

    /* Only the rules that launch our own apps are touched: Home loses its rule, so Samsung handles the
       key again, and the other keys go back to Samsung when the overlay is missing. The person at the
       screen is told what changed: nothing happens behind their back. */
    var KEY_NAMES = { "244": "⏯", "560": "Samsung TV Plus", "221": "Prime Video" };
    function keyName(rule) {
        var code = rule.trigger && String(rule.trigger.value);
        return KEY_NAMES[code] || APL.t("key {code}", { code: code });
    }
    function ours(a) {
        return a && a.type === "launch" && (a.appId === OVERLAY || a.appId === LAUNCHER);
    }
    function checkHomeRule() {
        sys.vetroGet("/remap").then(function (r) {
            var rules = (r && r.rules) || [], changed = false, home = false, freed = [];
            rules = rules.filter(function (rule) {
                /* The Home key is not ours to remap any more: drop the whole rule, whoever the
                   setup pointed it at, so Samsung handles Home again. */
                if (rule.id === HOME_RULE) { changed = true; home = true; return false; }
                var actions = rule.actions || [], mine = actions.filter(ours);
                if (!mine.length) return true;
                /* The overlay keeps the other keys while it is installed. */
                if (installed) return true;
                changed = true;
                freed.push(keyName(rule));
                rule.actions = actions.filter(function (a) { return !ours(a); });
                return rule.actions.length > 0;
            });
            if (!changed) return;
            sys.vetroPost("/remap", { rules: rules }).then(function () { tellRepaired(home, freed); }).catch(function () {});
        }, function () {});
    }
    function tellRepaired(home, freed) {
        if (!APL.alert) return;
        var keys = freed.join(", "), many = freed.length > 1, message;
        if (home && freed.length) message = many
            ? APL.t("Home now opens Samsung's Home Screen, and {keys} are back to Samsung.", { keys: keys })
            : APL.t("Home now opens Samsung's Home Screen, and {keys} is back to Samsung.", { keys: keys });
        else if (home) message = APL.t("Home now opens Samsung's Home Screen.");
        else message = many
            ? APL.t("{keys} are back to Samsung. Run APL Launcher Setup again to get the overlay back.", { keys: keys })
            : APL.t("{keys} is back to Samsung. Run APL Launcher Setup again to get the overlay back.", { keys: keys });
        APL.alert({ title: APL.t(home ? "Home is back to Samsung" : "APL Overlay is not installed"),
                    message: message, buttons: [{ label: APL.t("OK") }] });
    }

    function start() {
        if (sys.PREVIEW) return;
        APL.isInstalled(OVERLAY).then(function (yes) {
            installed = yes;
            if (yes) send();
            checkHomeRule();                 // Home always goes back to Samsung
        });
    }

    sys.onPref("homeReturn", send);
    sys.onPref("alexaBridge", send);
    sys.onPref("idleClose", send);

    APL.overlay = {
        start: start,
        setTheme: function (isLight) {
            if (isLight === light) return;
            light = isLight;
            send();
        },
        refresh: send,
        openSamsungHome: openSamsungHome,
        isInstalled: function () { return installed; }
    };
})(window);
