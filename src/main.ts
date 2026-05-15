import * as THREE from "three";
import { World } from "./world/World";
import { Controls } from "./player/Controls";
import { MobileControls } from "./player/MobileControls";
import { Player } from "./player/Player";
import { BLOCK_TYPES, BlockType } from "./Block";
import { AudioManager } from "./utils/AudioManager";
import { Zombie } from "./mobs/Zombie";
import { t, setLocale, getLocale } from "./i18n/i18n";
import "./globals.css";

const CHUNK_SIZE = 16;
const MOBILE_INTERACTION_COOLDOWN = 0.18;

// Day/night cycle constants
const CYCLE_DURATION = 240; // 4 minutes in seconds

function getRendererPixelRatio(): number {
  const isTouchDevice = "ontouchstart" in globalThis || navigator.maxTouchPoints > 0;
  const maxPixelRatio = isTouchDevice ? 1.5 : 2;
  return Math.min(window.devicePixelRatio, maxPixelRatio);
}

// Scene setup
const scene = new THREE.Scene();
const skyColors = {
  day: new THREE.Color(0x87ceeb),
  night: new THREE.Color(0x0a0a2e),
};
scene.background = skyColors.day;
scene.fog = new THREE.Fog(skyColors.day, 20, 80);

// Camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(getRendererPixelRatio());
document.body.appendChild(renderer.domElement);

// Lights
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(50, 100, 50);
scene.add(directionalLight);

const moonLight = new THREE.DirectionalLight(0x4466aa, 0.15);
moonLight.position.set(-50, 80, -50);
scene.add(moonLight);

// Hemisphere light for softer ambient
const hemisphereLight = new THREE.HemisphereLight(0x87ceeb, 0x333333, 0.3);
scene.add(hemisphereLight);

// World
const world = new World(scene);
world.update(8, 8); // initial player position

// Controls and Player
const controls = new Controls(camera, renderer.domElement);
const mobileControls = new MobileControls();
const audioManager = AudioManager.get();

// Player
let player: Player;

// Block selection
let selectedBlockIndex = 0;
const blockTypes = BLOCK_TYPES;

// Raycast state
const rayDirection = new THREE.Vector3();

const raycaster = new THREE.Raycaster();

// Crosshair
const crosshair = document.createElement("div");
crosshair.id = "crosshair";
document.body.appendChild(crosshair);

// Block highlight outline
const blockOutlineMat = new THREE.LineBasicMaterial({ color: 0xffffff });
const blockOutlineGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.001, 1.001, 1.001));
const blockOutline = new THREE.LineSegments(blockOutlineGeo, blockOutlineMat);
blockOutline.visible = false;
scene.add(blockOutline);

// Block selection UI
const blockUI = document.createElement("div");
blockUI.id = "block-ui";
document.body.appendChild(blockUI);

function updateBlockUI(): void {
  blockUI.innerHTML = "";
  blockTypes.forEach((block, index) => {
    const div = document.createElement("div");
    div.style.width = "40px";
    div.style.height = "40px";
    div.style.border = index === selectedBlockIndex ? "3px solid white" : "2px solid gray";
    div.style.backgroundColor = getBlockColor(block.id);
    div.style.opacity = index === selectedBlockIndex ? "1" : "0.6";
    div.addEventListener("click", e => {
      e.stopPropagation();
      selectedBlockIndex = index;
      updateBlockUI();
    });
    div.addEventListener("touchend", e => {
      e.preventDefault();
      e.stopPropagation();
      selectedBlockIndex = index;
      updateBlockUI();
    });
    blockUI.appendChild(div);
  });
}

function getBlockColor(blockType: BlockType): string {
  switch (blockType) {
    case BlockType.Grass:
      return "#4c9900";
    case BlockType.Dirt:
      return "#79553a";
    case BlockType.Stone:
      return "#808080";
    case BlockType.Wood:
      return "#996633";
    case BlockType.Leaves:
      return "#006600";
    case BlockType.Water:
      return "#3366aa";
    default:
      return "#000000";
  }
}

updateBlockUI();

// Mouse wheel for block selection
renderer.domElement.addEventListener("wheel", event => {
  event.preventDefault();
  if (event.deltaY > 0) {
    selectedBlockIndex = (selectedBlockIndex + 1) % blockTypes.length;
  } else {
    selectedBlockIndex = (selectedBlockIndex - 1 + blockTypes.length) % blockTypes.length;
  }
  updateBlockUI();
});

// Number keys for block selection
document.addEventListener("keydown", event => {
  const num = parseInt(event.key);
  if (num >= 1 && num <= blockTypes.length) {
    selectedBlockIndex = num - 1;
    updateBlockUI();
  }
});

