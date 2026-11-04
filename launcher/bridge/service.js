/* ============================================================
   bridge/service.js — private bridge between the launcher and Vetro.

   Vetro (http://127.0.0.1:8099) does not let the screen's apps read
   its answers (CORS). This service (same package as the launcher, started
   by it when needed and when the screen starts) makes the request on its behalf
   and sends the answer back. At start-up, it also opens the launcher.

   Security: NO network port is opened. The launcher and this service
   talk through trusted Tizen "message ports": only apps
   signed with the same certificate as this package can use them.
   Only the paths the launcher needs are relayed. The service
   stops on its own after 15 minutes without a request.

   Tizen 9: services go through a router (service_runner.js) that
   crashes if the app attaches a trusted reply port to its message.
   So the launcher sends its request with no port attached, and this service answers
   through its own trusted port to APL_BRIDGE_REPLY. Large
   answers are sent in several pieces (message port limit).

   Wake-up: some screens (The Frame 2025) come back on the TV input
   after sleep, even when the launcher was in front at power-off, and
   have no "Autorun Last App" setting. The launcher says when it is in
   front; the service then stays started and brings it back.
   ============================================================ */
"use strict";

var http = require("http");
var fs = require("fs");
var os = require("os");

var PORT_NAME = "APL_BRIDGE";
var APP_ID = "APLauncher.Home", REPLY_PORT = "APL_BRIDGE_REPLY";
/* Tizen 9 refuses 127.0.0.1 to services (EHOSTUNREACH), but not the same local address written in IPv6.
   Some screens (The Frame 2025) silently drop both: the connection hangs ~2 min, then ETIMEDOUT.
   The screen's own LAN address works there (Vetro listens on every interface). */
var HOSTS = ["::ffff:127.0.0.1", "127.0.0.1"].concat(lanAddresses()), VETRO_PORT = 8099, hostIndex = 0;
/* req.setTimeout never fires on these screens: own timers, one to connect, one for the answer. */
var CONNECT_MS = 5000;
// remap: the launcher repairs the Home rule without APL Overlay (overlay.js); quick: Alexa's microphone (services.js)
var ALLOWED = /^\/(status|screen|tv-settings|tv-menu|exec|components\/action|control|apps|remap|quick)(\/|\?|$)/;
var IDLE_MS = 15 * 60 * 1000;
var CHUNK = 4000;                       // characters per message (at most 12 KB once encoded)
var BOOT_WINDOW_S = 240, LAUNCH_TRIES = 5;
/* Going to sleep, the screen hides the launcher and sets memory/pm/state (1 = on); about 17 s
   later it freezes the apps, and the timer then misses its ticks (the fallback signal). */
var SLEEP_CHECKS = 4, POLL_MS = 3000, TICK_MS = 5000, ASLEEP_MS = 20000, HIDDEN_GRACE_MS = 45000;
var WAKE_WATCH_MS = 90000, SETTLE_MS = 15000;
/* The Frame: Art Mode hides the launcher but the screen stays on (memory/pm/state 1). Leaving it with the
   power key shows the TV input: watched while Art Mode is in front. */
var ART_APP = /^org\.tizen\.art-app$/, ART_POLL_MS = 1500;
var STATE = "vconftool get memory/pm/state; vconftool get memory/appfw/current_fullscreen_appid; vconftool get memory/system/source_type";

var port = null, idle = null, openedAtBoot = false;
var launcherFront = false, hiddenAt = 0, lastTick = Date.now(), ticking = null, sleeping = false, waking = false, inArt = false;

function stopLater() {
    clearTimeout(idle);
    // Stays while the launcher is in front or the screen sleeps on it, to bring it back at wake-up
    if (launcherFront || sleeping || waking || inArt) return;
    idle = setTimeout(function () {
        try { tizen.application.getCurrentApplication().exit(); } catch (e) {}
    }, IDLE_MS);
}

function field(data, key) {
    for (var i = 0; i < data.length; i++) if (data[i].key === key) return String(data[i].value);
    return "";
}

function answer(id, status, body) {
    var back;
    try { back = tizen.messageport.requestTrustedRemoteMessagePort(APP_ID, REPLY_PORT); } catch (e) { return; }
    body = String(body || "");
    var parts = Math.max(1, Math.ceil(body.length / CHUNK));
    for (var i = 0; i < parts; i++) {
        try {
            back.sendMessage([{ key: "id", value: id }, { key: "status", value: String(status) },
                              { key: "part", value: String(i) }, { key: "parts", value: String(parts) },
                              { key: "body", value: body.substr(i * CHUNK, CHUNK) }]);
        } catch (e) {}
    }
}

