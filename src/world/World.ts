import * as THREE from "three";
import { BlockType, BLOCKS } from "../Block";
import { octaveNoise2D } from "../utils/noise";
import { createAllMaterials } from "../utils/texture";
import { Chunk } from "./Chunk";

const CHUNK_SIZE = 16;
const MAX_HEIGHT = 64;
const RENDER_DISTANCE = 4; // chunks in each direction

export class World {
  private chunks = new Map<string, Chunk>();
  private scene: THREE.Scene;
  private materials: Map<number, THREE.Material>;
  private chunkMeshes = new Map<string, THREE.Group>();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.materials = createAllMaterials();
  }

  private chunkKey(cx: number, cz: number): string {
    return `${cx},${cz}`;
  }

  private generateChunkTerrain(chunk: Chunk): void {
    const baseX = chunk.chunkX * CHUNK_SIZE;
    const baseZ = chunk.chunkZ * CHUNK_SIZE;

    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const worldX = baseX + x;
        const worldZ = baseZ + z;

        // Use noise to determine terrain height (range roughly 2-12)
        const n = octaveNoise2D(worldX * 0.1, worldZ * 0.1, 4, 0.5);
        const height = Math.floor(THREE.MathUtils.mapLinear(n, -1, 1, 2, 14));

        for (let y = 0; y < height; y++) {
          let type: BlockType;
          if (y === height - 1) {
            type = BlockType.Grass;
          } else if (y > height - 4) {
            type = BlockType.Dirt;
          } else {
            type = BlockType.Stone;
          }
          chunk.setBlock(x, y, z, type);
        }
      }
    }
  }

  getChunk(cx: number, cz: number): Chunk {
    const key = this.chunkKey(cx, cz);
    if (this.chunks.has(key)) {
      return this.chunks.get(key)!;
    }
    const chunk = new Chunk(cx, cz);
    this.generateChunkTerrain(chunk);
    this.chunks.set(key, chunk);
    return chunk;
  }

  getBlock(worldX: number, worldY: number, worldZ: number): BlockType {
    const cx = Math.floor(worldX / CHUNK_SIZE);
    const cz = Math.floor(worldZ / CHUNK_SIZE);
    const chunk = this.chunks.get(this.chunkKey(cx, cz));
    if (!chunk) return BlockType.Air;

    const lx = ((worldX % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const ly = worldY;
    const lz = ((worldZ % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    return chunk.getBlock(lx, ly, lz);
  }

  setBlock(worldX: number, worldY: number, worldZ: number, type: BlockType): void {
    const cx = Math.floor(worldX / CHUNK_SIZE);
    const cz = Math.floor(worldZ / CHUNK_SIZE);
    let chunk = this.chunks.get(this.chunkKey(cx, cz));
    if (!chunk) {
      chunk = this.getChunk(cx, cz);
    }

    const lx = ((worldX % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const ly = worldY;
    const lz = ((worldZ % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    chunk.setBlock(lx, ly, lz, type);

    if (chunk.isDirty()) {
      this.rebuildChunkMesh(cx, cz);
    }
  }

  private rebuildChunkMesh(cx: number, cz: number): void {
    const chunk = this.chunks.get(this.chunkKey(cx, cz));
    if (!chunk) return;

    const oldMesh = this.chunkMeshes.get(this.chunkKey(cx, cz));
    if (oldMesh) {
      this.scene.remove(oldMesh);
    }

    const mesh = chunk.buildMesh(this.materials);
    this.scene.add(mesh);
    this.chunkMeshes.set(this.chunkKey(cx, cz), mesh);
  }

  update(playerX: number, playerZ: number): void {
    const centerCX = Math.floor(playerX / CHUNK_SIZE);
    const centerCZ = Math.floor(playerZ / CHUNK_SIZE);

    // Load chunks within render distance
    for (let dx = -RENDER_DISTANCE; dx <= RENDER_DISTANCE; dx++) {
      for (let dz = -RENDER_DISTANCE; dz <= RENDER_DISTANCE; dz++) {
        const cx = centerCX + dx;
        const cz = centerCZ + dz;
        const key = this.chunkKey(cx, cz);

        if (!this.chunkMeshes.has(key)) {
          const chunk = this.getChunk(cx, cz);
          const mesh = chunk.buildMesh(this.materials);
          this.scene.add(mesh);
          this.chunkMeshes.set(key, mesh);
        }
      }
    }
  }

  raycast(origin: THREE.Vector3, direction: THREE.Vector3, maxDistance: number = 6): {
    position: THREE.Vector3;
    normal: THREE.Vector3;
    blockType: BlockType;
  } | null {
    const step = 0.1;
    const steps = maxDistance / step;

    for (let i = 1; i <= steps; i++) {
      const x = Math.floor(origin.x + direction.x * step * i);
      const y = Math.floor(origin.y + direction.y * step * i);
      const z = Math.floor(origin.z + direction.z * step * i);

      const block = this.getBlock(x, y, z);
      if (block !== undefined && block > 0) {
        return {
          position: new THREE.Vector3(x, y, z),
          normal: new THREE.Vector3(0, 0, 0), // simplified
          blockType: block,
        };
      }
    }
    return null;
  }
}
