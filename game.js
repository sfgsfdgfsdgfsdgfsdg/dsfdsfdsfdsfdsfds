import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.162.0/build/three.module.js';
import { PointerLockControls } from 'https://cdn.jsdelivr.net/npm/three@0.162.0/examples/jsm/controls/PointerLockControls.js';

const episodeText = document.getElementById('episodeText');
const introOverlay = document.getElementById('introOverlay');
const startBtn = document.getElementById('startBtn');
const stabilityEl = document.getElementById('stability');
const timerEl = document.getElementById('timer');
const nodesEl = document.getElementById('nodes');

const barrelCanvas = document.getElementById('barrelCanvas');
const barrelCtx = barrelCanvas.getContext('2d');

function drawBarrel(t) {
  const w = barrelCanvas.width;
  const h = barrelCanvas.height;
  barrelCtx.fillStyle = '#020203';
  barrelCtx.fillRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2;
  const rotating = (t * 0.0014) % (Math.PI * 2);

  for (let i = 0; i < 12; i++) {
    const angle = rotating + (i / 12) * Math.PI * 2;
    const x = cx + Math.cos(angle) * 210;
    const y = cy + Math.sin(angle) * 210;
    barrelCtx.strokeStyle = 'rgba(211,218,239,0.5)';
    barrelCtx.lineWidth = 44;
    barrelCtx.beginPath();
    barrelCtx.arc(x, y, 180, angle + 1.2, angle + 2.4);
    barrelCtx.stroke();
  }

  barrelCtx.fillStyle = '#0a0e19';
  barrelCtx.beginPath();
  barrelCtx.arc(cx, cy, 120, 0, Math.PI * 2);
  barrelCtx.fill();

  const drop = Math.max(0, (t - 1800) / 900);
  const agentY = cy - 60 + Math.min(drop, 1) * 180;
  barrelCtx.fillStyle = '#dce3f5';
  barrelCtx.fillRect(cx - 16, agentY, 32, 90);
  barrelCtx.fillStyle = '#101423';
  barrelCtx.fillRect(cx - 14, agentY + 10, 28, 18);

  const fade = Math.max(0, Math.min(1, (t - 2350) / 450));
  if (fade > 0) {
    barrelCtx.fillStyle = `rgba(160,0,0,${0.6 * fade})`;
    barrelCtx.fillRect(0, 0, w, h);
  }
}

let introStart = performance.now();
let introStopped = false;
function introLoop(now) {
  if (introStopped) return;
  drawBarrel(now - introStart);
  requestAnimationFrame(introLoop);
}
requestAnimationFrame(introLoop);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111827);
scene.fog = new THREE.Fog(0x111827, 20, 130);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 700);
camera.position.set(0, 2, 6);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new PointerLockControls(camera, document.body);
scene.add(controls.getObject());

const hemi = new THREE.HemisphereLight(0xdde7ff, 0x151515, 1.3);
scene.add(hemi);
const dir = new THREE.DirectionalLight(0xffffff, 1.1);
dir.position.set(8, 16, 2);
scene.add(dir);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(250, 250),
  new THREE.MeshStandardMaterial({ color: 0x30343f })
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

const clock = new THREE.Clock();
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
const move = { forward: false, backward: false, left: false, right: false, sprint: false };

const blocks = [];
const nodeTargets = [];
const pulses = [];
const raycaster = new THREE.Raycaster();
let stability = 100;
let timer = 180;
let running = false;

function createParisBlock(x, z, w, d, h, color) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.2 })
  );
  mesh.position.set(x, h / 2, z);
  scene.add(mesh);
  blocks.push(mesh);
}

function populateEnvironment() {
  const palette = [0xb8b8b0, 0xd5d2cd, 0x8d95a6, 0x7e8b7d, 0x5f6268];
  for (let i = -5; i <= 5; i++) {
    createParisBlock(i * 11, -18, 9, 8, 5 + Math.random() * 6, palette[(i + 7) % palette.length]);
    createParisBlock(i * 11, 18, 9, 8, 5 + Math.random() * 6, palette[(i + 11) % palette.length]);
  }

  const street = new THREE.Mesh(
    new THREE.PlaneGeometry(150, 25),
    new THREE.MeshStandardMaterial({ color: 0x23252a })
  );
  street.rotation.x = -Math.PI / 2;
  street.position.set(0, 0.01, 0);
  scene.add(street);

  const lane = new THREE.Mesh(
    new THREE.PlaneGeometry(150, 0.4),
    new THREE.MeshBasicMaterial({ color: 0xf3f0be })
  );
  lane.rotation.x = -Math.PI / 2;
  lane.position.set(0, 0.02, 0);
  scene.add(lane);

  for (let i = 0; i < 6; i++) {
    const tree = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.25, 2.6),
      new THREE.MeshStandardMaterial({ color: 0x5a442f })
    );
    tree.position.set(-40 + i * 15, 1.3, 10 + (i % 2 === 0 ? 6 : -6));
    scene.add(tree);
    const crown = new THREE.Mesh(
      new THREE.SphereGeometry(1.4, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0x274c33 })
    );
    crown.position.set(tree.position.x, 3.4, tree.position.z);
    scene.add(crown);
  }
}

function spawnNodes() {
  nodeTargets.forEach((n) => scene.remove(n));
  nodeTargets.length = 0;

  const count = 5;
  for (let i = 0; i < count; i++) {
    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(0.65, 18, 18),
      new THREE.MeshStandardMaterial({ color: 0xff4d4d, emissive: 0x440000 })
    );
    orb.position.set((Math.random() - 0.5) * 90, 1.1, (Math.random() - 0.5) * 40);
    orb.userData.hp = 2;
    scene.add(orb);
    nodeTargets.push(orb);
  }
  nodesEl.textContent = String(nodeTargets.length);
}