// Raycast helper
function raycastBlock(): { position: THREE.Vector3; normal: THREE.Vector3 } | null {
  camera.getWorldDirection(rayDirection);
  const origin = player!.getEyePosition();
  const step = 0.1;
  const maxSteps = 60;

  for (let i = 1; i <= maxSteps; i++) {
    const x = Math.floor(origin.x + rayDirection.x * step * i);
    const y = Math.floor(origin.y + rayDirection.y * step * i);
    const z = Math.floor(origin.z + rayDirection.z * step * i);

    const block = world.getBlock(x, y, z);
    if (block !== undefined && block > 0 && block !== BlockType.Water) {
      const px = origin.x + rayDirection.x * step * i;
      const py = origin.y + rayDirection.y * step * i;
      const pz = origin.z + rayDirection.z * step * i;

      const fracX = px - x;
      const fracY = py - y;
      const fracZ = pz - z;

      const distLeft = fracX;
      const distRight = 1 - fracX;
      const distBottom = fracY;
      const distTop = 1 - fracY;
      const distFront = fracZ;
      const distBack = 1 - fracZ;

      const minDist = Math.min(distLeft, distRight, distBottom, distTop, distFront, distBack);

      const normal = new THREE.Vector3(0, 0, 0);
      if (minDist === distLeft) normal.set(-1, 0, 0);
      else if (minDist === distRight) normal.set(1, 0, 0);
      else if (minDist === distBottom) normal.set(0, -1, 0);
      else if (minDist === distTop) normal.set(0, 1, 0);
      else if (minDist === distFront) normal.set(0, 0, -1);
      else if (minDist === distBack) normal.set(0, 0, 1);

      return {
        position: new THREE.Vector3(x, y, z),
        normal: normal,
      };
    }
  }
  return null;
}

function findZombieByMesh(mesh: THREE.Object3D): Zombie | null {
  let obj: THREE.Object3D | null = mesh;
  while (obj) {
    for (const zombie of zombies) {
      if (zombie.mesh === obj) return zombie;
    }
    obj = obj.parent;
  }
  return null;
}

// Block interaction
renderer.domElement.addEventListener("mousedown", event => {
  if (document.pointerLockElement !== renderer.domElement) return;
  event.preventDefault();

  const hit = raycastBlock();

  if (event.button === 0) {
    // First check zombie hit
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const zombieMeshList: THREE.Object3D[] = [];
    for (const zombie of zombies) {
      zombie.mesh.traverse(child => {
        if ((child as THREE.Mesh).isMesh) {
          zombieMeshList.push(child);
        }
      });
    }
    const intersects = raycaster.intersectObjects(zombieMeshList);

    if (intersects.length > 0) {
      const zombie = findZombieByMesh(intersects[0].object);
      if (zombie && zombie.alive) {
        zombie.takeDamage(5);
        audioManager.play("break", 0.5);
        return;
      }
    }

    // Fall back to block breaking
    if (!hit) return;
    world.setBlock(hit.position.x, hit.position.y, hit.position.z, 0 as BlockType);
    audioManager.play("break", 0.5);
  } else if (event.button === 2) {
    if (!hit) return;
    const placePos = hit.position.clone().add(hit.normal);
    const blockAtPlace = world.getBlock(placePos.x, placePos.y, placePos.z);
    if (blockAtPlace === undefined || blockAtPlace === 0 || blockAtPlace === BlockType.Water) {
      world.setBlock(placePos.x, placePos.y, placePos.z, blockTypes[selectedBlockIndex].id);
      audioManager.play("place", 0.5);
    }
  }
});

// === DAY/NIGHT CYCLE ===
let cycleTime = 0; // seconds elapsed in current cycle (0..CYCLE_DURATION, loops)
const SUN_START_ANGLE = Math.PI * 0.2; // starts above horizon (morning)
const SUN_ANGLE_SPEED = (Math.PI * 2) / CYCLE_DURATION; // full rotation per cycle

function getSunAngle(): number {
  // Sun moves in a full circle over the cycle
  // At angle 0 = midnight (behind ground), PI = noon
  return SUN_START_ANGLE + cycleTime * SUN_ANGLE_SPEED;
}

