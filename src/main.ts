import * as THREE from "three";
import { World } from "./world/World";
import { Controls } from "./player/Controls";
import { Player } from "./player/Player";
import { BLOCK_TYPES, DEFAULT_BLOCK, BlockType } from "./Block";

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb); // sky blue
scene.fog = new THREE.Fog(0x87ceeb, 20, 80);

// Camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

// Lights
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(50, 100, 50);
scene.add(directionalLight);

// World
const world = new World(scene);
world.update(8, 8); // initial player position

// Controls and Player
const controls = new Controls(camera, renderer.domElement);
const player = new Player(camera, controls, world);

// Block selection
let selectedBlockIndex = 0; // index into blockTypes array
const blockTypes = BLOCK_TYPES;

// Raycaster for block interaction
const raycaster = new THREE.Raycaster();
const rayDirection = new THREE.Vector3();

// Crosshair
const crosshair = document.createElement("div");
crosshair.style.position = "fixed";
crosshair.style.top = "50%";
crosshair.style.left = "50%";
crosshair.style.transform = "translate(-50%, -50%)";
crosshair.style.width = "4px";
crosshair.style.height = "4px";
crosshair.style.backgroundColor = "white";
crosshair.style.borderRadius = "50%";
crosshair.style.pointerEvents = "none";
crosshair.style.zIndex = "1000";
document.body.appendChild(crosshair);

// Block selection UI
const blockUI = document.createElement("div");
blockUI.style.position = "fixed";
blockUI.style.bottom = "20px";
blockUI.style.left = "50%";
blockUI.style.transform = "translateX(-50%)";
blockUI.style.display = "flex";
blockUI.style.gap = "8px";
blockUI.style.zIndex = "1000";
blockUI.style.pointerEvents = "none";
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
  const origin = player.getEyePosition();
  const step = 0.1;
  const maxSteps = 60;

  for (let i = 1; i <= maxSteps; i++) {
    const x = Math.floor(origin.x + rayDirection.x * step * i);
    const y = Math.floor(origin.y + rayDirection.y * step * i);
    const z = Math.floor(origin.z + rayDirection.z * step * i);

    const block = world.getBlock(x, y, z);
    if (block !== undefined && block > 0) {
      // Calculate which face was hit
      const px = origin.x + rayDirection.x * step * i;
      const py = origin.y + rayDirection.y * step * i;
      const pz = origin.z + rayDirection.z * step * i;

      // Determine which face was hit by finding closest boundary
      const fracX = px - x;
      const fracY = py - y;
      const fracZ = pz - z;

      const distLeft = fracX; // distance to face at x
      const distRight = 1 - fracX; // distance to face at x+1
      const distBottom = fracY; // distance to face at y
      const distTop = 1 - fracY; // distance to face at y+1
      const distFront = fracZ; // distance to face at z
      const distBack = 1 - fracZ; // distance to face at z+1

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

// Block interaction - process directly on mousedown
renderer.domElement.addEventListener("mousedown", event => {
  if (document.pointerLockElement !== renderer.domElement) return;
  event.preventDefault();

  const hit = raycastBlock();
  if (!hit) return;

  if (event.button === 0) {
    // Left click: remove block
    world.setBlock(hit.position.x, hit.position.y, hit.position.z, 0 as BlockType);
  } else if (event.button === 2) {
    // Right click: place block
    const placePos = hit.position.clone().add(hit.normal);
    const blockAtPlace = world.getBlock(placePos.x, placePos.y, placePos.z);
    if (blockAtPlace === undefined || blockAtPlace === 0) {
      world.setBlock(placePos.x, placePos.y, placePos.z, blockTypes[selectedBlockIndex].id);
    }
  }
});

// Game loop
const clock = new THREE.Clock();

function animate(): void {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();

  if (document.pointerLockElement === renderer.domElement) {
    // Update player
    player.update(delta);

    // Update world (load chunks around player)
    world.update(player.position.x, player.position.z);
  }

  renderer.render(scene, camera);
}

// Handle window resize
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Prevent context menu on right click
renderer.domElement.addEventListener("contextmenu", e => e.preventDefault());

// Start game loop
animate();

// Initial instructions
const instructions = document.createElement("div");
instructions.style.position = "fixed";
instructions.style.top = "50%";
instructions.style.left = "50%";
instructions.style.transform = "translate(-50%, -50%)";
instructions.style.color = "white";
instructions.style.fontSize = "24px";
instructions.style.textAlign = "center";
instructions.style.zIndex = "2000";
instructions.style.pointerEvents = "none";
instructions.innerHTML =
  "Click to play<br>WASD: Move<br>Space: Jump<br>Left Click: Remove Block<br>Right Click: Place Block<br>Scroll/1-5: Select Block";
document.body.appendChild(instructions);

// Remove instructions when pointer is locked
document.addEventListener("pointerlockchange", () => {
  if (document.pointerLockElement === renderer.domElement) {
    instructions.style.display = "none";
  }
});
