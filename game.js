import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.166.1/build/three.module.js';
import { PointerLockControls } from 'https://cdn.jsdelivr.net/npm/three@0.166.1/examples/jsm/controls/PointerLockControls.js';

const missions = [
  {
    place: 'Rue Cler market district',
    context: 'An ISS courier dropped encrypted route chips among evening shoppers.',
    objective: 'Recover 5 encrypted chips and disable all hostile auto-turrets before they shred the evidence.'
  },
  {
    place: 'Belleville residential blocks',
    context: 'A malicious private operator scattered kinetic decoy nodes between apartment rooftops.',
    objective: 'Secure 6 data capsules and clear the decoy nodes before they overload local power lines.'
  },
  {
    place: 'Bercy riverside promenade',
    context: 'A hostile contractor deployed blast drones around delivery depots.',
    objective: 'Collect 4 tactical drives and neutralize every drone to keep the district stable.'
  },
  {
    place: 'Latin Quarter cafe lanes',
    context: 'An enemy handler buried signal amplifiers near crowded terraces to hijack ISS relays.',
    objective: 'Retrieve 5 relay keys and destroy all amplifiers before the relay blackout locks in.'
  }
];

const barrelSequence = document.getElementById('barrel-sequence');
const enterBtn = document.getElementById('enter-btn');
const hud = document.getElementById('hud');
const missionText = document.getElementById('mission-text');
const objectiveText = document.getElementById('objective-text');
const healthEl = document.getElementById('health');
const targetsEl = document.getElementById('targets');
const episodeEl = document.getElementById('episode');
const endScreen = document.getElementById('end-screen');
const endTitle = document.getElementById('end-title');
const endBody = document.getElementById('end-body');
const nextBtn = document.getElementById('next-btn');

let scene;
let camera;
let renderer;
let controls;
let clock;
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let sprint = false;
let velocity = new THREE.Vector3();
let direction = new THREE.Vector3();
let raycaster = new THREE.Raycaster();

let episode = 1;
let health = 100;
let running = false;
let collectibles = [];
let hostiles = [];
let environmentExplosives = [];

const playerHeight = 1.65;

function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x7085a1);
  scene.fog = new THREE.Fog(0x7085a1, 10, 120);

  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 500);
  camera.position.set(0, playerHeight, 12);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  document.body.appendChild(renderer.domElement);

  clock = new THREE.Clock();
  controls = new PointerLockControls(camera, document.body);
  scene.add(controls.getObject());

  const light = new THREE.HemisphereLight(0xffffff, 0x3c4a59, 1.0);
  scene.add(light);

  const sun = new THREE.DirectionalLight(0xffffff, 1.1);
  sun.position.set(30, 50, -20);
  sun.castShadow = true;
  scene.add(sun);

  createGround();
  createParisBlocks();
  setupInput();
  startEpisode();

  window.addEventListener('resize', onResize);
  animate();
}

