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
import "./globals.css";

inject();

const { scene, camera, renderer, clock, skyColors, lights } = createEngine();
const dayNight = createDayNightState(scene, renderer, skyColors, lights);
const ui = createGameUi(dayNight);

const world = new World(scene);
world.update(8, 8);

const controls = new Controls(camera, renderer.domElement);
const mobileControls = new MobileControls();
const audioManager = new AudioManager();

let player: Player;
let zombieManager: ZombieManager;
let blockInteractionManager: BlockInteractionManager;

const playerMovementManager = new PlayerMovementManager({ world, ui });

function animate(): void {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();

  const isMobileActive = mobileControls.enabled;

  if (document.pointerLockElement === renderer.domElement || isMobileActive) {
    playerMovementManager.update(delta);

    if (blockInteractionManager) {
      blockInteractionManager.update(delta, isMobileActive);
    }
  }

  dayNight.update(delta);

  if (zombieManager) {
    zombieManager.update(delta);
  }

  if (player && player.dead) {
    ui.deathOverlay.style.display = "flex";
  } else if (ui.deathOverlay.style.display !== "none") {
    ui.deathOverlay.style.display = "none";
  }

  renderer.render(scene, camera);
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
  dayNight,
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
