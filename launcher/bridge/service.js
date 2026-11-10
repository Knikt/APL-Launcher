/* ============================================================
   bridge/service.js — private bridge between the launcher and Vetro.

   Vetro (http://127.0.0.1:8099, or the port it was built with) does not let the screen's apps read
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
var HOSTS = ["::ffff:127.0.0.1", "127.0.0.1"].concat(lanAddresses()), hostIndex = 0;
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
/* Right after a wake the first readings are not reliable yet (no app in front, or a short-lived one), and
   Vetro's agent drops ~1.5 s later for ~15 s: read back to back for a while, and only take another app
   for the user's choice once it has stayed in front. */
var WAKE_FAST_MS = 6000, OTHER_APP_STAYS_MS = 4000;
/* The Frame: Art Mode hides the launcher but the screen stays on (memory/pm/state 1). Leaving it with the
   power key shows the TV input: watched while Art Mode is in front. */
var ART_APP = /^org\.tizen\.art-app$/, ART_POLL_MS = 1500;
/* APL Overlay shows over the app in front and is never the one the user chose: read as no app, like FrontApp in
   overlay/bridge/Program.cs. In the launcher's package on Tizen 7 and newer, a package of its own on Tizen 6. */
var OVERLAY_APP = /^(APLauncher\.Overlay|apl\.launcher\.overlay)$/;
var STATE = "vconftool get memory/pm/state; vconftool get memory/appfw/current_fullscreen_appid; vconftool get memory/system/source_type";

var port = null, idle = null, openedAtBoot = false;
var launcherFront = false, hiddenAt = 0, lastTick = Date.now(), ticking = null, sleeping = false, waking = false, inArt = false;

/* The bridge's own log, in the package's data folder (bridge.log, like the .NET bridge's). Screens can have
   app logs turned off (dlogutil: enable_apps 0), and on The Frame 2022 (Tizen 6.5, #21) the launcher never
   got an answer with nothing to say why. Read it through Vetro: cat <that folder>/bridge.log.
   No request bodies, only paths: an /exec command can carry anything. */
var LOG_FILES = [(process.env.HOME || "/home/owner") + "/apps_rw/APLauncher/data/bridge.log",
                 "/opt/usr/home/owner/apps_rw/APLauncher/data/bridge.log", "/tmp/apl-bridge-web.log"];
var LOG_MAX = 32768, logged = {}, requestsSeen = 0;
function note(msg) {
    var line = new Date().toISOString().slice(11, 23) + " " + msg + "\n";
    for (var i = 0; i < LOG_FILES.length; i++) {
        try {
            try { if (fs.statSync(LOG_FILES[i]).size > LOG_MAX) fs.unlinkSync(LOG_FILES[i]); } catch (e) {}
            fs.appendFileSync(LOG_FILES[i], line);
            return;
        } catch (e) {}
    }
}
/* The same failure over and over: written the first 3 times only. */
function noteOnce(key, msg) {
    logged[key] = (logged[key] || 0) + 1;
    if (logged[key] <= 3) note(msg + (logged[key] === 3 ? " (not written again)" : ""));
}

/* ---------- Vetro's port ----------
   8099, unless Vetro was built with another one (VETRO_PORT=… node build.cjs), which some people do because
   another app holds 8099 (tizen-youtube; Reddit, 1.0.22): then nothing answers on 8099, or another app does.
   Checked once per run with /status. When the port is not Vetro's, 8099 is tried, then every port open on
   the screen at once, and the one that answers like Vetro is kept in the data folder (vetro-port), where the
   .NET bridge and APL Overlay of the hybrid package read it too (overlay/VetroPort.cs). */
var DEFAULT_PORT = 8099, NOT_VETRO = [8001, 8002];          // 8001/8002: the screen's own remote API
var PORT_FILES = [(process.env.HOME || "/home/owner") + "/apps_rw/APLauncher/data/vetro-port",
                  "/opt/usr/home/owner/apps_rw/APLauncher/data/vetro-port"];
