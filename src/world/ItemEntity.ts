import * as THREE from "three";
import { BlockType } from "./BlockType";
import { BLOCKS } from "./Block";
import { World } from "./World";

export const ITEM_GRAVITY = -12.0;
export const ITEM_PICKUP_RANGE = 2.0;
export const ITEM_LIFETIME = 60;
const ITEM_PICKUP_VERTICAL_RANGE = 2.5;

export class ItemEntity {
  public mesh: THREE.Mesh;
  public position: THREE.Vector3;
  public velocity: THREE.Vector3;
  public blockType: BlockType;
  public alive: boolean = true;
  public lifetime: number = ITEM_LIFETIME;

  private world: World;
  private onGround: boolean = false;
  private bobTimer: number = 0;
  private baseY: number = 0;

  constructor(blockType: BlockType, x: number, y: number, z: number, world: World) {
    this.world = world;
    this.blockType = blockType;
    this.position = new THREE.Vector3(x, y, z);
    this.velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 2,
      2 + Math.random() * 2,
      (Math.random() - 0.5) * 2,
    );
    this.mesh = this.createMesh();
    this.mesh.position.copy(this.position);
  }

  private createMesh(): THREE.Mesh {
    const blockDef = BLOCKS[this.blockType];
    const textureLoader = new THREE.TextureLoader();

    let material: THREE.Material;
    if (blockDef) {
      const texture = textureLoader.load(blockDef.texturePath);
      material = new THREE.MeshLambertMaterial({ map: texture });
    } else {
      material = new THREE.MeshLambertMaterial({ color: 0xff00ff });
    }

    const geometry = new THREE.BoxGeometry(0.4, 0.4, 0.4);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    return mesh;
  }

  private checkGroundBelow(): boolean {
    const bx = Math.floor(this.position.x);
    const by = Math.floor(this.position.y) - 1;
    const bz = Math.floor(this.position.z);

    const block = this.world.getBlock(bx, by, bz);
    return block !== undefined && block > 0;
  }

  update(deltaTime: number): void {
    if (!this.alive) return;

    this.lifetime -= deltaTime;
    if (this.lifetime <= 0) {
      this.alive = false;
      return;
    }

    if (!this.onGround) {
      this.velocity.y += ITEM_GRAVITY * deltaTime;
      this.position.x += this.velocity.x * deltaTime;
      this.position.y += this.velocity.y * deltaTime;
      this.position.z += this.velocity.z * deltaTime;

      if (this.checkGroundBelow()) {
        this.position.y = Math.floor(this.position.y) + 0.5;
        this.velocity.y = 0;
        this.velocity.x = 0;
        this.velocity.z = 0;
        this.onGround = true;
        this.baseY = this.position.y;
        this.bobTimer = 0;
      }
    } else {
      this.bobTimer += deltaTime * 3;
      this.position.y = this.baseY + Math.sin(this.bobTimer) * 0.05;
      this.mesh.rotation.y += deltaTime * 1.5;
    }

    this.mesh.position.copy(this.position);
  }

  canPickupBy(playerPos: THREE.Vector3): boolean {
    const dx = Math.abs(playerPos.x - this.position.x);
    const dz = Math.abs(playerPos.z - this.position.z);
    const dy = playerPos.y - this.position.y;

    return (
      dx <= ITEM_PICKUP_RANGE &&
      dz <= ITEM_PICKUP_RANGE &&
      dy >= -0.5 &&
      dy <= ITEM_PICKUP_VERTICAL_RANGE
    );
  }

  destroy(): void {
    this.alive = false;
    if (this.mesh.parent) {
      this.mesh.parent.remove(this.mesh);
    }
    this.mesh.geometry.dispose();
    if (this.mesh.material instanceof THREE.Material) {
      this.mesh.material.dispose();
    }
  }
}
