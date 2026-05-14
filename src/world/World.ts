import * as THREE from "three";
import { BlockType } from "../Block";
import { octaveNoise2D, octaveNoise3D } from "../utils/noise";
import { createAllMaterials } from "../utils/texture";
import { Chunk } from "./Chunk";

const CHUNK_SIZE = 16;
const MAX_HEIGHT = 64;
const RENDER_DISTANCE = 4; // chunks in each direction
const CAVE_THRESHOLD = 0.35; // noise value below this = air (cave)
const CAVE_WATER_LEVEL = 10; // water fills caves below this y level

export class World {
  private chunks = new Map<string, Chunk>();
  private scene: THREE.Scene;
  private materials: Map<number, THREE.Material>;
  private chunkMeshes = new Map<string, THREE.Group>();
  private lastCenterCX: number | null = null;
  private lastCenterCZ: number | null = null;

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

    // Carve caves using 3D noise
    this.carveCaves(chunk, baseX, baseZ);

    // Fill low caves with water
    this.fillCaveWater(chunk);

    // Generate trees on top of grass surfaces
    this.generateTrees(chunk, baseX, baseZ);
  }

  private carveCaves(chunk: Chunk, baseX: number, baseZ: number): void {
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        for (let y = 1; y < MAX_HEIGHT - 1; y++) {
          const worldX = baseX + x;
          const worldY = y;
          const worldZ = baseZ + z;

          // Only carve into stone and dirt (not grass surface or water)
          const currentBlock = chunk.getBlock(x, y, z);
          if (currentBlock !== BlockType.Stone && currentBlock !== BlockType.Dirt) continue;

          // Skip very high terrain (keep surfaces intact)
          const surfaceNoise = octaveNoise2D(worldX * 0.1, worldZ * 0.1, 4, 0.5);
          const surfaceHeight = Math.floor(THREE.MathUtils.mapLinear(surfaceNoise, -1, 1, 2, 14));
          if (y >= surfaceHeight - 2) continue;

          // 3D noise for cave carving
          const caveNoise = octaveNoise3D(worldX * 0.08, worldY * 0.08, worldZ * 0.08, 3, 0.5);
          if (caveNoise > CAVE_THRESHOLD) continue;

          // Carve: set to air
          chunk.setBlock(x, y, z, BlockType.Air);

          // Also carve adjacent water if this block is next to a water block
          for (const [dx, dy, dz] of [
            [1, 0, 0],
            [-1, 0, 0],
            [0, 1, 0],
            [0, -1, 0],
            [0, 0, 1],
            [0, 0, -1],
          ]) {
            const nx = x + dx;
            const ny = y + dy;
            const nz = z + dz;
            if (
              nx >= 0 &&
              nx < CHUNK_SIZE &&
              ny >= 0 &&
              ny < MAX_HEIGHT &&
              nz >= 0 &&
              nz < CHUNK_SIZE &&
              chunk.getBlock(nx, ny, nz) === BlockType.Water
            ) {
              chunk.setBlock(nx, ny, nz, BlockType.Air);
            }
          }
        }
      }
    }
  }

  private fillCaveWater(chunk: Chunk): void {
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        // Find air pockets below a certain level and fill with water
        for (let y = 1; y < CAVE_WATER_LEVEL; y++) {
          if (chunk.getBlock(x, y, z) === BlockType.Air) {
            // Check if there's a solid block above (ceiling)
            const hasCeiling = this.hasSolidAbove(chunk, x, y, z);
            if (hasCeiling) {
              chunk.setBlock(x, y, z, BlockType.Water);
            }
          }
        }
      }
    }
  }

  private hasSolidAbove(chunk: Chunk, x: number, y: number, z: number): boolean {
    for (let yy = y + 1; yy < MAX_HEIGHT; yy++) {
      const b = chunk.getBlock(x, yy, z);
      if (b !== BlockType.Air && b !== BlockType.Water) return true;
    }
    return false;
  }

  private generateTrees(chunk: Chunk, baseX: number, baseZ: number): void {
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const worldX = baseX + x;
        const worldZ = baseZ + z;

        // Use noise to determine tree placement (~25% density)
        const treeNoise = octaveNoise2D(worldX * 0.15 + 100, worldZ * 0.15 + 100, 2, 0.5);
        if (treeNoise < 0.55) continue;

        // Find the topmost non-air block in this column
        for (let y = MAX_HEIGHT - 1; y >= 0; y--) {
          const block = chunk.getBlock(x, y, z);
          if (block === BlockType.Grass) {
            this.placeTree(chunk, x, y, z);
            break;
          } else if (block !== BlockType.Air) {
            break; // hit stone/dirt, no tree here
          }
        }
      }
    }
  }

  private placeTree(chunk: Chunk, x: number, y: number, z: number): void {
    // Trunk height: 4-6 blocks
    const trunkHeight =
      4 + (Math.floor(octaveNoise2D(x + chunk.chunkX * 16, z + chunk.chunkZ * 16, 1) * 3) % 3);

    // Place wood trunk
    for (let ty = 1; ty <= trunkHeight; ty++) {
      chunk.setBlock(x, y + ty, z, BlockType.Wood);
    }

    const canopyBase = y + trunkHeight;

    // Place leaves - 3x3 canopy at two levels for a full look
    for (let level = 0; level < 2; level++) {
      const cy = canopyBase + level;
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          // Skip corners on bottom level for a more natural shape
          if (level === 0 && Math.abs(dx) + Math.abs(dz) === 2) continue;
          const lx = x + dx;
          const lz = z + dz;
          if (lx >= 0 && lx < CHUNK_SIZE && lz >= 0 && lz < CHUNK_SIZE) {
            chunk.setBlock(lx, cy, lz, BlockType.Leaves);
          }
        }
      }
    }

    // Top leaf
    chunk.setBlock(x, canopyBase + 2, z, BlockType.Leaves);
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

    if (centerCX === this.lastCenterCX && centerCZ === this.lastCenterCZ) {
      return;
    }

    this.lastCenterCX = centerCX;
    this.lastCenterCZ = centerCZ;

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

  raycast(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    maxDistance: number = 6,
  ): {
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