/* Tried when the open ports cannot be read. */
var USUAL_PORTS = [8098, 8100, 8097, 9000, 9099, 8090, 8088, 8080, 8888, 9090, 8199, 18099];
var PROBE_CONNECT_MS = 1500, PROBE_ANSWER_MS = 3000, PORT_RETRY_MS = 30000, MAX_PROBES = 64;
var savedPort = rememberedPort() || DEFAULT_PORT, vetroPort = savedPort;
var portHow = vetroPort === DEFAULT_PORT ? "default" : "remembered", portProblem = "";
var portChecked = false, portWaiting = null, nextPortCheck = 0;

function validPort(p) { return p >= 1024 && p <= 65535 && NOT_VETRO.indexOf(p) < 0; }
function rememberedPort() {
    for (var i = 0; i < PORT_FILES.length; i++) {
        try { var p = parseInt(fs.readFileSync(PORT_FILES[i], "utf8"), 10); if (validPort(p)) return p; } catch (e) {}
    }
    return 0;
}
/* The usual port leaves no file behind. */
function rememberPort(p) {
    if (p === savedPort) return;
    savedPort = p;
    for (var i = 0; i < PORT_FILES.length; i++) {
        try {
            if (p === DEFAULT_PORT) { try { fs.unlinkSync(PORT_FILES[i]); } catch (e) {} continue; }
            fs.writeFileSync(PORT_FILES[i], String(p));
            return;
        } catch (e) {}
    }
}

/* Vetro's /status: its build ("app", with its version) and its root agent ("agent"). */
function isVetro(text) {
    try {
        var j = JSON.parse(text);
        return !!j && typeof j === "object" &&
               ((!!j.app && typeof j.app === "object" && !!j.app.version) || (!!j.agent && typeof j.agent === "object"));
    } catch (e) { return false; }
}

/* GET /status on one address and port: done("vetro"), done("other") when something else answers,
   done("refused") when nothing listens there, done("blocked") when the address itself is not reachable. */
function probe(host, port, done) {
    var finished = false, timer = null, req = null;
    function finish(kind) {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        try { req.abort(); } catch (e) {}
        done(kind);
    }
    try {
        req = http.request({ host: host, port: port, path: "/status", method: "GET" }, function (res) {
            var chunks = [], size = 0;
            res.on("data", function (c) { size += c.length; if (size > 262144) finish("other"); else chunks.push(c); });
            res.on("end", function () { finish(isVetro(Buffer.concat(chunks).toString("utf8")) ? "vetro" : "other"); });
        });
    } catch (e) { done("blocked"); return; }
    req.on("error", function (e) { finish(e && e.code === "ECONNREFUSED" ? "refused" : "blocked"); });
    timer = setTimeout(function () { finish("blocked"); }, PROBE_CONNECT_MS);
    req.on("socket", function (sock) {
        function connected() { clearTimeout(timer); timer = setTimeout(function () { finish("other"); }, PROBE_ANSWER_MS); }
        if (sock.connecting) sock.once("connect", connected); else connected();
    });
    req.end();
}

/* The ports open on the screen (LISTEN in /proc/net/tcp and tcp6), smallest first. */
function listeningPorts() {
    var ports = [];
    ["/proc/net/tcp", "/proc/net/tcp6"].forEach(function (file) {
        var lines = [];
        try { lines = fs.readFileSync(file, "utf8").split("\n").slice(1); } catch (e) {}
        lines.forEach(function (line) {
            var f = line.trim().split(/\s+/);
            if (f.length < 4 || f[3] !== "0A") return;
            var p = parseInt(f[1].split(":").pop(), 16);
            if (validPort(p) && ports.indexOf(p) < 0) ports.push(p);
        });
    });
    return ports.sort(function (a, b) { return a - b; });
}

