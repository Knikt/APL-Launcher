/* ============================================================
   bridge/service.js — CleanFrame's private relay to Vetro.

   Vetro (127.0.0.1:8099 on the screen) is a root service: it runs a command for
   the launcher, which is how the picture controls and the screen's own menus are
   reachable at all. What it does not do is let a web app read its answer - there
   is no CORS header - so a request from the launcher can change a value but
   never show what the value became.

   A service can read it. This one makes the request with Node's http, and hands
   the answer back over a trusted Tizen message port. Only apps signed with this
   package's certificate can open that port, and only /exec is relayed: the app
   can run a command, nothing else.

   Shape follows APL Launcher for TizenOS (MIT), trimmed to what CleanFrame uses:
   no boot launch, no wake-up watcher. The service starts when the app asks and
   exits after five minutes without a request.

   Addresses: Vetro is used through the set's own LAN address first (the owner's
   setup answers there and it survives whatever loopback rule the firmware has),
   then Tizen 9's IPv6 spelling of loopback, then plain 127.0.0.1.
   ============================================================ */
'use strict';

var http = require('http');
var os = require('os');
var fs = require('fs');

var PORT_NAME = 'CF_BRIDGE';
var MIC_PORT = 'CF_MIC';
var APP_ID = 'CfrmLs03B1.CleanFrame';
var REPLY_PORT = 'CF_BRIDGE_REPLY';
var VETRO_PORT = 8099;
var CONNECT_MS = 5000;
var ANSWER_MS = 20000;
var IDLE_MS = 5 * 60 * 1000;
var CHUNK = 4000;

/* The two paths the launcher needs: a Vetro command, and the microphone watch. */
var ALLOWED = /^\/(exec|mic)(\?|$)/;

var HOSTS = lanAddresses().concat(['::ffff:127.0.0.1', '127.0.0.1']);
var hostIndex = 0;
var port = null, idle = null;

function lanAddresses() {
  var out = [];
  try {
    var nets = os.networkInterfaces();
    Object.keys(nets).forEach(function (name) {
      (nets[name] || []).forEach(function (a) {
        if (a.family === 'IPv4' && !a.internal) out.push(a.address);
      });
    });
  } catch (e) {}
  return out;
}

function field(data, key) {
  for (var i = 0; i < data.length; i++) if (data[i].key === key) return String(data[i].value);
  return '';
}

function answer(id, status, body) {
  var back;
  try { back = tizen.messageport.requestTrustedRemoteMessagePort(APP_ID, REPLY_PORT); } catch (e) { return; }
  body = String(body || '');
  var parts = Math.max(1, Math.ceil(body.length / CHUNK));
  for (var i = 0; i < parts; i++) {
    try {
      back.sendMessage([{ key: 'id', value: id }, { key: 'status', value: String(status) },
        { key: 'part', value: String(i) }, { key: 'parts', value: String(parts) },
        { key: 'body', value: body.substr(i * CHUNK, CHUNK) }]);
    } catch (e) {}
  }
}

/* ------------------------------------------------------------
   The remote's microphone, for the listening glow.

   The screen keeps the microphone button to itself and gives it to Alexa, so an
   app cannot see it. Vetro keeps the remote, forwards its keys to a device named
   "vetro-forwarded-remote", and there the button arrives as key 216. The root
   reader below watches that device and keeps a file in /tmp while the button is
   held; nothing is intercepted, so Alexa keeps getting the press.

   The reader is written and started through Vetro once, then this service polls
   the file and tells the app. APL Launcher for TizenOS does the same thing from a
   C# overlay; the shell script is theirs, with our own file names.
   ------------------------------------------------------------ */
var MIC_FLAG = '/tmp/cf-mic';
var MIC_SCRIPT = '/tmp/cf-mic.sh';
var MIC_PID = '/tmp/cf-mic.pid';
var MIC_EVERY = 120;
var micTimer = null, micDown = null, micRequested = false;

var READER = 'echo $$ > ' + MIC_PID + '\n' +
  'mine() { [ "$(cat ' + MIC_PID + ' 2>/dev/null)" = "$$" ]; }\n' +
  'while mine; do\n' +
  '  node=$(grep -A5 \'Name="vetro-forwarded-remote"\' /proc/bus/input/devices | grep -o \'event[0-9]*\' | head -1)\n' +
  '  if [ -z "$node" ] || [ ! -r /dev/input/$node ]; then sleep 2; continue; fi\n' +
  '  exec 3< /dev/input/$node\n' +
  '  while mine; do\n' +
  '    e=$(dd bs=16 count=1 <&3 2>/dev/null | od -An -v -tx1 | tr -d \' \\n\')\n' +
  '    [ ${#e} -eq 32 ] || break\n' +
  '    case "$e" in\n' +
  '      ????????????????0100d80001000000) touch ' + MIC_FLAG + ' ;;\n' +
  '      ????????????????0100d80000000000) rm -f ' + MIC_FLAG + ' ;;\n' +
  '    esac\n' +
  '  done\n' +
  '  exec 3<&-\n' +
  '  rm -f ' + MIC_FLAG + '\n' +
  '  sleep 1\n' +
  'done; exit 0\n';

