import * as THREE from "three";
import { Zombie } from "../mobs/Zombie";
import { World } from "../world/World";
import { Player } from "../player/Player";
import { DayNightState } from "../rendering/dayNight";
import { AudioManager } from "../utils/AudioManager";

const ZOMBIE_MAX_COUNT = 3;
const ZOMBIE_SPAWN_INTERVAL = 15; // seconds between spawn attempts at night

export interface ZombieManagerDeps {
  scene: THREE.Scene;
  world: World;
  player: Player;
  dayNight: DayNightState;
  audioManager: AudioManager;
}

export class ZombieManager {
  private scene: THREE.Scene;
  private world: World;
  private player: Player;
  private dayNight: DayNightState;
  private audioManager: AudioManager;

  private zombies: Zombie[] = [];
  private lastZombieSpawnTime = 0;

  constructor(deps: ZombieManagerDeps) {
    this.scene = deps.scene;
    this.world = deps.world;
    this.player = deps.player;
    this.dayNight = deps.dayNight;
    this.audioManager = deps.audioManager;
  }

  update(deltaTime: number): void {
    this.lastZombieSpawnTime += deltaTime;

    // Spawn at night
    const sunAngle = this.dayNight.getSunAngle();
    const isNight = Math.sin(sunAngle) < 0;

    if (isNight && this.lastZombieSpawnTime >= ZOMBIE_SPAWN_INTERVAL) {
      this.lastZombieSpawnTime = 0;
      this.spawnZombieNearPlayer();
    }

    // Update and cleanup
    for (let i = this.zombies.length - 1; i >= 0; i--) {
      const zombie = this.zombies[i];

      // Despawn if too far
      const dx = zombie.position.x - this.player.position.x;
      const dz = zombie.position.z - this.player.position.z;
      const dist = Math.hypot(dx, dz);

      if (dist > 60 || !zombie.alive) {
        this.scene.remove(zombie.mesh);
        this.zombies.splice(i, 1);
        continue;
      }

      zombie.update(deltaTime);
    }
  }

  getAll(): Zombie[] {
    return this.zombies;
  }

  findZombieByMesh(mesh: THREE.Object3D): Zombie | null {
    let obj: THREE.Object3D | null = mesh;
    while (obj) {
      for (const zombie of this.zombies) {
        if (zombie.mesh === obj) return zombie;
      }
      obj = obj.parent;
    }
    return null;
  }

  destroy(): void {
    for (const zombie of this.zombies) {
      this.scene.remove(zombie.mesh);
    }
    this.zombies = [];
  }

  private spawnZombieNearPlayer(): void {
    if (this.zombies.length >= ZOMBIE_MAX_COUNT) return;

    const angle = Math.random() * Math.PI * 2;
    const distance = 15 + Math.random() * 20;
    const spawnX = this.player.position.x + Math.cos(angle) * distance;
    const spawnZ = this.player.position.z + Math.sin(angle) * distance;

    const zombie = new Zombie(this.world, this.player, spawnX, spawnZ);
    this.zombies.push(zombie);

    this.scene.add(zombie.mesh);
  }
}