function createGround() {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(260, 260),
    new THREE.MeshStandardMaterial({ color: 0x4f5857 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
}

function createParisBlocks() {
  const palette = [0xcdbba7, 0xd8c8b5, 0xe2d8cb, 0xbfb2a2];
  for (let i = 0; i < 60; i += 1) {
    const height = 4 + Math.random() * 10;
    const block = new THREE.Mesh(
      new THREE.BoxGeometry(8, height, 8),
      new THREE.MeshStandardMaterial({ color: palette[i % palette.length] })
    );
    block.position.set((Math.random() - 0.5) * 200, height / 2, (Math.random() - 0.5) * 200);
    block.castShadow = true;
    block.receiveShadow = true;
    scene.add(block);
  }

  const roads = new THREE.Mesh(
    new THREE.PlaneGeometry(220, 220),
    new THREE.MeshStandardMaterial({ color: 0x30363b })
  );
  roads.rotation.x = -Math.PI / 2;
  roads.position.y = 0.02;
  scene.add(roads);
}

function setupInput() {
  document.addEventListener('keydown', (event) => {
    switch (event.code) {
      case 'KeyW':
        moveForward = true;
        break;
      case 'KeyS':
        moveBackward = true;
        break;
      case 'KeyA':
        moveLeft = true;
        break;
      case 'KeyD':
        moveRight = true;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        sprint = true;
        break;
      case 'KeyR':
        if (!running) {
          episode += 1;
          startEpisode();
        }
        break;
      default:
        break;
    }
  });

  document.addEventListener('keyup', (event) => {
    switch (event.code) {
      case 'KeyW':
        moveForward = false;
        break;
      case 'KeyS':
        moveBackward = false;
        break;
      case 'KeyA':
        moveLeft = false;
        break;
      case 'KeyD':
        moveRight = false;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        sprint = false;
        break;
      default:
        break;
    }
  });

  document.addEventListener('click', () => {
    if (!controls.isLocked && barrelSequence.classList.contains('hidden')) {
      controls.lock();
    } else if (controls.isLocked) {
      shoot();
    }
  });
}

function startEpisode() {
  running = true;
  endScreen.classList.add('hidden');
  health = 100;
  healthEl.textContent = health;

  episodeEl.textContent = episode;
  clearObjects(collectibles);
  clearObjects(hostiles);
  clearObjects(environmentExplosives);

  const mission = missions[Math.floor(Math.random() * missions.length)];
  missionText.textContent = `Paris episode ${episode}: ${mission.place}. ${mission.context}`;
  objectiveText.textContent = `${mission.objective} No wider conspiracy; this operation is standalone.`;

  spawnCollectibles(4 + (episode % 3));
  spawnHostiles(5 + (episode % 4));
  spawnExplosives(7);
  targetsEl.textContent = hostiles.length;

  controls.getObject().position.set(0, playerHeight, 12);
}

function clearObjects(list) {
  list.forEach((entry) => {
    scene.remove(entry.mesh);
  });
  list.length = 0;
}

function spawnCollectibles(count) {
  for (let i = 0; i < count; i += 1) {
    const mesh = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.35, 0),
      new THREE.MeshStandardMaterial({ color: 0xe8f3ff, emissive: 0x2a8eff, emissiveIntensity: 0.8 })
    );
    mesh.position.set((Math.random() - 0.5) * 90, 0.7, (Math.random() - 0.5) * 90);
    scene.add(mesh);
    collectibles.push({ mesh, collected: false });
  }
}

function spawnHostiles(count) {
  for (let i = 0; i < count; i += 1) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.9, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0xaf1e1e, emissive: 0x460a0a })
    );
    mesh.position.set((Math.random() - 0.5) * 85, 1.0, (Math.random() - 0.5) * 85);
    scene.add(mesh);
    hostiles.push({ mesh, hp: 2 + Math.floor(Math.random() * 2), cooldown: Math.random() * 2 });
  }
}

function spawnExplosives(count) {
  for (let i = 0; i < count; i += 1) {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.45, 1.1, 10),
      new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0x771d1d })
    );
    mesh.position.set((Math.random() - 0.5) * 80, 0.6, (Math.random() - 0.5) * 80);
    scene.add(mesh);
    environmentExplosives.push({ mesh, active: true });
  }
}

function shoot() {
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const targetMeshes = [
    ...hostiles.map((h) => h.mesh),
    ...environmentExplosives.filter((e) => e.active).map((e) => e.mesh)
  ];
  const hit = raycaster.intersectObjects(targetMeshes, false)[0];
  if (!hit) return;

  const hostile = hostiles.find((h) => h.mesh === hit.object);
  if (hostile) {
    hostile.hp -= 1;
    hostile.mesh.material.emissiveIntensity = 1.7;
    setTimeout(() => {
      if (hostile.mesh.material) hostile.mesh.material.emissiveIntensity = 1;
    }, 80);
    if (hostile.hp <= 0) {
      explosionAt(hostile.mesh.position, 2.6);
      scene.remove(hostile.mesh);
      hostiles = hostiles.filter((h) => h !== hostile);
      targetsEl.textContent = hostiles.length;
    }
    return;
  }

  const explosive = environmentExplosives.find((e) => e.mesh === hit.object);
  if (explosive) {
    explosive.active = false;
    explosionAt(explosive.mesh.position, 4.0, true);
    scene.remove(explosive.mesh);
  }
}

