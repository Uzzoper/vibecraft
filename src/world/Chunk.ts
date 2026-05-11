import * as THREE from "three";
import { BlockType } from "../Block";

const CHUNK_SIZE = 16;
const MAX_HEIGHT = 64;

export type LODLevel = 0 | 1 | 2;

const FACE_DEFINITIONS = [
  {
    normal: [1, 0, 0],
    neighbor: [1, 0, 0],
    corners: [
      [1, 0, 0],
      [1, 1, 0],
      [1, 1, 1],
      [1, 0, 1],
    ],
  },
  {
    normal: [-1, 0, 0],
    neighbor: [-1, 0, 0],
    corners: [
      [0, 0, 1],
      [0, 1, 1],
      [0, 1, 0],
      [0, 0, 0],
    ],
  },
  {
    normal: [0, 1, 0],
    neighbor: [0, 1, 0],
    corners: [
      [0, 1, 1],
      [1, 1, 1],
      [1, 1, 0],
      [0, 1, 0],
    ],
  },
  {
    normal: [0, -1, 0],
    neighbor: [0, -1, 0],
    corners: [
      [0, 0, 0],
      [1, 0, 0],
      [1, 0, 1],
      [0, 0, 1],
    ],
  },
  {
    normal: [0, 0, 1],
    neighbor: [0, 0, 1],
    corners: [
      [0, 0, 1],
      [1, 0, 1],
      [1, 1, 1],
      [0, 1, 1],
    ],
  },
  {
    normal: [0, 0, -1],
    neighbor: [0, 0, -1],
    corners: [
      [1, 0, 0],
      [0, 0, 0],
      [0, 1, 0],
      [1, 1, 0],
    ],
  },
] as const;

interface MeshBuffers {
  positions: number[];
  normals: number[];
  uvs: number[];
  indices: number[];
}

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
      return BlockType.Air;
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
      this.mesh.traverse(child => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
        }
      });
    }

    const group = new THREE.Group();
    group.position.set(this.chunkX * CHUNK_SIZE, 0, this.chunkZ * CHUNK_SIZE);

    const buffersByType = new Map<number, MeshBuffers>();

    for (let y = 0; y < MAX_HEIGHT; y++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        for (let x = 0; x < CHUNK_SIZE; x++) {
          const type = this.blocks[this.getIndex(x, y, z)];
          if (type === 0) continue; // air

          let buffers = buffersByType.get(type);
          if (!buffers) {
            buffers = { positions: [], normals: [], uvs: [], indices: [] };
            buffersByType.set(type, buffers);
          }

          for (const face of FACE_DEFINITIONS) {
            const nx = x + face.neighbor[0];
            const ny = y + face.neighbor[1];
            const nz = z + face.neighbor[2];
            if (!this.isFaceVisible(nx, ny, nz)) continue;

            this.addFace(buffers, x, y, z, face.corners, face.normal);
          }
        }
      }
    }

    for (const [type, buffers] of buffersByType) {
      if (buffers.positions.length === 0) continue;
      const material = materials.get(type);
      if (material) {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.Float32BufferAttribute(buffers.positions, 3));
        geometry.setAttribute("normal", new THREE.Float32BufferAttribute(buffers.normals, 3));
        geometry.setAttribute("uv", new THREE.Float32BufferAttribute(buffers.uvs, 2));
        geometry.setIndex(buffers.indices);
        geometry.computeBoundingSphere();

        const mesh = new THREE.Mesh(geometry, material);
        group.add(mesh);
      }
    }

    this.mesh = group;
    this.dirty = false;
    return group;
  }

  private isFaceVisible(x: number, y: number, z: number): boolean {
    if (y < 0) return false;
    if (x < 0 || x >= CHUNK_SIZE || y >= MAX_HEIGHT || z < 0 || z >= CHUNK_SIZE) return true;
    return this.blocks[this.getIndex(x, y, z)] === BlockType.Air;
  }

  private addFace(
    buffers: MeshBuffers,
    x: number,
    y: number,
    z: number,
    corners: readonly (readonly [number, number, number])[],
    normal: readonly [number, number, number],
  ): void {
    const vertexIndex = buffers.positions.length / 3;

    for (const [cornerX, cornerY, cornerZ] of corners) {
      buffers.positions.push(x + cornerX, y + cornerY, z + cornerZ);
      buffers.normals.push(normal[0], normal[1], normal[2]);
    }

    buffers.uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
    buffers.indices.push(
      vertexIndex,
      vertexIndex + 1,
      vertexIndex + 2,
      vertexIndex,
      vertexIndex + 2,
      vertexIndex + 3,
    );
  }

  isDirty(): boolean {
    return this.dirty;
  }
}
