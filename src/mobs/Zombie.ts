import * as THREE from "three";
import { World } from "../world/World";
import { Player } from "../player/Player";
import { AudioManager } from "../utils/AudioManager";

const ZOMBIE_SPEED = 2.5;
const ZOMBIE_DAMAGE = 2;
const DESPAWN_DISTANCE = 50;
const BURN_HEIGHT = 60;

export class Zombie {
  public mesh: THREE.Group;
  public position: THREE.Vector3;
  public alive: boolean = true;
  private world: World;
  private target: Player;
  private damageTimer: number = 0;
  private burnTimer: number = 0;
  public health: number = 10;
  public maxHealth: number = 10;
  private hitTimer: number = 0;
  private leftArm!: THREE.Mesh;
  private rightArm!: THREE.Mesh;
  private attackAnimTimer: number = 0;
  private readonly ATTACK_ANIM_DURATION = 0.4;
  private growlTimer: number = 0;
  private currentSoundSource: AudioBufferSourceNode | null = null;

  constructor(world: World, target: Player, x: number, z: number) {
    this.world = world;
    this.target = target;
    this.position = new THREE.Vector3(x, 0, z);
    this.mesh = this.createMesh();

    // Find ground level for spawn
    this.position.y = this.findGroundY(x, z);
    this.mesh.position.copy(this.position);
  }

  takeDamage(amount: number): void {
    this.health -= amount;
    this.hitTimer = 0.2;

    this.mesh.traverse(child => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshLambertMaterial) {
        child.material.emissive.setHex(0xff0000);
        child.material.emissiveIntensity = 1;
      }
    });

    if (this.health <= 0) {
      this.alive = false;
    }
  }

  private createMesh(): THREE.Group {
    const group = new THREE.Group();

    const skinColor = 0x4a7a3a;
    const shirtColor = 0x3a6a2a;
    const darkColor = 0x1a3a0a;

    // Head
    const headGeo = new THREE.BoxGeometry(0.7, 0.7, 0.7);
    const headMat = new THREE.MeshLambertMaterial({ color: skinColor });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.set(0, 1.2, 0);
    group.add(head);

    // Eyes (dark dots)
    const eyeMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
    const eyeGeo = new THREE.BoxGeometry(0.12, 0.1, 0.05);
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.18, 1.25, 0.3);
    group.add(leftEye);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.18, 1.25, 0.3);
    group.add(rightEye);

    // Body
    const bodyGeo = new THREE.BoxGeometry(0.6, 0.8, 0.3);
    const bodyMat = new THREE.MeshLambertMaterial({ color: shirtColor });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.set(0, 0.6, 0);
    group.add(body);

    // Arms
    const armGeo = new THREE.BoxGeometry(0.2, 0.6, 0.2);
    const armMat = new THREE.MeshLambertMaterial({ color: skinColor });
    this.leftArm = new THREE.Mesh(armGeo, armMat);
    this.leftArm.position.set(-0.4, 0.5, 0);
    group.add(this.leftArm);
    this.rightArm = new THREE.Mesh(armGeo, armMat);
    this.rightArm.position.set(0.4, 0.5, 0);
    group.add(this.rightArm);

    // Legs
    const legGeo = new THREE.BoxGeometry(0.25, 0.5, 0.25);
    const legMat = new THREE.MeshLambertMaterial({ color: darkColor });
    const leftLeg = new THREE.Mesh(legGeo, legMat);
    leftLeg.position.set(-0.15, 0.05, 0);
    group.add(leftLeg);
    const rightLeg = new THREE.Mesh(legGeo, legMat);
    rightLeg.position.set(0.15, 0.05, 0);
    group.add(rightLeg);

    return group;
  }

  private findGroundY(x: number, z: number): number {
    for (let y = BURN_HEIGHT; y >= 0; y--) {
      const block = this.world.getBlock(Math.floor(x), y, Math.floor(z));
      if (block !== 0) {
        return y + 1;
      }
    }
    return 1;
  }

  update(deltaTime: number): void {
    if (!this.alive) return;

    if (this.hitTimer > 0) {
      this.hitTimer -= deltaTime;
      if (this.hitTimer <= 0) {
        this.mesh.traverse(child => {
          if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshLambertMaterial) {
            child.material.emissive.setHex(0x000000);
            child.material.emissiveIntensity = 0;
          }
        });
      }
    }

    const dx = this.target.position.x - this.position.x;
    const dz = this.target.position.z - this.position.z;
    const dist = Math.hypot(dx, dz);

    // Check for sunlight burn — if too high and exposed
    if (this.position.y >= BURN_HEIGHT) {
      this.burnTimer += deltaTime;
      if (this.burnTimer > 2) {
        this.alive = false;
        return;
      }
    } else {
      this.burnTimer = 0;
    }

    // Move toward player
    if (dist > 1.2 && dist < DESPAWN_DISTANCE) {
      const moveX = (dx / dist) * ZOMBIE_SPEED * deltaTime;
      const moveZ = (dz / dist) * ZOMBIE_SPEED * deltaTime;

      const newX = this.position.x + moveX;
      const newZ = this.position.z + moveZ;

      // Simple collision with blocks
      const headY = this.findGroundY(newX, newZ);
      if (headY - this.position.y <= 1.5) {
        this.position.x = newX;
        this.position.z = newZ;
        this.position.y = headY;
      }

      // Face toward player
      this.mesh.lookAt(
        new THREE.Vector3(this.target.position.x, this.position.y, this.target.position.z),
      );
    }

    // Proximity sound — louder when closer
    if (dist < 15) {
      this.growlTimer += deltaTime;
      if (this.growlTimer > 3) {
        this.growlTimer = 0;
        // Stop previous sound if still playing
        if (this.currentSoundSource) {
          this.currentSoundSource.stop();
          this.currentSoundSource = null;
        }
        const volume = THREE.MathUtils.mapLinear(dist, 0, 15, 0.5, 0.1);
        this.currentSoundSource = AudioManager.get().play("zombie", volume);
      }
    } else {
      this.growlTimer = 0;
    }

    // Attack player on contact
    if (dist < 1.5) {
      this.damageTimer += deltaTime;
      if (this.damageTimer > 0.8) {
        this.target.damage(ZOMBIE_DAMAGE);
        this.damageTimer = 0;
        this.attackAnimTimer = this.ATTACK_ANIM_DURATION;
      }
    }

    // Arm swing animation
    if (this.attackAnimTimer > 0) {
      this.attackAnimTimer -= deltaTime;
      const progress = this.attackAnimTimer / this.ATTACK_ANIM_DURATION;
      const swing = Math.sin(progress * Math.PI) * (-Math.PI / 2.5);
      this.leftArm.rotation.x = swing;
      this.rightArm.rotation.x = swing;
    }

    this.mesh.position.copy(this.position);
  }

  despawn(): void {
    this.alive = false;
    if (this.currentSoundSource) {
      this.currentSoundSource.stop();
      this.currentSoundSource = null;
    }
  }
}
