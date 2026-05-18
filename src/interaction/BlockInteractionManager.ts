import * as THREE from "three";
import { BLOCK_TYPES, BlockDefinition } from "../Block";
import { BlockType } from "../world/BlockType";
import { World } from "../world/World";
import { Player } from "../player/Player";
import { AudioManager } from "../utils/AudioManager";
import { ZombieManager } from "./ZombieManager";
import { DayNightState } from "../rendering/dayNight";
import { MobileControls } from "../player/MobileControls";

const MOBILE_INTERACTION_COOLDOWN = 0.18;

export interface BlockInteractionManagerDeps {
  camera: THREE.Camera;
  renderer: THREE.WebGLRenderer;
  world: World;
  player: Player;
  audioManager: AudioManager;
  zombieManager: ZombieManager;
  dayNight: DayNightState;
  mobileControls: MobileControls;
}

export class BlockInteractionManager {
  private camera: THREE.Camera;
  private renderer: THREE.WebGLRenderer;
  private world: World;
  private player: Player;
  private audioManager: AudioManager;
  private zombieManager: ZombieManager;
  private mobileControls: MobileControls;

  private selectedBlockIndex = 0;
  private blockTypes: BlockDefinition[] = BLOCK_TYPES;

  private rayDirection = new THREE.Vector3();
  private raycaster = new THREE.Raycaster();

  private crosshair: HTMLDivElement;
  private blockUI: HTMLDivElement;

  private blockOutline: THREE.LineSegments;

  private mobileBreakCooldown = 0;
  private mobilePlaceCooldown = 0;

  private boundMousedownHandler: (event: MouseEvent) => void;
  private boundWheelHandler: (event: WheelEvent) => void;
  private boundKeydownHandler: (event: KeyboardEvent) => void;
  private boundContextmenuHandler: (event: Event) => void;

