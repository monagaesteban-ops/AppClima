// game.js — state, game loop, resize, and boot
// draw() is defined in render.js; input listeners are set up in input.js

var COLS = 20;
var ROWS = 20;
var FPS  = 9;
var CELL; // pixels per cell, computed in resize()

// ── State ─────────────────────────────────────────────────────────────────

var snake, dir, nextDir, food, foodIsSpecial, foodsEaten, score, best, phase, loopTimer;
// phase: 'idle' | 'running' | 'dead'
// Every 10 foods eaten, the next food is a special one worth 5 points instead of 1.
var SPECIAL_FOOD_EVERY = 10;
var SPECIAL_FOOD_VALUE = 5;

function init() {
  snake      = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
  dir        = { x: 1, y: 0 };
  nextDir    = { x: 1, y: 0 };
  score      = 0;
  foodsEaten = 0;
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
  init();
  phase     = 'running';
  loopTimer = setInterval(tick, 1000 / FPS);
  AudioManager.playGameMusic();
}

// ── Game loop ──────────────────────────────────────────────────────────────

function tick() {
  dir = nextDir;

  var head = { x: (snake[0].x + dir.x + COLS) % COLS,
               y: (snake[0].y + dir.y + ROWS) % ROWS };

  if (snake.some(function(s) { return s.x === head.x && s.y === head.y; })) {
    phase = 'dead';
    best  = Math.max(best, score);
    clearInterval(loopTimer);
    AudioManager.playCollision();
    setTimeout(function() { AudioManager.playGameOver(); }, 150);
    setTimeout(function() { AudioManager.playMenuMusic(); }, 1400);
    draw();
    return;
  }

  snake.unshift(head);

  if (head.x === food.x && head.y === food.y) {
    score += foodIsSpecial ? SPECIAL_FOOD_VALUE : 1;
    foodsEaten++;
    placeFood();
    AudioManager.playEat();
  } else {
    snake.pop();
  }

  draw();
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
  draw();
  requestAnimationFrame(renderLoop);
})();