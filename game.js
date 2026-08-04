// game.js — state, game loop, resize, and boot
// draw() is defined in render.js; input listeners are set up in input.js

var COLS = 20;
var ROWS = 20;
var FPS  = 9;
var TICK_MS = 1000 / FPS;
var CELL; // pixels per cell, computed in resize()

// ── State ─────────────────────────────────────────────────────────────────

var snake, dir, nextDir, food, foodIsSpecial, foodsEaten, score, best, phase, loopTimer;
var prevSnake = []; // posiciones de cada segmento antes del tick actual, para interpolar el movimiento
var gameOverTimers = [];
var lastTickTime = 0; // performance.now() timestamp of the last tick, for smooth interpolation
var screenShake = 0;  // pixels of shake amplitude, decays back to 0
var pendingUnlockNotice = null; // última skin desbloqueada al morir, para mostrar aviso en el overlay
// phase: 'idle' | 'running' | 'dead'
// Every 10 foods eaten, the next food is a special one worth 5 points instead of 1.
var SPECIAL_FOOD_EVERY = 10;
var SPECIAL_FOOD_VALUE = 5;

function init() {
  snake      = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
  prevSnake  = snake.map(function(s) { return { x: s.x, y: s.y }; });
  dir        = { x: 1, y: 0 };
  nextDir    = { x: 1, y: 0 };
  score      = 0;
  foodsEaten = 0;
  screenShake = 0;
  placeFood();
}

function placeFood() {
  foodIsSpecial = foodsEaten >= SPECIAL_FOOD_EVERY && ((foodsEaten + 1) % SPECIAL_FOOD_EVERY === 1);
  do {
    food = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
  } while (snake.some(function(s) { return s.x === food.x && s.y === food.y; }));
}

function start() {
  if (loopTimer) clearInterval(loopTimer);
  gameOverTimers.forEach(function(id) { clearTimeout(id); });
  gameOverTimers = [];
  pendingUnlockNotice = null;
  init();
  phase        = 'running';
  lastTickTime = performance.now();
  loopTimer    = setInterval(tick, TICK_MS);
  AudioManager.playGameMusic();
}

// ── Game loop ──────────────────────────────────────────────────────────────

function tick() {
  dir = nextDir;
  lastTickTime = performance.now();
  prevSnake = snake.map(function(s) { return { x: s.x, y: s.y }; });

  var head = { x: (snake[0].x + dir.x + COLS) % COLS,
               y: (snake[0].y + dir.y + ROWS) % ROWS };

  if (snake.some(function(s) { return s.x === head.x && s.y === head.y; })) {
    phase = 'dead';
    best  = Math.max(best, score);
    clearInterval(loopTimer);
    AudioManager.stopMusic();
    AudioManager.playCollision();
    triggerShake(9);
    gameOverTimers.push(setTimeout(function() { AudioManager.playGameOver(); }, 150));
    SkinManager.registerGameEnd(score);
    pendingUnlockNotice = SkinManager.consumeUnlockNotice();
    draw();
    return;
  }

  snake.unshift(head);

  if (head.x === food.x && head.y === food.y) {
    score += foodIsSpecial ? SPECIAL_FOOD_VALUE : 1;
    foodsEaten++;
    var particleColor = foodIsSpecial ? '#ffd452' : '#ff5f5f';
    spawnEatParticles(food.x * CELL + CELL / 2, food.y * CELL + CELL / 2, particleColor);
    placeFood();
    AudioManager.playEat();
    AudioManager.setIntensity(Math.min(1, score / 40));
    SkinManager.registerFoodEaten();
  } else {
    snake.pop();
  }

  draw();
}

// Sacudida breve de pantalla (se usa al chocar); decae sola cuadro a cuadro.
function triggerShake(amount) {
  screenShake = amount;
}
function decayShake() {
  if (screenShake > 0) {
    screenShake *= 0.85;
    if (screenShake < 0.3) screenShake = 0;
  }
}

// ── Resize ────────────────────────────────────────────────────────────────

function resize() {
  var size  = Math.min(window.innerWidth, window.innerHeight);
  CELL      = Math.floor(size / COLS);
  var px    = CELL * COLS;
  canvas.width  = px;
  canvas.height = px;
  draw();
}

window.addEventListener('resize', resize);

// ── Boot ──────────────────────────────────────────────────────────────────

best  = 0;
phase = 'idle';
init();
resize();

// Separate render loop (independent of the game tick) so background
// animations keep running smoothly even while idle, dead, or between ticks.
(function renderLoop() {
  decayShake();
  draw();
  requestAnimationFrame(renderLoop);
})();