  constructor(deps: BlockInteractionManagerDeps) {
    this.camera = deps.camera;
    this.renderer = deps.renderer;
    this.world = deps.world;
    this.player = deps.player;
    this.audioManager = deps.audioManager;
    this.zombieManager = deps.zombieManager;
    this.mobileControls = deps.mobileControls;

    // Create crosshair
    this.crosshair = document.createElement("div");
    this.crosshair.id = "crosshair";
    this.crosshair.style.display = "none";
    document.body.appendChild(this.crosshair);

    // Create block highlight outline
    const blockOutlineMat = new THREE.LineBasicMaterial({ color: 0xffffff });
    const blockOutlineGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.001, 1.001, 1.001));
    this.blockOutline = new THREE.LineSegments(blockOutlineGeo, blockOutlineMat);
    this.blockOutline.visible = false;

    this.blockUI = document.createElement("div");
    this.blockUI.id = "block-ui";
    this.blockUI.style.display = "none";
    document.body.appendChild(this.blockUI);

    this.updateBlockUI();

    this.boundMousedownHandler = this.handleMousedown.bind(this);
    this.boundWheelHandler = this.handleWheel.bind(this);
    this.boundKeydownHandler = this.handleKeydown.bind(this);
    this.boundContextmenuHandler = this.handleContextmenu.bind(this);
  }

  setupEventListeners(): void {
    this.renderer.domElement.addEventListener("mousedown", this.boundMousedownHandler);
    this.renderer.domElement.addEventListener("wheel", this.boundWheelHandler, { passive: false });
    document.addEventListener("keydown", this.boundKeydownHandler);
    this.renderer.domElement.addEventListener("contextmenu", this.boundContextmenuHandler);
  }

  update(deltaTime: number, isMobileActive: boolean): void {
    if (isMobileActive) {
      this.mobileBreakCooldown = Math.max(0, this.mobileBreakCooldown - deltaTime);
      this.mobilePlaceCooldown = Math.max(0, this.mobilePlaceCooldown - deltaTime);

      if (this.mobileControls.breakBlock && this.mobileBreakCooldown === 0) {
        if (this.tryHitZombie()) {
          this.mobileBreakCooldown = MOBILE_INTERACTION_COOLDOWN;
          return;
        }

        const hit = this.raycastBlock();
        if (hit) {
          this.world.setBlock(hit.position.x, hit.position.y, hit.position.z, BlockType.Air);
          this.audioManager.play("break", 0.5);
        }
        this.mobileBreakCooldown = MOBILE_INTERACTION_COOLDOWN;
      }

      if (this.mobileControls.placeBlock && this.mobilePlaceCooldown === 0) {
        const hit = this.raycastBlock();
        if (hit) {
          const placePos = hit.position.clone().add(hit.normal);
          const blockAtPlace = this.world.getBlock(placePos.x, placePos.y, placePos.z);
          if (
            blockAtPlace === undefined ||
            blockAtPlace === 0 ||
            blockAtPlace === BlockType.Water
          ) {
            this.world.setBlock(
              placePos.x,
              placePos.y,
              placePos.z,
              this.blockTypes[this.selectedBlockIndex].id,
            );
            this.audioManager.play("place", 0.5);
          }
        }
        this.mobilePlaceCooldown = MOBILE_INTERACTION_COOLDOWN;
      }
    }

    const hitBlock = this.raycastBlock();
    if (hitBlock && (document.pointerLockElement === this.renderer.domElement || isMobileActive)) {
      this.blockOutline.position.set(
        hitBlock.position.x + 0.5,
        hitBlock.position.y + 0.5,
        hitBlock.position.z + 0.5,
      );
      this.blockOutline.visible = true;
    } else {
      this.blockOutline.visible = false;
    }
  }

  getSelectedBlockType(): BlockType {
    return this.blockTypes[this.selectedBlockIndex].id;
  }

  destroy(): void {
    this.renderer.domElement.removeEventListener("mousedown", this.boundMousedownHandler);
    this.renderer.domElement.removeEventListener("wheel", this.boundWheelHandler);
    document.removeEventListener("keydown", this.boundKeydownHandler);
    this.renderer.domElement.removeEventListener("contextmenu", this.boundContextmenuHandler);

    this.crosshair.remove();
    this.blockUI.remove();

    if (this.blockOutline.parent) {
      this.blockOutline.parent.remove(this.blockOutline);
    }
  }

  addOutlineToScene(scene: THREE.Scene): void {
    scene.add(this.blockOutline);
  }

  setGameActive(active: boolean): void {
    this.crosshair.style.display = active ? "block" : "none";
    this.blockUI.style.display = active ? "flex" : "none";
  }

  showMobileControls(show: boolean): void {
    if (show) {
      this.mobileControls.show();
    } else {
      this.mobileControls.hide();
    }
  }

  private raycastBlock(): { position: THREE.Vector3; normal: THREE.Vector3 } | null {
    this.camera.getWorldDirection(this.rayDirection);
    const origin = this.player.getEyePosition();
    const step = 0.1;
    const maxSteps = 60;

    for (let i = 1; i <= maxSteps; i++) {
      const x = Math.floor(origin.x + this.rayDirection.x * step * i);
      const y = Math.floor(origin.y + this.rayDirection.y * step * i);
      const z = Math.floor(origin.z + this.rayDirection.z * step * i);

      const block = this.world.getBlock(x, y, z);
      if (block !== undefined && block > 0 && block !== BlockType.Water) {
        const px = origin.x + this.rayDirection.x * step * i;
        const py = origin.y + this.rayDirection.y * step * i;
        const pz = origin.z + this.rayDirection.z * step * i;

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

  private tryHitZombie(): boolean {
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    const zombieMeshList: THREE.Object3D[] = [];
    for (const zombie of this.zombieManager.getAll()) {
      zombie.mesh.traverse(child => {
        if ((child as THREE.Mesh).isMesh) {
          zombieMeshList.push(child);
        }
      });
    }
    const intersects = this.raycaster.intersectObjects(zombieMeshList);

    if (intersects.length > 0) {
      const zombie = this.zombieManager.findZombieByMesh(intersects[0].object);
      if (zombie && zombie.alive) {
        zombie.takeDamage(5);
        this.audioManager.play("break", 0.5);
        return true;
      }
    }
    return false;
  }

  private handleMousedown(event: MouseEvent): void {
    if (document.pointerLockElement !== this.renderer.domElement) return;
    event.preventDefault();

    const hit = this.raycastBlock();

    if (event.button === 0) {
      if (this.tryHitZombie()) {
        return;
      }

      if (!hit) return;
      this.world.setBlock(hit.position.x, hit.position.y, hit.position.z, BlockType.Air);
      this.audioManager.play("break", 0.5);
    } else if (event.button === 2) {
      if (!hit) return;
      const placePos = hit.position.clone().add(hit.normal);
      const blockAtPlace = this.world.getBlock(placePos.x, placePos.y, placePos.z);
      if (blockAtPlace === undefined || blockAtPlace === 0 || blockAtPlace === BlockType.Water) {
        this.world.setBlock(
          placePos.x,
          placePos.y,
          placePos.z,
          this.blockTypes[this.selectedBlockIndex].id,
        );
        this.audioManager.play("place", 0.5);
      }
    }
  }

  private handleWheel(event: WheelEvent): void {
    event.preventDefault();
    if (event.deltaY > 0) {
      this.selectedBlockIndex = (this.selectedBlockIndex + 1) % this.blockTypes.length;
    } else {
      this.selectedBlockIndex =
        (this.selectedBlockIndex - 1 + this.blockTypes.length) % this.blockTypes.length;
    }
    this.updateBlockUI();
  }

  private handleKeydown(event: KeyboardEvent): void {
    const num = parseInt(event.key);
    if (num >= 1 && num <= this.blockTypes.length) {
      this.selectedBlockIndex = num - 1;
      this.updateBlockUI();
    }
  }

  private handleContextmenu(event: Event): void {
    event.preventDefault();
  }

  private updateBlockUI(): void {
    this.blockUI.innerHTML = "";
    this.blockTypes.forEach((block, index) => {
      const div = document.createElement("div");
      div.style.width = "40px";
      div.style.height = "40px";
      div.style.border = index === this.selectedBlockIndex ? "3px solid white" : "2px solid gray";
      div.style.backgroundColor = this.getBlockColor(block.id);
      div.style.opacity = index === this.selectedBlockIndex ? "1" : "0.6";
      div.addEventListener("click", e => {
        e.stopPropagation();
        this.selectedBlockIndex = index;
        this.updateBlockUI();
      });
      div.addEventListener("touchend", e => {
        e.preventDefault();
        e.stopPropagation();
        this.selectedBlockIndex = index;
        this.updateBlockUI();
      });
      this.blockUI.appendChild(div);
    });
  }

  private getBlockColor(blockType: BlockType): string {
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
}
