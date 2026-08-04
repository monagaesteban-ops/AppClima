// render.js — canvas setup and all drawing code.
// Estilo "aventura" colorido: fondo con degradado tipo bosque, serpiente con
// brillo y cuerpo en degradado, comida tipo gema, partículas al comer y
// sacudida de pantalla al chocar. Movimiento interpolado para que se vea
// fluido en vez de saltar celda a celda.
// Reads globals defined in game.js: CELL, COLS, ROWS, snake, food, score,
// best, phase, dir, lastTickTime, TICK_MS, screenShake

var canvas = document.getElementById('canvas');
var ctx    = canvas.getContext('2d');

var COLORS = {
  bgTop:     '#123a2e',
  bgBottom:  '#0a2420',
  grid:      'rgba(255,255,255,0.035)',
  food:      '#ff5f5f',
  foodGlow:  'rgba(255,95,95,0.55)',
  specialFood: '#ffd452',
  specialGlow: 'rgba(255,212,82,0.65)',
  text:      '#eafff0',
  dimText:   'rgba(234,255,240,0.65)',
  panel:     'rgba(6,26,20,0.82)',
  panelEdge: 'rgba(139,224,74,0.35)',
  danger:    '#ff5f5f'
};

var particles = []; // {x, y, vx, vy, life, maxLife, color, r}

function spawnEatParticles(cx, cy, color) {
  for (var i = 0; i < 10; i++) {
    var ang = (Math.PI * 2 * i) / 10 + Math.random() * 0.3;
    var speed = 40 + Math.random() * 60;
    particles.push({
      x: cx, y: cy,
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed,
      life: 0, maxLife: 0.45 + Math.random() * 0.2,
      color: color, r: 2 + Math.random() * 2
    });
  }
}

var lastParticleTime = null;
function updateParticles() {
  var now = performance.now();
  var dt = lastParticleTime ? Math.min(0.05, (now - lastParticleTime) / 1000) : 0;
  lastParticleTime = now;
  for (var i = particles.length - 1; i >= 0; i--) {
    var p = particles[i];
    p.life += dt;
    if (p.life >= p.maxLife) { particles.splice(i, 1); continue; }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 90 * dt; // gravedad leve
  }
}

