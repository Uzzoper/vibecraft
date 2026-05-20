import * as THREE from "three";
import { BLOCK_TYPES } from "../world/Block";
import { BlockType } from "../world/BlockType";
import { World } from "../world/World";
import { Player } from "../player/Player";
import { AudioManager } from "../utils/AudioManager";
import { ZombieManager } from "./ZombieManager";
import { MobileControls } from "../player/MobileControls";
import { BlockRaycaster } from "./BlockRaycaster";
import { BlockInteractionView } from "./BlockInteractionView";
import { ItemEntity } from "../world/ItemEntity";

const MOBILE_INTERACTION_COOLDOWN = 0.18;

export interface BlockInteractionManagerDeps {
  camera: THREE.Camera;
  renderer: THREE.WebGLRenderer;
  world: World;
  player: Player;
  audioManager: AudioManager;
  zombieManager: ZombieManager;
  mobileControls: MobileControls;
  scene: THREE.Scene;
}

export class BlockInteractionManager {
  private renderer: THREE.WebGLRenderer;
  private world: World;
  private player: Player;
  private audioManager: AudioManager;
  private mobileControls: MobileControls;
  private scene: THREE.Scene;
  private raycaster: BlockRaycaster;
  private view: BlockInteractionView;
  private selectedBlockIndex = 0;
  private mobileBreakCooldown = 0;
  private mobilePlaceCooldown = 0;
  private items: ItemEntity[] = [];
  private boundMousedownHandler: (event: MouseEvent) => void;
  private boundWheelHandler: (event: WheelEvent) => void;
  private boundKeydownHandler: (event: KeyboardEvent) => void;
  private boundContextmenuHandler: (event: Event) => void;
  private boundBlockSelectHandler: (index: number) => void;

  constructor(deps: BlockInteractionManagerDeps) {
    this.renderer = deps.renderer;
    this.world = deps.world;
    this.player = deps.player;
    this.audioManager = deps.audioManager;
    this.mobileControls = deps.mobileControls;
    this.scene = deps.scene;
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
    this.view.updateBlockUI(
      this.player.inventory,
      this.selectedBlockIndex,
      this.boundBlockSelectHandler,
    );
  }

  private canPlaceSelectedBlock(): boolean {
    const selectedType = this.getSelectedBlockType();
    const count = this.player.inventory.get(selectedType) || 0;
    return count > 0;
  }

  private consumeSelectedBlock(): void {
    const selectedType = this.getSelectedBlockType();
    const count = this.player.inventory.get(selectedType) || 0;
    if (count > 0) {
      const newCount = count - 1;
      if (newCount > 0) {
        this.player.inventory.set(selectedType, newCount);
      } else {
        this.player.inventory.delete(selectedType);
      }
      this.refreshBlockUI();
    }
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
          const brokenBlock = this.world.getBlock(hit.position.x, hit.position.y, hit.position.z);
          if (brokenBlock > 0 && brokenBlock !== BlockType.Water) {
            const item = new ItemEntity(
              brokenBlock,
              hit.position.x,
              hit.position.y,
              hit.position.z,
              this.world,
            );
            this.items.push(item);
            this.scene.add(item.mesh);
          }
          this.world.setBlock(hit.position.x, hit.position.y, hit.position.z, BlockType.Air);
          this.audioManager.play("break", 0.5);
        }
        this.mobileBreakCooldown = MOBILE_INTERACTION_COOLDOWN;
      }
      if (this.mobileControls.placeBlock && this.mobilePlaceCooldown === 0) {
        if (!this.canPlaceSelectedBlock()) {
          this.view.showEmptyInventoryWarning();
          this.mobilePlaceCooldown = MOBILE_INTERACTION_COOLDOWN;
          return;
        }
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
            this.consumeSelectedBlock();
            this.audioManager.play("place", 0.5);
          }
        }
        this.mobilePlaceCooldown = MOBILE_INTERACTION_COOLDOWN;
      }
    }
    for (const item of this.items) {
      item.update(deltaTime);
      if (!item.alive) {
        item.destroy();
      }
    }
    this.items = this.items.filter(i => i.alive);
    const hitBlock = this.raycaster.raycastBlock();
    const showOutline = !!(
      hitBlock &&
      (document.pointerLockElement === this.renderer.domElement || isMobileActive)
    );
    this.view.updateBlockOutline(hitBlock?.position ?? null, showOutline);
  }

  getSelectedBlockType(): BlockType {
    // Get the block type from the selected inventory slot
    const collectedBlocks: BlockType[] = [];
    this.player.inventory.forEach((count, blockType) => {
      if (count > 0) {
        collectedBlocks.push(blockType);
      }
    });

    // If we have collected blocks, return the selected one
    if (collectedBlocks.length > 0) {
      const adjustedIndex = this.selectedBlockIndex % collectedBlocks.length;
      return collectedBlocks[adjustedIndex];
    }

    // Fallback to original behavior if inventory is empty
    // We need to get the block types from somewhere - let's use a default list for now
    const fallbackBlocks: BlockType[] = [
      BlockType.Grass,
      BlockType.Dirt,
      BlockType.Stone,
      BlockType.Wood,
      BlockType.Leaves,
    ];
    return fallbackBlocks[this.selectedBlockIndex % fallbackBlocks.length];
  }

  refreshHotbar(): void {
    this.refreshBlockUI();
  }

  getItems(): ItemEntity[] {
    return this.items;
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
      const brokenBlock = this.world.getBlock(hit.position.x, hit.position.y, hit.position.z);
      if (brokenBlock > 0 && brokenBlock !== BlockType.Water) {
        const item = new ItemEntity(
          brokenBlock,
          hit.position.x,
          hit.position.y,
          hit.position.z,
          this.world,
        );
        this.items.push(item);
        this.scene.add(item.mesh);
      }
      this.world.setBlock(hit.position.x, hit.position.y, hit.position.z, BlockType.Air);
      this.audioManager.play("break", 0.5);
    } else if (event.button === 2) {
      if (!hit) return;
      if (!this.canPlaceSelectedBlock()) {
        this.view.showEmptyInventoryWarning();
        return;
      }
      const placePos = hit.position.clone().add(hit.normal);
      const blockAtPlace = this.world.getBlock(placePos.x, placePos.y, placePos.z);
      if (blockAtPlace === undefined || blockAtPlace === 0 || blockAtPlace === BlockType.Water) {
        this.world.setBlock(placePos.x, placePos.y, placePos.z, this.getSelectedBlockType());
        this.consumeSelectedBlock();
        this.audioManager.play("place", 0.5);
      }
    }
  }

  private handleWheel(event: WheelEvent): void {
    event.preventDefault();
    this.selectedBlockIndex =
      event.deltaY > 0
        ? (this.selectedBlockIndex + 1) % BLOCK_TYPES.length
        : (this.selectedBlockIndex - 1 + BLOCK_TYPES.length) % BLOCK_TYPES.length;
    this.refreshBlockUI();
  }

  private handleKeydown(event: KeyboardEvent): void {
    const num = parseInt(event.key);
    if (num >= 1 && num <= BLOCK_TYPES.length) {
      this.selectedBlockIndex = num - 1;
      this.refreshBlockUI();
    }
  }

  private handleContextmenu(event: Event): void {
    event.preventDefault();
  }
}