function pushMic(state) {
  var back;
  try { back = tizen.messageport.requestTrustedRemoteMessagePort(APP_ID, MIC_PORT); } catch (e) { return; }
  try { back.sendMessage([{ key: 'mic', value: state }]); } catch (e) {}
}

/* Started once. A newer script takes the pid file, and the old one stops at its
   next key. The screen refuses to run a script file that Samsung did not sign
   ("the file is NOT signed") but runs the same text through sh -c. */
function startReader() {
  var code = Buffer.from(READER, 'utf8').toString('base64');
  var cmd = 'echo ' + code + ' | base64 -d > ' + MIC_SCRIPT + '; ' +
    'kill -0 $(cat ' + MIC_PID + ' 2>/dev/null) 2>/dev/null || ' +
    '{ cp ' + MIC_SCRIPT + ' ' + MIC_SCRIPT + '.run; ' +
    'sh -c "$(cat ' + MIC_SCRIPT + '.run)" >/dev/null 2>&1 & }';
  vetro('/exec', Buffer.from(JSON.stringify({ cmd: cmd }), 'utf8'), function (status, text) {
    var parsed = null;
    try { parsed = JSON.parse(text); } catch (e) { parsed = null; }
    if (parsed && parsed.ok) pushMic(probeMic() ? 'down' : 'up');
  });
}

function probeMic() {
  try { return fs.existsSync(MIC_FLAG); } catch (e) { return false; }
}

function watchMic() {
  if (!micRequested) {
    micRequested = true;
    try { fs.unlinkSync(MIC_FLAG); } catch (e) {}
    micDown = false;
    startReader();
  }
  if (micTimer) return;
  micTimer = setInterval(function () {
    var down = probeMic();
    if (down === micDown) return;
    micDown = down;
    pushMic(down ? 'down' : 'up');
  }, MIC_EVERY);
}

function stopLater() {
  clearTimeout(idle);
  /* While the microphone is being watched the service stays up: it is the only
     thing that can see the button. Everything else still exits after idling. */
  if (micTimer) return;
  idle = setTimeout(function () {
    try { tizen.application.getCurrentApplication().exit(); } catch (e) {}
  }, IDLE_MS);
}

function vetro(path, buf, done, retries) {
  if (retries === undefined) retries = HOSTS.length - 1;
  var host = HOSTS[hostIndex], finished = false, timer = null, socketTimer = null;

  function finish(status, text) {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    clearTimeout(socketTimer);
    done(status, text);
  }
  function fail(e) {
    if (finished) return;
    if (retries > 0 && /EHOSTUNREACH|EACCES|ECONNREFUSED|ENETUNREACH|EINVAL|ETIMEDOUT/.test(e.code)) {
      finished = true;
      clearTimeout(timer);
      clearTimeout(socketTimer);
      if (HOSTS[hostIndex] === host) hostIndex = (hostIndex + 1) % HOSTS.length;
      vetro(path, buf, done, retries - 1);
      return;
    }
    finish(502, JSON.stringify({ ok: false, error: 'Vetro unreachable: ' + e.message }));
  }

  var req;
  try {
    req = http.request({
      host: host, port: VETRO_PORT, path: path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': buf.length }
    }, function (res) {
      var chunks = [];
      res.on('data', function (c) { chunks.push(c); });
      res.on('end', function () { finish(res.statusCode || 502, Buffer.concat(chunks).toString('utf8')); });
    });
  } catch (e) {
    finish(502, JSON.stringify({ ok: false, error: 'Vetro unreachable: ' + e.message }));
    return;
  }
  req.on('error', fail);
  timer = setTimeout(function () {
    var e = new Error('no answer from ' + host);
    e.code = 'ETIMEDOUT';
    fail(e);
    try { req.abort(); } catch (x) {}
  }, CONNECT_MS);
  req.on('socket', function (sock) {
    function connected() {
      clearTimeout(timer);
      timer = setTimeout(function () {
        finish(504, JSON.stringify({ ok: false, error: 'Vetro did not answer in time' }));
        try { req.abort(); } catch (x) {}
      }, ANSWER_MS);
    }
    if (sock.connecting) sock.once('connect', connected); else connected();
  });
  req.end(buf);
}

function onMessage(data) {
  stopLater();
  var id = field(data, 'id'), path = field(data, 'path') || '/exec', body = field(data, 'body');
  if (!ALLOWED.test(path)) { answer(id, 404, '{"ok":false,"error":"not relayed"}'); return; }
  if (path.indexOf('/mic') === 0) {
    watchMic();
    answer(id, 200, JSON.stringify({ ok: true, down: probeMic() }));
    return;
  }
  vetro(path, Buffer.from(body || '', 'utf8'), function (status, text) {
    answer(id, status, text);
  });
}

function start() {
  stopLater();
  if (port) return;
  try {
    port = tizen.messageport.requestTrustedLocalMessagePort(PORT_NAME);
    port.addMessagePortListener(onMessage);
  } catch (e) { port = null; }
}

module.exports.onStart = function () { start(); };
module.exports.onRequest = function () { start(); };
module.exports.onExit = function () {
  clearTimeout(idle);
  if (micTimer) { clearInterval(micTimer); micTimer = null; }
  port = null;
};
/* Some runtimes load the script without calling onStart. */
try { start(); } catch (e) {}