function drawParticles() {
  particles.forEach(function(p) {
    var t = 1 - p.life / p.maxLife;
    ctx.globalAlpha = Math.max(0, t);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * t, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

var terrainPatches = null;
var terrainW = 0, terrainH = 0;

function buildTerrainPatches(W, H) {
  var patches = [];
  var count = 10;
  // Posiciones pseudoaleatorias pero deterministas, para que no cambien
  // de frame a frame (se generan una sola vez por tamaño de canvas).
  var seed = 1337;
  function rnd() {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  }
  for (var i = 0; i < count; i++) {
    patches.push({
      x: rnd() * W,
      y: rnd() * H,
      r: (0.12 + rnd() * 0.18) * Math.max(W, H),
      light: rnd() > 0.5
    });
  }
  return patches;
}

function drawBackground(W, H) {
  var g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, COLORS.bgTop);
  g.addColorStop(1, COLORS.bgBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  if (!terrainPatches || terrainW !== W || terrainH !== H) {
    terrainPatches = buildTerrainPatches(W, H);
    terrainW = W; terrainH = H;
  }

  terrainPatches.forEach(function(p) {
    var grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
    if (p.light) {
      grad.addColorStop(0, 'rgba(139,224,74,0.05)');
      grad.addColorStop(1, 'rgba(139,224,74,0)');
    } else {
      grad.addColorStop(0, 'rgba(0,0,0,0.10)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  });

  // Viñeta suave para que los bordes se sientan menos "planos"
  var vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.72);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.30)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
}

function drawFood() {
  var cx = food.x * CELL + CELL / 2;
  var cy = food.y * CELL + CELL / 2;
  var pulse = 1 + Math.sin(Date.now() / 220) * 0.08;
  var special = typeof foodIsSpecial !== 'undefined' && foodIsSpecial;
  var color = special ? COLORS.specialFood : COLORS.food;
  var glow  = special ? COLORS.specialGlow : COLORS.foodGlow;
  var r = (CELL / 2 - 2) * (special ? 1.15 : 0.85) * pulse;

  ctx.save();
  ctx.shadowColor = glow;
  ctx.shadowBlur = special ? 18 : 12;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // brillo pequeño arriba-izquierda, para que se vea como gema/fruta
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.arc(cx - r * 0.35, cy - r * 0.35, r * 0.28, 0, Math.PI * 2);
  ctx.fill();
}

function drawEyesAt(hp, fx, fy) {
  var px = -fy, py = fx;
  var fwd  = CELL * 0.22;
  var side = CELL * 0.22;
  var eyeR = Math.max(1.6, CELL * 0.11);

  [1, -1].forEach(function(s) {
    var ex = hp.x + fx * fwd + px * side * s;
    var ey = hp.y + fy * fwd + py * side * s;
    ctx.fillStyle = '#0a2420';
    ctx.beginPath();
    ctx.arc(ex, ey, eyeR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(ex - eyeR * 0.3, ey - eyeR * 0.3, eyeR * 0.35, 0, Math.PI * 2);
    ctx.fill();
  });
}

// Posición interpolada del segmento i: cada segmento se desliza desde su
// propia posición anterior (prevSnake) hasta la actual, así una curva se ve
// como un giro real y no como si todo el cuerpo se arrastrara en bloque.
// new[i] siempre corresponde a old[i-1] (old[0] para la cabeza), porque
// cada tick el cuerpo avanza "heredando" la posición del segmento de
// adelante.
function segPoint(i, t) {
  var cur  = snake[i];
  var prev = (i === 0) ? prevSnake[0] : prevSnake[i - 1];
  var ix = cur.x, iy = cur.y;
  if (prev) {
    var dx = cur.x - prev.x, dy = cur.y - prev.y;
    if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) { // ignora el salto al envolver el borde
      ix = prev.x + dx * t;
      iy = prev.y + dy * t;
    }
  }
  return { x: ix * CELL + CELL / 2, y: iy * CELL + CELL / 2 };
}

// Devuelve un color de acuerdo al patrón de la skin activa, para el punto
// de recorrido "progress" (0 = cabeza, 1 = cola). Solo 'rainbow' varía el
// color por posición; el resto usa siempre skinColors.mid.
function bodyColorAt(skinColors, pattern, progress) {
  if (pattern !== 'rainbow') return skinColors.mid;
  var hue = (progress * 300 + Date.now() / 20) % 360;
  return 'hsl(' + hue + ', 80%, 62%)';
}

function drawSnake(t, skinOverride) {
  if (snake.length === 0) return;
  var skin = skinOverride || SkinManager.getActive();
  var sc = skin.colors, pattern = skin.pattern;
  var usesGlow = pattern !== 'pixel';

  var fullWidth = CELL - 2;
  var TAPER = Math.min(4, snake.length - 1);
  var HEAD_TAPER = Math.min(2, snake.length - 1);
  var headWidth = fullWidth * 1.3;
  var mainStart = HEAD_TAPER;

  ctx.lineJoin = pattern === 'pixel' ? 'miter' : 'round';
  ctx.lineCap = pattern === 'pixel' ? 'square' : 'round';
  ctx.save();
  if (usesGlow) { ctx.shadowColor = sc.glow; ctx.shadowBlur = 10; }

  for (var h = 0; h < HEAD_TAPER; h++) {
    var ha = snake[h], hb = snake[h + 1];
    var adjacentHB = Math.abs(hb.x - ha.x) <= 1 && Math.abs(hb.y - ha.y) <= 1;
    if (!adjacentHB) continue;
    var hProgress = h / HEAD_TAPER;
    var hw = headWidth - (headWidth - fullWidth) * hProgress;
    ctx.lineWidth = hw;
    ctx.strokeStyle = sc.head;
    var pa = segPoint(h, t), pb = segPoint(h + 1, t);
    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
    ctx.stroke();
  }

  var mainEnd = snake.length - 1 - TAPER;
  if (mainEnd > mainStart) {
    ctx.lineWidth = fullWidth;
    var prevIdx = -1;
    for (var i = mainStart; i <= mainEnd; i++) {
      var p = segPoint(i, t);
      var adjacent = prevIdx >= 0 &&
        Math.abs(snake[i].x - snake[prevIdx].x) <= 1 && Math.abs(snake[i].y - snake[prevIdx].y) <= 1;
      if (pattern === 'rainbow') {
        // Con arcoíris cada tramo cambia de color, así que se traza segmento a segmento.
        if (adjacent) {
          ctx.strokeStyle = bodyColorAt(sc, pattern, (i - mainStart) / (mainEnd - mainStart || 1));
          ctx.beginPath();
          var prevP = segPoint(prevIdx, t);
          ctx.moveTo(prevP.x, prevP.y);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
        }
      } else {
        ctx.strokeStyle = sc.mid;
        if (!adjacent) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      prevIdx = i;
    }
    if (pattern !== 'rainbow') ctx.stroke();

    // Texturas encima del cuerpo principal
    if (pattern === 'scales') drawScalePattern(mainStart, mainEnd, t, fullWidth, sc);
    if (pattern === 'stripes') drawStripePattern(mainStart, mainEnd, t, fullWidth, sc);
    if (pattern === 'pixel') drawPixelPattern(mainStart, mainEnd, t, fullWidth, sc);
  }

  var tailStart = Math.max(mainEnd, 0);
  for (var tI = tailStart; tI < snake.length - 1; tI++) {
    var a = snake[tI], b = snake[tI + 1];
    var adjacentAB = Math.abs(b.x - a.x) <= 1 && Math.abs(b.y - a.y) <= 1;
    if (!adjacentAB) continue;
    var progress = (tI - tailStart + 1) / (snake.length - 1 - tailStart);
    var w = fullWidth * (1 - progress * 0.75);
    ctx.lineWidth = Math.max(2, w);
    ctx.strokeStyle = sc.tail;
    var pa2 = segPoint(tI, t), pb2 = segPoint(tI + 1, t);
    ctx.beginPath();
    ctx.moveTo(pa2.x, pa2.y);
    ctx.lineTo(pb2.x, pb2.y);
    ctx.stroke();
  }

  ctx.restore();

  if (mainEnd >= 0) {
    var jp = segPoint(mainEnd, t);
    ctx.fillStyle = sc.mid;
    ctx.beginPath();
    ctx.arc(jp.x, jp.y, (mainEnd === snake.length - 1 ? CELL / 2 - 1 : fullWidth / 2), 0, Math.PI * 2);
    ctx.fill();
  }

  var hp = segPoint(0, t);
  ctx.save();
  if (usesGlow) { ctx.shadowColor = sc.glow; ctx.shadowBlur = 14; }
  ctx.fillStyle = sc.head;
  ctx.beginPath();
  ctx.arc(hp.x, hp.y, (CELL / 2 - 1) * 1.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Dirección hacia la que miran los ojos: la del movimiento actual.
  var fx = 0, fy = -1;
  if (typeof dir !== 'undefined' && (dir.x !== 0 || dir.y !== 0)) { fx = dir.x; fy = dir.y; }
  drawEyesAt(hp, fx, fy);

  if (snake.length > 1) {
    var tp = segPoint(snake.length - 1, t);
    ctx.fillStyle = sc.tail;
    ctx.beginPath();
    ctx.arc(tp.x, tp.y, (CELL / 2 - 1) * 0.28, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── Texturas de piel ─────────────────────────────────────────────────────

// Escamas: pequeños arcos semitransparentes alternados a lo largo del cuerpo.
function drawScalePattern(mainStart, mainEnd, t, fullWidth, sc) {
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  for (var i = mainStart; i <= mainEnd; i += 2) {
    var p = segPoint(i, t);
    var r = fullWidth * 0.22;
    ctx.beginPath();
    ctx.arc(p.x, p.y - r * 0.3, r, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.fill();
  }
  ctx.restore();
}

// Franjas: pequeñas marcas perpendiculares al recorrido, tipo tigre/serpiente de fuego.
function drawStripePattern(mainStart, mainEnd, t, fullWidth, sc) {
  ctx.save();
  ctx.strokeStyle = 'rgba(20,10,0,0.35)';
  ctx.lineWidth = Math.max(1.5, fullWidth * 0.12);
  for (var i = mainStart; i <= mainEnd; i += 2) {
    var cur = snake[i], nxt = snake[i + 1] || snake[i];
    var dx = nxt.x - cur.x, dy = nxt.y - cur.y;
    var px = -dy, py = dx; // perpendicular
    var p = segPoint(i, t);
    var half = fullWidth * 0.4;
    ctx.beginPath();
    ctx.moveTo(p.x - px * half, p.y - py * half);
    ctx.lineTo(p.x + px * half, p.y + py * half);
    ctx.stroke();
  }
  ctx.restore();
}

// Pixel: cuadraditos discretos en vez de curva continua, look retro 8-bit.
function drawPixelPattern(mainStart, mainEnd, t, fullWidth, sc) {
  ctx.save();
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 1;
  var s = fullWidth * 0.9;
  for (var i = mainStart; i <= mainEnd; i++) {
    var p = segPoint(i, t);
    ctx.strokeRect(p.x - s / 2, p.y - s / 2, s, s);
  }
  ctx.restore();
}

function draw() {
  var W = canvas.width, H = canvas.height;
  updateParticles();

  var shakeX = 0, shakeY = 0;
  if (typeof screenShake !== 'undefined' && screenShake > 0) {
    shakeX = (Math.random() * 2 - 1) * screenShake;
    shakeY = (Math.random() * 2 - 1) * screenShake;
  }

  ctx.save();
  ctx.translate(shakeX, shakeY);

  drawBackground(W, H);
  drawFood();

  // t: progreso (0..1) dentro del tick actual, usado para deslizar cada
  // segmento de la serpiente suavemente entre su posición anterior y la
  // actual (ver segPoint).
  var t = 1;
  if (phase === 'running' && typeof lastTickTime === 'number') {
    t = Math.min(1, (performance.now() - lastTickTime) / TICK_MS);
  }
  drawSnake(t);
  drawParticles();

  ctx.restore();

  drawHUD(W, H);

  if (uiMode === 'skins') {
    drawSkinsMenu(W, H);
    return;
  }

  if (phase === 'idle') {
    drawOverlay('SNAKE', 'toca la pantalla o presiona una flecha\npara comenzar la aventura', false);
    drawSkinsButton(W, H);
  } else if (phase === 'dead') {
    var notice = typeof pendingUnlockNotice !== 'undefined' ? pendingUnlockNotice : null;
    var sub = 'puntaje: ' + score + '\ntoca o presiona una flecha para reintentar';
    if (notice) sub = '¡Nueva skin desbloqueada: ' + notice.name + '!\n' + sub;
    drawOverlay('GAME OVER', sub, true);
    drawSkinsButton(W, H);
  }
}

// ── Botón "Skins" y menú de selección ───────────────────────────────────────

var skinsButtonRect = null; // {x,y,w,h}, usado por input.js para detectar el toque

function drawSkinsButton(W, H) {
  var bw = Math.min(180, W * 0.42), bh = Math.max(30, CELL * 1.05);
  var bx = (W - bw) / 2, by = H - bh - CELL * 0.6;
  skinsButtonRect = { x: bx, y: by, w: bw, h: bh };

  var active = SkinManager.getActive();
  ctx.save();
  ctx.fillStyle = COLORS.panel;
  roundRect(bx, by, bw, bh, bh / 2);
  ctx.fill();
  ctx.strokeStyle = COLORS.panelEdge;
  ctx.lineWidth = 1.5;
  roundRect(bx, by, bw, bh, bh / 2);
  ctx.stroke();

  ctx.fillStyle = active.colors.head;
  ctx.font = Math.max(13, bh * 0.42) + 'px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🎨 Skins', bx + bw / 2, by + bh / 2 + 1);
  ctx.textBaseline = 'alphabetic';
  ctx.restore();
}

// Rects de las zonas táctiles del menú de skins, calculados en cada dibujo
// y leídos por input.js para saber qué se tocó.
var skinsMenuRects = { prev: null, next: null, select: null, close: null };

function drawSkinsMenu(W, H) {
  var skin = SKINS[skinsMenuIndex];
  var unlocked = SkinManager.isUnlocked(skin.id);
  var isActive = SkinManager.getActive().id === skin.id;

  ctx.save();
  ctx.fillStyle = 'rgba(6,20,16,0.88)';
  ctx.fillRect(0, 0, W, H);

  // Vista previa de la skin: una serpiente corta y quieta en el centro.
  var previewCell = Math.min(CELL, W / 14);
  var cx = W / 2, cy = H * 0.36;
  var previewSnake = [
    { x: 0, y: 0 }, { x: -1, y: 0 }, { x: -2, y: 0 }, { x: -3, y: 0 }, { x: -4, y: 0 }
  ];
  var savedSnake = snake, savedPrev = prevSnake, savedCell = CELL, savedDir = dir;
  snake = previewSnake.map(function(s) { return { x: s.x + 6, y: s.y + 4 }; });
  prevSnake = snake;
  CELL = previewCell;
  ctx.save();
  ctx.translate(cx - (6) * previewCell - previewCell / 2, cy - 4 * previewCell - previewCell / 2);
  dir = { x: 1, y: 0 };
  drawSnake(1, skin);
  ctx.restore();
  snake = savedSnake; prevSnake = savedPrev; CELL = savedCell; dir = savedDir;

  if (!unlocked) {
    ctx.fillStyle = 'rgba(6,20,16,0.55)';
    ctx.beginPath();
    ctx.arc(cx, cy, previewCell * 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = (previewCell * 1.6) + 'px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText('🔒', cx, cy + previewCell * 0.55);
  }

  // Nombre y estado
  ctx.textAlign = 'center';
  ctx.font = 'bold ' + Math.max(20, CELL * 1.1) + 'px system-ui, sans-serif';
  ctx.fillStyle = unlocked ? skin.colors.head : COLORS.dimText;
  ctx.fillText(skin.name, cx, H * 0.5);

  ctx.font = Math.max(12, CELL * 0.48) + 'px system-ui, sans-serif';
  ctx.fillStyle = COLORS.dimText;
  if (unlocked) {
    ctx.fillText(isActive ? 'Seleccionada' : 'Desbloqueada — toca "Usar" para equiparla', cx, H * 0.5 + CELL * 0.7);
  } else {
    var prog = SkinManager.progressFor(skin);
    var progText = prog ? ' (' + prog.current + ' / ' + prog.target + ')' : '';
    ctx.fillText(skin.unlock.label + progText, cx, H * 0.5 + CELL * 0.7);
  }

  // Flechas para cambiar de skin (izquierda/derecha)
  var arrowY = H * 0.36;
  var arrowSize = Math.max(20, CELL * 1.2);
  ctx.font = arrowSize + 'px system-ui, sans-serif';
  ctx.fillStyle = COLORS.text;
  var prevX = W * 0.12, nextX = W * 0.88;
  ctx.fillText('‹', prevX, arrowY + arrowSize * 0.35);
  ctx.fillText('›', nextX, arrowY + arrowSize * 0.35);
  skinsMenuRects.prev = { x: 0, y: 0, w: W * 0.28, h: H };
  skinsMenuRects.next = { x: W * 0.72, y: 0, w: W * 0.28, h: H };

  // Indicador de posición (puntitos)
  var dotsY = H * 0.58;
  var dotR = Math.max(2.5, CELL * 0.09);
  var totalW = SKINS.length * dotR * 3.2;
  SKINS.forEach(function(s, idx) {
    var dx = cx - totalW / 2 + idx * dotR * 3.2 + dotR;
    ctx.beginPath();
    ctx.arc(dx, dotsY, dotR, 0, Math.PI * 2);
    ctx.fillStyle = idx === skinsMenuIndex ? COLORS.text : 'rgba(255,255,255,0.3)';
    ctx.fill();
  });

  // Botón "Usar" (solo si está desbloqueada y no es la activa)
  var bw = Math.min(200, W * 0.5), bh = Math.max(34, CELL * 1.1);
  var bx = cx - bw / 2, by = H * 0.68;
  if (unlocked && !isActive) {
    ctx.fillStyle = skin.colors.mid;
    roundRect(bx, by, bw, bh, bh / 2);
    ctx.fill();
    ctx.fillStyle = '#0a2420';
    ctx.font = 'bold ' + Math.max(14, CELL * 0.5) + 'px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Usar esta skin', cx, by + bh / 2 + 1);
    ctx.textBaseline = 'alphabetic';
    skinsMenuRects.select = { x: bx, y: by, w: bw, h: bh };
  } else {
    skinsMenuRects.select = null;
  }

  // Botón "Volver"
  var cbw = Math.min(160, W * 0.4), cbh = Math.max(30, CELL * 0.95);
  var cbx = cx - cbw / 2, cby = H * 0.68 + bh + CELL * 0.5;
  ctx.strokeStyle = COLORS.panelEdge;
  ctx.lineWidth = 1.5;
  roundRect(cbx, cby, cbw, cbh, cbh / 2);
  ctx.stroke();
  ctx.fillStyle = COLORS.dimText;
  ctx.font = Math.max(13, CELL * 0.46) + 'px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Volver', cx, cby + cbh / 2 + 1);
  ctx.textBaseline = 'alphabetic';
  skinsMenuRects.close = { x: cbx, y: cby, w: cbw, h: cbh };

  ctx.textAlign = 'left';
  ctx.restore();
}

function drawHUD(W, H) {
  var fontSize = Math.max(13, CELL * 0.55);
  var barH = fontSize * 2.1;

  ctx.fillStyle = COLORS.panel;
  ctx.fillRect(0, 0, W, barH);
  ctx.strokeStyle = COLORS.panelEdge;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, barH);
  ctx.lineTo(W, barH);
  ctx.stroke();

  ctx.font = 'bold ' + fontSize + 'px system-ui, sans-serif';
  ctx.textBaseline = 'middle';

  ctx.textAlign = 'left';
  ctx.fillStyle = COLORS.text;
  ctx.fillText('⭐ ' + score, CELL * 0.35, barH / 2);

  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.dimText;
  ctx.fillText('🍎 ' + foodsEaten, W / 2, barH / 2);

  ctx.textAlign = 'right';
  ctx.fillStyle = COLORS.specialFood;
  ctx.fillText('🏆 ' + (best || 0), W - CELL * 0.35, barH / 2);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

function drawOverlay(title, sub, isGameOver) {
  var W = canvas.width, H = canvas.height;
  var titleSize = Math.max(24, CELL * 1.5);
  var subSize   = Math.max(12, CELL * 0.5);

  ctx.save();
  ctx.fillStyle = 'rgba(6,20,16,0.72)';
  ctx.fillRect(0, 0, W, H);

  var panelW = W * 0.82, panelH = H * 0.34;
  var px = (W - panelW) / 2, py = (H - panelH) / 2;
  ctx.fillStyle = COLORS.panel;
  roundRect(px, py, panelW, panelH, 18);
  ctx.fill();
  ctx.strokeStyle = isGameOver ? COLORS.danger : COLORS.panelEdge;
  ctx.lineWidth = 2;
  roundRect(px, py, panelW, panelH, 18);
  ctx.stroke();

  var activeColors = SkinManager.getActive().colors;
  ctx.textAlign = 'center';
  ctx.font = 'bold ' + titleSize + 'px system-ui, sans-serif';
  ctx.fillStyle = isGameOver ? COLORS.danger : activeColors.head;
  ctx.shadowColor = isGameOver ? COLORS.danger : activeColors.glow;
  ctx.shadowBlur = 16;
  ctx.fillText(title, W / 2, py + panelH * 0.4);
  ctx.shadowBlur = 0;

  ctx.font = subSize + 'px system-ui, sans-serif';
  ctx.fillStyle = COLORS.dimText;
  var lines = sub.split('\n');
  lines.forEach(function(line, i) {
    ctx.fillText(line, W / 2, py + panelH * 0.68 + i * subSize * 1.4);
  });

  ctx.textAlign = 'left';
  ctx.restore();
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