function updateDayNightCycle(deltaTime: number): void {
  cycleTime += deltaTime;
  if (cycleTime >= CYCLE_DURATION) {
    cycleTime -= CYCLE_DURATION;
  }

  const sunAngle = getSunAngle();

  // Sun position: circular motion, clamped above ground
  const sunX = Math.cos(sunAngle) * 100;
  const sunY = Math.max(Math.sin(sunAngle) * 100, 5); // min height 5 so it never goes too low
  const sunZ = Math.sin(sunAngle * 0.3) * 50; // slight Z drift for variety
  directionalLight.position.set(sunX, sunY, sunZ);

  // Moon opposite to sun
  moonLight.position.set(-sunX * 0.5, Math.max(-sunY * 0.3 + 80, 40), -sunZ * 0.5);

  // Smooth light intensity based on sun height
  const sunHeight = Math.sin(sunAngle);
  const isDay = sunHeight > 0;

  // Ambient light: bright during day, dim at night
  const ambientIntensity = isDay ? THREE.MathUtils.mapLinear(sunHeight, 0, 1, 0.2, 0.8) : 0.08;
  ambientLight.intensity = THREE.MathUtils.lerp(ambientLight.intensity, ambientIntensity, 0.05);

  // Directional light: strong during day, off at night
  directionalLight.intensity = isDay ? THREE.MathUtils.mapLinear(sunHeight, 0, 1, 0.05, 1.0) : 0.0;

  // Moon light: on at night
  moonLight.intensity = isDay
    ? 0.0
    : THREE.MathUtils.mapLinear(Math.max(-sunHeight, 0), 0, 1, 0.0, 0.25);

  // Hemisphere light
  hemisphereLight.intensity = isDay ? THREE.MathUtils.mapLinear(sunHeight, 0, 1, 0.05, 0.4) : 0.03;

  // Sky color: smooth gradient between day and night
  const skyLerp = THREE.MathUtils.smoothstep(THREE.MathUtils.clamp(sunHeight * 4, -1, 1), -1, 1);
  (scene.background as THREE.Color).lerpColors(
    skyColors.day,
    skyColors.night,
    THREE.MathUtils.clamp(1 - skyLerp, 0, 1),
  );
  (scene.fog as THREE.Fog).color.lerpColors(
    skyColors.day,
    skyColors.night,
    THREE.MathUtils.clamp(1 - skyLerp, 0, 1),
  );

  // Renderer tone mapping for day/night feel
  renderer.toneMappingExposure = isDay ? THREE.MathUtils.mapLinear(sunHeight, 0, 1, 0.6, 1.2) : 0.3;
}

// === ZOMBIE SYSTEM ===
const ZOMBIE_MAX_COUNT = 3;
const ZOMBIE_SPAWN_INTERVAL = 15; // seconds between spawn attempts at night
let zombies: Zombie[] = [];
let lastZombieSpawnTime = 0;

function spawnZombieNearPlayer(): void {
  if (zombies.length >= ZOMBIE_MAX_COUNT) return;

  const angle = Math.random() * Math.PI * 2;
  const distance = 15 + Math.random() * 20;
  const spawnX = player.position.x + Math.cos(angle) * distance;
  const spawnZ = player.position.z + Math.sin(angle) * distance;

  const zombie = new Zombie(world, player, spawnX, spawnZ);
  zombies.push(zombie);

  scene.add(zombie.mesh);
}

function updateZombies(deltaTime: number): void {
  lastZombieSpawnTime += deltaTime;

  // Spawn at night
  const sunAngle = getSunAngle();
  const isNight = Math.sin(sunAngle) < 0;

  if (isNight && lastZombieSpawnTime >= ZOMBIE_SPAWN_INTERVAL) {
    lastZombieSpawnTime = 0;
    spawnZombieNearPlayer();
  }

  // Update and cleanup
  for (let i = zombies.length - 1; i >= 0; i--) {
    const zombie = zombies[i];

    // Despawn if too far
    const dx = zombie.position.x - player.position.x;
    const dz = zombie.position.z - player.position.z;
    const dist = Math.hypot(dx, dz);

    if (dist > 60 || !zombie.alive) {
      scene.remove(zombie.mesh);
      zombies.splice(i, 1);
      continue;
    }

    zombie.update(deltaTime);
  }
}

// Health HUD
const healthBarBg = document.createElement("div");
healthBarBg.id = "health-bar-bg";
document.body.appendChild(healthBarBg);

const healthBar = document.createElement("div");
healthBar.id = "health-bar";
healthBarBg.appendChild(healthBar);

const healthText = document.createElement("div");
healthText.id = "health-text";
healthText.textContent = `20 ${t("healthSeparator")} 20`;
healthBarBg.appendChild(healthText);

// Cycle time indicator
const cycleIndicator = document.createElement("div");
cycleIndicator.id = "cycle-indicator";
document.body.appendChild(cycleIndicator);

