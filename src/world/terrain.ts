import { octaveNoise2D, octaveNoise3D } from "../utils/noise";
import { BlockType } from "./BlockType";

const CHUNK_SIZE = 16;
const MAX_HEIGHT = 64;
const CAVE_THRESHOLD = 0.35;
const CAVE_WATER_LEVEL = 10;

function getIndex(x: number, y: number, z: number): number {
  return (y * CHUNK_SIZE + z) * CHUNK_SIZE + x;
}

function getBlock(blocks: Uint8Array, x: number, y: number, z: number): BlockType {
  if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= MAX_HEIGHT || z < 0 || z >= CHUNK_SIZE) {
    return BlockType.Air;
  }
  return blocks[getIndex(x, y, z)] as BlockType;
}

function setBlock(blocks: Uint8Array, x: number, y: number, z: number, type: BlockType): void {
  if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= MAX_HEIGHT || z < 0 || z >= CHUNK_SIZE) return;
  blocks[getIndex(x, y, z)] = type;
}

function hasSolidAbove(blocks: Uint8Array, x: number, y: number, z: number): boolean {
  for (let yy = y + 1; yy < MAX_HEIGHT; yy++) {
    const block = getBlock(blocks, x, yy, z);
    if (block !== BlockType.Air && block !== BlockType.Water) return true;
  }
  return false;
}

function placeTree(
  blocks: Uint8Array,
  cx: number,
  cz: number,
  x: number,
  y: number,
  z: number,
): void {
  const trunkHeight = 4 + (Math.floor(octaveNoise2D(x + cx * 16, z + cz * 16, 1) * 3) % 3);

  for (let ty = 1; ty <= trunkHeight; ty++) {
    setBlock(blocks, x, y + ty, z, BlockType.Wood);
  }

  const canopyBase = y + trunkHeight;

  for (let level = 0; level < 2; level++) {
    const cy = canopyBase + level;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        if (level === 0 && Math.abs(dx) + Math.abs(dz) === 2) continue;
        const lx = x + dx;
        const lz = z + dz;
        if (lx >= 0 && lx < CHUNK_SIZE && lz >= 0 && lz < CHUNK_SIZE) {
          setBlock(blocks, lx, cy, lz, BlockType.Leaves);
        }
      }
    }
  }

  setBlock(blocks, x, canopyBase + 2, z, BlockType.Leaves);
}

export function generateTerrain(cx: number, cz: number): Uint8Array {
  const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * MAX_HEIGHT);
  const baseX = cx * CHUNK_SIZE;
  const baseZ = cz * CHUNK_SIZE;

  for (let x = 0; x < CHUNK_SIZE; x++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      const worldX = baseX + x;
      const worldZ = baseZ + z;

      const noise = octaveNoise2D(worldX * 0.1, worldZ * 0.1, 4, 0.5);
      const height = Math.floor(((noise + 1) / 2) * (14 - 2) + 2);

      for (let y = 0; y < height; y++) {
        let type: BlockType;
        if (y === height - 1) {
          type = BlockType.Grass;
        } else if (y > height - 4) {
          type = BlockType.Dirt;
        } else {
          type = BlockType.Stone;
        }
        setBlock(blocks, x, y, z, type);
      }
    }
  }

  for (let x = 0; x < CHUNK_SIZE; x++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let y = 1; y < MAX_HEIGHT - 1; y++) {
        const worldX = baseX + x;
        const worldY = y;
        const worldZ = baseZ + z;

        const currentBlock = getBlock(blocks, x, y, z);
        if (currentBlock !== BlockType.Stone && currentBlock !== BlockType.Dirt) continue;

        const surfaceNoise = octaveNoise2D(worldX * 0.1, worldZ * 0.1, 4, 0.5);
        const surfaceHeight = Math.floor(((surfaceNoise + 1) / 2) * (14 - 2) + 2);
        if (y >= surfaceHeight - 2) continue;

        const caveNoise = octaveNoise3D(worldX * 0.08, worldY * 0.08, worldZ * 0.08, 3, 0.5);
        if (caveNoise <= CAVE_THRESHOLD) {
          setBlock(blocks, x, y, z, BlockType.Air);

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
              blocks[getIndex(nx, ny, nz)] === BlockType.Water
            ) {
              blocks[getIndex(nx, ny, nz)] = BlockType.Air;
            }
          }
        }
      }
    }
  }

  for (let x = 0; x < CHUNK_SIZE; x++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let y = 1; y < CAVE_WATER_LEVEL; y++) {
        if (getBlock(blocks, x, y, z) === BlockType.Air && hasSolidAbove(blocks, x, y, z)) {
          setBlock(blocks, x, y, z, BlockType.Water);
        }
      }
    }
  }

  for (let x = 0; x < CHUNK_SIZE; x++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      const worldX = baseX + x;
      const worldZ = baseZ + z;

      const treeNoise = octaveNoise2D(worldX * 0.15 + 100, worldZ * 0.15 + 100, 2, 0.5);
      if (treeNoise < 0.55) continue;

      for (let y = MAX_HEIGHT - 1; y >= 0; y--) {
        const block = getBlock(blocks, x, y, z);
        if (block === BlockType.Grass) {
          placeTree(blocks, cx, cz, x, y, z);
          break;
        } else if (block !== BlockType.Air) {
          break;
        }
      }
    }
  }

  return blocks;
}
