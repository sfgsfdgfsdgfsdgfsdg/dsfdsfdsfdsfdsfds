const gameCanvas = document.getElementById('gameCanvas');
const gtx = gameCanvas.getContext('2d');
const introCanvas = document.getElementById('introCanvas');
const itx = introCanvas.getContext('2d');
const menu = document.getElementById('menu');
const menuContent = document.getElementById('menuContent');
const startBtn = document.getElementById('startBtn');
const hud = document.getElementById('hud');
const crosshair = document.getElementById('crosshair');
const modeLabel = document.getElementById('modeLabel');
const targetLabel = document.getElementById('targetLabel');

const FOV = Math.PI / 3;
const MAP = [
  '1111111111111111',
  '1000000000000001',
  '1011110111111101',
  '1000010000000101',
  '1011010111100101',
  '1010010000100101',
  '1011111110100101',
  '1000000010100001',
  '1110111010111101',
  '1000100010000101',
  '1011101111100101',
  '1000001000000001',
  '1011101011111101',
  '1000101000000001',
  '1000000010000001',
  '1111111111111111',
];
const TILE = 64;

let state = 'intro';
let introStarted = performance.now();
let nyxMode = 'Panther';
const keys = new Set();

const player = {
  x: TILE * 2.4,
  y: TILE * 2.1,
  angle: 0.15,
  speed: 150,
  turnSpeed: 2.4,
  fireCooldown: 0,
};

const enemies = [
  { x: TILE * 10.2, y: TILE * 3.5, alive: true },
  { x: TILE * 12.6, y: TILE * 13.2, alive: true },
  { x: TILE * 4.3, y: TILE * 12.8, alive: true },
  { x: TILE * 9.1, y: TILE * 8.2, alive: true },
  { x: TILE * 13.3, y: TILE * 5.6, alive: true },
];

