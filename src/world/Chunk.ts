import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { BlockType, BLOCKS } from "../Block";

const CHUNK_SIZE = 16;
const MAX_HEIGHT = 64;

export class Chunk {
  public readonly chunkX: number;
  public readonly chunkZ: number;
  public blocks: Uint8Array; // flat array: index = (y * CHUNK_SIZE + z) * CHUNK_SIZE + x
  public mesh: THREE.Group | null = null;
  private dirty = true;

  constructor(chunkX: number, chunkZ: number) {
    this.chunkX = chunkX;
    this.chunkZ = chunkZ;
    this.blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * MAX_HEIGHT).fill(0);
  }

  private getIndex(x: number, y: number, z: number): number {
    return (y * CHUNK_SIZE + z) * CHUNK_SIZE + x;
  }

  getBlock(x: number, y: number, z: number): BlockType {
    if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= MAX_HEIGHT || z < 0 || z >= CHUNK_SIZE) {
      return BlockType.Grass; // treat out-of-bounds as air? Actually should be handled by world
    }
    return this.blocks[this.getIndex(x, y, z)] as BlockType;
  }

  setBlock(x: number, y: number, z: number, type: BlockType): void {
    if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= MAX_HEIGHT || z < 0 || z >= CHUNK_SIZE) return;
    this.blocks[this.getIndex(x, y, z)] = type;
    this.dirty = true;
  }

  buildMesh(materials: Map<number, THREE.Material>): THREE.Group {
    if (this.mesh) {
      this.mesh.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
        }
      });
    }

    const group = new THREE.Group();
    group.position.set(this.chunkX * CHUNK_SIZE, 0, this.chunkZ * CHUNK_SIZE);

    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    const geometriesByType = new Map<number, THREE.BufferGeometry[]>();

    for (let y = 0; y < MAX_HEIGHT; y++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        for (let x = 0; x < CHUNK_SIZE; x++) {
          const type = this.blocks[this.getIndex(x, y, z)];
          if (type === 0) continue; // air

          const key = type;
          if (!geometriesByType.has(key)) {
            geometriesByType.set(key, []);
          }
          const geo = boxGeo.clone();
          geo.translate(x + 0.5, y + 0.5, z + 0.5);
          geometriesByType.get(key)!.push(geo);
        }
      }
    }

    for (const [type, geos] of geometriesByType) {
      if (geos.length === 0) continue;
      const merged = mergeGeometries(geos);
      const material = materials.get(type);
      if (material) {
        const mesh = new THREE.Mesh(merged, material);
        group.add(mesh);
      }
    }

    boxGeo.dispose();
    this.mesh = group;
    this.dirty = false;
    return group;
  }

  isDirty(): boolean {
    return this.dirty;
  }
}
