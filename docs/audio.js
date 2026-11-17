/* =====================================================================
   audio.js - zero-dependency Web Audio chiptune + sound effects engine
   Load with a plain <script src="audio.js"></script> before the game.

   Public API (all on window; safe to call before the first user gesture):
     sfx(name)                 one-shot sound effects
     music.start(id)           loop the theme for `id` (unknown ids -> 'menu')
     music.stop()
     music.setIntensity(0..1)  faster tempo + more layers, changes at bar lines
     music.toggleMute()        and music.muted (saved in localStorage)

   All melodies below are original compositions.
   ===================================================================== */
(function () {
  'use strict';

  /* ---------- 1. Audio context, buses, autoplay rule ---------- */

  // Browsers refuse to make sound until the user has interacted with the page
  // (the "autoplay policy"). So we do NOT create the AudioContext at load time.
  // We remember what music was asked for, and the first key/click/touch creates
  // + resumes the context and then starts that queued theme.
  var ctx = null;                 // the AudioContext (created lazily)
  var master, musicBus, sfxBus;   // gain nodes: master -> (music | sfx)
  var noiseBuf = null;            // 1 second of white noise, reused by drums + sfx
  var waves = {};                 // custom pulse waveforms (25% / 12.5% duty)
  var MASTER_VOL = 0.25;

  var muted = false;
  try { muted = localStorage.getItem('neverest-muted') === '1'; } catch (e) {}

  var wantedId = null;            // most recently requested theme (queued until unlocked)
  var targetIntensity = 0;        // what the game asked for

  function getCtx() {
    if (ctx) return ctx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : MASTER_VOL;
    master.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.55;  // music quieter...
    sfxBus = ctx.createGain();   sfxBus.gain.value = 1.0;     // ...than effects
    musicBus.connect(master);
    sfxBus.connect(master);

    // White-noise buffer: random samples between -1 and 1.
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    var nd = noiseBuf.getChannelData(0);
    for (var i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

    waves.p25 = pulseWave(0.25);
    waves.p12 = pulseWave(0.125);
    return ctx;
  }

  // A pulse wave with duty cycle d, built from its Fourier series (NES-style voices).
  function pulseWave(d) {
    var n = 64, real = new Float32Array(n), imag = new Float32Array(n);
    for (var k = 1; k < n; k++) real[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * d);
    return ctx.createPeriodicWave(real, imag);
  }

  function unlock() {
    if (!getCtx()) return;
    if (ctx.state === 'suspended') ctx.resume();
    if (wantedId) beginTheme(wantedId);      // start the queued theme
  }
  ['keydown', 'pointerdown', 'touchstart'].forEach(function (ev) {
    // capture=true so we run before the game's own handlers and can play their sfx
    window.addEventListener(ev, unlock, true);
  });

  /* ---------- 2. Low-level sound makers ---------- */

  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }   // MIDI note -> Hz

  // One enveloped oscillator. voice: 'p50' | 'p25' | 'p12' | 'tri' | 'sine' | 'saw'.
  // f1 (optional) = slide to this frequency over the note. The short attack and
  // release ramps are what stop clicks/pops.
  function tone(dest, voice, f0, f1, t, dur, vol, vib) {
    dur = Math.max(dur, 0.04);
    var o = ctx.createOscillator();
    if (voice === 'p25' || voice === 'p12') o.setPeriodicWave(waves[voice]);
    else o.type = { p50: 'square', tri: 'triangle', sine: 'sine', saw: 'sawtooth' }[voice] || 'square';
    o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.005);
    g.gain.setValueAtTime(vol, t + Math.max(0.006, dur - 0.03));
    g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g); g.connect(dest);
    if (vib) {                       // gentle vibrato (flute-like) via an LFO on detune
      var l = ctx.createOscillator(), lg = ctx.createGain();
      l.frequency.value = 5.5; lg.gain.value = 14;
      l.connect(lg); lg.connect(o.detune);
      l.start(t); l.stop(t + dur + 0.02);
    }
    o.start(t); o.stop(t + dur + 0.02);
  }

  // A burst of filtered noise that decays quickly (drums, whooshes, thuds).
  function noise(dest, type, freq, t, dur, vol, sweepTo) {
    var s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    var f = ctx.createBiquadFilter();
    f.type = type; f.frequency.setValueAtTime(freq, t);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    var g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest);
    s.start(t, Math.random() * 0.5, dur + 0.02);
  }

  function drum(dest, ch, t, v) {
    if (ch === 'k') {                 // kick = pitched-down sine blip
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(40, t + 0.1);
      g.gain.setValueAtTime(0.8 * v, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.16);
    } else if (ch === 's') {          // snare = noise burst + a little body
      noise(dest, 'highpass', 1500, t, 0.12, 0.5 * v);
      tone(dest, 'tri', 190, 120, t, 0.06, 0.25 * v);
    } else if (ch === 'h') {          // hat = very short high noise
      noise(dest, 'highpass', 7500, t, 0.04, 0.28 * v);
    }
  }

  /* ---------- 3. Song data ----------
     Notation: a melody is a list of bars; each bar is a string of steps
     separated by spaces. One token = one step (an 8th note in most themes).
       "E4"  start a note (sharps '#', flats 'b', e.g. "Bb4", "F#5")
       "-"   hold the previous note for one more step
       "."   rest
     Bass and arpeggio are not written note by note: `roots` gives one root note
     per bar, and `bass` is a pattern of intervals relative to that root
       r=root  t=+2  m=+3  M=+4  f=+7(fifth)  s=+10  o=+12(octave)  .=rest
     Drums: k=kick s=snare h=hat .=rest (one char per step, cycles every bar).
     A theme loops once its melody ends (8 bars). */

  var OFFS = { r: 0, t: 2, m: 3, M: 4, f: 7, s: 10, o: 12, O: 24 };
  var SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

  function noteToMidi(s) {
    var m = /^([A-G])([#b]?)(-?\d)$/.exec(s);
    if (!m) return null;
    return 12 * (parseInt(m[3], 10) + 1) + SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  }

  // Turn a token list into events: events[step] = {m: midi, len: steps} or null.
  function compile(tokens) {
    var ev = [], cur = null;
    tokens.forEach(function (tk) {
      if (tk === '-') { if (cur) cur.len++; ev.push(null); }
      else if (tk === '.') { cur = null; ev.push(null); }
      else { cur = { m: tk, len: 1 }; ev.push(cur); }
    });
    return ev;
  }

  function parseMelody(bars) {
    return bars.join(' ').split(/\s+/).map(function (s) {
      return (s === '.' || s === '-') ? s : noteToMidi(s);
    });
  }

  // Expand roots + interval pattern into a token list (one pattern per bar).
  function expand(roots, pat, shift) {
    var out = [], p = pat.split(' ');
    roots.split(' ').forEach(function (r) {
      var base = noteToMidi(r) + shift;
      p.forEach(function (c) { out.push((c === '.' || c === '-') ? c : base + OFFS[c]); });
    });
    return out;
  }

  var THEMES = {
    // Cheerful C-major title screen: bouncy leaps over a steady beat.
    menu: {
      bpm: 132, bar: 8, lead: 'p50', gate: 0.8,
      melody: ['C5 E5 G5 E5 C6 . G5 .', 'A4 C5 E5 C5 A5 . E5 .', 'F4 A4 C5 A4 F5 . C5 .', 'G4 B4 D5 G5 B5 - . .',
               'E5 . D5 C5 D5 E5 G5 .', 'A5 . G5 E5 G5 . . .', 'F5 . E5 D5 C5 D5 E5 .', 'D5 - . G4 D5 G5 C6 -'],
      roots: 'C2 A1 F2 G2 C2 A1 F2 G2', bass: 'r . o . r . f .', drums: 'k h s h k k s h'
    },
    // 6/8 (two groups of three) tarantella: D minor, fast staccato, galloping.
    marinara: {
      bpm: 138, spb: 3, bar: 6, lead: 'p25', gate: 0.6,
      melody: ['D5 . F5 A5 . F5', 'G5 F5 E5 D5 . A4', 'Bb4 . D5 F5 . D5', 'E5 D5 C#5 A4 . .',
               'D5 . F5 A5 . C6', 'Bb5 A5 G5 F5 E5 D5', 'E5 . G5 Bb5 . A5', 'A5 G5 F5 E5 D5 .'],
      roots: 'D2 G2 Bb1 A1 D2 G2 A1 D2', bass: 'r . f r . f', drums: 'k h h s h h'
    },
    // Fast but sad: E minor, thin pulse lead with very short "drip" notes.
    soggy: {
      bpm: 160, bar: 8, lead: 'p12', gate: 0.3,
      melody: ['E5 G5 B5 . G5 . E5 .', 'C5 E5 G5 . E5 . C5 .', 'D5 F#5 A5 . F#5 . D5 .', 'B4 D#5 F#5 . B5 . . .',
               'E5 G5 B5 . A5 . G5 .', 'C6 . B5 . A5 . G5 .', 'F#5 . E5 . D#5 . F#5 .', 'E5 . . . B4 . . .'],
      roots: 'E2 C2 D2 B1 E2 A1 B1 E2', bass: 'r . . r . . f .', drums: 'k . . h s . h .'
    },
    // Office bop: lots of chromatic wiggles (half-steps) in F major, clipped notes.
    taxman: {
      bpm: 140, bar: 8, lead: 'p50', gate: 0.5,
      melody: ['F5 . E5 F5 . G5 F#5 G5', 'A5 . G#5 A5 . C6 . .', 'Bb5 A5 G5 F5 E5 Eb5 D5 .', 'C5 . . D5 Eb5 E5 F5 .',
               'F5 . E5 F5 . G5 F#5 G5', 'A5 . G#5 A5 . C6 B5 C6', 'D6 C6 Bb5 A5 G#5 G5 F#5 F5', 'E5 . C5 . F5 . . .'],
      roots: 'F2 F2 Bb1 C2 F2 F2 G2 C2', bass: 'r . f . r . s .', drums: 'k . h . s . h k'
    },
    // Heroic adventure: D dorian (minor with a bright 6th), galloping bass.
    lunk: {
      bpm: 120, bar: 8, lead: 'p25', gate: 0.85,
      melody: ['D5 . . A4 D5 . E5 F5', 'G5 . . F5 E5 . D5 .', 'E5 . . B4 E5 . F5 G5', 'A5 - - - . . . .',
               'D5 . . A4 D5 . E5 F5', 'G5 . A5 B5 C6 . B5 A5', 'G5 . F5 E5 D5 . E5 .', 'D5 - - - . . . .'],
      roots: 'D2 G2 C2 A1 D2 G2 C2 D2', bass: 'r r . r r r . r', drums: 'k . s . k k s .'
    },

  };

  /* ---------- 4. The lookahead scheduler ---------- */
  // JavaScript timers (setTimeout/setInterval) are sloppy: they can fire late by
  // tens of milliseconds, which would make music stutter. The audio clock
  // (ctx.currentTime) is sample-accurate but you must tell it in advance what
  // to play. So the trick: a timer ticks every 25 ms, and each tick schedules
  // every step that falls within the next 0.1 s *at an exact audio time*.
  // The timer can be a bit late and the music still stays rock-steady.
  var TICK_MS = 25, LOOKAHEAD = 0.1;
  var timer = null;
  var cur = null;       // the running song: {key, th, lead, harm, bass, arp, drums, len, step, next, int, bus}

  function stepDur(th, intensity) {
    var bpm = th.bpm * (1 + 0.3 * intensity);               // up to +30% tempo
    return 60 / bpm / (th.spb || 2);                          // seconds per step
  }

  function compileTheme(key) {
    var th = THEMES[key], mel = parseMelody(th.melody);
    var hi = th.hi === undefined ? 12 : th.hi;
    var arpPat = [], i;                                       // arpeggio: root-fifth-octave-fifth...
    for (i = 0; i < th.bar; i++) arpPat.push(['r', 'f', 'o', 'f'][i % 4]);
    return {
      key: key, th: th, len: mel.length, step: 0, int: 0,
      lead: compile(mel),
      harm: compile(mel.map(function (x) { return typeof x === 'number' ? x + hi : x; })),
      bass: compile(expand(th.roots, th.bass, 0)),
      arp: compile(expand(th.roots, arpPat.join(' '), 24)),
      drums: th.roots.split(' ').map(function () { return th.drums.split(' '); })
              .reduce(function (a, b) { return a.concat(b); }, [])
    };
  }

  function scheduleStep(s, i, t) {
    var th = s.th, bus = s.bus;
    if (i % th.bar === 0) s.int = targetIntensity;           // intensity only changes on bar lines
    var sd = stepDur(th, s.int);
    var tt = (th.swing && i % 2 === 1) ? t + th.swing * sd : t;
    var e;
    if ((e = s.lead[i])) tone(bus, th.lead, mtof(e.m), 0, tt, e.len * sd * (th.gate || 0.8), 0.3, th.vib);
    if ((e = s.bass[i])) tone(bus, 'tri', mtof(e.m), 0, tt, e.len * sd * 0.8, 0.5);
    if (s.int > 0.3) drum(bus, s.drums[i], tt, 0.6 + 0.4 * s.int);
    if (s.int > 0.7) {                                        // extra layers at high intensity
      if ((e = s.harm[i])) tone(bus, 'p12', mtof(e.m), 0, tt, e.len * sd * (th.gate || 0.8), 0.12, th.vib);
      if ((e = s.arp[i])) tone(bus, 'p25', mtof(e.m), 0, tt, sd * 0.6, 0.07);
    }
    return sd;
  }

  function tick() {
    if (!cur) return;
    // If the tab was in the background, timers slept while the audio clock kept going.
    // Don't try to "catch up" on every missed note (thousands of nodes) - just resume from now.
    if (cur.next < ctx.currentTime) cur.next = ctx.currentTime + 0.05;
    while (cur.next < ctx.currentTime + LOOKAHEAD) {
      cur.next += scheduleStep(cur, cur.step, cur.next);
      cur.step = (cur.step + 1) % cur.len;
    }
  }

  function killTheme() {
    if (timer) { clearInterval(timer); timer = null; }
    if (cur) {
      var old = cur.bus, t = ctx.currentTime;
      old.gain.cancelScheduledValues(t);
      old.gain.setTargetAtTime(0, t, 0.02);                   // quick fade to avoid a click
      setTimeout(function () { try { old.disconnect(); } catch (e) {} }, 300);
      cur = null;
    }
  }

  function beginTheme(id) {
    if (!ctx) return;
    var key = THEMES[id] ? id : 'menu';
    if (cur && cur.key === key) return;                       // already playing this one
    killTheme();
    cur = compileTheme(key);
    cur.bus = ctx.createGain();
    cur.bus.connect(musicBus);
    cur.next = ctx.currentTime + 0.06;
    timer = setInterval(tick, TICK_MS);
    tick();
  }

  /* ---------- 5. Sound effects ---------- */

  var SFX = {
    jump:     function (d, t) { tone(d, 'p50', 260, 640, t, 0.14, 0.3); },
    wallkick: function (d, t) { tone(d, 'p25', 300, 1200, t, 0.12, 0.32); tone(d, 'p12', 600, 1800, t + 0.04, 0.12, 0.25); },
    land:     function (d, t) { tone(d, 'sine', 150, 55, t, 0.1, 0.5); noise(d, 'lowpass', 500, t, 0.06, 0.25); },
    combo:    function (d, t) { [72, 76, 79, 84].forEach(function (m, k) { tone(d, 'p25', mtof(m), 0, t + k * 0.06, 0.09, 0.28); }); },
    fireOn:   function (d, t) {
      noise(d, 'lowpass', 200, t, 0.5, 0.6, 4000);                       // whoosh: filter sweeps up
      [60, 64, 67, 72].forEach(function (m) { tone(d, 'p25', mtof(m), 0, t + 0.3, 0.45, 0.18); });
      tone(d, 'tri', mtof(48), 0, t + 0.3, 0.45, 0.35);
    },
    fireOff:  function (d, t) { [880, 660, 440].forEach(function (f, k) { tone(d, 'p50', f, 0, t + k * 0.07, 0.07, 0.25); }); },
    gameover: function (d, t) {
      [71, 69, 67, 65].forEach(function (m, k) { tone(d, 'p50', mtof(m), 0, t + k * 0.2, 0.18, 0.28); });
      tone(d, 'p50', mtof(62), mtof(40), t + 0.8, 0.65, 0.3);            // the sad "wah" slide down
      tone(d, 'tri', mtof(50), mtof(28), t + 0.8, 0.65, 0.35);
    },
    select:   function (d, t) { tone(d, 'p50', 880, 0, t, 0.05, 0.25); tone(d, 'p50', 1320, 0, t + 0.05, 0.06, 0.25); },
    start:    function (d, t) {
      [60, 64, 67, 72, 67, 72].forEach(function (m, k) { tone(d, 'p25', mtof(m), 0, t + k * 0.08, k === 5 ? 0.35 : 0.08, 0.28); });
      tone(d, 'tri', mtof(48), 0, t + 0.4, 0.35, 0.35);
    },
    beam:     function (d, t) { tone(d, 'saw', 2000, 150, t, 0.28, 0.2); tone(d, 'p12', 1200, 100, t, 0.28, 0.2); },
    warn:     function (d, t) { tone(d, 'p50', 1100, 0, t, 0.07, 0.25); tone(d, 'p50', 1100, 0, t + 0.11, 0.07, 0.25); },
    hit:      function (d, t) { noise(d, 'bandpass', 900, t, 0.12, 0.6); tone(d, 'sine', 220, 60, t, 0.15, 0.5); }
  };

  window.sfx = function (name) {
    if (!ctx || !SFX[name]) return;            // before the first gesture (or unknown name): ignore
    try { SFX[name](sfxBus, ctx.currentTime + 0.005); } catch (e) {}
  };

  /* ---------- 6. Music public API ---------- */

  window.music = {
    muted: muted,
    start: function (id) {
      wantedId = id;                            // remember it even if audio is still locked
      if (!ctx) return;
      if (ctx.state === 'suspended') ctx.resume();
      beginTheme(id);
    },
    stop: function () {
      wantedId = null;
      if (ctx) killTheme();
    },
    setIntensity: function (x) {
      x = Number(x);
      targetIntensity = isNaN(x) ? 0 : Math.max(0, Math.min(1, x));
    },
    toggleMute: function () {
      muted = !muted;
      window.music.muted = muted;
      try { localStorage.setItem('neverest-muted', muted ? '1' : '0'); } catch (e) {}
      if (ctx) master.gain.setTargetAtTime(muted ? 0 : MASTER_VOL, ctx.currentTime, 0.015);
      return muted;
    },
    _themes: THEMES                              // exposed for debugging / tests only
  };
})();
