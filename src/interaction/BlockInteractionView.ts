import * as THREE from "three";
import { BlockDefinition, BLOCKS } from "../world/Block";
import { BlockType } from "../world/BlockType";
import { t } from "../i18n/i18n";

export interface BlockInteractionViewDeps {
  scene: THREE.Scene;
}

export class BlockInteractionView {
  private scene: THREE.Scene;

  private crosshair: HTMLDivElement;
  private blockUI: HTMLDivElement;
  private blockOutline: THREE.LineSegments;
  private warningMessage: HTMLDivElement | null = null;
  private warningTimeout: number | null = null;

  private selectedBlockIndex = 0;
  private blockTypes: BlockDefinition[] = [];

  constructor(deps: BlockInteractionViewDeps) {
    this.scene = deps.scene;

    this.crosshair = document.createElement("div");
    this.crosshair.id = "crosshair";
    this.crosshair.style.display = "none";
    document.body.appendChild(this.crosshair);

    const blockOutlineMat = new THREE.LineBasicMaterial({ color: 0xffffff });
    const blockOutlineGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.001, 1.001, 1.001));
    this.blockOutline = new THREE.LineSegments(blockOutlineGeo, blockOutlineMat);
    this.blockOutline.visible = false;

    this.blockUI = document.createElement("div");
    this.blockUI.id = "block-ui";
    this.blockUI.style.display = "none";
    document.body.appendChild(this.blockUI);

    this.warningMessage = document.createElement("div");
    this.warningMessage.id = "inventory-warning";
    this.warningMessage.style.display = "none";
    this.warningMessage.style.color = "#ff4444";
    this.warningMessage.style.position = "fixed";
    this.warningMessage.style.bottom = "80px";
    this.warningMessage.style.left = "50%";
    this.warningMessage.style.transform = "translateX(-50%)";
    this.warningMessage.style.fontFamily = "'Press Start 2P', monospace";
    this.warningMessage.style.fontSize = "12px";
    this.warningMessage.style.textAlign = "center";
    this.warningMessage.style.pointerEvents = "none";
    this.warningMessage.style.textShadow = "1px 1px 2px rgba(0,0,0,0.8)";
    this.warningMessage.textContent = t("noBlocksWarning");
    document.body.appendChild(this.warningMessage);
  }

  showEmptyInventoryWarning(): void {
    if (!this.warningMessage) return;
    this.warningMessage.textContent = t("noBlocksWarning");
    this.warningMessage.style.display = "block";
    if (this.warningTimeout) clearTimeout(this.warningTimeout);
    this.warningTimeout = globalThis.setTimeout(() => {
      if (this.warningMessage) {
        this.warningMessage.style.display = "none";
      }
    }, 2000);
  }

  addOutlineToScene(scene: THREE.Scene): void {
    scene.add(this.blockOutline);
  }

  showGameUI(active: boolean): void {
    this.crosshair.style.display = active ? "block" : "none";
    this.blockUI.style.display = active ? "flex" : "none";
  }

  updateBlockOutline(position: THREE.Vector3 | null, visible: boolean): void {
    if (position && visible) {
      this.blockOutline.position.set(position.x + 0.5, position.y + 0.5, position.z + 0.5);
      this.blockOutline.visible = true;
    } else {
      this.blockOutline.visible = false;
    }
  }

  updateBlockUI(
    inventory: Map<BlockType, number>,
    selectedBlockIndex: number,
    onSelectBlock: (index: number) => void,
  ): void {
    this.selectedBlockIndex = selectedBlockIndex;
    this.blockUI.innerHTML = "";

    const collectedBlocks: { block: BlockDefinition; count: number }[] = [];
    inventory.forEach((count, blockType) => {
      if (count > 0) {
        const blockDef = BLOCKS[blockType];
        if (blockDef) {
          collectedBlocks.push({ block: blockDef, count });
        }
      }
    });

    const displayBlocks = collectedBlocks.slice(0, 9);

    displayBlocks.forEach(({ block, count }, index) => {
      const div = document.createElement("div");
      div.style.width = "40px";
      div.style.height = "40px";
      div.style.border = index === selectedBlockIndex ? "3px solid white" : "2px solid gray";
      div.style.backgroundColor = this.getBlockColor(block.id);
      div.style.opacity = index === selectedBlockIndex ? "1" : "0.6";
      div.style.position = "relative";
      div.style.display = "flex";
      div.style.alignItems = "center";
      div.style.justifyContent = "center";

      if (count > 1) {
        const countSpan = document.createElement("span");
        countSpan.textContent = count.toString();
        countSpan.style.position = "absolute";
        countSpan.style.bottom = "2px";
        countSpan.style.right = "2px";
        countSpan.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
        countSpan.style.color = "white";
        countSpan.style.fontSize = "10px";
        countSpan.style.padding = "1px 3px";
        countSpan.style.borderRadius = "3px";
        div.appendChild(countSpan);
      }

      div.addEventListener("click", e => {
        e.stopPropagation();
        onSelectBlock(index);
      });
      div.addEventListener("touchend", e => {
        e.preventDefault();
        e.stopPropagation();
        onSelectBlock(index);
      });
      this.blockUI.appendChild(div);
    });
  }

  getBlockColor(blockType: BlockType): string {
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
      case BlockType.Sand:
        return "#e8d68c";
      case BlockType.Snow:
        return "#ffffff";
      case BlockType.Glass:
        return "#aaddff";
      case BlockType.Brick:
        return "#b85c3e";
      case BlockType.Sandstone:
        return "#c4a265";
      default:
        return "#000000";
    }
  }

  destroy(): void {
    this.crosshair.remove();
    this.blockUI.remove();
    if (this.warningMessage) {
      this.warningMessage.remove();
    }

    if (this.blockOutline.parent) {
      this.blockOutline.parent.remove(this.blockOutline);
    }
  }
}
