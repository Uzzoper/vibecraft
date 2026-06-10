import { inject } from "@vercel/analytics";
import { createEngine } from "./engine/createEngine";
import { createDayNightState } from "./rendering/dayNight";
import { createGameUi } from "./ui/gameUi";
import { World } from "./world/World";
import { Controls } from "./player/Controls";
import { MobileControls } from "./player/MobileControls";
import { Player } from "./player/Player";
import { AudioManager } from "./utils/AudioManager";
import { ZombieManager } from "./interaction/ZombieManager";
import { BlockInteractionManager } from "./interaction/BlockInteractionManager";
import { PlayerMovementManager } from "./core/PlayerMovementManager";
import { recordPerformanceMetric } from "./utils/performanceMetrics";
import "./globals.css";

inject();

const { scene, camera, renderer, clock, skyColors, lights } = createEngine();
const dayNight = createDayNightState(scene, renderer, skyColors, lights);
const ui = createGameUi(dayNight);

const world = new World(scene);
world.update(8, 8);
world.setBurstMode(500);

const controls = new Controls(camera, renderer.domElement);
const mobileControls = new MobileControls();
const audioManager = new AudioManager();

let player: Player;
let zombieManager: ZombieManager;
let blockInteractionManager: BlockInteractionManager;

const playerMovementManager = new PlayerMovementManager({ world, ui });

function animate(): void {
  requestAnimationFrame(animate);

  const animateStart = performance.now();
  const delta = clock.getDelta();

  const isMobileActive = mobileControls.enabled;

  if (document.pointerLockElement === renderer.domElement || isMobileActive) {
    const movementStart = performance.now();
    playerMovementManager.update(delta);
    recordPerformanceMetric("main.playerMovementUpdate", performance.now() - movementStart);

    const pickedUpItem = player.tryPickupItems(blockInteractionManager.getItems());
    if (pickedUpItem) {
      blockInteractionManager.refreshHotbar();
    }

    if (blockInteractionManager) {
      const blockInteractionStart = performance.now();
      blockInteractionManager.update(delta, isMobileActive);
      recordPerformanceMetric(
        "main.blockInteractionUpdate",
        performance.now() - blockInteractionStart,
      );
    }
  }

  const dayNightStart = performance.now();
  dayNight.update(delta);
  recordPerformanceMetric("main.dayNightUpdate", performance.now() - dayNightStart);

  if (zombieManager) {
    const zombieStart = performance.now();
    zombieManager.update(delta);
    recordPerformanceMetric("main.zombieUpdate", performance.now() - zombieStart);
  }

  if (player && player.dead) {
    ui.deathOverlay.style.display = "flex";
  } else if (ui.deathOverlay.style.display !== "none") {
    ui.deathOverlay.style.display = "none";
  }

  world.processQueuedWorkerMessages();

  const renderStart = performance.now();
  renderer.render(scene, camera);
  recordPerformanceMetric("main.render", performance.now() - renderStart, {
    calls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
    geometries: renderer.info.memory.geometries,
    textures: renderer.info.memory.textures,
    programs: renderer.info.programs?.length ?? 0,
  });
  recordPerformanceMetric("main.animate", performance.now() - animateStart);
}

function setGameActive(active: boolean): void {
  ui.setGameActive(active);
  if (blockInteractionManager) {
    blockInteractionManager.setGameActive(active);
    if (active && mobileControls.enabled) {
      blockInteractionManager.showMobileControls(true);
    }
  }
}

setGameActive(false);
ui.healthBarBg.style.display = "none";
ui.cycleIndicator.style.display = "none";

await audioManager.loadAll();
player = new Player(camera, controls, world, audioManager, mobileControls);
playerMovementManager.setPlayer(player);

zombieManager = new ZombieManager({
  scene,
  world,
  player,
  dayNight,
  audioManager,
});

blockInteractionManager = new BlockInteractionManager({
  camera,
  renderer,
  world,
  player,
  audioManager,
  zombieManager,
  mobileControls,
  scene,
});

blockInteractionManager.addOutlineToScene(scene);
blockInteractionManager.setupEventListeners();

ui.updateAllText(player.health, player.maxHealth);
ui.updateInstructions(mobileControls.enabled);

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

animate();