function resize() {
  gameCanvas.width = window.innerWidth;
  gameCanvas.height = window.innerHeight;
  introCanvas.width = window.innerWidth;
  introCanvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

function tileAt(x, y) {
  const mx = Math.floor(x / TILE);
  const my = Math.floor(y / TILE);
  if (!MAP[my] || !MAP[my][mx]) return '1';
  return MAP[my][mx];
}

function castRay(angle) {
  const sin = Math.sin(angle);
  const cos = Math.cos(angle);
  for (let depth = 1; depth < TILE * 18; depth += 1) {
    const rx = player.x + cos * depth;
    const ry = player.y + sin * depth;
    if (tileAt(rx, ry) === '1') {
      return { depth, hitX: rx, hitY: ry };
    }
  }
  return { depth: TILE * 18, hitX: player.x, hitY: player.y };
}

function drawSkyAndFloor() {
  const w = gameCanvas.width;
  const h = gameCanvas.height;
  const grdSky = gtx.createLinearGradient(0, 0, 0, h * 0.62);
  grdSky.addColorStop(0, '#7a8a9f');
  grdSky.addColorStop(0.45, '#39495f');
  grdSky.addColorStop(1, '#192334');
  gtx.fillStyle = grdSky;
  gtx.fillRect(0, 0, w, h * 0.62);

  const grdFloor = gtx.createLinearGradient(0, h * 0.62, 0, h);
  grdFloor.addColorStop(0, '#30343a');
  grdFloor.addColorStop(1, '#0f1419');
  gtx.fillStyle = grdFloor;
  gtx.fillRect(0, h * 0.62, w, h * 0.38);
}

function renderWorld() {
  drawSkyAndFloor();
  const w = gameCanvas.width;
  const h = gameCanvas.height;
  const rays = w;
  const zBuffer = new Array(rays);

  for (let x = 0; x < rays; x += 1) {
    const rayAngle = player.angle - FOV / 2 + (x / rays) * FOV;
    const ray = castRay(rayAngle);
    const correctedDepth = ray.depth * Math.cos(rayAngle - player.angle);
    zBuffer[x] = correctedDepth;
    const wallHeight = Math.min(h, (TILE * h) / (correctedDepth + 0.0001));
    const shade = Math.max(0.14, 1 - correctedDepth / (TILE * 12));

    const edge = Math.abs((ray.hitX + ray.hitY) % TILE);
    const detail = edge < 3 || edge > TILE - 3 ? 1.14 : 1;
    const r = Math.floor(75 * shade * detail);
    const g = Math.floor(88 * shade * detail);
    const b = Math.floor(102 * shade * detail);

    gtx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    gtx.fillRect(x, (h - wallHeight) / 2, 1, wallHeight);
  }

  const aliveEnemies = enemies
    .filter((e) => e.alive)
    .map((e) => {
      const dx = e.x - player.x;
      const dy = e.y - player.y;
      const dist = Math.hypot(dx, dy);
      let rel = Math.atan2(dy, dx) - player.angle;
      while (rel > Math.PI) rel -= Math.PI * 2;
      while (rel < -Math.PI) rel += Math.PI * 2;
      return { ...e, dist, rel };
    })
    .filter((e) => Math.abs(e.rel) < FOV * 0.7)
    .sort((a, b) => b.dist - a.dist);

  aliveEnemies.forEach((e) => {
    const screenX = ((e.rel + FOV / 2) / FOV) * w;
    const size = Math.min(h * 0.72, (TILE * h * 0.75) / e.dist);
    const top = h / 2 - size / 2;
    const left = screenX - size / 2;

    const centerX = Math.floor(screenX);
    if (centerX >= 0 && centerX < w && e.dist < zBuffer[centerX] + 18) {
      const hue = nyxMode === 'Helicopter' ? '#9ef7ff' : '#f7d8de';
      gtx.fillStyle = hue;
      gtx.fillRect(left, top, size, size * 0.96);
      gtx.fillStyle = '#212831';
      gtx.fillRect(left + size * 0.12, top + size * 0.2, size * 0.3, size * 0.12);
      gtx.fillRect(left + size * 0.58, top + size * 0.2, size * 0.3, size * 0.12);
      gtx.fillStyle = '#ff3f66';
      gtx.fillRect(left + size * 0.4, top + size * 0.62, size * 0.2, size * 0.16);
    }
  });

  const vignette = gtx.createRadialGradient(w / 2, h / 2, h * 0.18, w / 2, h / 2, h * 0.7);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.55)');
  gtx.fillStyle = vignette;
  gtx.fillRect(0, 0, w, h);

  targetLabel.textContent = `Targets: ${enemies.filter((e) => e.alive).length}`;
}

function tryMove(dx, dy) {
  const nx = player.x + dx;
  const ny = player.y + dy;
  if (tileAt(nx, player.y) !== '1') player.x = nx;
  if (tileAt(player.x, ny) !== '1') player.y = ny;
}

function update(dt) {
  const moveSpeed = (nyxMode === 'Helicopter' ? player.speed * 1.35 : player.speed) * dt;
  const turnSpeed = player.turnSpeed * dt;

  if (keys.has('a')) {
    tryMove(Math.cos(player.angle - Math.PI / 2) * moveSpeed, Math.sin(player.angle - Math.PI / 2) * moveSpeed);
  }
  if (keys.has('d')) {
    tryMove(Math.cos(player.angle + Math.PI / 2) * moveSpeed, Math.sin(player.angle + Math.PI / 2) * moveSpeed);
  }
  if (keys.has('w')) {
    tryMove(Math.cos(player.angle) * moveSpeed, Math.sin(player.angle) * moveSpeed);
  }
  if (keys.has('s')) {
    tryMove(-Math.cos(player.angle) * moveSpeed, -Math.sin(player.angle) * moveSpeed);
  }
  if (keys.has('arrowleft')) player.angle -= turnSpeed;
  if (keys.has('arrowright')) player.angle += turnSpeed;

  player.fireCooldown = Math.max(0, player.fireCooldown - dt);
}

