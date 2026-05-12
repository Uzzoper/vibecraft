import * as THREE from "three";
import { Controls } from "./Controls";
import { MobileControls } from "./MobileControls";
import { World } from "../world/World";
import { AudioManager } from "../utils/AudioManager";

const SPEED = 5.0;
const GRAVITY = -8.0;
const JUMP_FORCE = 4.5;
const TERMINAL_FALL_SPEED = -18.0;
const PLAYER_HEIGHT = 2.0;
const PLAYER_WIDTH = 0.6;
const MOUSE_SENSITIVITY = 0.002;

export class Player {
  public position: THREE.Vector3;
  public velocity: THREE.Vector3;
  public onGround: boolean = false;
  private controls: Controls;
  private mobileControls: MobileControls | null;
  private world: World;
  private camera: THREE.Camera;
  private euler: THREE.Euler;
  private audio: AudioManager;

  constructor(
    camera: THREE.Camera,
    controls: Controls,
    world: World,
    mobileControls?: MobileControls,
    audio?: AudioManager,
  ) {
    this.camera = camera;
    this.controls = controls;
    this.mobileControls = mobileControls || null;
    this.world = world;
    this.audio = audio || AudioManager.get();
    this.position = new THREE.Vector3(8, 20, 8);
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.euler = new THREE.Euler(0, 0, 0, "YXZ");
    this.updateCamera();
  }

  update(deltaTime: number): void {
    // Camera rotation from mobile controls
    if (
      this.mobileControls &&
      (this.mobileControls.cameraDeltaX !== 0 || this.mobileControls.cameraDeltaY !== 0)
    ) {
      this.euler.setFromQuaternion(this.camera.quaternion);
      this.euler.y -= this.mobileControls.cameraDeltaX * MOUSE_SENSITIVITY;
      this.euler.x -= this.mobileControls.cameraDeltaY * MOUSE_SENSITIVITY;
      this.euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.euler.x));
      this.camera.quaternion.setFromEuler(this.euler);
      this.mobileControls.update();
    }

    // Horizontal movement
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

    const moveDir = new THREE.Vector3(0, 0, 0);

    // Desktop controls
    if (this.controls.moveForward) moveDir.add(forward);
    if (this.controls.moveBackward) moveDir.sub(forward);
    if (this.controls.moveRight) moveDir.add(right);
    if (this.controls.moveLeft) moveDir.sub(right);

    // Mobile controls
    if (
      this.mobileControls &&
      (this.mobileControls.moveX !== 0 || this.mobileControls.moveY !== 0)
    ) {
      moveDir.add(right.multiplyScalar(this.mobileControls.moveX));
      moveDir.add(forward.multiplyScalar(-this.mobileControls.moveY));
    }

    const isMoving = moveDir.length() > 0;
    if (isMoving) {
      moveDir.normalize().multiplyScalar(SPEED * deltaTime);
      this.tryMoveHorizontal(moveDir.x, moveDir.z);
    }

    // Jump (only if on ground)
    const wantsToJump = this.controls.moveUp || (this.mobileControls?.jump ?? false);
    if (wantsToJump && this.onGround) {
      this.velocity.y = JUMP_FORCE;
      this.onGround = false;
      this.audio.play("jump", 0.6);
    }

    // Physics
    if (!this.onGround) {
      this.velocity.y += GRAVITY * deltaTime;
      this.velocity.y = Math.max(this.velocity.y, TERMINAL_FALL_SPEED);
    }

    // Move vertically (handles landing and sets onGround)
    this.tryMoveVertical(deltaTime);

    // After vertical movement, detect walking off edges
    if (!this.checkGroundBelow() && this.onGround) {
      this.onGround = false;
    }

    // Footsteps
    this.audio.updateFootsteps(deltaTime, this.onGround, isMoving);

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

  private tryMoveVertical(deltaTime: number): void {
    const dy = this.velocity.y * deltaTime;
    if (dy === 0) return;

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
      if (!this.checkCollisionAt(this.position.x, newY, this.position.z)) {
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
    this.camera.position.set(this.position.x, this.position.y + PLAYER_HEIGHT, this.position.z);
  }

  getEyePosition(): THREE.Vector3 {
    return new THREE.Vector3(
      this.position.x,
      this.position.y + PLAYER_HEIGHT - 0.2,
      this.position.z,
    );
  }
}