/* Probes ports at once on one address: done(the ports that answered like Vetro, how many were tried, where they came from). */
function probeAll(host, exclude, done) {
    var ports = listeningPorts(), from = "open ports";
    if (!ports.length) { ports = USUAL_PORTS; from = "usual ports"; }
    ports = ports.filter(function (p) { return exclude.indexOf(p) < 0; }).slice(0, MAX_PROBES);
    var left = ports.length, vetros = [];
    if (!left) { done(vetros, 0, from); return; }
    ports.forEach(function (p) {
        probe(host, p, function (kind) {
            if (kind === "vetro") vetros.push(p);
            if (--left === 0) done(vetros.sort(function (a, b) { return a - b; }), ports.length, from);
        });
    });
}

/* Is vetroPort Vetro's? If not: 8099, then the open ports. done() once decided; vetroPort only changes for a port
   that answered like Vetro. */
function checkPort(done) {
    var t0 = Date.now(), tried = [vetroPort];
    function found(p, how) {
        if (p !== vetroPort || how.indexOf("found") === 0) note("Vetro on port " + p + " (" + how + ", " + (Date.now() - t0) + " ms)");
        vetroPort = p; portHow = how; portProblem = ""; portChecked = true;
        rememberPort(p);
        done();
    }
    function gaveUp(why) {
        portProblem = why;
        noteOnce("port", "Vetro's port: " + why);
        nextPortCheck = Date.now() + PORT_RETRY_MS;
        done();
    }
    function scan(host, why) {
        probeAll(host, tried, function (vetros, count, from) {
            if (vetros.length) found(vetros[0], "found among " + count + " " + from);
            else gaveUp(why + ", not among " + count + " " + from);
        });
    }
    // The first address that is not blocked (Tizen 9 refuses 127.0.0.1 to services, The Frame 2025 both loopback forms)
    (function onHost(i) {
        if (i >= HOSTS.length) { gaveUp("no address reached"); return; }
        var host = HOSTS[(hostIndex + i) % HOSTS.length];
        probe(host, vetroPort, function (kind) {
            if (kind === "blocked") { onHost(i + 1); return; }
            if (kind === "vetro") { found(vetroPort, portHow); return; }
            var why = (kind === "refused" ? "nothing on " : "another app on ") + vetroPort;
            if (vetroPort === DEFAULT_PORT) { scan(host, why); return; }
            tried.push(DEFAULT_PORT);
            probe(host, DEFAULT_PORT, function (k) { if (k === "vetro") found(DEFAULT_PORT, "default"); else scan(host, why); });
        });
    })(0);
}

/* Runs fn once Vetro's port is known: checked once per run, and again after Vetro could not be reached
   (at most every 30 s while it is not found). */
function withPort(fn) {
    if (portChecked || Date.now() < nextPortCheck) { fn(); return; }
    if (portWaiting) { portWaiting.push(fn); return; }
    portWaiting = [fn];
    checkPort(function () {
        var waiting = portWaiting;
        portWaiting = null;
        waiting.forEach(function (f) { f(); });
    });
}

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

/* The answer goes back through the launcher's trusted port (Tizen 9 refuses a port attached to the request).
   If that fails, through the port the launcher attached to its request (older screens), then through its
   plain port (APL_BRIDGE_REPLY_PLAIN, only opened on screens before Tizen 7). The way that worked is tried
   first next time, and every change of way is written in the log. */
