/* ============================================================
   siri.js — the listening glow for the remote's microphone button.

   The screen keeps that button to itself: it belongs to Alexa, and an app cannot
   claim it. So nothing here intercepts anything - the press still goes to Alexa,
   and this only shows that the set heard you.

   The button is seen the way APL Launcher for TizenOS sees it: Vetro keeps the
   remote and forwards its keys to a device it names "vetro-forwarded-remote",
   where the microphone arrives as key 216. A root reader in bridge/service.js
   watches that device and keeps a file in /tmp while the button is down; the
   service polls the file and pushes down/up over a trusted message port.

   The visual is the orb CleanFrame's own Ask sheet draws - one small WebGL
   shader at half resolution, a dark glass sphere whose spectral ribbon moves
   faster as the voice level rises - not a new animation. It is the same shader,
   unchanged, from the app's assistant module.

   What this can and cannot do: it is drawn by the launcher, so it is only visible
   while the launcher is on screen. Drawing over a playing video needs a separate
   native window; that is not in this build.
   ============================================================ */
(function (global) {
  'use strict';

  var PORT = 'CF_MIC';
  var HOLD_MS = 20000;     /* a release that never comes must not leave it up */
  var ANSWER_MS = 6000;    /* nothing says when Alexa has finished */
  var FADE_MS = 220;
  var RETRY_MS = 20000;
  var SIZE = 520;          /* stage pixels; the canvas renders at half of this */

  var el = null, canvas = null, held = false, timer = null, port = null;
  var started = false, retry = null, level = 0;
  var orb = { gl: null, prog: null, u: {}, raf: 0, last: 0, t: 0, lvl: 0, flat: false };

  /* ---------- the orb, from the app's assistant ---------- */

  var VERT = 'attribute vec2 aPos;void main(){gl_Position=vec4(aPos,0.0,1.0);}';
  /* The orb is a dark glass sphere, not a bright ball: a nearly black body, a
     hairline iridescent rim, and one horizontal spectral ribbon flowing across
     the middle - clay on the left through warm white in the centre to blue-violet
     on the right, soft at its edges and liquid in its shape. The ribbon's height,
     thickness and colour drift with time and with the voice level, so it moves
     like light under glass instead of like painted colour. */
  var FRAG = [
    'precision mediump float;',
    'uniform vec2 uRes;uniform float uTime;uniform float uLevel;',
    'float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
    'float noise(vec2 p){vec2 i=floor(p);vec2 f=fract(p);f=f*f*(3.0-2.0*f);',
    'float a=hash(i),b=hash(i+vec2(1.0,0.0)),c=hash(i+vec2(0.0,1.0)),d=hash(i+vec2(1.0,1.0));',
    'return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);}',
    'float fbm(vec2 p){float v=0.0;float a=0.5;for(int i=0;i<4;i++){v+=a*noise(p);p*=2.03;a*=0.5;}return v;}',
    'vec3 ramp(float x){',
    'x=clamp(x,0.0,1.0);',
    'vec3 c=vec3(0.760,0.400,0.220);',
    'c=mix(c,vec3(0.957,0.690,0.396),smoothstep(0.08,0.26,x));',
    'c=mix(c,vec3(1.000,0.906,0.760),smoothstep(0.30,0.42,x));',
    'c=mix(c,vec3(1.000,1.000,1.000),smoothstep(0.42,0.50,x));',
    'c=mix(c,vec3(0.851,0.824,0.965),smoothstep(0.52,0.62,x));',
    'c=mix(c,vec3(0.561,0.545,0.941),smoothstep(0.62,0.76,x));',
    'c=mix(c,vec3(0.310,0.357,0.816),smoothstep(0.76,0.88,x));',
    'c=mix(c,vec3(0.169,0.165,0.290),smoothstep(0.88,1.0,x));',
    'return c;}',
    'void main(){',
    'vec2 p=(gl_FragCoord.xy-0.5*uRes)/min(uRes.x,uRes.y)*2.0;',
    'float r=length(p);',
    'float t=uTime*(0.50+1.10*uLevel);',
    'float disc=smoothstep(1.0,0.85,r);',
    'vec3 col=vec3(0.0);',
    'float rim=exp(-pow((r-0.96)/0.045,2.0));',
    'vec3 rimCol=mix(vec3(0.96,0.72,0.44),vec3(0.56,0.57,0.95),0.5+0.5*sin(atan(p.y,p.x)*2.0+t*0.35));',
    'col+=rimCol*rim*0.70;',
    'float wob=fbm(vec2(p.x*1.7-t*0.33,t*0.27));',
    'float wob2=fbm(vec2(p.x*3.3+t*0.21,t*0.19));',
    'float wave=0.085*sin(p.x*2.25+t*1.05)+0.045*sin(p.x*4.7-t*1.55)+(wob-0.5)*0.13;',
    'float mid=p.y-wave;',
    'float thick=0.32+0.09*wob+0.05*wob2;',
    'float band=exp(-pow(mid/thick,2.0));',
    'float hot=exp(-pow(mid/(thick*0.34),2.0))*exp(-pow(p.x/0.70,2.0));',
    'vec3 ribbon=ramp(p.x*0.5+0.5+0.02*sin(t*0.5));',
    'col+=ribbon*band*1.65;',
    'col+=vec3(1.0,0.985,0.95)*hot*0.65;',
    'float sheen=exp(-pow(length(p-vec2(-0.34,0.50))/0.46,2.0));',
    'col+=vec3(0.86,0.90,1.0)*sheen*0.25*disc;',
    'float edgeCut=smoothstep(1.0,0.85,r);',
    'float alpha=clamp((band*1.15+hot*0.95+rim*0.90+sheen*0.35)*edgeCut,0.0,1.0);',
    'gl_FragColor=vec4(col*alpha,alpha);',
    '}'
  ].join('');

  function orbSetup() {
    var gl = null, vs, fs, prog, buf;
    if (!canvas) return;
    try {
      gl = canvas.getContext('webgl', { alpha: true, antialias: false, depth: false, stencil: false, premultipliedAlpha: true });
    } catch (e) { gl = null; }
    if (!gl) { orb.flat = true; return; }
    vs = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vs, VERT); gl.compileShader(vs);
    fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs, FRAG); gl.compileShader(fs);
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) { orb.flat = true; return; }
    prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { orb.flat = true; return; }
    gl.useProgram(prog);
    buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    orb.gl = gl; orb.prog = prog;
    orb.u = {
      res: gl.getUniformLocation(prog, 'uRes'),
      time: gl.getUniformLocation(prog, 'uTime'),
      level: gl.getUniformLocation(prog, 'uLevel')
    };
  }

  function orbFrame(now) {
    orb.raf = 0;
    if (!shown || document.hidden || orb.flat || !orb.gl) return;
    var dt = orb.last ? Math.min(64, now - orb.last) : 16;
    orb.last = now;
    orb.lvl += (level - orb.lvl) * 0.12;
    orb.t += (dt / 1000) * (1 + 1.7 * orb.lvl);
    var gl = orb.gl, c = orb.canvas;
    gl.viewport(0, 0, c.width, c.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(orb.u.res, c.width, c.height);
    gl.uniform1f(orb.u.time, orb.t);
    gl.uniform1f(orb.u.level, orb.lvl);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    orb.raf = global.requestAnimationFrame(orbFrame);
  }

  function startOrb() {
    if (!orb.gl && !orb.flat) orbSetup();
    if (orb.flat || !orb.gl) { if (el) el.classList.add('is-flat'); return; }
    if (orb.raf) return;
    orb.last = 0;
    orb.raf = global.requestAnimationFrame(orbFrame);
  }

  function stopOrb() {
    if (orb.raf) global.cancelAnimationFrame(orb.raf);
    orb.raf = 0;
    orb.last = 0;
  }

  /* ---------- showing and hiding ---------- */

  var shown = false;

  function show(mode) {
    if (!el) el = document.getElementById('siri');
    if (!el) return;
    if (!canvas) canvas = document.getElementById('siriCanvas');
    clearTimeout(timer);
    shown = true;
    level = mode === 'held' ? 1 : 0.18;
    el.classList.add('is-on');
    el.classList.toggle('is-held', mode === 'held');
    el.classList.toggle('is-answering', mode === 'answering');
    startOrb();
    timer = setTimeout(hide, mode === 'held' ? HOLD_MS : ANSWER_MS);
  }

  function hide() {
    clearTimeout(timer);
    shown = false;
    held = false;
    level = 0;
    if (!el) return;
    el.classList.remove('is-on');
    /* The shader stops with the last frame still on the canvas, so the fade is
       the only thing left moving. Frame numbers stop here too. */
    setTimeout(function () {
      stopOrb();
      if (el && !el.classList.contains('is-on')) el.classList.remove('is-held', 'is-answering');
    }, FADE_MS);
  }

  /* ---------- the button ---------- */

  function listen() {
    if (port) return true;
    try {
      port = tizen.messageport.requestTrustedLocalMessagePort(PORT);
      port.addMessagePortListener(function (data) {
        var i, value = '';
        for (i = 0; i < data.length; i++) if (data[i].key === 'mic') value = String(data[i].value);
        if (value !== 'down' && value !== 'up') return;
        /* A held key repeats: only a real change counts, as in their overlay. */
        if (value === 'down') {
          if (held) return;
          held = true;
          show('held');
          return;
        }
        if (!held) return;
        held = false;
        show('answering');
      });
      return true;
    } catch (e) {
      port = null;
      return false;
    }
  }

  function ask() {
    if (!(global.tizen && tizen.messageport && global.CleanFrameTV)) return;
    global.CleanFrameTV.mic().then(function (answer) {
      /* The service answers with the button as it is right now, so a glow opened
         mid-press does not wait for the next one. */
      if (answer && answer.raw && answer.raw.down) show('held');
      listen();
      clearTimeout(retry);
    }).catch(function () {
      /* Vetro may not be up yet: the service is asked again, quietly. */
      clearTimeout(retry);
      retry = setTimeout(ask, RETRY_MS);
    });
  }

  function start() {
    if (started) return;
    if (!(global.tizen && tizen.messageport && global.CleanFrameTV)) return;
    started = true;
    el = document.getElementById('siri');
    canvas = document.getElementById('siriCanvas');
    if (canvas) { canvas.width = SIZE / 2; canvas.height = SIZE / 2; }
    listen();
    ask();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, false);
  } else {
    start();
  }

  global.CleanFrameSiri = {
    start: start,
    /* Exposed for the preview and for a hand check without the remote. */
    pulse: function () { show('held'); },
    release: function () { show('answering'); },
    hide: hide
  };
})(window);
