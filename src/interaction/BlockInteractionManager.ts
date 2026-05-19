import * as THREE from "three";
import { BLOCK_TYPES, BlockDefinition } from "../world/Block";
import { BlockType } from "../world/BlockType";
import { World } from "../world/World";
import { Player } from "../player/Player";
import { AudioManager } from "../utils/AudioManager";
import { ZombieManager } from "./ZombieManager";
import { DayNightState } from "../rendering/dayNight";
import { MobileControls } from "../player/MobileControls";
import { BlockRaycaster } from "./BlockRaycaster";
import { BlockInteractionView } from "./BlockInteractionView";

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
  scene: THREE.Scene;
}

export class BlockInteractionManager {
  private renderer: THREE.WebGLRenderer;
  private world: World;
  private audioManager: AudioManager;
  private mobileControls: MobileControls;
  private raycaster: BlockRaycaster;
  private view: BlockInteractionView;
  private selectedBlockIndex = 0;
  private blockTypes: BlockDefinition[] = BLOCK_TYPES;
  private mobileBreakCooldown = 0;
  private mobilePlaceCooldown = 0;
  private boundMousedownHandler: (event: MouseEvent) => void;
  private boundWheelHandler: (event: WheelEvent) => void;
  private boundKeydownHandler: (event: KeyboardEvent) => void;
  private boundContextmenuHandler: (event: Event) => void;
  private boundBlockSelectHandler: (index: number) => void;

  constructor(deps: BlockInteractionManagerDeps) {
    this.renderer = deps.renderer;
    this.world = deps.world;
    this.audioManager = deps.audioManager;
    this.mobileControls = deps.mobileControls;
    this.raycaster = new BlockRaycaster({
      camera: deps.camera,
      player: deps.player,
      world: deps.world,
      zombieManager: deps.zombieManager,
      audioManager: deps.audioManager,
    });
    this.view = new BlockInteractionView({ scene: deps.scene });
    this.boundBlockSelectHandler = this.handleBlockSelect.bind(this);
    this.boundMousedownHandler = this.handleMousedown.bind(this);
    this.boundWheelHandler = this.handleWheel.bind(this);
    this.boundKeydownHandler = this.handleKeydown.bind(this);
    this.boundContextmenuHandler = this.handleContextmenu.bind(this);
    this.refreshBlockUI();
  }

  private refreshBlockUI(): void {
    this.view.updateBlockUI(this.blockTypes, this.selectedBlockIndex, this.boundBlockSelectHandler);
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
        if (this.raycaster.tryHitZombie()) {
          this.mobileBreakCooldown = MOBILE_INTERACTION_COOLDOWN;
          return;
        }
        const hit = this.raycaster.raycastBlock();
        if (hit) {
          this.world.setBlock(hit.position.x, hit.position.y, hit.position.z, BlockType.Air);
          this.audioManager.play("break", 0.5);
        }
        this.mobileBreakCooldown = MOBILE_INTERACTION_COOLDOWN;
      }
      if (this.mobileControls.placeBlock && this.mobilePlaceCooldown === 0) {
        const hit = this.raycaster.raycastBlock();
        if (hit) {
          const placePos = hit.position.clone().add(hit.normal);
          const blockAtPlace = this.world.getBlock(placePos.x, placePos.y, placePos.z);
          if (
            blockAtPlace === undefined ||
            blockAtPlace === 0 ||
            blockAtPlace === BlockType.Water
          ) {
            this.world.setBlock(placePos.x, placePos.y, placePos.z, this.getSelectedBlockType());
            this.audioManager.play("place", 0.5);
          }
        }
        this.mobilePlaceCooldown = MOBILE_INTERACTION_COOLDOWN;
      }
    }
    const hitBlock = this.raycaster.raycastBlock();
    const showOutline = !!(
      hitBlock &&
      (document.pointerLockElement === this.renderer.domElement || isMobileActive)
    );
    this.view.updateBlockOutline(hitBlock?.position ?? null, showOutline);
  }

  getSelectedBlockType(): BlockType {
    return this.blockTypes[this.selectedBlockIndex].id;
  }

  destroy(): void {
    this.renderer.domElement.removeEventListener("mousedown", this.boundMousedownHandler);
    this.renderer.domElement.removeEventListener("wheel", this.boundWheelHandler);
    document.removeEventListener("keydown", this.boundKeydownHandler);
    this.renderer.domElement.removeEventListener("contextmenu", this.boundContextmenuHandler);
    this.view.destroy();
  }

  addOutlineToScene(scene: THREE.Scene): void {
    this.view.addOutlineToScene(scene);
  }

  setGameActive(active: boolean): void {
    this.view.showGameUI(active);
  }

  showMobileControls(show: boolean): void {
    if (show) {
      this.mobileControls.show();
    } else {
      this.mobileControls.hide();
    }
  }

  private handleBlockSelect(index: number): void {
    this.selectedBlockIndex = index;
    this.refreshBlockUI();
  }

  private handleMousedown(event: MouseEvent): void {
    if (document.pointerLockElement !== this.renderer.domElement) return;
    event.preventDefault();
    const hit = this.raycaster.raycastBlock();
    if (event.button === 0) {
      if (this.raycaster.tryHitZombie()) return;
      if (!hit) return;
      this.world.setBlock(hit.position.x, hit.position.y, hit.position.z, BlockType.Air);
      this.audioManager.play("break", 0.5);
    } else if (event.button === 2) {
      if (!hit) return;
      const placePos = hit.position.clone().add(hit.normal);
      const blockAtPlace = this.world.getBlock(placePos.x, placePos.y, placePos.z);
      if (blockAtPlace === undefined || blockAtPlace === 0 || blockAtPlace === BlockType.Water) {
        this.world.setBlock(placePos.x, placePos.y, placePos.z, this.getSelectedBlockType());
        this.audioManager.play("place", 0.5);
      }
    }
  }

  private handleWheel(event: WheelEvent): void {
    event.preventDefault();
    this.selectedBlockIndex =
      event.deltaY > 0
        ? (this.selectedBlockIndex + 1) % this.blockTypes.length
        : (this.selectedBlockIndex - 1 + this.blockTypes.length) % this.blockTypes.length;
    this.refreshBlockUI();
  }

  private handleKeydown(event: KeyboardEvent): void {
    const num = parseInt(event.key);
    if (num >= 1 && num <= this.blockTypes.length) {
      this.selectedBlockIndex = num - 1;
      this.refreshBlockUI();
    }
  }

  private handleContextmenu(event: Event): void {
    event.preventDefault();
  }
}
