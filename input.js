// input.js — keyboard and touch/swipe input
// canvas is defined in render.js (loaded before this file)
// dir, nextDir, phase, start are defined in game.js (loaded after this file)

// ── Audio unlock ──────────────────────────────────────────────────────────
// El audio (Web Audio API) requiere un gesto del usuario para poder sonar.
// El primer gesto solo desbloquea el audio y pone la música de la pantalla
// de inicio; no cuenta como "empezar" el juego. Desde el segundo gesto en
// adelante, el input funciona como siempre.

var audioUnlocked = false;

function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  AudioManager.init();
  if (phase !== 'running') AudioManager.playMenuMusic();
}

// ── Keyboard ──────────────────────────────────────────────────────────────

var KEY_MAP = { 37: 'left', 38: 'up', 39: 'right', 40: 'down' };

document.addEventListener('keydown', function(e) {
  var action = KEY_MAP[e.keyCode];
  if (!action) return;
  e.preventDefault();

  if (!audioUnlocked) { unlockAudio(); return; }

  if (uiMode === 'skins') {
    if (action === 'left')  skinsMenuIndex = (skinsMenuIndex - 1 + SKINS.length) % SKINS.length;
    if (action === 'right') skinsMenuIndex = (skinsMenuIndex + 1) % SKINS.length;
    return;
  }

  if (phase !== 'running') { start(); return; }

  if (action === 'left'  && dir.x === 0) nextDir = { x: -1, y:  0 };
  if (action === 'right' && dir.x === 0) nextDir = { x:  1, y:  0 };
  if (action === 'up'    && dir.y === 0) nextDir = { x:  0, y: -1 };
  if (action === 'down'  && dir.y === 0) nextDir = { x:  0, y:  1 };
});

// ── Skins: botón y menú ──────────────────────────────────────────────────
// canvas puede tener un tamaño CSS distinto al de su buffer interno (width/
// height), así que convertimos coordenadas de cliente a coordenadas de canvas.

function canvasPoint(clientX, clientY) {
  var rect = canvas.getBoundingClientRect();
  var scaleX = canvas.width / rect.width;
  var scaleY = canvas.height / rect.height;
  return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
}

function pointInRect(p, r) {
  return r && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

// Devuelve true si el toque fue consumido por la UI de skins (botón o menú),
// en cuyo caso el input normal del juego (swipe / start) no debe aplicarse.
function handleSkinsTap(clientX, clientY) {
  var p = canvasPoint(clientX, clientY);

  if (uiMode === 'skins') {
    if (pointInRect(p, skinsMenuRects.close)) { uiMode = 'game'; return true; }
    if (pointInRect(p, skinsMenuRects.select)) {
      SkinManager.select(SKINS[skinsMenuIndex].id);
      return true;
    }
    if (pointInRect(p, skinsMenuRects.prev)) {
      skinsMenuIndex = (skinsMenuIndex - 1 + SKINS.length) % SKINS.length;
      return true;
    }
    if (pointInRect(p, skinsMenuRects.next)) {
      skinsMenuIndex = (skinsMenuIndex + 1) % SKINS.length;
      return true;
    }
    return true; // dentro del menú, cualquier otro toque no debe filtrarse al juego
  }

  if (phase !== 'running' && pointInRect(p, skinsButtonRect)) {
    skinsMenuIndex = SKINS.findIndex(function(s) { return s.id === SkinManager.getActive().id; });
    if (skinsMenuIndex < 0) skinsMenuIndex = 0;
    uiMode = 'skins';
    return true;
  }

  return false;
}

// ── Touch / swipe ─────────────────────────────────────────────────────────

var touchStart = null;

canvas.addEventListener('touchstart', function(e) {
  e.preventDefault();
  var t = e.touches[0];
  touchStart = { x: t.clientX, y: t.clientY };
}, { passive: false });

canvas.addEventListener('touchend', function(e) {
  e.preventDefault();
  if (!touchStart) return;

  var t  = e.changedTouches[0];
  var dx = t.clientX - touchStart.x;
  var dy = t.clientY - touchStart.y;
  var start0 = touchStart;
  touchStart = null;

  if (!audioUnlocked) { unlockAudio(); return; }

  if (handleSkinsTap(t.clientX, t.clientY)) return;

  if (phase !== 'running') { start(); return; }

  // Ignore taps — require a real swipe
  if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;

  if (Math.abs(dx) > Math.abs(dy)) {
    if (dx > 0 && dir.x === 0) nextDir = { x:  1, y: 0 };
    if (dx < 0 && dir.x === 0) nextDir = { x: -1, y: 0 };
  } else {
    if (dy > 0 && dir.y === 0) nextDir = { x: 0, y:  1 };
    if (dy < 0 && dir.y === 0) nextDir = { x: 0, y: -1 };
  }
}, { passive: false });

// ── Clic de mouse (para pruebas de escritorio) ──────────────────────────────

canvas.addEventListener('click', function(e) {
  if (!audioUnlocked) { unlockAudio(); return; }
  if (handleSkinsTap(e.clientX, e.clientY)) return;
  if (phase !== 'running') { start(); return; }
});
