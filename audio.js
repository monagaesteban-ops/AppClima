// audio.js — banda sonora y efectos generados con Web Audio API (síntesis
// procedural, sin archivos ni samples externos, así que funciona 100%
// offline y no usa ningún audio con copyright).
//
// Estilo: synth moderno — pads con filtro, arpegios pulsantes, bajo grave y
// percusión ligera, todo pasando por una cadena de efectos compartida
// (filtro + delay con retroalimentación) que da sensación de espacio e
// inmersión, y que se "abre" según la intensidad de la partida.

var AudioManager = (function() {
  var ctx = null;
  var initialized = false;

  var musicBus = null;    // nodo de entrada al que se conecta todo el sonido en vivo
  var masterFilter = null; // filtro compartido, se abre/cierra con la intensidad

  var menuLoops = [], gameLoops = [];
  var menuIndexRef = { i: 0 }, gameIndexRef = { i: 0 };
  var currentSource = null;
  var currentMode = null; // 'menu' | 'game' | null

  // ── Setup ──────────────────────────────────────────────────────────────

  function init() {
    if (initialized) return;
    initialized = true;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    var chain = buildChain(ctx, ctx.destination, true);
    musicBus = chain.input;
    masterFilter = chain.filter;
    buildAllLoops();
  }

  function resume() {
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  // Cadena de efectos reutilizable: filtro (lowpass) + un delay corto con
  // retroalimentación en paralelo, mezclado por debajo de la señal directa.
  // Se usa tanto en tiempo real (menú, partida, efectos) como dentro de cada
  // pista pre-renderizada, para que todo comparta la misma "sensación" de
  // espacio.
  function buildChain(audioCtx, dest, includeDelay) {
    var input = audioCtx.createGain();
    input.gain.value = 1;

    var filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 0.5;
    filter.frequency.value = 4200;

    var dry = audioCtx.createGain();
    dry.gain.value = 0.85;

    input.connect(filter);
    filter.connect(dry);
    dry.connect(dest);

    if (includeDelay) {
      var delay = audioCtx.createDelay(1.0);
      delay.delayTime.value = 0.26;
      var feedback = audioCtx.createGain();
      feedback.gain.value = 0.27;
      var wet = audioCtx.createGain();
      wet.gain.value = 0.2;

      filter.connect(delay);
      delay.connect(feedback);
      feedback.connect(delay);
      delay.connect(wet);
      wet.connect(dest);
    }

    return { input: input, filter: filter };
  }

  // Abre/cierra el filtro maestro según la intensidad de la partida (0..1),
  // para que la música se sienta más viva y brillante mientras mejor va el
  // jugador — un pequeño detalle inmersivo que reacciona al juego en vivo.
  function setIntensity(amount) {
    if (!masterFilter) return;
    var clamped = Math.max(0, Math.min(1, amount));
    var target = 2200 + clamped * 7200;
    masterFilter.frequency.setTargetAtTime(target, ctx.currentTime, 0.6);
  }

  // ── Utilidades musicales ─────────────────────────────────────────────

  function midiToFreq(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function chordTones(root, offsets) {
    return offsets.map(function(o) { return midiToFreq(root + o); });
  }
  function rotate(arr, n) { return arr.slice(n).concat(arr.slice(0, n)); }

  var ARP_PATTERN = [0, 2, 1, 3, 2, 4, 3, 5];

  // ── Timbres sintéticos ───────────────────────────────────────────────

  // Pluck de arpegio: sierra + filtro que cae rápido, ataque instantáneo.
  // Es el sonido "principal" de las pistas: pulsos cortos y brillantes.
  function synthPluck(audioCtx, node, freq, t0, dur, vol) {
    var osc = audioCtx.createOscillator();
    var filt = audioCtx.createBiquadFilter();
    var gain = audioCtx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    filt.type = 'lowpass';
    filt.Q.value = 1.1;
    filt.frequency.setValueAtTime(freq * 8 + 1200, t0);
    filt.frequency.exponentialRampToValueAtTime(Math.max(180, freq * 1.4), t0 + dur);

    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    osc.connect(filt); filt.connect(gain); gain.connect(node);
    osc.start(t0); osc.stop(t0 + dur + 0.05);
  }

  // Voz de pad: dos sierras ligeramente desafinadas (como un coro sutil),
  // ataque y caída suaves, para un colchón armónico de fondo.
  function padVoice(audioCtx, node, freq, t0, dur, vol) {
    var oscA = audioCtx.createOscillator();
    var oscB = audioCtx.createOscillator();
    var filt = audioCtx.createBiquadFilter();
    var gain = audioCtx.createGain();

    oscA.type = 'sawtooth'; oscB.type = 'sawtooth';
    oscA.frequency.value = freq; oscB.frequency.value = freq;
    oscB.detune.value = 9;
    filt.type = 'lowpass'; filt.Q.value = 0.3;
    filt.frequency.value = freq * 3 + 500;

    var atk = Math.min(1.2, dur * 0.35), rel = Math.min(1.4, dur * 0.4);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + atk);
    gain.gain.setValueAtTime(vol, Math.max(t0 + atk, t0 + dur - rel));
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    oscA.connect(filt); oscB.connect(filt); filt.connect(gain); gain.connect(node);
    oscA.start(t0); oscA.stop(t0 + dur + 0.1);
    oscB.start(t0); oscB.stop(t0 + dur + 0.1);
  }
  function padChord(audioCtx, node, freqs, t0, dur, vol) {
    freqs.forEach(function(f) { padVoice(audioCtx, node, f, t0, dur, vol); });
  }

  // Bajo: triángulo grave con un pequeño golpe de energía al inicio.
  function subBass(audioCtx, node, freq, t0, dur, vol) {
    var osc = audioCtx.createOscillator();
    var gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;

    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.03);
    gain.gain.exponentialRampToValueAtTime(vol * 0.55, t0 + dur * 0.5);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    osc.connect(gain); gain.connect(node);
    osc.start(t0); osc.stop(t0 + dur + 0.05);
  }

  // Ruido blanco (para el hi-hat y el golpe de choque).
  function makeNoiseBuffer(audioCtx, dur) {
    var n = Math.max(1, Math.floor(audioCtx.sampleRate * dur));
    var buffer = audioCtx.createBuffer(1, n, audioCtx.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  function hat(audioCtx, node, t0, vol, noiseBuf) {
    var src = audioCtx.createBufferSource();
    src.buffer = noiseBuf || makeNoiseBuffer(audioCtx, 0.08);
    var filt = audioCtx.createBiquadFilter();
    filt.type = 'highpass'; filt.frequency.value = 6500;
    var gain = audioCtx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.06);
    src.connect(filt); filt.connect(gain); gain.connect(node);
    src.start(t0); src.stop(t0 + 0.09);
  }

  function kick(audioCtx, node, t0, vol) {
    var osc = audioCtx.createOscillator();
    var gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, t0);
    osc.frequency.exponentialRampToValueAtTime(45, t0 + 0.14);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
    osc.connect(gain); gain.connect(node);
    osc.start(t0); osc.stop(t0 + 0.2);
  }

  // ── Progresiones de acordes (la mor natural, sonido moderno/cinemático) ──

  var MENU_PROGRESSION = [ // Am – F – C – G
    { root: 57, off: [0, 3, 7] },
    { root: 53, off: [0, 4, 7] },
    { root: 60, off: [0, 4, 7] },
    { root: 55, off: [0, 4, 7] }
  ];
  var GAME_PROGRESSION = [ // Am – G – F – Em (más tensión, típico de synthwave)
    { root: 57, off: [0, 3, 7] },
    { root: 55, off: [0, 4, 7] },
    { root: 53, off: [0, 4, 7] },
    { root: 52, off: [0, 3, 7] }
  ];

  // ── Generador de pistas ──────────────────────────────────────────────
  // Construye una pieza completa (pad + bajo + arpegio, y percusión
  // opcional) a partir de una progresión de acordes, renderizándola fuera
  // de línea para poder reproducirla sin gastar CPU en vivo.
  function renderTrack(progression, opts) {
    var duration = opts.duration;
    var chordDur = duration / progression.length;
    var offline = new OfflineAudioContext(2, Math.ceil(44100 * duration), 44100);
    var chain = buildChain(offline, offline.destination, true);

    // El filtro "respira" a lo largo de toda la pieza: se abre hacia la
    // mitad y vuelve a cerrarse, dando una sensación de oleaje/evolución.
    chain.filter.frequency.setValueAtTime(opts.filterStart, 0);
    chain.filter.frequency.linearRampToValueAtTime(opts.filterPeak, duration * 0.55);
    chain.filter.frequency.linearRampToValueAtTime(opts.filterStart, duration);

    var t = 0;
    progression.forEach(function(chord) {
      var tones = chordTones(chord.root, chord.off);

      padChord(offline, chain.input, tones, t, chordDur * 1.05, opts.padVol);
      subBass(offline, chain.input, midiToFreq(chord.root - 12), t, chordDur * 0.95, opts.bassVol);

      var extended = tones.concat(tones.map(function(f) { return f * 2; }));
      var steps = Math.round(chordDur / opts.noteDur);
      for (var s = 0; s < steps; s++) {
        var noteT = t + s * opts.noteDur;
        var freq = extended[ARP_PATTERN[s % ARP_PATTERN.length] % extended.length];
        var accent = (s % 4 === 0) ? opts.arpVol : opts.arpVol * 0.7;

        var target = chain.input;
        if (offline.createStereoPanner) {
          var panner = offline.createStereoPanner();
          panner.pan.value = (s % 2 === 0) ? -0.32 : 0.32;
          panner.connect(chain.input);
          target = panner;
        }
        synthPluck(offline, target, freq, noteT, opts.noteDur * 0.9, accent);
      }

      if (opts.drums) {
        var beats = Math.round(chordDur / 0.5);
        for (var b = 0; b < beats; b++) {
          var bt = t + b * 0.5;
          if (b % 2 === 0) kick(offline, chain.input, bt, opts.kickVol);
          hat(offline, chain.input, bt + 0.25, opts.hatVol);
        }
      }

      t += chordDur;
    });

    return offline.startRendering();
  }

  // ── Pistas de menú (idle): ambiente sintético relajado, sin percusión ──

  function buildMenuLoops() {
    var opts = {
      duration: 16, noteDur: 0.5,
      padVol: 0.05, bassVol: 0.05, arpVol: 0.085,
      filterStart: 900, filterPeak: 2600, drums: false
    };
    menuLoops = [
      renderTrack(MENU_PROGRESSION, opts),
      renderTrack(rotate(MENU_PROGRESSION, 2), opts) // misma tonalidad, otro punto de partida (C–G–Am–F)
    ];
  }

  // ── Pistas de partida (running): más ritmo, arpegio rápido y percusión ──

  function buildGameLoops() {
    var opts = {
      duration: 16, noteDur: 0.25,
      padVol: 0.045, bassVol: 0.07, arpVol: 0.095,
      filterStart: 1200, filterPeak: 4600, drums: true,
      kickVol: 0.22, hatVol: 0.06
    };
    gameLoops = [
      renderTrack(GAME_PROGRESSION, opts),
      renderTrack(rotate(GAME_PROGRESSION, 2), opts)
    ];
  }

  function buildAllLoops() {
    buildMenuLoops();
    buildGameLoops();
  }

  // ── Reproducción en bucle, rotando pistas ────────────────────────────

  function stopCurrent() {
    if (currentSource) {
      try { currentSource.onended = null; currentSource.stop(); } catch (e) {}
      currentSource = null;
    }
  }

  function playNext(loops, indexRef, mode) {
    if (currentMode !== mode) return; // se cambió de pantalla mientras cargaba
    loops[indexRef.i].then(function(buffer) {
      if (currentMode !== mode) return; // se canceló mientras renderizaba
      var src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(musicBus);
      src.onended = function() {
        if (currentMode !== mode) return;
        indexRef.i = (indexRef.i + 1) % loops.length;
        playNext(loops, indexRef, mode);
      };
      currentSource = src;
      src.start(0);
    });
  }

  function playMenuMusic() {
    if (!initialized) init();
    resume();
    if (currentMode === 'menu') return;
    stopCurrent();
    currentMode = 'menu';
    setIntensity(0);
    playNext(menuLoops, menuIndexRef, 'menu');
  }

  function playGameMusic() {
    if (!initialized) init();
    resume();
    if (currentMode === 'game') return;
    stopCurrent();
    currentMode = 'game';
    setIntensity(0);
    playNext(gameLoops, gameIndexRef, 'game');
  }

  function stopMusic() {
    currentMode = null;
    stopCurrent();
  }

  // ── Efectos de sonido puntuales ───────────────────────────────────────

  // Comer: dos pulsos ascendentes tipo "moneda", con un toque de hi-hat.
  function playEat() {
    if (!ctx) return;
    var now = ctx.currentTime;
    synthPluck(ctx, musicBus, 880, now, 0.12, 0.22);
    synthPluck(ctx, musicBus, 1174.66, now + 0.07, 0.14, 0.2);
    hat(ctx, musicBus, now, 0.12);

    if (navigator.vibrate) navigator.vibrate([25, 20, 25]);
  }

  // Choque: zap descendente con filtro cerrándose + golpe grave.
  function playCollision() {
    if (!ctx) return;
    var now = ctx.currentTime;

    var osc = ctx.createOscillator();
    var filt = ctx.createBiquadFilter();
    var gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.35);
    filt.type = 'lowpass';
    filt.frequency.setValueAtTime(3000, now);
    filt.frequency.exponentialRampToValueAtTime(200, now + 0.35);
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
    osc.connect(filt); filt.connect(gain); gain.connect(musicBus);
    osc.start(now); osc.stop(now + 0.42);

    kick(ctx, musicBus, now + 0.02, 0.28);

    if (navigator.vibrate) navigator.vibrate([120, 60, 120]);
  }

  // Game over: acorde de pad sostenido + arpegio descendente que resuelve
  // en la raíz grave, y una breve caída del filtro maestro (sensación de
  // "apagado") que se recupera para la siguiente partida.
  function playGameOver() {
    if (!ctx) return;
    var now = ctx.currentTime;

    padChord(ctx, musicBus, chordTones(57, [0, 3, 7]), now, 2.6, 0.09);

    var t = now + 0.15;
    var descent = [880, 783.99, 659.25, 523.25, 440, 349.23, 220];
    descent.forEach(function(f) {
      synthPluck(ctx, musicBus, f, t, 0.35, 0.14);
      t += 0.22;
    });

    if (masterFilter) {
      masterFilter.frequency.cancelScheduledValues(now);
      masterFilter.frequency.setValueAtTime(masterFilter.frequency.value, now);
      masterFilter.frequency.exponentialRampToValueAtTime(400, now + 2.2);
      masterFilter.frequency.exponentialRampToValueAtTime(4200, now + 2.6);
    }

    if (navigator.vibrate) navigator.vibrate([80, 40, 80, 40, 250]);
  }

  return {
    init: init,
    playMenuMusic: playMenuMusic,
    playGameMusic: playGameMusic,
    stopMusic: stopMusic,
    playEat: playEat,
    playCollision: playCollision,
    playGameOver: playGameOver,
    setIntensity: setIntensity
  };
})();



