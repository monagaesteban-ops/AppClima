// render.js — canvas setup and all drawing code (Nokia/Xenzia LCD style)
// Reads globals defined in game.js: CELL, COLS, ROWS, snake, food, score, best, phase

var canvas = document.getElementById('canvas');
var ctx    = canvas.getContext('2d');

// Real Nokia 1100-style LCD palette: olive/yellow-green screen, dark brown-olive pixels
var COLORS = {
  bgA:       [154, 156, 78],   // olive green  — one end of the background oscillation
  bgB:       [30, 30, 30],     // dark gray/black — the other end
  border:    '#3a3a1c',   // dark frame line under the score
  pixel:     '#3a3a1c',   // "on" LCD pixel — snake, food, text (all one dark tone)
  specialFood: '#f5f5f0',  // near-white for the special (5-point) food
  text:      '#3a3a1c',
  dimText:   'rgba(58,58,28,0.65)',
  overlay:   'rgba(58,58,28,0.55)',
};

// Slowly oscillates the background between bgA and bgB using a sine wave —
// smooth, slow, not jarring.
var INK_A = [25, 25, 10];     // dark olive ink — used when the bg is light/olive
var INK_B = [245,245,235];  // light ink — used when the bg goes dark, for contrast

function bgProgress() {
  return (Math.sin(Date.now() / 6000) + 1) / 2; // 0..1
}

function mixColor(a, b, t) {
  var r = Math.round(a[0] + (b[0] - a[0]) * t);
  var g = Math.round(a[1] + (b[1] - a[1]) * t);
  var bl = Math.round(a[2] + (b[2] - a[2]) * t);
  return 'rgb(' + r + ',' + g + ',' + bl + ')';
}

function currentBg() {
  return mixColor(COLORS.bgA, COLORS.bgB, bgProgress());
}

// The snake/text ink color shifts opposite the background so it always stays
// readable, whether the screen is currently olive or dark.
function currentInk() {
  return mixColor(INK_A, INK_B, bgProgress());
}

// Draws one rounded dot-matrix "pixel" — matches the chained blob look of the real screen
function cell(x, y, color, scale) {
  scale = scale || 1;
  var cx = x * CELL + CELL / 2;
  var cy = y * CELL + CELL / 2;
  var r  = (CELL / 2 - 1) * scale;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawEyes(head, neck) {
  // Direction the head is facing: from neck toward head, or straight up if the
  // snake hasn't moved yet.
  var fx = 0, fy = -1;
  if (neck) {
    var dx = head.x - neck.x, dy = head.y - neck.y;
    // Handle wrap-around neighbors so eyes don't point the wrong way
    if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1 && (dx !== 0 || dy !== 0)) {
      fx = dx; fy = dy;
    }
  }
  var px = -fy, py = fx; // perpendicular vector, for left/right eye placement

  var cx = head.x * CELL + CELL / 2;
  var cy = head.y * CELL + CELL / 2;
  var fwd  = CELL * 0.22;
  var side = CELL * 0.22;
  var eyeR = Math.max(1.2, CELL * 0.09);

  ctx.fillStyle = currentBg();
  [1, -1].forEach(function(s) {
    var ex = cx + fx * fwd + px * side * s;
    var ey = cy + fy * fwd + py * side * s;
    ctx.beginPath();
    ctx.arc(ex, ey, eyeR, 0, Math.PI * 2);
    ctx.fill();
  });
}

