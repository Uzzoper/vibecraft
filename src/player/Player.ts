import * as THREE from "three";
import { Controls } from "./Controls";
import { MobileControls } from "./MobileControls";
import { World } from "../world/World";
import { BlockType } from "../world/BlockType";
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
  public health: number = 20;
  public maxHealth: number = 20;
  private controls: Controls;
  private mobileControls: MobileControls | null;
  public world: World;
  private camera: THREE.Camera;
  private euler: THREE.Euler;
  private audio: AudioManager;
  public invincibleTimer: number = 0;
  public dead: boolean = false;
  private respawnTimer: number = 0;
  private drownTimer: number = 0;
  private readonly DROWN_INTERVAL = 5; // seconds between damage while submerged

  constructor(
    camera: THREE.Camera,
    controls: Controls,
    world: World,
    audio: AudioManager,
    mobileControls?: MobileControls,
  ) {
    this.camera = camera;
    this.controls = controls;
    this.mobileControls = mobileControls || null;
    this.world = world;
    this.audio = audio;
    this.position = new THREE.Vector3(8, 20, 8);
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.euler = new THREE.Euler(0, 0, 0, "YXZ");
    this.updateCamera();
  }

  update(deltaTime: number): void {
    if (this.dead) {
      this.respawnTimer -= deltaTime;
      if (this.respawnTimer <= 0) {
        this.respawn();
      }
      return;
    }

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

    // Drowning: take 1 damage every 5 seconds while submerged
    if (this.isInWater()) {
      this.drownTimer += deltaTime;
      if (this.drownTimer >= this.DROWN_INTERVAL) {
        this.drownTimer = 0;
        this.damage(1);
      }
    } else {
      this.drownTimer = 0;
    }

    // Underwater ambient sound
    if (this.isInWater()) {
      this.audio.startUnderwaterSound(0.3);
    } else {
      this.audio.stopUnderwaterSound();
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
    return block !== undefined && block > 0 && block !== BlockType.Water;
  }

  private isInWater(): boolean {
    const bx = Math.floor(this.position.x);
    const by = Math.floor(this.position.y);
    const bz = Math.floor(this.position.z);
    // Check from feet to head height (player is 2 blocks tall)
    for (let dy = 0; dy <= 2; dy++) {
      if (this.world.getBlock(bx, by + dy, bz) === BlockType.Water) {
        return true;
      }
    }
    return false;
  }

  damage(amount: number): void {
    if (this.invincibleTimer > 0) return;
    if (this.dead) return;
    this.health -= amount;
    this.invincibleTimer = 1.0; // 1 second of invincibility
    this.audio.play("break", 0.5);
    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
      this.respawnTimer = 2.0;
    }
  }

  private respawn(): void {
    this.position.set(8, 20, 8);
    this.velocity.set(0, 0, 0);
    this.health = this.maxHealth;
    this.dead = false;
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
