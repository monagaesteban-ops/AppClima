// audio.js — sonidos generados con Web Audio API + vibraciones
// Todo se genera de forma procedural (sin archivos externos), así que
// funciona 100% offline y no usa ningún audio con copyright.

var AudioManager = (function() {
  var ctx = null;
  var initialized = false;

  var menuLoops = [];
  var gameLoops = [];
  var menuIndex = 0;
  var gameIndex = 0;

  var currentSource = null;
  var currentMode = null; // 'menu' | 'game' | null

  // ── Setup ──────────────────────────────────────────────────────────────

  function init() {
    if (initialized) return;
    initialized = true;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    buildAllLoops();
  }

  function resume() {
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  // ── Generación de tonos ───────────────────────────────────────────────

  function scheduleTone(destCtx, frequency, startTime, duration, volume, type) {
    var osc  = destCtx.createOscillator();
    var gain = destCtx.createGain();

    osc.type = type || 'sine';
    osc.frequency.value = frequency;

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(volume, startTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(destCtx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);
  }

  // ── Timbres tipo instrumento ──────────────────────────────────────────

  // "Guitarra": dos osciladores ligeramente desafinados (como cuerdas
  // dobles), ataque muy rápido y caída exponencial natural, como un pulsado.
  function pluckGuitar(destCtx, freq, startTime, duration, volume) {
    var oscA   = destCtx.createOscillator();
    var oscB   = destCtx.createOscillator();
    var filter = destCtx.createBiquadFilter();
    var gain   = destCtx.createGain();

    filter.type = 'lowpass';
    filter.frequency.value = freq * 4 + 600;

    oscA.type = 'sawtooth';
    oscB.type = 'triangle';
    oscA.frequency.value = freq;
    oscB.frequency.value = freq;
    oscB.detune.value = 6;

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(volume, startTime + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    oscA.connect(filter);
    oscB.connect(filter);
    filter.connect(gain);
    gain.connect(destCtx.destination);

    oscA.start(startTime); oscA.stop(startTime + duration + 0.05);
    oscB.start(startTime); oscB.stop(startTime + duration + 0.05);
  }

  // "Violín": oscilador con vibrato (LFO en frecuencia) y ataque de arco
  // más lento, para una nota sostenida y expresiva.
  function bowViolin(destCtx, freq, startTime, duration, volume) {
    var osc     = destCtx.createOscillator();
    var gain    = destCtx.createGain();
    var lfo     = destCtx.createOscillator();
    var lfoGain = destCtx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.value = freq;

    lfo.type = 'sine';
    lfo.frequency.value = 5.5;
    lfoGain.gain.value = freq * 0.012;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    var release = Math.min(0.18, duration * 0.35);
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(volume, startTime + Math.min(0.12, duration * 0.3));
    gain.gain.setValueAtTime(volume, startTime + duration - release);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(destCtx.destination);

    lfo.start(startTime); lfo.stop(startTime + duration + 0.1);
    osc.start(startTime); osc.stop(startTime + duration + 0.1);
  }

  function chordPluck(destCtx, freqs, startTime, duration, volume) {
    freqs.forEach(function(f) { pluckGuitar(destCtx, f, startTime, duration, volume); });
  }

  // Pieza de 20s: acordes de guitarra sostenidos (re-pulsados a la mitad
  // para que no se apaguen) como colchón de ambiente, y encima una
  // melodía de violín propiamente dicha (ritmo variado, con silencios
  // para que respire) — no una escala corrida, sino una frase musical.
  function renderMelodyPiece(chords, melody, chordVol, melVol) {
    var duration = 20;
    var offline = new OfflineAudioContext(1, Math.ceil(44100 * duration), 44100);

    var t = 0;
    chords.forEach(function(chord) {
      chordPluck(offline, chord.freqs, t, chord.dur, chordVol);
      chordPluck(offline, chord.freqs, t + chord.dur * 0.5, chord.dur * 0.5, chordVol * 0.65);
      t += chord.dur;
    });

    var mt = 0;
    melody.forEach(function(note) {
      if (note.f) bowViolin(offline, note.f, mt, note.d, melVol);
      mt += note.d;
    });

    return offline.startRendering();
  }

  // ── Loops de la pantalla de inicio (idle) ────────────────────────────
  // Colchón de acordes + melodía de violín pausada y atmosférica, como
  // quien espera en la entrada de un paraje antes de aventurarse.
  // Piezas de 20s, rotan mientras esté en idle.

  function buildMenuLoops() {
    menuLoops = [
      renderMelodyPiece( // La menor
        [ { freqs: [220.00, 261.63, 329.63], dur: 5 },
          { freqs: [174.61, 220.00, 261.63], dur: 5 },
          { freqs: [196.00, 246.94, 329.63], dur: 5 },
          { freqs: [220.00, 261.63, 329.63], dur: 5 } ],
        [ { f: 440.00, d: 1.4 }, { f: 523.25, d: 0.9 }, { f: 440.00, d: 1.1 }, { f: 0, d: 0.6 },
          { f: 392.00, d: 1.1 }, { f: 440.00, d: 1.1 }, { f: 329.63, d: 1.7 }, { f: 0, d: 0.6 },
          { f: 349.23, d: 1.1 }, { f: 392.00, d: 0.9 }, { f: 440.00, d: 1.3 }, { f: 0, d: 0.6 },
          { f: 329.63, d: 1.1 }, { f: 293.66, d: 1.1 }, { f: 220.00, d: 2.4 } ],
        0.10, 0.11
      ),
      renderMelodyPiece( // Mi menor
        [ { freqs: [164.81, 196.00, 246.94], dur: 5 },
          { freqs: [130.81, 164.81, 196.00], dur: 5 },
          { freqs: [146.83, 185.00, 246.94], dur: 5 },
          { freqs: [164.81, 196.00, 246.94], dur: 5 } ],
        [ { f: 329.63, d: 1.3 }, { f: 392.00, d: 1.0 }, { f: 329.63, d: 1.0 }, { f: 0, d: 0.5 },
          { f: 293.66, d: 1.0 }, { f: 329.63, d: 1.0 }, { f: 246.94, d: 1.6 }, { f: 0, d: 0.6 },
          { f: 261.63, d: 1.0 }, { f: 293.66, d: 0.9 }, { f: 329.63, d: 1.3 }, { f: 0, d: 0.6 },
          { f: 246.94, d: 1.1 }, { f: 220.00, d: 1.1 }, { f: 164.81, d: 2.6 } ],
        0.10, 0.105
      ),
      renderMelodyPiece( // Re menor
        [ { freqs: [146.83, 174.61, 220.00], dur: 5 },
          { freqs: [130.81, 174.61, 220.00], dur: 5 },
          { freqs: [174.61, 220.00, 261.63], dur: 5 },
          { freqs: [146.83, 174.61, 220.00], dur: 5 } ],
        [ { f: 293.66, d: 1.3 }, { f: 349.23, d: 0.9 }, { f: 293.66, d: 1.1 }, { f: 0, d: 0.6 },
          { f: 261.63, d: 1.1 }, { f: 293.66, d: 1.1 }, { f: 220.00, d: 1.7 }, { f: 0, d: 0.6 },
          { f: 246.94, d: 1.0 }, { f: 261.63, d: 0.9 }, { f: 293.66, d: 1.3 }, { f: 0, d: 0.6 },
          { f: 220.00, d: 1.1 }, { f: 196.00, d: 1.1 }, { f: 146.83, d: 2.4 } ],
        0.095, 0.10
      )
    ];
  }

  // ── Loops de fondo durante la partida (running) ──────────────────────
  // Mismo lenguaje (guitarra + violín) pero con la melodía más activa y
  // los acordes cambiando más seguido, como avanzando por el paraje.
  // Piezas de 20s, rotan durante la partida.

  function buildGameLoops() {
    gameLoops = [
      renderMelodyPiece( // La menor
        [ { freqs: [220.00, 261.63, 329.63], dur: 2.5 },
          { freqs: [174.61, 220.00, 261.63], dur: 2.5 },
          { freqs: [196.00, 246.94, 329.63], dur: 2.5 },
          { freqs: [220.00, 261.63, 329.63], dur: 2.5 },
          { freqs: [261.63, 329.63, 392.00], dur: 2.5 },
          { freqs: [220.00, 261.63, 329.63], dur: 2.5 },
          { freqs: [196.00, 246.94, 329.63], dur: 2.5 },
          { freqs: [220.00, 261.63, 329.63], dur: 2.5 } ],
        [ { f: 440.00, d: 0.45 }, { f: 523.25, d: 0.45 }, { f: 440.00, d: 0.35 }, { f: 392.00, d: 0.35 },
          { f: 440.00, d: 0.55 }, { f: 0, d: 0.25 },
          { f: 523.25, d: 0.45 }, { f: 587.33, d: 0.45 }, { f: 523.25, d: 0.35 }, { f: 440.00, d: 0.35 },
          { f: 493.88, d: 0.55 }, { f: 0, d: 0.25 },
          { f: 440.00, d: 0.45 }, { f: 392.00, d: 0.35 }, { f: 440.00, d: 0.35 }, { f: 523.25, d: 0.45 },
          { f: 587.33, d: 0.65 }, { f: 0, d: 0.3 },
          { f: 493.88, d: 0.4 }, { f: 440.00, d: 0.4 }, { f: 392.00, d: 0.4 }, { f: 329.63, d: 0.8 },
          { f: 0, d: 0.3 },
          { f: 440.00, d: 0.4 }, { f: 523.25, d: 0.4 }, { f: 659.25, d: 0.55 }, { f: 587.33, d: 0.4 },
          { f: 523.25, d: 0.7 }, { f: 0, d: 0.3 },
          { f: 440.00, d: 0.4 }, { f: 392.00, d: 0.4 }, { f: 349.23, d: 0.4 }, { f: 392.00, d: 0.4 },
          { f: 440.00, d: 0.9 } ],
        0.11, 0.10
      ),
      renderMelodyPiece( // Mi menor
        [ { freqs: [164.81, 196.00, 246.94], dur: 2.5 },
          { freqs: [130.81, 164.81, 196.00], dur: 2.5 },
          { freqs: [146.83, 185.00, 246.94], dur: 2.5 },
          { freqs: [164.81, 196.00, 246.94], dur: 2.5 },
          { freqs: [196.00, 246.94, 293.66], dur: 2.5 },
          { freqs: [164.81, 196.00, 246.94], dur: 2.5 },
          { freqs: [146.83, 185.00, 246.94], dur: 2.5 },
          { freqs: [164.81, 196.00, 246.94], dur: 2.5 } ],
        [ { f: 329.63, d: 0.4 }, { f: 392.00, d: 0.4 }, { f: 329.63, d: 0.35 }, { f: 293.66, d: 0.35 },
          { f: 329.63, d: 0.55 }, { f: 0, d: 0.25 },
          { f: 392.00, d: 0.4 }, { f: 440.00, d: 0.4 }, { f: 392.00, d: 0.35 }, { f: 329.63, d: 0.35 },
          { f: 369.99, d: 0.55 }, { f: 0, d: 0.25 },
          { f: 329.63, d: 0.4 }, { f: 293.66, d: 0.35 }, { f: 329.63, d: 0.35 }, { f: 392.00, d: 0.4 },
          { f: 440.00, d: 0.65 }, { f: 0, d: 0.3 },
          { f: 369.99, d: 0.4 }, { f: 329.63, d: 0.4 }, { f: 293.66, d: 0.4 }, { f: 246.94, d: 0.8 },
          { f: 0, d: 0.3 },
          { f: 329.63, d: 0.4 }, { f: 392.00, d: 0.4 }, { f: 493.88, d: 0.5 }, { f: 440.00, d: 0.4 },
          { f: 392.00, d: 0.7 }, { f: 0, d: 0.3 },
          { f: 329.63, d: 0.4 }, { f: 293.66, d: 0.4 }, { f: 261.63, d: 0.4 }, { f: 293.66, d: 0.4 },
          { f: 329.63, d: 0.9 } ],
        0.11, 0.095
      ),
      renderMelodyPiece( // Re menor
        [ { freqs: [146.83, 174.61, 220.00], dur: 2.5 },
          { freqs: [130.81, 174.61, 220.00], dur: 2.5 },
          { freqs: [174.61, 220.00, 261.63], dur: 2.5 },
          { freqs: [146.83, 174.61, 220.00], dur: 2.5 },
          { freqs: [164.81, 220.00, 261.63], dur: 2.5 },
          { freqs: [146.83, 174.61, 220.00], dur: 2.5 },
          { freqs: [174.61, 220.00, 261.63], dur: 2.5 },
          { freqs: [146.83, 174.61, 220.00], dur: 2.5 } ],
        [ { f: 293.66, d: 0.4 }, { f: 349.23, d: 0.4 }, { f: 293.66, d: 0.35 }, { f: 261.63, d: 0.35 },
          { f: 293.66, d: 0.55 }, { f: 0, d: 0.25 },
          { f: 349.23, d: 0.4 }, { f: 392.00, d: 0.4 }, { f: 349.23, d: 0.35 }, { f: 293.66, d: 0.35 },
          { f: 329.63, d: 0.55 }, { f: 0, d: 0.25 },
          { f: 293.66, d: 0.4 }, { f: 261.63, d: 0.35 }, { f: 293.66, d: 0.35 }, { f: 349.23, d: 0.4 },
          { f: 392.00, d: 0.65 }, { f: 0, d: 0.3 },
          { f: 329.63, d: 0.4 }, { f: 293.66, d: 0.4 }, { f: 261.63, d: 0.4 }, { f: 220.00, d: 0.8 },
          { f: 0, d: 0.3 },
          { f: 293.66, d: 0.4 }, { f: 349.23, d: 0.4 }, { f: 440.00, d: 0.5 }, { f: 392.00, d: 0.4 },
          { f: 349.23, d: 0.7 }, { f: 0, d: 0.3 },
          { f: 293.66, d: 0.4 }, { f: 261.63, d: 0.4 }, { f: 233.08, d: 0.4 }, { f: 261.63, d: 0.4 },
          { f: 293.66, d: 0.9 } ],
        0.105, 0.095
      )
    ];
  }

  function buildAllLoops() {
    buildMenuLoops();
    buildGameLoops();
  }

  // ── Reproducción en bucle rotando pistas ─────────────────────────────

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
      src.connect(ctx.destination);
      src.onended = function() {
        if (currentMode !== mode) return;
        indexRef.i = (indexRef.i + 1) % loops.length;
        playNext(loops, indexRef, mode);
      };
      currentSource = src;
      src.start(0);
    });
  }

  var menuIndexRef = { i: 0 };
  var gameIndexRef = { i: 0 };

  function playMenuMusic() {
    if (!initialized) init();
    resume();
    if (currentMode === 'menu') return;
    stopCurrent();
    currentMode = 'menu';
    playNext(menuLoops, menuIndexRef, 'menu');
  }

  function playGameMusic() {
    if (!initialized) init();
    resume();
    if (currentMode === 'game') return;
    stopCurrent();
    currentMode = 'game';
    playNext(gameLoops, gameIndexRef, 'game');
  }

  function stopMusic() {
    currentMode = null;
    stopCurrent();
  }

  // ── Efectos de sonido puntuales ───────────────────────────────────────

  function playEat() {
    if (!ctx) return;
    var now = ctx.currentTime;
    scheduleTone(ctx, 880, now,        0.09, 0.18, 'sine');
    scheduleTone(ctx, 880, now + 0.13, 0.09, 0.18, 'sine');

    if (navigator.vibrate) navigator.vibrate([25, 20, 25]);
  }

  function playCollision() {
    if (!ctx) return;
    var now = ctx.currentTime;
    scheduleTone(ctx, 180, now,        0.28, 0.22, 'sawtooth');
    scheduleTone(ctx, 120, now + 0.10, 0.30, 0.18, 'sawtooth');

    if (navigator.vibrate) navigator.vibrate([120, 60, 120]);
  }

  // Jingle de "game over": acorde de guitarra sostenido y una melodía de
  // violín que cae hasta resolver en una nota grave — distinta de las
  // pistas de menú/juego y del golpe seco de la colisión.
  function playGameOver() {
    if (!ctx) return;
    var now = ctx.currentTime;

    chordPluck(ctx, [220.00, 174.61, 130.81], now, 3.2, 0.13);
    chordPluck(ctx, [220.00, 174.61, 130.81], now + 1.6, 1.6, 0.09);

    var t = now + 0.3;
    var melody = [
      { f: 440.00, d: 0.55 }, { f: 392.00, d: 0.5 }, { f: 349.23, d: 0.55 },
      { f: 293.66, d: 0.7 },  { f: 0,      d: 0.2 },
      { f: 261.63, d: 0.6 },  { f: 220.00, d: 0.7 }, { f: 174.61, d: 0.9 },
      { f: 130.81, d: 1.6 }
    ];
    melody.forEach(function(note) {
      if (note.f) bowViolin(ctx, note.f, t, note.d, 0.14);
      t += note.d;
    });

    if (navigator.vibrate) navigator.vibrate([80, 40, 80, 40, 250]);
  }

  return {
    init: init,
    playMenuMusic: playMenuMusic,
    playGameMusic: playGameMusic,
    stopMusic: stopMusic,
    playEat: playEat,
    playCollision: playCollision,
    playGameOver: playGameOver
  };
})();



