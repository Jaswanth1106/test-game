import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { clamp, applyDamage, zoneRadius, outsideZone, circleIntersectsBox, rampHeight, snapToGrid } from './gameLogic.js';
import './style.css';

const $ = (id) => document.getElementById(id);
const ui = Object.fromEntries(['game', 'menu', 'play', 'menu-status', 'quality', 'hud', 'health-value', 'shield-value', 'health-fill', 'shield-fill', 'ammo', 'materials', 'mode-label', 'storm-label', 'alive', 'kills', 'notice', 'hitmarker', 'damage-flash', 'minimap'].map((id) => [id, $(id)]));

try {
  boot();
} catch (error) {
  console.error(error);
  ui['menu-status'].textContent = 'Unable to start WebGL 2. Try an updated desktop browser with hardware acceleration enabled.';
  ui.play.textContent = 'Renderer unavailable';
  ui.play.disabled = true;
}

function boot() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#9bcedd');
  scene.fog = new THREE.FogExp2('#9bcedd', 0.0035);
  const camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.1, 1400);
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.65));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  ui.game.append(renderer.domElement);
  renderer.domElement.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    fatal('Graphics context lost. Reload the page; choose Performance if this happens again.');
  });
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.22, 0.45, 0.9);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  let highQuality = true;
  const sky = new Sky();
  sky.scale.setScalar(1200);
  sky.material.uniforms.turbidity.value = 5;
  sky.material.uniforms.rayleigh.value = 1.7;
  sky.material.uniforms.mieCoefficient.value = 0.008;
  sky.material.uniforms.sunPosition.value.set(180, 100, -130);
  scene.add(sky);
  const hemi = new THREE.HemisphereLight('#c3efff', '#627948', 2.4);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff0cc', 3.2);
  sun.position.set(80, 110, -70);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -120, right: 120, top: 120, bottom: -120, near: 1, far: 320 });
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.045;
  scene.add(sun);

  let seed = 7919;
  function random() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  }
  const rand = (a, b) => a + random() * (b - a);
  const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...extra });
  const palette = {
    grass: mat('#708f43'), sand: mat('#d2bd80'), stone: mat('#79888c'), trunk: mat('#755342'),
    leaf: mat('#32795e'), leafLight: mat('#51966a'), concrete: mat('#d5cfba'), roof: mat('#446c7d'),
    metal: mat('#283b50', { metalness: 0.65, roughness: 0.35 }), glass: mat('#54ddec', { emissive: '#20afc9', emissiveIntensity: 0.45, metalness: 0.5 }),
    wood: mat('#b99b65'), ramp: mat('#8eacb7', { metalness: 0.3 }),
  };
  const cube = new THREE.BoxGeometry(1, 1, 1);
  const obstacles = [];
  const solidMeshes = [];
  const builds = [];
  const bots = [];
  const pickups = [];
  const effects = [];
  const ray = new THREE.Raycaster();
  const up = new THREE.Vector3(0, 1, 0);
  const centerScreen = new THREE.Vector2();

  function box(parent, x, y, z, sx, sy, sz, material) {
    const mesh = new THREE.Mesh(cube, material);
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  function disc(radius, y, material, segments = 96) {
    const mesh = new THREE.Mesh(new THREE.CircleGeometry(radius, segments), material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = y;
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  }
  const ocean = disc(950, -1.1, mat('#2688a2', { roughness: 0.27, metalness: 0.3 }));
  disc(133, -0.18, palette.sand);
  const groundCanvas = document.createElement('canvas');
  groundCanvas.width = groundCanvas.height = 256;
  const ctx = groundCanvas.getContext('2d');
  ctx.fillStyle = '#82995a';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 6500; i++) {
    ctx.fillStyle = random() > 0.5 ? '#667f4438' : '#b7b77d35';
    ctx.fillRect(rand(0, 256), rand(0, 256), rand(1, 5), rand(1, 4));
  }
  const texture = new THREE.CanvasTexture(groundCanvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(34, 34);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  palette.grass.map = texture;
  const ground = disc(119, 0, palette.grass);
  solidMeshes.push(ground);
  const pathMaterial = mat('#afa983');
  box(scene, 0, 0.01, 0, 9, 0.025, 205, pathMaterial).castShadow = false;
  box(scene, 0, 0.02, -7, 180, 0.025, 7, pathMaterial).castShadow = false;
  // Decorative waves: simple rings avoid expensive animated water shaders.
  const waves = [];
  for (let i = 0; i < 5; i++) {
    const wave = new THREE.Mesh(new THREE.RingGeometry(137 + i * 10, 137.4 + i * 10, 120), new THREE.MeshBasicMaterial({ color: '#a1efed', transparent: true, opacity: 0.22, side: THREE.DoubleSide }));
    wave.rotation.x = -Math.PI / 2;
    wave.position.y = -1.05;
    scene.add(wave);
    waves.push(wave);
  }

  function structure(x, z, width, depth, height) {
    const root = new THREE.Group();
    root.position.set(x, 0, z);
    scene.add(root);
    box(root, 0, height / 2, 0, width, height, depth, palette.concrete);
    box(root, 0, height + 0.25, 0, width + 0.6, 0.5, depth + 0.6, palette.roof);
    for (const side of [-1, 1]) {
      for (let dx = -width / 2 + 1.5; dx < width / 2; dx += 3) {
        box(root, dx, 2.6, side * (depth / 2 + 0.03), 1.4, 1.5, 0.06, palette.glass);
      }
      box(root, side * width / 2, height + 0.7, 0, 0.25, 0.8, depth, palette.roof);
    }
    box(root, 0, height + 0.8, 0, 2.8, 1, 2, palette.metal);
    obstacles.push({ x, z, width: width + 0.7, depth: depth + 0.7, angle: 0, height: height + 1.3 });
    solidMeshes.push(root);
  }
  structure(-27, -28, 14, 11, 5);
  structure(26, -30, 11, 15, 7);
  structure(-37, 24, 12, 12, 5.5);
  structure(38, 25, 13, 10, 5);
  structure(0, -66, 19, 10, 6);
  const tower = new THREE.Group();
  scene.add(tower);
  box(tower, 0, 0.4, 0, 12, 0.8, 12, palette.concrete);
  box(tower, 0, 5, 0, 3, 10, 3, palette.metal);
  box(tower, 0, 10, 0, 5, 0.5, 5, palette.glass);
  box(tower, 0, 13, 0, 0.45, 6, 0.45, palette.metal);
  obstacles.push({ x: 0, z: 0, width: 12, depth: 12, angle: 0, height: 16 });
  solidMeshes.push(tower);
  function clearAt(x, z, radius = 2) {
    return !obstacles.some((o) => circleIntersectsBox(x, z, radius, o));
  }
  for (let i = 0; i < 95; i++) {
    const a = rand(0, Math.PI * 2);
    const r = rand(25, 113);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (Math.abs(x) < 8 || Math.abs(z + 7) < 7 || !clearAt(x, z, 5)) continue;
    const height = rand(5, 10);
    const tree = new THREE.Group();
    tree.position.set(x, 0, z);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.65, height * 0.7, 7), palette.trunk);
    trunk.position.y = height * 0.35;
    trunk.castShadow = true;
    tree.add(trunk);
    for (let j = 0; j < 3; j++) {
      const crown = new THREE.Mesh(new THREE.ConeGeometry(3 - j * 0.6, 4, 7), j % 2 ? palette.leafLight : palette.leaf);
      crown.position.y = height * 0.5 + j * 1.5;
      crown.rotation.y = j;
      crown.castShadow = true;
      tree.add(crown);
    }
    scene.add(tree);
    obstacles.push({ x, z, width: 1.2, depth: 1.2, angle: 0, height: height + 3 });
    solidMeshes.push(tree);
  }
  for (let i = 0; i < 35; i++) {
    const x = rand(-100, 100);
    const z = rand(-100, 100);
    if (Math.hypot(x, z) > 110 || !clearAt(x, z, 4) || Math.hypot(x, z - 45) < 7) continue;
    const r = rand(1, 2.5);
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), palette.stone);
    rock.position.set(x, r * 0.5, z);
    rock.scale.y = 0.8;
    rock.rotation.set(rand(0, 1), rand(0, 4), 0);
    rock.castShadow = rock.receiveShadow = true;
    scene.add(rock);
    obstacles.push({ x, z, width: r * 2, depth: r * 2, angle: 0, height: r * 1.4 });
    solidMeshes.push(rock);
  }
  for (const [x, z] of [[-14, 12], [13, 14], [-14, -16], [16, -12], [-55, -8], [62, -8]]) {
    const mesh = box(scene, x, 1.2, z, 5, 2.4, 2, palette.wood);
    solidMeshes.push(mesh);
    obstacles.push({ x, z, width: 5, depth: 2, angle: 0, height: 2.4 });
  }
  // Deterministic procedural decoration: all meshes are original, no game assets required.
  const grassGeo = new THREE.ConeGeometry(0.14, 0.5, 3);
  const grass = new THREE.InstancedMesh(grassGeo, palette.leafLight, 1600);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 1600; i++) {
    const a = rand(0, 6.283);
    const r = Math.sqrt(random()) * 115;
    const x = Math.sin(a) * r;
    const z = Math.cos(a) * r;
    const valid = Math.abs(x) > 6 && Math.abs(z + 7) > 5 && clearAt(x, z, 0.4);
    dummy.position.set(x, valid ? 0.2 : -10, z);
    dummy.rotation.y = rand(0, 6);
    dummy.scale.setScalar(rand(0.7, 1.8));
    dummy.updateMatrix();
    grass.setMatrixAt(i, dummy.matrix);
  }
  scene.add(grass);

  function makeCharacter(color) {
    const root = new THREE.Group();
    const armor = mat(color, { metalness: 0.25, roughness: 0.5 });
    box(root, 0, 1.15, 0, 0.72, 0.85, 0.42, armor);
    box(root, 0, 1.22, 0.28, 0.5, 0.65, 0.2, palette.metal);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.29, 12, 10), armor);
    head.position.y = 1.88;
    head.castShadow = true;
    root.add(head);
    box(root, 0, 1.9, -0.25, 0.42, 0.15, 0.13, palette.glass);
    const limbs = [];
    for (const side of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(side * 0.22, 0.77, 0);
      box(leg, 0, -0.34, 0, 0.26, 0.7, 0.28, palette.metal);
      box(leg, 0, -0.65, -0.08, 0.3, 0.18, 0.46, armor);
      root.add(leg);
      limbs.push(leg);
      box(root, side * 0.46, 1.18, -0.08, 0.23, 0.62, 0.27, armor);
    }
    box(root, 0.42, 1.27, -0.65, 0.2, 0.23, 0.95, palette.metal);
    box(root, 0.42, 1.3, -1.13, 0.1, 0.1, 0.1, palette.glass);
    root.userData.limbs = limbs;
    scene.add(root);
    return root;
  }
  const playerModel = makeCharacter('#75b3e6');
  const player = { x: 0, z: 45, y: 0, vy: 0, health: 100, shield: 50, ammo: 30, reserve: 180, materials: 180, kills: 0, grounded: true };
  playerModel.position.set(player.x, 0, player.z);
  let yaw = 0;
  let pitch = 0.12;
  let aim = false;
  let firing = false;
  let buildMode = null;
  let buildRotation = 0;
  let elapsed = 0;
  let cooldown = 0;
  let reloadTime = 0;
  let phase = 'menu';
  let hasStarted = false;
  let noticeUntil = 0;
  let hitUntil = 0;
  let damageUntil = 0;
  let lastTime = performance.now();
  let hudTime = 0;
  let audio;
  const keys = new Set();

  function pickSpawn(minRadius = 30, maxRadius = 100) {
    for (let n = 0; n < 250; n++) {
      const a = rand(0, Math.PI * 2);
      const r = rand(minRadius, maxRadius);
      const x = Math.sin(a) * r;
      const z = Math.cos(a) * r;
      if (clearAt(x, z, 2) && Math.hypot(x - player.x, z - player.z) > 18) return { x, z };
    }
    return { x: 0, z: -95 };
  }
  for (let i = 0; i < 12; i++) {
    const p = pickSpawn();
    const model = makeCharacter(i % 2 ? '#e79969' : '#b58cdd');
    const bot = { ...p, y: 0, health: 100, shield: 0, model, cooldown: rand(1, 4), phase: rand(0, 7), moving: 0 };
    model.position.set(p.x, 0, p.z);
    model.traverse((mesh) => { mesh.userData.bot = bot; });
    bots.push(bot);
  }
  function spawnPickup(x, z, type) {
    const colors = { health: '#8fff81', ammo: '#ffd56a', materials: '#76d8ff', shield: '#8c91ff' };
    const material = mat(colors[type], { emissive: colors[type], emissiveIntensity: 0.65, metalness: 0.2 });
    const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.65), material);
    mesh.position.set(x, 0.9, z);
    mesh.castShadow = true;
    scene.add(mesh);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 24), new THREE.MeshBasicMaterial({ color: colors[type], transparent: true, opacity: 0.5, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.04, z);
    scene.add(ring);
    pickups.push({ x, z, type, mesh, ring, phase: rand(0, 6) });
  }
  for (let i = 0; i < 32; i++) {
    const p = pickSpawn(12, 95);
    spawnPickup(p.x, p.z, ['health', 'ammo', 'materials', 'shield'][i % 4]);
  }
  spawnPickup(0, 39, 'ammo');
  spawnPickup(4, 42, 'shield');

  const storm = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 75, 128, 1, true), new THREE.MeshBasicMaterial({ color: '#a180fa', transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }));
  storm.position.y = 34;
  scene.add(storm);
  const zoneRing = new THREE.Mesh(new THREE.RingGeometry(0.992, 1, 160), new THREE.MeshBasicMaterial({ color: '#bc9bff', transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
  zoneRing.rotation.x = -Math.PI / 2;
  zoneRing.position.y = 0.06;
  scene.add(zoneRing);

  function makeRamp(material) {
    const shape = new THREE.Shape();
    shape.moveTo(-3, 0);
    shape.lineTo(3, 0);
    shape.lineTo(-3, 3);
    shape.closePath();
    // Shape X becomes world Z, extrusion becomes world X after rotation.
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: 6, bevelEnabled: false, steps: 1 });
    geometry.translate(0, 0, -3);
    geometry.rotateY(-Math.PI / 2);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = mesh.receiveShadow = true;
    return mesh;
  }
  const ghostMaterial = new THREE.MeshBasicMaterial({ color: '#70f8c0', transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide });
  const wallGhost = new THREE.Mesh(new THREE.BoxGeometry(6, 3.5, 0.4), ghostMaterial);
  const rampGhost = makeRamp(ghostMaterial);
  scene.add(wallGhost, rampGhost);
  wallGhost.visible = rampGhost.visible = false;
  function placement() {
    const angle = Math.round(yaw / (Math.PI / 2)) * (Math.PI / 2) + buildRotation;
    const x = snapToGrid(player.x - Math.sin(yaw) * 7);
    const z = snapToGrid(player.z - Math.cos(yaw) * 7);
    const width = 6;
    const depth = buildMode === 'wall' ? 0.4 : 6;
    const valid = player.materials >= 10 && builds.length < 60 && Math.hypot(x, z) < 112
      && clearAt(x, z, 4.4) && !builds.some((b) => Math.hypot(b.x - x, b.z - z) < 6)
      && Math.hypot(player.x - x, player.z - z) > 4.4
      && !bots.some((b) => b.health > 0 && Math.hypot(b.x - x, b.z - z) < 4.4);
    return { x, z, angle, width, depth, height: buildMode === 'wall' ? 3.5 : 3, kind: buildMode, valid };
  }
  function placeBuild() {
    if (cooldown > 0) return;
    const p = placement();
    if (!p.valid) { notify('Cannot build here — find clear ground and 10 materials.'); return; }
    const mesh = buildMode === 'wall' ? new THREE.Mesh(new THREE.BoxGeometry(6, 3.5, 0.4), palette.wood) : makeRamp(palette.ramp);
    mesh.position.set(p.x, buildMode === 'wall' ? 1.75 : 0, p.z);
    mesh.rotation.y = p.angle;
    mesh.castShadow = mesh.receiveShadow = true;
    p.mesh = mesh;
    p.health = 125;
    mesh.userData.build = p;
    builds.push(p);
    solidMeshes.push(mesh);
    scene.add(mesh);
    player.materials -= 10;
    cooldown = 0.3;
    tone(180, 0.09, 0.03);
  }
  function removeBuild(build) {
    scene.remove(build.mesh);
    build.mesh.geometry.dispose();
    builds.splice(builds.indexOf(build), 1);
    solidMeshes.splice(solidMeshes.indexOf(build.mesh), 1);
  }
  function groundSupport(x, z, previousY) {
    let support = 0;
    for (const b of builds) {
      if (b.kind !== 'ramp') continue;
      const height = rampHeight(x, z, b);
      if (height !== null && height <= previousY + 0.5) support = Math.max(support, height);
    }
    return support;
  }
  function blocked(x, z, feetY, radius = 0.48) {
    if (Math.hypot(x, z) > 116) return true;
    if (obstacles.some((o) => feetY < o.height && circleIntersectsBox(x, z, radius, o))) return true;
    for (const b of builds) {
      if (b.kind === 'wall' && feetY < b.height && circleIntersectsBox(x, z, radius, b)) return true;
      if (b.kind === 'ramp') {
        const height = rampHeight(x, z, b);
        if (height !== null && height > feetY + 0.5) return true;
      }
    }
    return false;
  }
  function moveActor(actor, dx, dz) {
    if (!blocked(actor.x + dx, actor.z, actor.y)) actor.x += dx;
    if (!blocked(actor.x, actor.z + dz, actor.y)) actor.z += dz;
  }
  function tone(frequency, duration = 0.06, volume = 0.025) {
    if (!audio || audio.state !== 'running') return;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(frequency, audio.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, frequency / 3), audio.currentTime + duration);
    gain.gain.setValueAtTime(volume, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + duration);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start();
    oscillator.stop(audio.currentTime + duration);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }
  function notify(text, duration = 2.4) {
    ui.notice.textContent = text;
    noticeUntil = elapsed + duration;
  }
  function tracer(start, end, color = '#ffe8a7') {
    const geo = new THREE.BufferGeometry().setFromPoints([start, end]);
    const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 1 });
    const line = new THREE.Line(geo, material);
    scene.add(line);
    effects.push({ mesh: line, life: 0.09, duration: 0.09 });
  }
  function spark(point, color = '#ffdd82') {
    const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13), new THREE.MeshBasicMaterial({ color }));
    mesh.position.copy(point);
    scene.add(mesh);
    effects.push({ mesh, life: 0.16, duration: 0.16 });
  }
  function reload() {
    if (reloadTime > 0 || player.ammo === 30 || player.reserve <= 0 || buildMode) return;
    reloadTime = 1.65;
    notify('Reloading…', 1.65);
    tone(310, 0.1);
  }
  function damagePlayer(amount, stormDamage = false) {
    Object.assign(player, applyDamage(player, amount, stormDamage));
    damageUntil = elapsed + 0.18;
    if (player.health <= 0) endMatch(false);
  }
  function damageBot(bot, amount, credited = false) {
    if (bot.health <= 0) return;
    bot.health = Math.max(0, bot.health - amount);
    if (bot.health > 0) return;
    bot.model.visible = false;
    if (credited) {
      player.kills++;
      notify('Elimination! Supplies dropped.');
      tone(680, 0.16, 0.035);
    }
    spawnPickup(bot.x, bot.z, credited ? 'ammo' : 'health');
    if (credited) spawnPickup(bot.x + 1, bot.z, 'materials');
  }
  function shoot() {
    if (cooldown > 0 || reloadTime > 0) return;
    if (player.ammo <= 0) { reload(); return; }
    cooldown = 0.13;
    player.ammo--;
    scene.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);
    ray.setFromCamera(centerScreen, camera);
    const targets = [...solidMeshes, ...bots.filter((b) => b.health > 0).map((b) => b.model)];
    ray.far = 160;
    const viewHit = ray.intersectObjects(targets, true)[0];
    const target = viewHit ? viewHit.point.clone() : ray.ray.at(160, new THREE.Vector3());
    const muzzle = new THREE.Vector3(0.42, 1.3, -1.15).applyAxisAngle(up, yaw).add(playerModel.position);
    const direction = target.clone().sub(muzzle).normalize();
    // Trace from the weapon too: the camera cannot shoot through cover.
    ray.set(muzzle, direction);
    ray.far = 165;
    const hit = ray.intersectObjects(targets, true)[0];
    const endpoint = hit ? hit.point : muzzle.clone().addScaledVector(direction, 160);
    tracer(muzzle, endpoint);
    spark(muzzle);
    tone(110, 0.08, 0.045);
    if (hit) {
      spark(hit.point);
      const bot = hit.object.userData.bot;
      const build = hit.object.userData.build;
      if (bot) {
        const headshot = hit.point.y > bot.y + 1.65;
        damageBot(bot, headshot ? 50 : 25, true);
        hitUntil = elapsed + 0.16;
      }
      if (build) { build.health -= 25; if (build.health <= 0) removeBuild(build); }
    }
    pitch = clamp(pitch - 0.007, -0.4, 1.15);
  }
  function updatePlayer(dt) {
    cooldown = Math.max(0, cooldown - dt);
    if (reloadTime > 0) {
      reloadTime -= dt;
      if (reloadTime <= 0) {
        const count = Math.min(30 - player.ammo, player.reserve);
        player.ammo += count;
        player.reserve -= count;
      }
    }
    let forward = Number(keys.has('KeyW')) - Number(keys.has('KeyS'));
    let strafe = Number(keys.has('KeyD')) - Number(keys.has('KeyA'));
    const magnitude = Math.hypot(forward, strafe);
    if (magnitude) { forward /= magnitude; strafe /= magnitude; }
    const speed = aim ? 4 : (keys.has('ShiftLeft') || keys.has('ShiftRight')) ? 11 : 7;
    const dx = (-Math.sin(yaw) * forward + Math.cos(yaw) * strafe) * speed * dt;
    const dz = (-Math.cos(yaw) * forward - Math.sin(yaw) * strafe) * speed * dt;
    moveActor(player, dx, dz);
    const support = groundSupport(player.x, player.z, player.y);
    if (player.grounded && keys.has('Space')) { player.vy = 8.5; player.grounded = false; }
    player.vy -= 23 * dt;
    player.y += player.vy * dt;
    if (player.y <= support) { player.y = support; player.vy = 0; player.grounded = true; }
    else player.grounded = false;
    playerModel.position.set(player.x, player.y, player.z);
    playerModel.rotation.y = yaw;
    playerModel.userData.limbs.forEach((limb, i) => { limb.rotation.x = magnitude ? Math.sin(elapsed * speed * 1.7 + i * Math.PI) * 0.6 : 0; });
    if (firing) { if (buildMode) placeBuild(); else shoot(); }
    const radius = zoneRadius(elapsed);
    if (outsideZone(player.x, player.z, radius)) damagePlayer(7 * dt, true);
    for (let i = pickups.length - 1; i >= 0; i--) {
      const p = pickups[i];
      if (Math.hypot(player.x - p.x, player.z - p.z) > 1.8 || player.y > 2) continue;
      if (p.type === 'health' && player.health >= 100) continue;
      if (p.type === 'shield' && player.shield >= 100) continue;
      if (p.type === 'health') player.health = Math.min(100, player.health + 35);
      if (p.type === 'shield') player.shield = Math.min(100, player.shield + 35);
      if (p.type === 'ammo') player.reserve += 60;
      if (p.type === 'materials') player.materials += 50;
      notify({ health: '+35 health', shield: '+35 shield', ammo: '+60 ammunition', materials: '+50 materials' }[p.type], 1.3);
      tone(550, 0.1);
      scene.remove(p.mesh, p.ring);
      p.mesh.geometry.dispose(); p.mesh.material.dispose();
      p.ring.geometry.dispose(); p.ring.material.dispose();
      pickups.splice(i, 1);
    }
  }
  function updateBots(dt) {
    const radius = zoneRadius(elapsed);
    scene.updateMatrixWorld(true);
    for (const bot of bots) {
      if (bot.health <= 0) continue;
      if (outsideZone(bot.x, bot.z, radius)) damageBot(bot, 9 * dt);
      if (bot.health <= 0) continue;
      const distance = Math.hypot(player.x - bot.x, player.z - bot.z);
      const fleeing = Math.hypot(bot.x, bot.z) > radius - 8;
      let tx = fleeing ? -bot.x : player.x - bot.x;
      let tz = fleeing ? -bot.z : player.z - bot.z;
      if (!fleeing && distance < 20) {
        tx = Math.cos(elapsed * 0.35 + bot.phase) * 12;
        tz = Math.sin(elapsed * 0.35 + bot.phase) * 12;
      }
      const length = Math.max(0.01, Math.hypot(tx, tz));
      const speed = fleeing ? 5.2 : 3.3;
      const oldX = bot.x;
      const oldZ = bot.z;
      moveActor(bot, tx / length * speed * dt, tz / length * speed * dt);
      if (Math.hypot(bot.x - oldX, bot.z - oldZ) < dt * 0.4) {
        const turn = Math.sin(bot.phase) > 0 ? 1 : -1;
        moveActor(bot, -tz / length * speed * dt * turn, tx / length * speed * dt * turn);
      }
      bot.y = groundSupport(bot.x, bot.z, bot.y);
      bot.model.position.set(bot.x, bot.y, bot.z);
      bot.model.rotation.y = Math.atan2(bot.x - player.x, bot.z - player.z);
      bot.model.userData.limbs.forEach((limb, i) => { limb.rotation.x = Math.sin(elapsed * 7 + i * Math.PI + bot.phase) * 0.5; });
      bot.cooldown -= dt;
      if (bot.cooldown <= 0 && distance < 65 && phase === 'playing') {
        bot.cooldown = rand(1.1, 2.5);
        const start = new THREE.Vector3(bot.x, bot.y + 1.4, bot.z);
        const end = new THREE.Vector3(player.x, player.y + 1.2, player.z);
        const direction = end.clone().sub(start).normalize();
        ray.set(start, direction);
        ray.far = start.distanceTo(end);
        const blocker = ray.intersectObjects(solidMeshes, true)[0];
        if (!blocker) {
          const accuracy = aim ? 0.55 : 0.36;
          const hit = random() < accuracy;
          if (!hit) end.add(new THREE.Vector3(rand(-2, 2), rand(0.8, 2), rand(-2, 2)));
          tracer(start, end, '#ff8c73');
          if (hit) damagePlayer(8);
        } else if (blocker.object.userData.build) {
          const build = blocker.object.userData.build;
          tracer(start, blocker.point, '#ff8c73');
          build.health -= 12;
          if (build.health <= 0) removeBuild(build);
        }
      }
    }
    if (phase === 'playing' && bots.every((b) => b.health <= 0)) endMatch(true);
  }
  function updateCamera(dt) {
    const direction = new THREE.Vector3(-Math.sin(yaw) * Math.cos(pitch), -Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
    const pivot = new THREE.Vector3(player.x, player.y + 1.75, player.z);
    const desired = pivot.clone().addScaledVector(direction, aim ? -3.2 : -6.5).add(new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)).multiplyScalar(aim ? 0.7 : 1));
    desired.y = Math.max(0.6, desired.y);
    const offset = desired.clone().sub(pivot);
    ray.set(pivot, offset.clone().normalize());
    ray.far = offset.length();
    const hit = ray.intersectObjects(solidMeshes, true)[0];
    if (hit) desired.copy(pivot).addScaledVector(offset.normalize(), Math.max(0.25, hit.distance - 0.2));
    camera.position.copy(desired);
    camera.lookAt(camera.position.clone().addScaledVector(direction, 100));
    const fov = aim ? 48 : 68;
    camera.fov = THREE.MathUtils.lerp(camera.fov, fov, 1 - Math.exp(-12 * dt));
    camera.updateProjectionMatrix();
    playerModel.visible = camera.position.distanceTo(pivot) > 1.1;
  }
  function updateGhost() {
    wallGhost.visible = rampGhost.visible = false;
    if (!buildMode || phase !== 'playing') return;
    const p = placement();
    const ghost = buildMode === 'wall' ? wallGhost : rampGhost;
    ghost.visible = true;
    ghost.position.set(p.x, buildMode === 'wall' ? 1.75 : 0.06, p.z);
    ghost.rotation.y = p.angle;
    ghostMaterial.color.set(p.valid ? '#70f8c0' : '#ff6b76');
  }
  const map = ui.minimap.getContext('2d');
  function updateHud() {
    ui['health-value'].textContent = Math.ceil(player.health);
    ui['shield-value'].textContent = Math.ceil(player.shield);
    ui['health-fill'].style.width = `${player.health}%`;
    ui['shield-fill'].style.width = `${player.shield}%`;
    ui.ammo.innerHTML = reloadTime > 0 ? 'RELOADING' : `${player.ammo} <span>/ ${player.reserve}</span>`;
    ui.materials.textContent = `MATERIALS ${player.materials}`;
    ui['mode-label'].textContent = buildMode ? `${buildMode.toUpperCase()} · 10 MATERIALS` : 'PULSE RIFLE';
    ui.alive.textContent = `${bots.filter((b) => b.health > 0).length + (player.health > 0 ? 1 : 0)} ALIVE`;
    ui.kills.textContent = `${player.kills} ELIMS`;
    const radius = zoneRadius(elapsed);
    ui['storm-label'].textContent = outsideZone(player.x, player.z, radius) ? 'IN STORM — MOVE TO CIRCLE' : elapsed < 20 ? `STORM IN ${Math.ceil(20 - elapsed)}s` : `SAFE ZONE ${Math.round(radius)}m`;
    map.clearRect(0, 0, 180, 180);
    map.fillStyle = '#172e39'; map.fillRect(0, 0, 180, 180);
    const scale = 0.68;
    const dot = (x, z, size, color) => { map.fillStyle = color; map.beginPath(); map.arc(90 + x * scale, 90 + z * scale, size, 0, Math.PI * 2); map.fill(); };
    dot(0, 0, 119 * scale, '#435f43');
    map.fillStyle = '#b5ae8970'; map.fillRect(87, 18, 6, 144); map.fillRect(23, 83, 134, 5);
    for (const o of obstacles) { map.fillStyle = '#afbec47a'; map.fillRect(90 + (o.x - o.width / 2) * scale, 90 + (o.z - o.depth / 2) * scale, o.width * scale, o.depth * scale); }
    map.strokeStyle = '#cfb1ff'; map.lineWidth = 2; map.beginPath(); map.arc(90, 90, radius * scale, 0, Math.PI * 2); map.stroke();
    for (const b of bots) if (b.health > 0) dot(b.x, b.z, 2, '#ff997e');
    map.save(); map.translate(90 + player.x * scale, 90 + player.z * scale); map.rotate(-yaw);
    map.fillStyle = '#c5ff69'; map.beginPath(); map.moveTo(0, -6); map.lineTo(4, 5); map.lineTo(0, 3); map.lineTo(-4, 5); map.closePath(); map.fill(); map.restore();
  }
  function endMatch(won) {
    phase = 'ended';
    firing = false;
    aim = false;
    if (document.pointerLockElement) document.exitPointerLock();
    ui.menu.hidden = false;
    ui.play.textContent = 'PLAY AGAIN';
    ui['menu-status'].textContent = `${won ? 'VICTORY — last survivor!' : 'Eliminated. Try using cover and staying inside the circle.'} ${player.kills} eliminations · ${Math.floor(elapsed)} seconds survived.`;
    ui.notice.style.opacity = '0';
  }
  function fatal(message) {
    phase = 'error';
    if (document.pointerLockElement) document.exitPointerLock();
    ui.menu.hidden = false;
    ui.play.disabled = true;
    ui.play.textContent = 'Reload required';
    ui['menu-status'].textContent = message;
  }
  function pause() {
    if (phase !== 'playing') return;
    phase = 'paused';
    keys.clear(); firing = false; aim = false;
    ui.menu.hidden = false;
    ui.play.textContent = 'RESUME MATCH';
    ui['menu-status'].textContent = 'Paused. Click Resume to capture the mouse again.';
  }
  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement === renderer.domElement && phase !== 'ended' && phase !== 'error') {
      phase = 'playing'; hasStarted = true;
      ui.menu.hidden = true; ui.hud.hidden = false;
      lastTime = performance.now();
    } else pause();
  });
  document.addEventListener('pointerlockerror', () => {
    ui['menu-status'].textContent = 'Mouse capture was blocked. Open localhost in its own tab, then click Play again.';
  });
  ui.play.addEventListener('click', async () => {
    if (phase === 'ended') { location.reload(); return; }
    try {
      const AudioClass = window.AudioContext || window.webkitAudioContext;
      if (AudioClass && !audio) audio = new AudioClass();
      if (audio) audio.resume().catch(() => {});
      await renderer.domElement.requestPointerLock();
    } catch {
      ui['menu-status'].textContent = 'Mouse capture unavailable. Click Play again in a desktop browser tab.';
    }
  });
  ui.quality.addEventListener('change', () => {
    highQuality = ui.quality.value === 'high';
    renderer.shadowMap.enabled = highQuality;
    renderer.setPixelRatio(Math.min(devicePixelRatio, highQuality ? 1.65 : 1));
    composer.setPixelRatio(renderer.getPixelRatio());
    grass.visible = highQuality;
    scene.traverse((object) => {
      if (object.isMesh && object.material) {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => { material.needsUpdate = true; });
      }
    });
    resize();
  });
  document.addEventListener('keydown', (event) => {
    if (phase !== 'playing') return;
    if (['Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(event.code)) event.preventDefault();
    keys.add(event.code);
    if (event.repeat) return;
    if (event.code === 'KeyR') reload();
    if (event.code === 'KeyQ' || event.code === 'KeyE') {
      const mode = event.code === 'KeyQ' ? 'wall' : 'ramp';
      buildMode = buildMode === mode ? null : mode;
      firing = false;
      notify(buildMode ? `${buildMode.toUpperCase()} selected · F rotates · Click to place` : 'Rifle selected', 1.8);
    }
    if (event.code === 'KeyF') buildRotation += Math.PI / 2;
  });
  document.addEventListener('keyup', (event) => keys.delete(event.code));
  document.addEventListener('mousemove', (event) => {
    if (phase !== 'playing' || document.pointerLockElement !== renderer.domElement) return;
    yaw -= event.movementX * (aim ? 0.0013 : 0.0022);
    pitch = clamp(pitch + event.movementY * 0.0018, -0.4, 1.15);
  });
  document.addEventListener('mousedown', (event) => {
    if (phase !== 'playing') return;
    if (event.button === 0) firing = true;
    if (event.button === 2) aim = true;
  });
  document.addEventListener('mouseup', (event) => {
    if (event.button === 0) firing = false;
    if (event.button === 2) aim = false;
  });
  renderer.domElement.addEventListener('contextmenu', (event) => event.preventDefault());
  const releaseMouse = () => { keys.clear(); firing = false; aim = false; if (document.pointerLockElement) document.exitPointerLock(); pause(); };
  window.addEventListener('blur', releaseMouse);
  document.addEventListener('visibilitychange', () => { if (document.hidden) releaseMouse(); });
  function resize() {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    composer.setSize(innerWidth, innerHeight);
  }
  window.addEventListener('resize', resize);
  scene.updateMatrixWorld(true);
  updateCamera(1);
  updateHud();
  ui.play.disabled = false;
  ui.play.textContent = 'DROP INTO ARENA';
  ui['menu-status'].textContent = 'Ready. Click Play to capture your mouse. Esc releases it.';
  function frame(now) {
    if (phase === 'error') return;
    try {
      const dt = Math.min((now - lastTime) / 1000, 0.04);
      lastTime = now;
      if (phase === 'playing') {
        elapsed += dt;
        updateCamera(dt);
        updatePlayer(dt);
        if (phase === 'playing') updateBots(dt);
        scene.updateMatrixWorld(true);
        updateCamera(dt);
      } else if (!hasStarted) {
        const angle = now * 0.000035;
        camera.position.set(Math.sin(angle) * 88, 45, Math.cos(angle) * 88);
        camera.lookAt(0, 1, 0);
      }
      const radius = zoneRadius(elapsed);
      storm.scale.set(radius, 1, radius);
      zoneRing.scale.set(radius, radius, 1);
      storm.material.opacity = 0.12 + Math.sin(now * 0.0015) * 0.025;
      ocean.material.roughness = 0.28 + Math.sin(now * 0.0003) * 0.04;
      waves.forEach((wave, i) => { wave.material.opacity = 0.14 + Math.sin(now * 0.001 + i) * 0.08; });
      pickups.forEach((p) => {
        p.mesh.rotation.y = now * 0.001 + p.phase;
        p.mesh.position.y = 1 + Math.sin(now * 0.002 + p.phase) * 0.18;
      });
      for (let i = effects.length - 1; i >= 0; i--) {
        const effect = effects[i];
        effect.life -= dt;
        effect.mesh.material.opacity = Math.max(0, effect.life / effect.duration);
        if (effect.life <= 0) {
          scene.remove(effect.mesh); effect.mesh.geometry.dispose(); effect.mesh.material.dispose(); effects.splice(i, 1);
        }
      }
      updateGhost();
      ui.notice.style.opacity = phase === 'playing' && elapsed < noticeUntil ? '1' : '0';
      ui.hitmarker.style.opacity = phase === 'playing' && elapsed < hitUntil ? '1' : '0';
      ui['damage-flash'].style.opacity = phase === 'playing' && elapsed < damageUntil ? '0.8' : '0';
      hudTime += dt;
      if (hudTime > 0.08) { updateHud(); hudTime = 0; }
      if (highQuality) composer.render(); else renderer.render(scene, camera);
      requestAnimationFrame(frame);
    } catch (error) {
      console.error(error);
      fatal('The game encountered an error. Reload the page and check the browser console for details.');
    }
  }
  requestAnimationFrame(frame);
}
