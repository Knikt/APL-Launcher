/* ============================================================
   services.js — Settings › General › Samsung Services.

   Stops the Samsung services the launcher no longer needs from starting
   automatically. Nothing is uninstalled or disabled: they stay on the
   screen, and "Restore All" brings back what was blocked (the
   original settings are kept here).

   Never here: the Samsung home, Vetro, TizenBrew, Bluetooth and
   AirPods, AirPlay, the HDMI sources, the Samsung account (the App Store
   needs it) and whatever Vetro classes as required by the system.
   ============================================================ */
(function (global) {
    "use strict";

    var APL = global.APL, sys = APL.sys;
    var CUT_KEY = "servicesCut";        // { id: { onboot, autorestart } } as they were before

    var GROUPS = [
        { id: "tracking", label: APL.t("Tracking and ads"),
          desc: APL.t("Recognition of what you watch and analysis for targeted ads."),
          ids: ["com.samsung.tv.acr", "com.samsung.tv.cis", "com.samsung.tv.canalysis-service"] },
        { id: "voice", label: APL.t("Alexa, Bixby and Samsung voice"),
          desc: APL.t("Alexa on the remote's microphone button and Voice Guide will stop working. The Echo Dot does not depend on them."),
          ids: ["com.samsung.tv.bixby-prov", "com.samsung.tv.farfieldvoice", "com.samsung.tv.ondevice-voice",
                "com.samsung.tv.utterance-recommender-core", "com.samsung.tv.vif", "com.samsung.tv.wakeup-engine-alexa",
                "com.samsung.tv.wakeup-engine-bixby", "com.samsung.tv.wakeupless", "org.tizen.tts-engine-neural", "org.tizen.voice-client"] },
        { id: "smartthings", label: APL.t("SmartThings and connected devices"),
          desc: APL.t("SmartThings, Multi Control and the link with your Samsung phone."),
          ids: ["com.samsung.tizen.smartthings-client", "com.samsung.tizen.smartthings-thing", "com.samsung.tv.mde-framework",
                "com.samsung.tv.smartthingsfind-daemon", "com.samsung.tv.tvsensor-iot-service", "com.samsung.tv.vd-sc-client-service",
                "com.samsung.tv.iot-hub-control", "com.samsung.tv.health-mde-service", "com.samsung.tv.MultiControl-Service"] },
        { id: "other", label: APL.t("Gaming Hub and AI sound"),
          desc: APL.t("Gaming Hub, adaptive sound, wireless music content and setup from a phone."),
          ids: ["com.samsung.tv.ghdaemon", "com.samsung.tv.aisound-app", "com.samsung.tv.waapp-contents-provider", "org.tizen.easysetup-daemon"] }
    ];

    function saved() { return sys.pref(CUT_KEY) || {}; }

    function isCut(group) {
        var s = saved();
        return group.ids.every(function (id) { return id in s; });
    }

    function act(body) {
        return sys.vetroPost("/components/action", body).then(function (r) { return !!(r && r.ok); }, function () { return false; });
    }

    /* One service at a time: Vetro runs everything in sequence, and Home must keep responding. */
    function eachInTurn(list, step) {
        return list.reduce(function (chain, item) {
            return chain.then(function () { return step(item); });
        }, Promise.resolve());
    }

    /* Takes effect at the next full start-up: the screen only rereads these settings at that point.
       On the M8, a service closed before then comes back in under 30 s, and then takes more memory. And at
       start-up, the system still launches some of them: the launcher closes them afterwards (bootCleanup). */
    function cut(groups) {
        var ids = [];
        groups.forEach(function (g) { ids = ids.concat(g.ids); });
        var memo = saved(), done = 0;
        ids = ids.filter(function (id) { return !(id in memo); });
        if (!ids.length) return Promise.resolve();
        APL.toast(APL.t("Blocking {n} services…", { n: ids.length }), true);
        return sys.vetroGet("/apps").then(function (inv) {
            var byId = {};
            ((inv && inv.apps) || []).forEach(function (r) { byId[r.appId] = r; });
            return eachInTurn(ids, function (id) {
                var r = byId[id];
                if (!r || r.protected) return null;       // not on this screen, or protected by Vetro: leave it alone
                var work = [];
                if (r.onboot) work.push({ appId: id, action: "flags", flag: "onboot", enabled: false });
                if (r.autorestart) work.push({ appId: id, action: "flags", flag: "autorestart", enabled: false });
                var good = true;
                return eachInTurn(work, function (b) { return act(b).then(function (ok) { good = good && ok; }); }).then(function () {
                    if (!good) return null;
                    memo[id] = { onboot: !!r.onboot, autorestart: !!r.autorestart };
                    sys.setPref(CUT_KEY, memo);
                    done++;
                    return null;
                });
            });
        }).then(function () {
            APL.toast(APL.t("{n} services blocked: takes effect the next time the screen restarts", { n: done }), true);
        });
    }

    function restore(groups) {
        var memo = saved(), ids = [];
        groups.forEach(function (g) { g.ids.forEach(function (id) { if (id in memo) ids.push(id); }); });
        if (!ids.length) return Promise.resolve();
        APL.toast(APL.t("Restoring {n} services…", { n: ids.length }), true);
        return eachInTurn(ids, function (id) {
            var was = memo[id], work = [];
            if (was.onboot) work.push({ appId: id, action: "flags", flag: "onboot", enabled: true });
            if (was.autorestart) work.push({ appId: id, action: "flags", flag: "autorestart", enabled: true });
            return eachInTurn(work, act).then(function () {
                delete memo[id];
                sys.setPref(CUT_KEY, memo);
            });
        }).then(function () { APL.toast(APL.t("Services restored: they will come back the next time the screen starts"), true); });
    }

    /* Alexa on the microphone button. The microphone router (multi-assistant) hands the microphone to the
       assistant chosen when the button is held; the optimizer disabled it along with all the voice assistants.
       Here: the voice services blocked above come back, Vetro re-enables the router, then Samsung's
       Voice menu opens on "Voice Assistant": choosing Amazon Alexa starts the Amazon sign-in.
       Tried on the M8: the Alexa app launched on its own (PAGETYPE ALEXA_LOGIN) shows nothing. */
    var MIC_HUB = "org.tizen.multi-assistant-service";
    function alexaMic() {
        return restore(GROUPS.filter(function (g) { return g.id === "voice"; })).then(function () {
            return sys.vetroGet("/apps");
        }).then(function (inv) {
            var hub = ((inv && inv.apps) || []).filter(function (r) { return r.appId === MIC_HUB; })[0];
            if (!hub) throw new Error(APL.t("No Alexa on this screen"));
            var on = !hub.disabled ? Promise.resolve() : sys.vetroPost("/quick", { id: "voice-all", off: false }).then(function (r) {
                if (!r || !r.ok) throw new Error(APL.t("Vetro did not turn the microphone back on"));
            });
            return on.then(function () {
                return eachInTurn(["onboot", "autorestart"].filter(function (f) { return !hub[f]; }), function (f) {
                    return act({ appId: MIC_HUB, action: "flags", flag: f, enabled: true });
                });
            });
        }).then(function () {
            return sys.exec("app_launcher -s " + MIC_HUB + " >/dev/null 2>&1; " +
                            "app_launcher -s org.tizen.menu menuitem general-voice-voice-assistant >/dev/null 2>&1; true");
        });
    }

    function failed(e) { APL.toast((e && e.message) || APL.t("Vetro is not responding")); }

    var busy = false;
    function run(work) {
        if (busy) return Promise.resolve();
        busy = true;
        function end() { busy = false; }
        return work().then(end, function (e) { end(); failed(e); });
    }

    APL.services = {
        groups: GROUPS,
        isCut: isCut,
        toggle: function (group) { return run(function () { return isCut(group) ? restore([group]) : cut([group]); }); },
        cutAll: function () { return run(function () { return cut(GROUPS); }); },
        restoreAll: function () { return run(function () { return restore(GROUPS); }); },
        alexaMic: function () { return run(alexaMic); }
    };
})(window);