function onMessage(data) {
    var front = field(data, "front");
    if (front) {                        // the launcher came in front ("1") or left it ("0")
        launcherFront = front === "1";
        if (!launcherFront) { hiddenAt = Date.now(); checkSleep(SLEEP_CHECKS); }
        stopLater();
        return;
    }
    stopLater();
    var id = field(data, "id"), method = field(data, "method") || "GET", path = field(data, "path"), body = field(data, "body");
    if (!ALLOWED.test(path) || (method !== "GET" && method !== "POST")) {
        answer(id, 404, '{"error":"not relayed"}');
        return;
    }
    vetro(method, path, Buffer.from(body || "", "utf8"), 150000, function (status, text) { answer(id, status, text); });
}

/* The screen's IPv4 addresses on the network, tried after the two loopback forms. */
function lanAddresses() {
    var out = [];
    try {
        var nets = os.networkInterfaces();
        Object.keys(nets).forEach(function (name) {
            nets[name].forEach(function (a) { if (a.family === "IPv4" && !a.internal) out.push(a.address); });
        });
    } catch (e) {}
    return out;
}

/* A request to Vetro; done(status, text) is called once. */
function vetro(method, path, buf, timeoutMs, done, retries) {
    if (retries === undefined) retries = HOSTS.length - 1;
    var host = HOSTS[hostIndex], finished = false, timer = null;
    function finish(status, text) {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        done(status, text);
    }
    function fail(e) {
        if (finished) return;
        // The request did not go out (refused, or no answer to connect): try the next address
        if (retries > 0 && /EHOSTUNREACH|EACCES|ECONNREFUSED|ENETUNREACH|EINVAL|ETIMEDOUT/.test(e.code)) {
            finished = true;
            clearTimeout(timer);
            if (HOSTS[hostIndex] === host) hostIndex = (hostIndex + 1) % HOSTS.length;
            vetro(method, path, buf, timeoutMs, done, retries - 1);
            return;
        }
        finish(502, JSON.stringify({ ok: false, error: "Vetro unreachable: " + e.message }));
    }
    var req = http.request({
        host: host, port: VETRO_PORT, path: path, method: method,
        headers: { "Content-Type": "application/json", "Content-Length": buf.length }
    }, function (res) {
        var chunks = [];
        res.on("data", function (c) { chunks.push(c); });
        res.on("end", function () { finish(res.statusCode || 502, Buffer.concat(chunks).toString("utf8")); });
    });
    req.on("error", fail);
    timer = setTimeout(function () {
        var e = new Error("no answer from " + host); e.code = "ETIMEDOUT";
        fail(e);
        try { req.abort(); } catch (x) {}
    }, CONNECT_MS);
    req.on("socket", function (sock) {
        // Connected: a slow answer is only a timeout, the address is kept
        function connected() {
            clearTimeout(timer);
            timer = setTimeout(function () {
                finish(504, JSON.stringify({ ok: false, error: "Vetro did not answer in time" }));
                try { req.abort(); } catch (x) {}
            }, timeoutMs);
        }
        if (sock.connecting) sock.once("connect", connected); else connected();
    });
    req.end(buf);
}

/* ---------- wake-up ----------
   Back from sleep, if the launcher was in front at power-off: when the screen shows the TV input
   (antenna, no device) or Samsung's home, the launcher is opened again. An HDMI input (a console
   that switched the screen on), an app or the launcher itself are left alone. Vetro restarts its
   agent at wake-up: it answers again after about 15 s. */
function shell(command, done) {
    var buf = Buffer.from(JSON.stringify({ cmd: command }), "utf8");
    vetro("POST", "/exec", buf, 20000, function (status, text) {
        var out = "";
        try { out = String(JSON.parse(text).output || ""); } catch (e) {}
        done(out);
    });
}
function vconfValue(out, key) { return (new RegExp(key + ", value = (\\S+)").exec(out) || [])[1]; }

/* Screen state, app in front and source in one read: { pm: "1", app: "appId", source: 0 }. */
function readState(done) {
    shell(STATE, function (out) {
        done({ pm: vconfValue(out, "memory/pm/state"), app: vconfValue(out, "current_fullscreen_appid"),
               source: parseInt(vconfValue(out, "source_type"), 10) });
    });
}
/* The screen shows the TV input (antenna, no device) or Samsung's home: the launcher should come back. */
function onTvInput(st) { return !!st.app && ((/tv-viewer/.test(st.app) && st.source === 0) || /csfs|home\.sidebar/.test(st.app)); }

