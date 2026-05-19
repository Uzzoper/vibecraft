import * as THREE from "three";
import { BlockDefinition } from "../world/Block";
import { BlockType } from "../world/BlockType";

export interface BlockInteractionViewDeps {
  scene: THREE.Scene;
}

export class BlockInteractionView {
  private scene: THREE.Scene;

  private crosshair: HTMLDivElement;
  private blockUI: HTMLDivElement;
  private blockOutline: THREE.LineSegments;

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
    blockTypes: BlockDefinition[],
    selectedBlockIndex: number,
    onSelectBlock: (index: number) => void,
  ): void {
    this.blockTypes = blockTypes;
    this.selectedBlockIndex = selectedBlockIndex;
    this.blockUI.innerHTML = "";

    blockTypes.forEach((block, index) => {
      const div = document.createElement("div");
      div.style.width = "40px";
      div.style.height = "40px";
      div.style.border = index === selectedBlockIndex ? "3px solid white" : "2px solid gray";
      div.style.backgroundColor = this.getBlockColor(block.id);
      div.style.opacity = index === selectedBlockIndex ? "1" : "0.6";
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
      default:
        return "#000000";
    }
  }

  destroy(): void {
    this.crosshair.remove();
    this.blockUI.remove();

    if (this.blockOutline.parent) {
      this.blockOutline.parent.remove(this.blockOutline);
    }
  }
}
