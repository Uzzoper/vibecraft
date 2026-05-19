import { Player } from "../player/Player";
import { World } from "../world/World";
import type { GameUi } from "../ui/gameUi";

const CHUNK_SIZE = 16;

export class PlayerMovementManager {
  private world: World;
  private ui: GameUi;
  private _player: Player | null = null;
  private lastPlayerChunkX = 0;
  private lastPlayerChunkZ = 0;

  constructor(config: { world: World; player?: Player | null; ui: GameUi }) {
    this.world = config.world;
    this.ui = config.ui;
    if (config.player) {
      this._player = config.player;
    }
  }

  get player(): Player | null {
    return this._player;
  }

  setPlayer(player: Player): void {
    this._player = player;
    this.lastPlayerChunkX = Math.floor(player.position.x / CHUNK_SIZE);
    this.lastPlayerChunkZ = Math.floor(player.position.z / CHUNK_SIZE);
  }

  update(deltaTime: number): void {
    const player = this._player;
    if (!player) return;

    // Player physics and movement
    player.update(deltaTime);

    // Decrement invincibility timer
    if (player.invincibleTimer > 0) {
      player.invincibleTimer -= deltaTime;
    }

    // Void damage — kill player if fallen below world
    if (player.position.y < -10) {
      player.damage(player.health);
    }

    // Chunk tracking — load new chunks when player crosses chunk boundary
    const playerChunkX = Math.floor(player.position.x / CHUNK_SIZE);
    const playerChunkZ = Math.floor(player.position.z / CHUNK_SIZE);
    if (playerChunkX !== this.lastPlayerChunkX || playerChunkZ !== this.lastPlayerChunkZ) {
      this.lastPlayerChunkX = playerChunkX;
      this.lastPlayerChunkZ = playerChunkZ;
      this.world.update(player.position.x, player.position.z);
    }

    // HUD update
    this.ui.updateHud(player.health, player.maxHealth);
  }

  destroy(): void {
    this._player = null;
  }
}
