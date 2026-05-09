import * as THREE from "three";
import { Controls } from "./Controls";
import { World } from "../world/World";

const SPEED = 5.0;
const GRAVITY = -10.0;
const JUMP_FORCE = 1.2;
const PLAYER_HEIGHT = 2.0;
const PLAYER_WIDTH = 0.6;

export class Player {
  public position: THREE.Vector3;
  public velocity: THREE.Vector3;
  public onGround: boolean = false;
  private controls: Controls;
  private world: World;
  private camera: THREE.Camera;

  constructor(camera: THREE.Camera, controls: Controls, world: World) {
    this.camera = camera;
    this.controls = controls;
    this.world = world;
    this.position = new THREE.Vector3(8, 20, 8); // Start above terrain
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.updateCamera();
  }

  update(deltaTime: number): void {
    // Horizontal movement
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

    const moveDir = new THREE.Vector3(0, 0, 0);
    if (this.controls.moveForward) moveDir.add(forward);
    if (this.controls.moveBackward) moveDir.sub(forward);
    if (this.controls.moveRight) moveDir.add(right);
    if (this.controls.moveLeft) moveDir.sub(right);

    if (moveDir.length() > 0) {
      moveDir.normalize().multiplyScalar(SPEED * deltaTime);
      this.tryMoveHorizontal(moveDir.x, moveDir.z);
    }

    // Physics — apply gravity first
    this.velocity.y += GRAVITY * deltaTime;
    this.velocity.y = Math.max(this.velocity.y, -50); // terminal velocity

    // Move vertically (handles landing and sets onGround)
    this.tryMoveVertical();

    // After vertical movement, detect walking off edges
    if (!this.checkGroundBelow() && this.onGround) {
      this.onGround = false;
    }

    // Jump (only if on ground)
    if (this.controls.moveUp && this.onGround) {
      this.velocity.y = JUMP_FORCE;
      this.onGround = false;
    }

    this.updateCamera();
  }

  private checkGroundBelow(): boolean {
    // Check if there is a solid block directly below the player's feet
    // Check several points under the player's bounding box
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

  private tryMoveHorizontal(dx: number, dz: number): void {
    const newX = this.position.x + dx;
    const newZ = this.position.z + dz;

    // Check for horizontal collision at current Y
    if (!this.checkCollisionAt(newX, this.position.y, this.position.z)) {
      this.position.x = newX;
    }
    if (!this.checkCollisionAt(this.position.x, this.position.y, newZ)) {
      this.position.z = newZ;
    }
  }

  private tryMoveVertical(): void {
    const dy = this.velocity.y;
    const newY = this.position.y + dy;

    if (dy < 0) {
      // Falling down — check if we hit something below
      if (!this.checkCollisionAt(this.position.x, newY, this.position.z)) {
        this.position.y = newY;
        this.onGround = false;
      } else {
        // Land on top of a block: snap to the block surface
        this.position.y = Math.floor(this.position.y);
        this.velocity.y = 0;
        this.onGround = true;
      }
    } else if (dy > 0) {
      // Moving up — check if we hit a block above
      if (!this.checkCollisionAt(this.position.x, newY + PLAYER_HEIGHT, this.position.z)) {
        this.position.y = newY;
      } else {
        this.velocity.y = 0;
      }
    }
  }

  private checkCollisionAt(x: number, y: number, z: number): boolean {
    // Sample several points within the player's bounding box
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
    return block !== undefined && block > 0;
  }

  private updateCamera(): void {
    this.camera.position.set(
      this.position.x,
      this.position.y + PLAYER_HEIGHT,
      this.position.z
    );
  }

  getEyePosition(): THREE.Vector3 {
    return new THREE.Vector3(
      this.position.x,
      this.position.y + PLAYER_HEIGHT - 0.2,
      this.position.z
    );
  }
}