var PLAIN_REPLY_PORT = "APL_BRIDGE_REPLY_PLAIN", route = "";
function replyRoutes(attached) {
    var all = [
        ["trusted", function () { return tizen.messageport.requestTrustedRemoteMessagePort(APP_ID, REPLY_PORT); }],
        ["attached", function () { if (!attached) throw new Error("no port attached"); return attached; }],
        ["plain", function () { return tizen.messageport.requestRemoteMessagePort(APP_ID, PLAIN_REPLY_PORT); }]
    ];
    return all.filter(function (r) { return r[0] === route; }).concat(all.filter(function (r) { return r[0] !== route; }));
}
function answer(id, status, body, attached) {
    body = String(body || "");
    var parts = Math.max(1, Math.ceil(body.length / CHUNK)), routes = replyRoutes(attached), errors = [];
    for (var r = 0; r < routes.length; r++) {
        try {
            var back = routes[r][1]();
            for (var i = 0; i < parts; i++) {
                back.sendMessage([{ key: "id", value: id }, { key: "status", value: String(status) },
                                  { key: "part", value: String(i) }, { key: "parts", value: String(parts) },
                                  { key: "body", value: body.substr(i * CHUNK, CHUNK) }]);
            }
            if (route !== routes[r][0]) {
                note("answers go through the " + routes[r][0] + " port" + (errors.length ? " (" + errors.join("; ") + ")" : ""));
                route = routes[r][0];
            }
            return;
        } catch (e) {
            errors.push(routes[r][0] + ": " + ((e && (e.name + " " + e.message)) || e));
        }
    }
    noteOnce("answer", "could not answer request " + id + ": " + errors.join("; "));
}