/* The launcher was just hidden: by another app, by Art Mode, or by the screen going to sleep? */
function checkSleep(tries) {
    if (sleeping || waking || inArt) return;
    readState(function (st) {
        if (st.pm && st.pm !== "1") { sleeping = true; stopLater(); watchWake(); return; }
        if (st.app && ART_APP.test(st.app)) { inArt = true; stopLater(); watchArt(); return; }
        if (tries > 1 && !launcherFront) setTimeout(function () { checkSleep(tries - 1); }, 1000);
    });
}
/* The reading that shows the wake is passed on: Vetro restarts its agent a moment later and only
   answers again after about 15 s, so reading again would keep the TV input on screen meanwhile. */
function watchWake() {
    readState(function (st) {
        if (st.pm === "1") { sleeping = false; wokeUp(true, st); return; }
        setTimeout(watchWake, POLL_MS);
    });
}
/* Art Mode in front: wait until it is left. To the TV input or Samsung's home, the launcher comes back;
   to an HDMI input (a device that switched the screen on) or another app, nothing is done. */
function watchArt() {
    if (launcherFront || !inArt) { inArt = false; stopLater(); return; }
    readState(function (st) {
        if (launcherFront) { inArt = false; stopLater(); return; }
        if (st.pm && st.pm !== "1") { inArt = false; sleeping = true; stopLater(); watchWake(); return; }   // Art Mode, then off
        if (!st.app || ART_APP.test(st.app)) { setTimeout(watchArt, ART_POLL_MS); return; }
        inArt = false;
        if (onTvInput(st)) { try { tizen.application.launch(APP_ID, function () {}, function () {}); } catch (e) {} }
        stopLater();
    });
}

/* Fallback: the apps were frozen during the sleep. */
function tick() {
    var now = Date.now();
    if (now - lastTick > ASLEEP_MS) wokeUp(launcherFront || sleeping || (hiddenAt > 0 && lastTick - hiddenAt < HIDDEN_GRACE_MS));
    lastTick = now;
}

function wokeUp(wasFront, first) {
    if (waking || !wasFront) return;
    waking = true;
    var until = Date.now() + WAKE_WATCH_MS, launcherSince = 0;
    function done() { waking = false; stopLater(); }
    function decided(st) {               // true when nothing more is needed
        if (!st || !st.app) return false;
        if (onTvInput(st)) {
            try { tizen.application.launch(APP_ID, function () {}, function () {}); } catch (e) {}
            return true;
        }
        // The Frame often wakes up in Art Mode: leaving it later is watched like any other Art Mode
        if (ART_APP.test(st.app)) { inArt = true; watchArt(); return true; }
        if (st.app !== APP_ID) return true;
        if (!launcherSince) launcherSince = Date.now();
        return Date.now() - launcherSince > SETTLE_MS;                          // the screen came back on it
    }
    if (decided(first)) { done(); return; }
    (function look() {
        readState(function (st) {
            if (decided(st) || Date.now() > until) { done(); return; }
            setTimeout(look, POLL_MS);
        });
    })();
}

function start() {
    stopLater();
    if (!ticking) ticking = setInterval(tick, TICK_MS);
    if (port) return;
    port = tizen.messageport.requestTrustedLocalMessagePort(PORT_NAME);
    port.addMessagePortListener(onMessage);
}

/* Full start-up (power cut, restart): the screen comes back on its last input and,
   with no device plugged in, its HDMI page puts it to sleep at about 78 s. This service starts with the screen,
   at about 57 s (on-boot, config.xml): opening the launcher cancels the countdown. Started later
   by the launcher, it does nothing. */
function isBooting() {
    try { return parseFloat(fs.readFileSync("/proc/uptime", "utf8")) < BOOT_WINDOW_S; } catch (e) { return false; }
}
function openLauncher(tries) {
    if (openedAtBoot || tries <= 0 || !isBooting()) return;
    function again() { setTimeout(function () { openLauncher(tries - 1); }, 3000); }
    try {
        tizen.application.getAppsContext(function (running) {
            if (running.some(function (c) { return c.appId === APP_ID; })) { openedAtBoot = true; return; }
            tizen.application.launch(APP_ID, function () { openedAtBoot = true; }, again);
        }, again);
    } catch (e) { again(); }
}

module.exports.onStart = function () { start(); openLauncher(LAUNCH_TRIES); };
// Some environments run the script without calling onStart
try { start(); openLauncher(LAUNCH_TRIES); } catch (e) {}
module.exports.onRequest = function () { start(); };
module.exports.onExit = function () { clearTimeout(idle); clearInterval(ticking); ticking = null; port = null; };
