/* ============================================================
   overlay.js — the link with APL Overlay (overlay/ folder), the native app
   that shows Control Center on top of a video.

   The Home, Pause, Samsung TV Plus and Prime Video keys go to the overlay
   (Vetro rules): see overlay/Program.cs. The launcher
   starts it hidden so that it responds right away, and passes it the theme,
   the "Return to the Launcher" setting and the delay for closing background apps.

   With no overlay installed, keys still handed to it in Vetro do nothing: at start-up the
   launcher reads the Vetro rules and tells which ones to change in Vetro's Remapper.
   It never changes them itself.
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

    /* Keys handed to the overlay while it is not there. The launcher only reads Vetro's rules and
       says which keys to change: it never writes them, the Remapper belongs to the user. */
    var KEY_NAMES = { "63": "Home", "244": "⏯", "560": "Samsung TV Plus", "221": "Prime Video" };
    function checkHomeRule() {
        sys.vetroGet("/remap").then(function (r) {
            var keys = ((r && r.rules) || []).filter(function (rule) {
                return rule.enabled !== false && (rule.actions || []).some(function (a) { return a.type === "launch" && a.appId === OVERLAY; });
            }).map(function (rule) {
                var code = rule.trigger && String(rule.trigger.value);
                return KEY_NAMES[code] || (rule.id === HOME_RULE ? "Home" : APL.t("key {code}", { code: code }));
            });
            if (!keys.length || !APL.alert) return;
            APL.alert({
                title: APL.t("APL Overlay is not installed"),
                message: APL.t("Vetro still sends {keys} to it, so these buttons do nothing. Open the Vetro dashboard (http://<screen IP>:8099) › Remapper: set Home to open APL Launcher ({app}) and delete the rules of the other buttons to give them back to Samsung.",
                               { keys: keys.join(", "), app: LAUNCHER }),
                buttons: [{ label: APL.t("OK") }]
            });
        }, function () {});
    }

    function start() {
        if (sys.PREVIEW) return;
        APL.isInstalled(OVERLAY).then(function (yes) {
            installed = yes;
            if (yes) send(); else checkHomeRule();
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
        isInstalled: function () { return installed; }
    };
})(window);