const conflicts = [
  'A famous Paris baker is blackmailed over inherited recipe rights by a malicious cousin. Neutralize pressure nodes before reputations collapse.',
  'Two metro engineers are pushed into sabotage by a vindictive former partner. Disable coercion beacons and stabilize the district.',
  'A gallery owner faces targeted social ruin by an obsessed ex-ally. Dissolve networked intimidation points before panic spreads.',
  'A neighborhood mediator is trapped in a manipulated debt spiral by a malicious former friend. Remove leverage devices and secure calm.',
  'A florist family is being psychologically cornered by a resentful relative. Erase disruption relays to protect everyday life.'
];

function setEpisodeText() {
  const objective = conflicts[Math.floor(Math.random() * conflicts.length)];
  episodeText.textContent = `Episode ${Math.floor(Math.random() * 900 + 100)} · ${objective} No public spectacle. No corruption or terrorism. Non-lethal field response only.`;
}

function shootPulse() {
  if (!running || !controls.isLocked) return;
  const pulse = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xe4f2ff })
  );
  pulse.position.copy(camera.position);
  const dirVec = new THREE.Vector3();
  camera.getWorldDirection(dirVec);
  pulse.userData.velocity = dirVec.multiplyScalar(90);
  pulse.userData.life = 1.2;
  scene.add(pulse);
  pulses.push(pulse);
}

window.addEventListener('click', shootPulse);
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyW') move.forward = true;
  if (e.code === 'KeyS') move.backward = true;
  if (e.code === 'KeyA') move.left = true;
  if (e.code === 'KeyD') move.right = true;
  if (e.code === 'ShiftLeft') move.sprint = true;
  if (e.code === 'KeyR') resetEpisode();
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'KeyW') move.forward = false;
  if (e.code === 'KeyS') move.backward = false;
  if (e.code === 'KeyA') move.left = false;
  if (e.code === 'KeyD') move.right = false;
  if (e.code === 'ShiftLeft') move.sprint = false;
});

function resetEpisode() {
  stability = 100;
  timer = 180;
  spawnNodes();
  setEpisodeText();
  stabilityEl.textContent = String(stability);
  timerEl.textContent = String(timer);
  running = true;
}

function endEpisode(success) {
  running = false;
  if (success) {
    episodeText.textContent = 'Episode secured. Civilian relationships stabilized. Press R for a new standalone operation.';
  } else {
    episodeText.innerHTML = '<span class="warning">Episode failed. Social pressure collapsed. Press R to deploy again.</span>';
  }
}

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.04);

  if (controls.isLocked && running) {
    velocity.x -= velocity.x * 10 * delta;
    velocity.z -= velocity.z * 10 * delta;

    direction.z = Number(move.forward) - Number(move.backward);
    direction.x = Number(move.right) - Number(move.left);
    direction.normalize();

    const speed = move.sprint ? 52 : 32;
    if (move.forward || move.backward) velocity.z -= direction.z * speed * delta;
    if (move.left || move.right) velocity.x -= direction.x * speed * delta;

    controls.moveRight(-velocity.x * delta);
    controls.moveForward(-velocity.z * delta);

    const pos = controls.getObject().position;
    pos.y = 2;
    pos.x = THREE.MathUtils.clamp(pos.x, -70, 70);
    pos.z = THREE.MathUtils.clamp(pos.z, -48, 48);

    timer -= delta;
    if (timer <= 0) {
      timer = 0;
      endEpisode(false);
    }

    if (Math.random() < 0.006 + (5 - nodeTargets.length) * 0.0015 && nodeTargets.length > 0) {
      stability = Math.max(0, stability - 1);
      stabilityEl.textContent = String(stability);
      if (stability === 0) endEpisode(false);
    }
  }

  for (let i = pulses.length - 1; i >= 0; i--) {
    const p = pulses[i];
    p.position.addScaledVector(p.userData.velocity, delta);
    p.userData.life -= delta;

    raycaster.set(p.position, p.userData.velocity.clone().normalize());
    const hits = raycaster.intersectObjects(nodeTargets, false);
    if (hits.length > 0 && hits[0].distance < 1.0) {
      const node = hits[0].object;
      node.userData.hp -= 1;
      if (node.userData.hp <= 0) {
        scene.remove(node);
        nodeTargets.splice(nodeTargets.indexOf(node), 1);
        nodesEl.textContent = String(nodeTargets.length);
        stability = Math.min(100, stability + 5);
        stabilityEl.textContent = String(stability);
        if (nodeTargets.length === 0) endEpisode(true);
      }
      scene.remove(p);
      pulses.splice(i, 1);
      continue;
    }

    if (p.userData.life <= 0) {
      scene.remove(p);
      pulses.splice(i, 1);
    }
  }

  timerEl.textContent = String(Math.ceil(timer));
  renderer.render(scene, camera);
}

populateEnvironment();
resetEpisode();
animate();

startBtn.addEventListener('click', () => {
  introStopped = true;
  introOverlay.classList.add('hidden');
  controls.lock();
});

controls.addEventListener('unlock', () => {
  episodeText.textContent = 'Paused. Click to re-enter field.';
});
controls.addEventListener('lock', () => {
  if (running) setEpisodeText();
});
