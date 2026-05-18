import * as THREE from "three";
import { Controls } from "./Controls";
import { MobileControls } from "./MobileControls";
import { World } from "../world/World";
import { BlockType } from "../world/BlockType";
import { AudioManager } from "../utils/AudioManager";
import { PlayerPhysics } from "./PlayerPhysics";

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
  private readonly DROWN_INTERVAL = 5;
  private physics: PlayerPhysics;

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
    this.physics = new PlayerPhysics(world);
    this.position = this.physics.position;
    this.velocity = this.physics.velocity;
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
      moveDir.normalize().multiplyScalar(this.physics.getSpeed() * deltaTime);
      this.physics.tryMoveHorizontal(moveDir.x, moveDir.z);
    }

    // Jump (only if on ground)
    const wantsToJump = this.controls.moveUp || (this.mobileControls?.jump ?? false);
    if (wantsToJump && this.physics.onGround) {
      this.physics.jump(this.physics.getJumpForce());
      this.audio.play("jump", 0.6);
    }

    // Physics
    this.physics.applyGravity(deltaTime);

    // Move vertically (handles landing and sets onGround)
    this.physics.tryMoveVertical(deltaTime);

    // Sync physics state to player
    this.onGround = this.physics.onGround;
    this.position = this.physics.position;
    this.velocity = this.physics.velocity;

    // After vertical movement, detect walking off edges
    if (!this.physics.checkGroundBelow() && this.physics.onGround) {
      this.physics.onGround = false;
      this.onGround = false;
    }

    // Footsteps
    this.audio.updateFootsteps(deltaTime, this.onGround, isMoving);

    this.updateCamera();
  }

  private isInWater(): boolean {
    const bx = Math.floor(this.position.x);
    const by = Math.floor(this.position.y);
    const bz = Math.floor(this.position.z);
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
    this.invincibleTimer = 1.0;
    this.audio.play("break", 0.5);
    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
      this.respawnTimer = 2.0;
    }
  }

  private respawn(): void {
    this.physics.position.set(8, 20, 8);
    this.physics.velocity.set(0, 0, 0);
    this.physics.onGround = false;
    this.position = this.physics.position;
    this.velocity = this.physics.velocity;
    this.onGround = this.physics.onGround;
    this.health = this.maxHealth;
    this.dead = false;
  }

  private updateCamera(): void {
    this.camera.position.set(
      this.position.x,
      this.position.y + this.physics.getPlayerHeight(),
      this.position.z,
    );
  }

  getEyePosition(): THREE.Vector3 {
    return new THREE.Vector3(
      this.position.x,
      this.position.y + this.physics.getPlayerHeight() - 0.2,
      this.position.z,
    );
  }
}
