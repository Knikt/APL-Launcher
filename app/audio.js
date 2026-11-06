/* CleanFrame Audio Feedback System (ES5 compatible for Tizen OS)
   One Web Audio context, decoded on demand. The previous build created twelve
   pools of three <audio> elements shortly after start, which meant thirty-six
   file reads and thirty-six media pipelines before the viewer had pressed
   anything: on the set the TV's media pipeline limit is reached, the decoder
   gives up quietly and the sounds go missing, and the burst also lands in the
   first second of navigation. Decoding a 5 KB clip once, the first time it is
   needed, keeps both problems away. An <audio> element is still the fallback if
   a set has no Web Audio or refuses the clip.
   Powered by Google Material Design Sound Resources. */
(function (root) {
  'use strict';

  var BASE = 'assets/sounds/';
  var muted = false;
  var volumeLevel = 'standard'; // 'subtle' | 'standard' | 'high'
  var initialized = false;

  /* Each clip ships as 24 kHz mono PCM WAV. The set's HTML5 media stack does
     not decode the OGG Vorbis these were authored as - that is why the sounds
     were silent there while the browser played them - so WAV is tried first and
     the original OGG is kept only as a fallback for engines that reject PCM. */
  var SOUNDS = {
    focus: 'focus',
    select: 'select',
    open: 'open',
    close: 'close',
    back: 'back',
    snap: 'snap',
    swipe: 'swipe',
    toggleOn: 'toggle-on',
    toggleOff: 'toggle-off',
    typing: 'typing',
    blocked: 'blocked',
    warning: 'warning'
  };
  var SOURCES = ['.wav', '.ogg'];

  var VOLUMES = {
    focus: 0.30,
    select: 0.52,
    open: 0.46,
    close: 0.42,
    back: 0.42,
    snap: 0.34,
    swipe: 0.36,
    toggleOn: 0.48,
    toggleOff: 0.40,
    typing: 0.16,
    blocked: 0.36,
    warning: 0.44
  };

  var SCALES = {
    subtle: 0.5,
    standard: 1.0,
    high: 1.8
  };

  function loadPrefs() {
    try {
      var raw = root.localStorage && root.localStorage.getItem('cleanframe.audio.v1');
      if (raw) {
        var p = JSON.parse(raw);
        if (typeof p.muted === 'boolean') muted = p.muted;
        if (p.level && SCALES[p.level]) volumeLevel = p.level;
      }
    } catch (e) {}
  }

  function savePrefs() {
    try {
      if (root.localStorage) {
        root.localStorage.setItem('cleanframe.audio.v1', JSON.stringify({
          muted: muted,
          level: volumeLevel
        }));
      }
    } catch (e) {}
  }

  function effectiveVol(name) {
    var base = VOLUMES[name] || 0.20;
    var s = SCALES[volumeLevel] || 1.0;
    return Math.min(1.0, Math.max(0.01, base * s));
  }

  /* ---------- Web Audio ---------- */
  var ctx = null, ctxDead = false;
  var buffers = {}, reading = {}, broken = {}, asking = {};

  function audioContext() {
    if (ctx || ctxDead) return ctx;
    var C = root.AudioContext || root.webkitAudioContext;
    if (!C) { ctxDead = true; return null; }
    try { ctx = new C(); } catch (e) { ctx = null; }
    if (!ctx) ctxDead = true;
    return ctx;
  }

  /* A key press is the gesture that lets a TV engine start its audio clock. */
  function resume() {
    if (!ctx || ctx.state !== 'suspended' || typeof ctx.resume !== 'function') return;
    try { ctx.resume(); } catch (e) {}
  }

  function decode(c, data, ok, fail) {
    var settled = false;
    function done(buf) {
      if (settled) return;
      settled = true;
      if (buf) ok(buf); else fail();
    }
    function bad() {
      if (settled) return;
      settled = true;
      fail();
    }
    try {
      /* Old TV engines only take the callback form of decodeAudioData. */
      var p = c.decodeAudioData(data, done, bad);
      if (p && typeof p.then === 'function') p.then(done, bad);
    } catch (e) { bad(); }
  }

  function readSound(name, cb) {
    var c = audioContext(), base = SOUNDS[name];
    if (!c || !base || broken[name]) { cb(null); return; }
    if (buffers[name]) { cb(buffers[name]); return; }
    if (reading[name]) { reading[name].push(cb); return; }
    reading[name] = [cb];
    function finish(buffer) {
      var waiters = reading[name] || [];
      reading[name] = null;
      if (buffer) buffers[name] = buffer;
      else broken[name] = true;
      for (var i = 0; i < waiters.length; i++) waiters[i](buffer || null);
    }
    if (typeof root.XMLHttpRequest !== 'function') { finish(null); return; }
    /* One container at a time, in order: the first that decodes wins. */
    (function attempt(index) {
      if (index >= SOURCES.length) { finish(null); return; }
      try {
        var xhr = new root.XMLHttpRequest();
        xhr.open('GET', BASE + base + SOURCES[index], true);
        xhr.responseType = 'arraybuffer';
        xhr.onload = function () {
          if (!xhr.response || (xhr.status && xhr.status >= 400)) { attempt(index + 1); return; }
          decode(c, xhr.response, finish, function () { attempt(index + 1); });
        };
        xhr.onerror = function () { attempt(index + 1); };
        xhr.send();
      } catch (e) { attempt(index + 1); }
    })(0);
  }

  function playBuffer(name, buffer) {
    var c = audioContext();
    if (!c || !buffer) return;
    try {
      var gain = c.createGain();
      gain.gain.value = effectiveVol(name);
      var src = c.createBufferSource();
      src.buffer = buffer;
      src.connect(gain);
      gain.connect(c.destination);
      src.start ? src.start(0) : src.noteOn(0);
    } catch (e) {}
  }

  /* ---------- <audio> fallback ---------- */
  var elements = {};
  function playElement(name) {
    var el = elements[name];
    try {
      if (!el) {
        el = elements[name] = new root.Audio(BASE + SOUNDS[name] + SOURCES[0]);
        el.preload = 'auto';
      }
      el.volume = effectiveVol(name);
      el.currentTime = 0;
      var p = el.play();
      if (p && typeof p.catch === 'function') p.catch(function () {});
    } catch (e) {}
  }

  function init() {
    if (initialized) return;
    initialized = true;
    loadPrefs();
  }

  function play(name) {
    if (muted) return;
    if (!initialized) init();
    if (!SOUNDS[name]) return;
    var c = audioContext();
    if (c) {
      resume();
      if (buffers[name]) { playBuffer(name, buffers[name]); return; }
      /* One read per clip. Presses that arrive while the first one is still in
         flight are dropped rather than queued, so the clip that lands is not
         fired over itself half a dozen times. */
      if (asking[name]) return;
      asking[name] = true;
      readSound(name, function (buffer) {
        asking[name] = false;
        if (buffer) playBuffer(name, buffer);
        else playElement(name);
      });
      return;
    }
    playElement(name);
  }

  /* The two sounds a viewer hears first are read once the launcher has
     settled, so the very first focus already has its clip in hand. Four
     kilobytes of audio, not a pool of elements. */
  function warm() {
    if (muted) return;
    readSound('focus', function () {});
    readSound('select', function () {});
  }

  root.CleanFrameAudio = {
    init: init,
    play: play,
    focus: function () { play('focus'); },
    select: function () { play('select'); },
    open: function () { play('open'); },
    close: function () { play('close'); },
    back: function () { play('back'); },
    snap: function () { play('snap'); },
    swipe: function () { play('swipe'); },
    toggleOn: function () { play('toggleOn'); },
    toggleOff: function () { play('toggleOff'); },
    typing: function () { play('typing'); },
    blocked: function () { play('blocked'); },
    warning: function () { play('warning'); },
    mute: function (val) {
      muted = !!val;
      savePrefs();
      if (!muted) play('toggleOn');
    },
    setMuted: function (val) {
      this.mute(val);
    },
    isMuted: function () {
      if (!initialized) init();
      return muted;
    },
    setVolumeLevel: function (lvl) {
      if (SCALES[lvl]) {
        volumeLevel = lvl;
        savePrefs();
        play('select');
      }
    },
    getVolumeLevel: function () {
      if (!initialized) init();
      return volumeLevel;
    },
    /* Called once the launcher is on screen: no audio work during the first
       paint, only when the set is idle. */
    warm: warm
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(function () { init(); }, 900);
    });
  } else {
    setTimeout(function () { init(); }, 900);
  }

})(window);