function updateHUD(): void {
  const ratio = player.health / player.maxHealth;
  healthBar.style.width = `${ratio * 100}%`;
  healthText.textContent = `${Math.max(0, Math.ceil(player.health))} ${t("healthSeparator")} ${player.maxHealth}`;

  // Color based on health
  if (ratio > 0.5) {
    healthBar.style.backgroundColor = "#4caf50";
  } else if (ratio > 0.25) {
    healthBar.style.backgroundColor = "#ff9800";
  } else {
    healthBar.style.backgroundColor = "#f44336";
  }

  // Cycle indicator
  const isNight = Math.sin(getSunAngle()) < 0;
  const sunAngle = getSunAngle();
  const currentQuadrant = Math.floor(sunAngle / Math.PI);
  const nextCrossing = (currentQuadrant + 1) * Math.PI;
  const secondsLeft = (nextCrossing - sunAngle) / SUN_ANGLE_SPEED;
  const minutesLeft = secondsLeft / 60;
  cycleIndicator.textContent = isNight
    ? `🌙 ${t("cycleNight")} - ${minutesLeft.toFixed(0)} ${t("cycleMinSuffixNight")}`
    : `☀️ ${t("cycleDay")} - ${minutesLeft.toFixed(0)} ${t("cycleMinSuffix")}`;
}

// Death screen overlay
const deathOverlay = document.createElement("div");
deathOverlay.id = "death-overlay";
deathOverlay.textContent = t("deathScreen");
document.body.appendChild(deathOverlay);

// Create player after audio init

// Game loop
const clock = new THREE.Clock();
let mobileBreakCooldown = 0;
let mobilePlaceCooldown = 0;
let lastPlayerChunkX = 0;
let lastPlayerChunkZ = 0;

function animate(): void {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();

  const isMobileActive = mobileControls.enabled;

  if (document.pointerLockElement === renderer.domElement || isMobileActive) {
    // Update player
    if (player) {
      player.update(delta);
      if (player.invincibleTimer > 0) {
        player.invincibleTimer -= delta;
      }
      // Water breathing handled by Player.update()

      // Check if player fell into void
      if (player.position.y < -10) {
        player.damage(player.health);
      }
    }

    // Mobile block interaction
    if (isMobileActive) {
      mobileBreakCooldown = Math.max(0, mobileBreakCooldown - delta);
      mobilePlaceCooldown = Math.max(0, mobilePlaceCooldown - delta);

      if (mobileControls.breakBlock && mobileBreakCooldown === 0) {
        // First check zombie hit
        raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
        const zombieMeshList: THREE.Object3D[] = [];
        for (const zombie of zombies) {
          zombie.mesh.traverse(child => {
            if ((child as THREE.Mesh).isMesh) {
              zombieMeshList.push(child);
            }
          });
        }
        const zombieIntersects = raycaster.intersectObjects(zombieMeshList);
        if (zombieIntersects.length > 0) {
          const zombie = findZombieByMesh(zombieIntersects[0].object);
          if (zombie && zombie.alive) {
            zombie.takeDamage(5);
            audioManager.play("break", 0.5);
            mobileBreakCooldown = MOBILE_INTERACTION_COOLDOWN;
            return;
          }
        }

        // Fall back to block breaking
        const hit = raycastBlock();
        if (hit) {
          world.setBlock(hit.position.x, hit.position.y, hit.position.z, 0 as BlockType);
          audioManager.play("break", 0.5);
        }
        mobileBreakCooldown = MOBILE_INTERACTION_COOLDOWN;
      }
      if (mobileControls.placeBlock && mobilePlaceCooldown === 0) {
        const hit = raycastBlock();
        if (hit) {
          const placePos = hit.position.clone().add(hit.normal);
          const blockAtPlace = world.getBlock(placePos.x, placePos.y, placePos.z);
          if (
            blockAtPlace === undefined ||
            blockAtPlace === 0 ||
            blockAtPlace === BlockType.Water
          ) {
            world.setBlock(placePos.x, placePos.y, placePos.z, blockTypes[selectedBlockIndex].id);
            audioManager.play("place", 0.5);
          }
        }
        mobilePlaceCooldown = MOBILE_INTERACTION_COOLDOWN;
      }
    }

    const playerChunkX = Math.floor(player.position.x / CHUNK_SIZE);
    const playerChunkZ = Math.floor(player.position.z / CHUNK_SIZE);
    if (playerChunkX !== lastPlayerChunkX || playerChunkZ !== lastPlayerChunkZ) {
      lastPlayerChunkX = playerChunkX;
      lastPlayerChunkZ = playerChunkZ;
      world.update(player.position.x, player.position.z);
    }

    // Update block highlight
    const hitBlock = raycastBlock();
    if (
      hitBlock &&
      (document.pointerLockElement === renderer.domElement || mobileControls.enabled)
    ) {
      blockOutline.position.set(
        hitBlock.position.x + 0.5,
        hitBlock.position.y + 0.5,
        hitBlock.position.z + 0.5,
      );
      blockOutline.visible = true;
    } else {
      blockOutline.visible = false;
    }
  }

  // Always update day/night cycle
  updateDayNightCycle(delta);

  // Update zombies
  if (player) {
    updateZombies(delta);
  }

  // Update HUD
  if (player) {
    updateHUD();
  }

  // Death screen
  if (player && player.dead) {
    deathOverlay.style.display = "flex";
  } else if (deathOverlay.style.display !== "none") {
    deathOverlay.style.display = "none";
  }

  renderer.render(scene, camera);
}