function draw() {
  var W = canvas.width, H = canvas.height;

  ctx.fillStyle = currentBg();
  ctx.fillRect(0, 0, W, H);

  // Food — solid round dot; the special (5-point) food is bigger and white
  if (typeof foodIsSpecial !== 'undefined' && foodIsSpecial) {
    cell(food.x, food.y, COLORS.specialFood, 1.8);
  } else {
    cell(food.x, food.y, currentInk());
  }

  // Snake — drawn as one continuous joined body (like the real LCD screen),
  // not separate touching dots: a thick round-jointed stroke through every segment center.
  if (snake.length > 0) {
    var fullWidth = CELL - 2;
    var TAPER = Math.min(4, snake.length - 1); // how many links near the tail taper down

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // Head taper: the first couple links bulge out a bit wider than the body,
    // so the head reads as a distinct, broader shape (like a real snake head).
    var HEAD_TAPER = Math.min(2, snake.length - 1);
    var headWidth = fullWidth * 1.3;
    var mainStart = HEAD_TAPER;
    for (var h = 0; h < HEAD_TAPER; h++) {
      var ha = snake[h], hb = snake[h + 1];
      var adjacentHB = Math.abs(hb.x - ha.x) <= 1 && Math.abs(hb.y - ha.y) <= 1;
      if (!adjacentHB) continue;
      var hProgress = h / HEAD_TAPER; // 0 at head, 1 at the point it rejoins the body
      var hw = headWidth - (headWidth - fullWidth) * hProgress;
      ctx.lineWidth = hw;
      ctx.strokeStyle = currentInk();
      ctx.beginPath();
      ctx.moveTo(ha.x * CELL + CELL / 2, ha.y * CELL + CELL / 2);
      ctx.lineTo(hb.x * CELL + CELL / 2, hb.y * CELL + CELL / 2);
      ctx.stroke();
    }

    // Main body: everything except the head bulge and tapering tail section,
    // drawn as one constant-width path (fast, and avoids seams between segments).
    var mainEnd = snake.length - 1 - TAPER; // last index still at full width
    if (mainEnd > mainStart) {
      ctx.lineWidth = fullWidth;
      ctx.strokeStyle = currentInk();
      ctx.beginPath();
      var prev = null;
      for (var i = mainStart; i <= mainEnd; i++) {
        var s = snake[i];
        var cx = s.x * CELL + CELL / 2;
        var cy = s.y * CELL + CELL / 2;
        var adjacent = prev && Math.abs(s.x - prev.x) <= 1 && Math.abs(s.y - prev.y) <= 1;
        if (!adjacent) ctx.moveTo(cx, cy);
        else ctx.lineTo(cx, cy);
        prev = s;
      }
      ctx.stroke();
    }

    // Tapering tail: each link from mainEnd to the very last segment gets
    // progressively thinner, so the tail narrows to a point like a real snake.
    var tailStart = Math.max(mainEnd, 0);
    for (var t = tailStart; t < snake.length - 1; t++) {
      var a = snake[t], b = snake[t + 1];
      var adjacentAB = Math.abs(b.x - a.x) <= 1 && Math.abs(b.y - a.y) <= 1;
      if (!adjacentAB) continue; // wrapped around an edge — leave the gap
      var progress = (t - tailStart + 1) / (snake.length - 1 - tailStart); // 0..1 toward the tip
      var w = fullWidth * (1 - progress * 0.75); // narrows to ~25% width at the tip
      ctx.lineWidth = Math.max(2, w);
      ctx.strokeStyle = currentInk();
      ctx.beginPath();
      ctx.moveTo(a.x * CELL + CELL / 2, a.y * CELL + CELL / 2);
      ctx.lineTo(b.x * CELL + CELL / 2, b.y * CELL + CELL / 2);
      ctx.stroke();
    }

    // Fill the joint where the main body meets the taper, so there's no seam
    if (mainEnd >= 0) cell(snake[mainEnd].x, snake[mainEnd].y, currentInk(), mainEnd === snake.length - 1 ? 1 : fullWidth / CELL);

    // Head: slightly larger round cap (matches the bulge) plus two small
    // eye-dots cut out in the direction of travel, so it clearly reads as a head.
    var head = snake[0];
    cell(head.x, head.y, currentInk(), 1.3);
    drawEyes(head, snake.length > 1 ? snake[1] : null);

    // Very tip of the tail: a small dot so it comes to a rounded point
    if (snake.length > 1) {
      cell(snake[snake.length - 1].x, snake[snake.length - 1].y, currentInk(), 0.28);
    }
  }

  // Divider line + score, bottom-left, like the real screen's digit readout
  var fontSize = Math.max(12, CELL * 0.9);
  var lineY = H - fontSize * 1.6;

  ctx.strokeStyle = currentInk();
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(CELL * 0.3, lineY);
  ctx.lineTo(W - CELL * 0.3, lineY);
  ctx.stroke();

  ctx.font = 'bold ' + fontSize + 'px monospace';
ctx.fillStyle = currentInk();

// Score (izquierda)
ctx.textAlign = 'left';
ctx.fillText('S:' + String(score).padStart(3, '0'),
             CELL * 0.4,
             H - fontSize * 0.5);

// Food (centro)
ctx.textAlign = 'center';
ctx.fillText('F:' + String(foodsEaten).padStart(3, '0'),
             W / 2,
             H - fontSize * 0.5);

// Best (derecha)
if (best) {
  ctx.textAlign = 'right';
  ctx.font = Math.max(10, CELL * 0.55) + 'px monospace';
  ctx.fillText('BEST ' + best,
               W - CELL * 0.4,
               H - fontSize * 0.5);
}

// Restaurar alineación
ctx.textAlign = 'left';

  if (phase === 'idle') {
    drawOverlay('SNAKE', 'swipe or press  \u2190 \u2191 \u2192 \u2193  to start');
  } else if (phase === 'dead') {
    drawOverlay('GAME OVER', 'score ' + score + '   tap or press arrow to play again');
  }
}

function drawOverlay(title, sub) {
  var W = canvas.width, H = canvas.height;
  var titleSize = Math.max(20, CELL * 1.6);
  var subSize   = Math.max(11, CELL * 0.65);

  ctx.fillStyle = currentBg();
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.font = 'bold ' + titleSize + 'px monospace';
  ctx.fillStyle = currentInk();
  ctx.fillText(title, W / 2, H / 2 - titleSize * 0.6);

  ctx.font = subSize + 'px monospace';
  ctx.fillStyle = currentInk();
  ctx.fillText(sub, W / 2, H / 2 + subSize * 1.4);
  ctx.textAlign = 'left';
}