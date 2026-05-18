import * as THREE from "three";
import { BlockType } from "./BlockType";

const CHUNK_SIZE = 16;
const MAX_HEIGHT = 64;

export interface WorkerMeshData {
  [key: number]: {
    positions: Float32Array;
    normals: Float32Array;
    uvs: Float32Array;
    indices: Uint32Array;
  };
}

export class Chunk {
  public readonly chunkX: number;
  public readonly chunkZ: number;
  public blocks: Uint8Array; // flat array: index = (y * CHUNK_SIZE + z) * CHUNK_SIZE + x
  public mesh: THREE.Group | null = null;
  private dirty = true;

  constructor(chunkX: number, chunkZ: number, blocks?: Uint8Array) {
    this.chunkX = chunkX;
    this.chunkZ = chunkZ;
    this.blocks = blocks || new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * MAX_HEIGHT).fill(0);
  }

  private getIndex(x: number, y: number, z: number): number {
    return (y * CHUNK_SIZE + z) * CHUNK_SIZE + x;
  }

  getBlock(x: number, y: number, z: number): BlockType {
    if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= MAX_HEIGHT || z < 0 || z >= CHUNK_SIZE) {
      return BlockType.Air;
    }
    return this.blocks[this.getIndex(x, y, z)] as BlockType;
  }

  setBlock(x: number, y: number, z: number, type: BlockType): void {
    if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= MAX_HEIGHT || z < 0 || z >= CHUNK_SIZE) return;
    this.blocks[this.getIndex(x, y, z)] = type;
    this.dirty = true;
  }

  applyMeshData(meshData: WorkerMeshData, materials: Map<number, THREE.Material>): THREE.Group {
    if (this.mesh) {
      this.mesh.traverse(child => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
        }
      });
      this.mesh.clear();
    } else {
      this.mesh = new THREE.Group();
      this.mesh.position.set(this.chunkX * CHUNK_SIZE, 0, this.chunkZ * CHUNK_SIZE);
    }

    for (const [typeStr, data] of Object.entries(meshData)) {
      const type = Number(typeStr);
      const material = materials.get(type);
      if (material) {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(data.positions, 3));
        geometry.setAttribute("normal", new THREE.BufferAttribute(data.normals, 3));
        geometry.setAttribute("uv", new THREE.BufferAttribute(data.uvs, 2));
        geometry.setIndex(new THREE.BufferAttribute(data.indices, 1));
        geometry.computeBoundingSphere();

        const mesh = new THREE.Mesh(geometry, material);
        this.mesh.add(mesh);
      }
    }

    this.dirty = false;
    return this.mesh;
  }

  isDirty(): boolean {
    return this.dirty;
  }
}
