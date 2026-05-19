import * as THREE from "three";
import { World } from "../world/World";
import { BlockType } from "../world/BlockType";

const SPEED = 5.0;
const GRAVITY = -8.0;
const JUMP_FORCE = 4.5;
const TERMINAL_FALL_SPEED = -18.0;
const PLAYER_HEIGHT = 2.0;
const PLAYER_WIDTH = 0.6;

export class PlayerPhysics {
  public position: THREE.Vector3;
  public velocity: THREE.Vector3;
  public onGround: boolean = false;

  private world: World;

  constructor(world: World) {
    this.world = world;
    this.position = new THREE.Vector3(8, 20, 8);
    this.velocity = new THREE.Vector3(0, 0, 0);
  }

  checkGroundBelow(): boolean {
    for (let dx = -PLAYER_WIDTH / 2; dx <= PLAYER_WIDTH / 2; dx += 0.5) {
      for (let dz = -PLAYER_WIDTH / 2; dz <= PLAYER_WIDTH / 2; dz += 0.5) {
        const bx = Math.floor(this.position.x + dx);
        const by = Math.floor(this.position.y) - 1;
        const bz = Math.floor(this.position.z + dz);

        if (this.isSolidBlock(bx, by, bz)) {
          return true;
        }
      }
    }
    return false;
  }

  tryMoveHorizontal(dx: number, dz: number): void {
    const newX = this.position.x + dx;
    const newZ = this.position.z + dz;

    if (!this.checkCollisionAt(newX, this.position.y, this.position.z)) {
      this.position.x = newX;
    }
    if (!this.checkCollisionAt(this.position.x, this.position.y, newZ)) {
      this.position.z = newZ;
    }
  }

  tryMoveVertical(deltaTime: number): void {
    const dy = this.velocity.y * deltaTime;
    if (dy === 0) return;

    const newY = this.position.y + dy;

    if (dy < 0) {
      if (!this.checkCollisionAt(this.position.x, newY, this.position.z)) {
        this.position.y = newY;
        this.onGround = false;
      } else {
        this.position.y = Math.floor(this.position.y);
        this.velocity.y = 0;
        this.onGround = true;
      }
    } else if (dy > 0) {
      if (!this.checkCollisionAt(this.position.x, newY, this.position.z)) {
        this.position.y = newY;
      } else {
        this.velocity.y = 0;
      }
    }
  }

  checkCollisionAt(x: number, y: number, z: number): boolean {
    for (let dy = 0; dy <= PLAYER_HEIGHT; dy += 0.5) {
      for (let dx = -PLAYER_WIDTH / 2; dx <= PLAYER_WIDTH / 2; dx += 0.5) {
        for (let dz = -PLAYER_WIDTH / 2; dz <= PLAYER_WIDTH / 2; dz += 0.5) {
          const bx = Math.floor(x + dx);
          const by = Math.floor(y + dy);
          const bz = Math.floor(z + dz);

          if (this.isSolidBlock(bx, by, bz)) {
            return true;
          }
        }
      }
    }
    return false;
  }

  private isSolidBlock(bx: number, by: number, bz: number): boolean {
    const block = this.world.getBlock(bx, by, bz);
    return block !== undefined && block > 0 && block !== BlockType.Water;
  }

  applyGravity(deltaTime: number): void {
    if (!this.onGround) {
      this.velocity.y += GRAVITY * deltaTime;
      this.velocity.y = Math.max(this.velocity.y, TERMINAL_FALL_SPEED);
    }
  }

  jump(force: number): void {
    this.velocity.y = force;
    this.onGround = false;
  }

  getSpeed(): number {
    return SPEED;
  }

  getJumpForce(): number {
    return JUMP_FORCE;
  }

  getPlayerHeight(): number {
    return PLAYER_HEIGHT;
  }
}