function fire() {
  if (player.fireCooldown > 0 || state !== 'playing') return;
  player.fireCooldown = 0.2;
  const hitAngleLimit = 0.08;
  const lineDistMax = TILE * 10;

  enemies.forEach((e) => {
    if (!e.alive) return;
    const dx = e.x - player.x;
    const dy = e.y - player.y;
    const dist = Math.hypot(dx, dy);
    if (dist > lineDistMax) return;
    let rel = Math.atan2(dy, dx) - player.angle;
    while (rel > Math.PI) rel -= Math.PI * 2;
    while (rel < -Math.PI) rel += Math.PI * 2;
    const wall = castRay(player.angle).depth;
    if (Math.abs(rel) < hitAngleLimit && dist < wall + 8) {
      e.alive = false;
    }
  });

  crosshair.style.transform = 'translate(-50%, -50%) scale(1.2)';
  setTimeout(() => {
    crosshair.style.transform = 'translate(-50%, -50%) scale(1)';
  }, 80);
}

function drawIntro() {
  const elapsed = (performance.now() - introStarted) / 1000;
  const w = introCanvas.width;
  const h = introCanvas.height;

  itx.fillStyle = '#000';
  itx.fillRect(0, 0, w, h);

  const centerX = w / 2;
  const centerY = h / 2;

  for (let i = 0; i < 12; i += 1) {
    const ring = ((elapsed * 130) + i * 72) % (Math.max(w, h) * 1.15);
    const alpha = 1 - ring / (Math.max(w, h) * 1.2);
    itx.beginPath();
    itx.strokeStyle = `rgba(220, 230, 245, ${Math.max(0, alpha * 0.5)})`;
    itx.lineWidth = 20;
    itx.arc(centerX, centerY, ring, 0, Math.PI * 2);
    itx.stroke();
  }

  const sweep = ((elapsed * 1.6) % 1) * w;
  itx.fillStyle = 'rgba(255,255,255,0.06)';
  itx.fillRect(sweep - 90, 0, 180, h);

  const silhouetteX = centerX + Math.sin(elapsed * 1.9) * w * 0.22;
  itx.fillStyle = '#06090f';
  itx.fillRect(silhouetteX - 40, centerY - 180, 80, 260);
  itx.beginPath();
  itx.arc(silhouetteX, centerY - 210, 42, 0, Math.PI * 2);
  itx.fill();

  itx.fillStyle = '#d50032';
  itx.fillRect(silhouetteX + 16, centerY - 126, 16, 16);

  itx.fillStyle = 'rgba(255,255,255,0.94)';
  itx.font = '700 34px Inter, sans-serif';
  itx.textAlign = 'center';
  itx.fillText('OBSIDIAN BARREL SEQUENCE', centerX, h * 0.86);

  if (elapsed > 4.3) {
    menuContent.classList.remove('hidden');
  }

  if (state === 'intro') requestAnimationFrame(drawIntro);
}

function loop(ts) {
  if (!loop.last) loop.last = ts;
  const dt = Math.min(0.033, (ts - loop.last) / 1000);
  loop.last = ts;

  if (state === 'playing') {
    update(dt);
    renderWorld();
  }
  requestAnimationFrame(loop);
}

startBtn.addEventListener('click', async () => {
  state = 'playing';
  menu.classList.add('hidden');
  hud.classList.remove('hidden');
  crosshair.classList.remove('hidden');
  gameCanvas.requestPointerLock?.();
  loop.last = performance.now();
});

window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  keys.add(k);

  if (k === ' ' && state === 'playing') {
    e.preventDefault();
    fire();
  }

  if (k === 'h' && state === 'playing') {
    nyxMode = nyxMode === 'Panther' ? 'Helicopter' : 'Panther';
    modeLabel.textContent = `Nyx Mode: ${nyxMode}`;
  }
});

window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
window.addEventListener('click', () => fire());
window.addEventListener('mousemove', (e) => {
  if (state !== 'playing' || document.pointerLockElement !== gameCanvas) return;
  player.angle += e.movementX * 0.0022;
});

menuContent.classList.add('hidden');
drawIntro();
requestAnimationFrame(loop);
