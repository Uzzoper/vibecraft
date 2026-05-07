import * as THREE from "three";
import { Controls } from "./Controls";
import { World, BlockType } from "../world/World";

const SPEED = 5.0;
const GRAVITY = -20.0;
const JUMP_FORCE = 8.0;
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
    // Apply gravity
    if (!this.onGround) {
      this.velocity.y += GRAVITY * deltaTime;
    }

    // Jump
    if (this.controls.moveUp && this.onGround) {
      this.velocity.y = JUMP_FORCE;
      this.onGround = false;
    }

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
      this.tryMove(moveDir.x, moveDir.z);
    }

    // Vertical movement (gravity)
    this.velocity.y = Math.max(this.velocity.y, -50); // terminal velocity
    this.tryMoveY(this.velocity.y * deltaTime);

    // Update camera position
    this.updateCamera();
  }

  private tryMove(dx: number, dz: number): void {
    const newX = this.position.x + dx;
    const newZ = this.position.z + dz;

    // Check collision at new position
    if (!this.checkCollision(newX, this.position.y, this.position.z)) {
      this.position.x = newX;
    }
    if (!this.checkCollision(this.position.x, this.position.y, newZ)) {
      this.position.z = newZ;
    }
  }

  private tryMoveY(dy: number): void {
    const newY = this.position.y + dy;
    if (dy < 0) {
      // Moving down - check ground
      if (!this.checkCollision(this.position.x, newY, this.position.z)) {
        this.position.y = newY;
        this.onGround = false;
      } else {
        this.position.y = Math.ceil(this.position.y);
        this.velocity.y = 0;
        this.onGround = true;
      }
    } else {
      // Moving up
      if (!this.checkCollision(this.position.x, newY + PLAYER_HEIGHT, this.position.z)) {
        this.position.y = newY;
      } else {
        this.velocity.y = 0;
      }
    }
  }

  private checkCollision(x: number, y: number, z: number): boolean {
    // Check if any of the blocks around the player's feet and head are solid
    for (let dy = 0; dy <= PLAYER_HEIGHT; dy += 1) {
      for (let dx = -PLAYER_WIDTH / 2; dx <= PLAYER_WIDTH / 2; dx += 0.5) {
        for (let dz = -PLAYER_WIDTH / 2; dz <= PLAYER_WIDTH / 2; dz += 0.5) {
          const block = this.world.getBlock(
            Math.floor(x + dx),
            Math.floor(y + dy),
            Math.floor(z + dz)
          );
          if (block !== undefined && block > 0) {
            return true; // collision
          }
        }
      }
    }
    return false;
  }

  private updateCamera(): void {
    this.camera.position.set(
      this.position.x,
      this.position.y + PLAYER_HEIGHT - 0.5, // camera at head level
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
