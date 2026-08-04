// skins.js — catálogo de apariencias de la serpiente, lógica de desbloqueo
// por logros y persistencia en localStorage. No depende de ningún otro
// archivo del juego; render.js e input.js lo consultan para pintar y
// para manejar el menú de skins.

var SKINS = [
  {
    id: 'clasica',
    name: 'Clásica',
    pattern: 'solid',
    colors: { head: '#8be04a', mid: '#4fbf5e', tail: '#2f8f57', glow: 'rgba(139,224,74,0.35)' },
    unlock: { type: 'default', label: 'Desbloqueada desde el inicio' }
  },
  {
    id: 'escarcha',
    name: 'Escarcha',
    pattern: 'scales',
    colors: { head: '#bfe9ff', mid: '#6ec3e8', tail: '#3d7fa8', glow: 'rgba(110,195,232,0.45)' },
    unlock: { type: 'score', value: 15, label: 'Consigue 15 puntos en una partida' }
  },
  {
    id: 'fuego',
    name: 'Fuego',
    pattern: 'stripes',
    colors: { head: '#ffb347', mid: '#ff6f3c', tail: '#c23b1f', glow: 'rgba(255,111,60,0.5)' },
    unlock: { type: 'score', value: 30, label: 'Consigue 30 puntos en una partida' }
  },
  {
    id: 'dorada',
    name: 'Dorada',
    pattern: 'scales',
    colors: { head: '#ffe27a', mid: '#ffc93c', tail: '#c98f12', glow: 'rgba(255,201,60,0.55)' },
    unlock: { type: 'score', value: 50, label: 'Consigue 50 puntos en una partida' }
  },
  {
    id: 'pixel',
    name: 'Pixel Retro',
    pattern: 'pixel',
    colors: { head: '#f4f4f4', mid: '#bdbdbd', tail: '#6e6e6e', glow: 'rgba(255,255,255,0.22)' },
    unlock: { type: 'totalFood', value: 100, label: 'Come 100 frutas en total (todas las partidas)' }
  },
  {
    id: 'arcoiris',
    name: 'Arcoíris',
    pattern: 'rainbow',
    colors: { head: '#ff6bcb', mid: '#8b6bff', tail: '#4fbfff', glow: 'rgba(139,107,255,0.5)' },
    unlock: { type: 'score', value: 75, label: 'Consigue 75 puntos en una partida' }
  }
];

var SkinManager = (function() {
  var STORAGE_KEY = 'snake_skins_v1';
  var state = { unlocked: ['clasica'], selected: 'clasica', totalFood: 0, bestEver: 0 };
  var lastUnlocked = null; // última skin desbloqueada, para avisar en pantalla

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && parsed.unlocked) state = parsed;
      }
    } catch (e) { /* sin localStorage: se usa el estado por defecto en memoria */ }
  }

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
  }

  function isUnlocked(id) { return state.unlocked.indexOf(id) !== -1; }

  function getSkin(id) {
    for (var i = 0; i < SKINS.length; i++) if (SKINS[i].id === id) return SKINS[i];
    return SKINS[0];
  }

  function getActive() { return getSkin(state.selected); }

  function select(id) {
    if (!isUnlocked(id)) return false;
    state.selected = id;
    save();
    return true;
  }

  function checkUnlocks() {
    SKINS.forEach(function(s) {
      if (isUnlocked(s.id)) return;
      var u = s.unlock;
      var met = (u.type === 'score' && state.bestEver >= u.value) ||
                (u.type === 'totalFood' && state.totalFood >= u.value);
      if (met) {
        state.unlocked.push(s.id);
        lastUnlocked = s;
      }
    });
  }

  // Llamar al terminar cada partida, con el puntaje final.
  function registerGameEnd(score) {
    if (score > state.bestEver) state.bestEver = score;
    checkUnlocks();
    save();
  }

  // Llamar cada vez que se come una fruta (progreso acumulado entre partidas).
  function registerFoodEaten() {
    state.totalFood++;
    checkUnlocks();
    save();
  }

  // Devuelve la última skin desbloqueada (para mostrar un aviso) y la limpia.
  function consumeUnlockNotice() {
    var n = lastUnlocked;
    lastUnlocked = null;
    return n;
  }

  function progressFor(skin) {
    var u = skin.unlock;
    if (u.type === 'score') return { current: Math.min(state.bestEver, u.value), target: u.value };
    if (u.type === 'totalFood') return { current: Math.min(state.totalFood, u.value), target: u.value };
    return null;
  }

  load();

  return {
    list: SKINS,
    isUnlocked: isUnlocked,
    getSkin: getSkin,
    getActive: getActive,
    select: select,
    registerGameEnd: registerGameEnd,
    registerFoodEaten: registerFoodEaten,
    consumeUnlockNotice: consumeUnlockNotice,
    progressFor: progressFor
  };
})();

// ── Estado de la interfaz del menú de skins ─────────────────────────────────
// uiMode: 'game' (normal) | 'skins' (menú de selección abierto)
// Estas variables las usa input.js (para saber a dónde enrutar los toques)
// y render.js (para saber qué dibujar).
var uiMode = 'game';
var skinsMenuIndex = 0;