function explosionAt(position, radius, chain = false) {
  const flash = new THREE.PointLight(0xff8844, 4, 16);
  flash.position.copy(position);
  scene.add(flash);
  setTimeout(() => scene.remove(flash), 90);

  if (chain) {
    hostiles.forEach((hostile) => {
      if (hostile.mesh.position.distanceTo(position) < radius + 2.2) {
        hostile.hp = 0;
        scene.remove(hostile.mesh);
      }
    });
    hostiles = hostiles.filter((h) => h.hp > 0);
    targetsEl.textContent = hostiles.length;
  }
}

function updateCollectibles() {
  const playerPos = controls.getObject().position;
  collectibles.forEach((entry) => {
    if (!entry.collected && entry.mesh.position.distanceTo(playerPos) < 1.4) {
      entry.collected = true;
      scene.remove(entry.mesh);
    }
  });
}

function updateHostiles(delta) {
  if (!running) return;
  const playerPos = controls.getObject().position;

  hostiles.forEach((hostile) => {
    const dir = new THREE.Vector3().subVectors(playerPos, hostile.mesh.position);
    const dist = dir.length();
    dir.normalize();

    if (dist > 3) {
      hostile.mesh.position.addScaledVector(dir, delta * 3.7);
    }

    hostile.cooldown -= delta;
    if (dist < 20 && hostile.cooldown <= 0) {
      health = Math.max(0, health - 6);
      healthEl.textContent = health;
      hostile.cooldown = 1.1 + Math.random() * 0.8;
    }
  });

  if (health <= 0) {
    running = false;
    showEnd(false);
  }
}

function updatePlayer(delta) {
  if (!controls.isLocked || !running) return;

  velocity.x -= velocity.x * 10.0 * delta;
  velocity.z -= velocity.z * 10.0 * delta;

  direction.z = Number(moveForward) - Number(moveBackward);
  direction.x = Number(moveRight) - Number(moveLeft);
  direction.normalize();

  const speed = sprint ? 25 : 15;
  if (moveForward || moveBackward) velocity.z -= direction.z * speed * delta;
  if (moveLeft || moveRight) velocity.x -= direction.x * speed * delta;

  controls.moveRight(-velocity.x * delta);
  controls.moveForward(-velocity.z * delta);

  const pos = controls.getObject().position;
  pos.y = playerHeight;
  pos.x = THREE.MathUtils.clamp(pos.x, -110, 110);
  pos.z = THREE.MathUtils.clamp(pos.z, -110, 110);
}

function showEnd(success) {
  controls.unlock();
  endScreen.classList.remove('hidden');
  if (success) {
    endTitle.textContent = `Episode ${episode} Complete`;
    endBody.textContent = 'Agent E-006 secured the district. Mission closed cleanly with no cliffhanger and no larger narrative thread.';
  } else {
    endTitle.textContent = `Episode ${episode} Failed`;
    endBody.textContent = 'Hostile pressure overwhelmed the field run. Reset for a fresh standalone assignment.';
  }
}

function checkWinState() {
  const remainingCollectibles = collectibles.filter((x) => !x.collected).length;
  if (running && hostiles.length === 0 && remainingCollectibles === 0) {
    running = false;
    showEnd(true);
  }
}

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();

  updatePlayer(delta);
  updateCollectibles();
  updateHostiles(delta);
  checkWinState();

  renderer.render(scene, camera);
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

enterBtn.addEventListener('click', () => {
  barrelSequence.classList.add('hidden');
  hud.classList.remove('hidden');
  if (!scene) init();
  controls.lock();
});

nextBtn.addEventListener('click', () => {
  episode += 1;
  startEpisode();
  controls.lock();
});
