import * as THREE from "three";
import { BlockType } from "../world/BlockType";
import { World } from "../world/World";
import { Player } from "../player/Player";
import { AudioManager } from "../utils/AudioManager";
import { ZombieManager } from "./ZombieManager";

export interface BlockRaycasterDeps {
  camera: THREE.Camera;
  player: Player;
  world: World;
  zombieManager: ZombieManager;
  audioManager: AudioManager;
}

export class BlockRaycaster {
  private camera: THREE.Camera;
  private player: Player;
  private world: World;
  private zombieManager: ZombieManager;
  private audioManager: AudioManager;

  private rayDirection = new THREE.Vector3();
  private raycaster = new THREE.Raycaster();

  constructor(deps: BlockRaycasterDeps) {
    this.camera = deps.camera;
    this.player = deps.player;
    this.world = deps.world;
    this.zombieManager = deps.zombieManager;
    this.audioManager = deps.audioManager;
  }

  raycastBlock(): { position: THREE.Vector3; normal: THREE.Vector3 } | null {
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

  tryHitZombie(): boolean {
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
}