function onMessage(data, attached) {
    var front = field(data, "front");
    if (front) {                        // the launcher came in front ("1") or left it ("0")
        launcherFront = front === "1";
        if (!launcherFront) { hiddenAt = Date.now(); checkSleep(SLEEP_CHECKS); }
        stopLater();
        return;
    }
    stopLater();
    var id = field(data, "id"), method = field(data, "method") || "GET", path = field(data, "path"), body = field(data, "body");
    if (++requestsSeen <= 20) note("request " + id + ": " + method + " " + path.split("?")[0] + (attached ? " (port attached)" : ""));
    // Settings › Support › Link to Vetro: answered here, without Vetro, so the launcher can tell a bridge that
    // gets nothing (or cannot answer) from one that cannot reach Vetro, and which addresses failed how (#21)
    if (/^\/bridge-info(\?|$)/.test(path)) {
        var info = { bridge: "web", hosts: HOSTS, using: HOSTS[hostIndex], reached: reached, errors: hostErrors, route: route,
                     port: vetroPort, portHow: portChecked ? portHow : "not checked yet", portProblem: portProblem };
        // ?scan=1: every open port tried as Vetro would be, to check the search on a screen (nothing is changed)
        if (!/[?&]scan=1/.test(path)) { answer(id, 200, JSON.stringify(info), attached); return; }
        var t0 = Date.now();
        probeAll(reached || HOSTS[hostIndex], [], function (vetros, count, from) {
            info.scan = { vetro: vetros, tried: count, from: from, ms: Date.now() - t0 };
            answer(id, 200, JSON.stringify(info), attached);
        });
        return;
    }
    if (!ALLOWED.test(path) || (method !== "GET" && method !== "POST")) {
        answer(id, 404, '{"error":"not relayed"}', attached);
        return;
    }
    withPort(function () {
        vetro(method, path, Buffer.from(body || "", "utf8"), 150000, function (status, text) { answer(id, status, text, attached); });
    });
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

/* For /bridge-info: the address Vetro last answered on, and the last error on each address tried. */
var reached = "", hostErrors = {};

/* A request to Vetro; done(status, text) is called once. */
function vetro(method, path, buf, timeoutMs, done, retries) {
    if (retries === undefined) retries = HOSTS.length - 1;
    var host = HOSTS[hostIndex], finished = false, timer = null;
    function finish(status, text) {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        if (status > 0 && status < 500) reached = host;
        done(status, text);
    }
    function fail(e) {
        if (finished) return;
        hostErrors[host] = (e.code || "") + " " + String(e.message || "").slice(0, 60);
        noteOnce("vetro " + host, "Vetro at " + host + ": " + hostErrors[host]);
        // The request did not go out (refused, or no answer to connect): try the next address
        if (retries > 0 && /EHOSTUNREACH|EACCES|ECONNREFUSED|ENETUNREACH|EINVAL|ETIMEDOUT/.test(e.code)) {
            finished = true;
            clearTimeout(timer);
            if (HOSTS[hostIndex] === host) hostIndex = (hostIndex + 1) % HOSTS.length;
            vetro(method, path, buf, timeoutMs, done, retries - 1);
            return;
        }
        portChecked = false;            // Vetro may have moved to another port: looked for again before the next request
        finish(502, JSON.stringify({ ok: false, error: "Vetro unreachable on port " + vetroPort + ": " + e.message }));
    }
    var req = http.request({
        host: host, port: vetroPort, path: path, method: method,
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
                hostErrors[host] = "connected, no answer in " + Math.round(timeoutMs / 1000) + " s";
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
    withPort(function () {
        vetro("POST", "/exec", buf, 20000, function (status, text) {
            var out = "";
            try { out = String(JSON.parse(text).output || ""); } catch (e) {}
            done(out);
        });
    });
}
function vconfValue(out, key) { return (new RegExp(key + ", value = (\\S+)").exec(out) || [])[1]; }

/* Screen state, app in front and source in one read: { pm: "1", app: "appId", source: 0 }. */
function readState(done) {
    shell(STATE, function (out) {
        var app = vconfValue(out, "current_fullscreen_appid");
        done({ pm: vconfValue(out, "memory/pm/state"), app: app && !OVERLAY_APP.test(app) ? app : undefined,
               source: parseInt(vconfValue(out, "source_type"), 10) });
    });
}
/* The screen shows the TV input (antenna, no device) or Samsung's home: the launcher should come back. */
function onTvInput(st) { return !!st.app && ((/tv-viewer/.test(st.app) && st.source === 0) || /csfs|home\.sidebar|coba\.newhome|home\.media/.test(st.app)); }

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
    var woke = Date.now(), until = woke + WAKE_WATCH_MS, launcherSince = 0, other = null, otherSince = 0;
    function done() { waking = false; stopLater(); }
    function decided(st) {               // true when nothing more is needed
        if (!st || !st.app) return false;
        if (onTvInput(st)) {
            try { tizen.application.launch(APP_ID, function () {}, function () {}); } catch (e) {}
            return true;
        }
        // Art Mode in front at wake: leaving it later is watched like any other Art Mode
        if (ART_APP.test(st.app)) { inArt = true; watchArt(); return true; }
        if (st.app !== APP_ID) {
            // Another app: the user's choice only if it stays (wake-up screens come and go)
            if (st.app !== other) { other = st.app; otherSince = Date.now(); return false; }
            return Date.now() - otherSince >= OTHER_APP_STAYS_MS;
        }
        other = null;
        if (!launcherSince) launcherSince = Date.now();
        return Date.now() - launcherSince > SETTLE_MS;                          // the screen came back on it
    }
    if (decided(first)) { done(); return; }
    (function look() {
        readState(function (st) {
            if (decided(st) || Date.now() > until) { done(); return; }
            setTimeout(look, Date.now() - woke > WAKE_FAST_MS ? POLL_MS : 100);   // back to back at first
        });
    })();
}

function start() {
    stopLater();
    if (!ticking) ticking = setInterval(tick, TICK_MS);
    if (port) return;
    try {
        port = tizen.messageport.requestTrustedLocalMessagePort(PORT_NAME);
        port.addMessagePortListener(onMessage);
    } catch (e) {
        port = null;
        noteOnce("port", "could not open port " + PORT_NAME + ": " + ((e && (e.name + " " + e.message)) || e));
        throw e;
    }
    var up = "?";
    try { up = Math.round(parseFloat(fs.readFileSync("/proc/uptime", "utf8"))); } catch (e) {}
    note("started (Node " + process.version + ", screen up for " + up + " s), port " + PORT_NAME + " open");
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