// Handle window resize
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(getRendererPixelRatio());
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Prevent context menu
renderer.domElement.addEventListener("contextmenu", e => e.preventDefault());

document.title = t("pageTitle");

// Title
const title = document.createElement("div");
title.id = "game-title";
title.textContent = t("gameTitle");
document.body.appendChild(title);

// Version subtitle
const version = document.createElement("div");
version.id = "game-version";
version.textContent = t("version");
document.body.appendChild(version);

// Instructions
const instructions = document.createElement("div");
instructions.id = "instructions";

function updateInstructions(): void {
  if (mobileControls.enabled) {
    instructions.innerHTML = t("instructionsMobile");
  } else {
    instructions.innerHTML = t("instructionsDesktop");
  }
}

updateInstructions();
document.body.appendChild(instructions);

const footer = document.createElement("div");
footer.id = "game-footer";
footer.textContent = t("footer");
document.body.appendChild(footer);

// Language toggle button
const langToggle = document.createElement("button");
langToggle.id = "lang-toggle";
langToggle.textContent = getLocale() === "en" ? "🇧🇷" : "🇺🇸";
document.body.appendChild(langToggle);

langToggle.addEventListener("click", () => {
  const newLocale = getLocale() === "en" ? "ptBR" : "en";
  setLocale(newLocale);
  updateAllUI();
});

function updateAllUI(): void {
  document.title = t("pageTitle");
  title.textContent = t("gameTitle");
  version.textContent = t("version");
  footer.textContent = t("footer");
  deathOverlay.textContent = t("deathScreen");
  if (player) {
    healthText.textContent = `${Math.max(0, Math.ceil(player.health))} ${t("healthSeparator")} ${player.maxHealth}`;
  }
  updateInstructions();
  langToggle.textContent = getLocale() === "en" ? "🇧🇷" : "🇺🇸";
  mobileControls.updateTooltips();
}

function setGameActive(active: boolean): void {
  if (active) {
    instructions.style.display = "none";
    title.style.display = "none";
    version.style.display = "none";
    crosshair.style.display = "block";
    blockUI.style.display = "flex";
    healthBarBg.style.display = "block";
    cycleIndicator.style.display = "block";
    footer.style.display = "none";
    langToggle.style.display = "none";
    if (mobileControls.enabled) {
      mobileControls.show();
    }
  } else {
    instructions.style.display = "block";
    title.style.display = "block";
    version.style.display = "block";
    crosshair.style.display = "none";
    blockUI.style.display = "none";
    healthBarBg.style.display = "none";
    cycleIndicator.style.display = "none";
    footer.style.display = "block";
    langToggle.style.display = "block";
    if (mobileControls.enabled) {
      mobileControls.hide();
    }
  }
}

// Initial state
setGameActive(false);
healthBarBg.style.display = "none";
cycleIndicator.style.display = "none";

// Load sounds and init player
await audioManager.loadAll();
player = new Player(camera, controls, world, mobileControls, audioManager);
lastPlayerChunkX = Math.floor(player.position.x / CHUNK_SIZE);
lastPlayerChunkZ = Math.floor(player.position.z / CHUNK_SIZE);

// Handle clicks
renderer.domElement.addEventListener("click", () => {
  if (mobileControls.enabled) {
    setGameActive(true);
  }
});

renderer.domElement.addEventListener("touchend", e => {
  if (mobileControls.enabled) {
    e.preventDefault();
    setGameActive(true);
  }
});

document.addEventListener("pointerlockchange", () => {
  if (document.pointerLockElement === renderer.domElement) {
    setGameActive(true);
  } else if (!mobileControls.enabled) {
    setGameActive(false);
  }
});

// Start game loop
animate();
