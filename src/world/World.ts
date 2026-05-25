import * as THREE from "three";
import { createAllMaterials } from "../utils/texture";
import { BlockType } from "./BlockType";
import { Chunk, WorkerMeshData } from "./Chunk";
import { generateTerrain } from "./terrain";

const CHUNK_SIZE = 16;
const RENDER_DISTANCE = 4; // chunks in each direction

interface WorkerMessage {
  type: "GENERATE_AND_MESH_RESULT" | "MESH_ONLY_RESULT";
  cx: number;
  cz: number;
  blocks?: Uint8Array;
  meshData: WorkerMeshData;
}

interface SceneLike {
  add: (obj: any) => void;
  remove: (obj: any) => void;
  traverse: (callback: (child: any) => void) => void;
}

export class World {
  private chunks = new Map<string, Chunk>();
  private scene: SceneLike;
  private materials: Map<number, THREE.Material>;
  private chunkMeshes = new Map<string, THREE.Group>();
  private lastCenterCX: number | null = null;
  private lastCenterCZ: number | null = null;
  private worker: Worker;
  private pendingMeshes = new Set<string>();
  private chunksToRemesh = new Set<string>();
  private modifiedChunkBlocks = new Map<string, Uint8Array>();
  private pendingChunks = new Set<string>();

  constructor(scene: SceneLike, worker?: Worker, workerBaseUrl?: string | URL) {
    this.scene = scene;
    this.materials = createAllMaterials();

    this.worker =
      worker ??
      new Worker(new URL("world.worker.ts", workerBaseUrl ?? import.meta.url), {
        type: "module",
      });
    this.worker.addEventListener("message", e => {
      const { type, cx, cz, blocks, meshData } = e.data as WorkerMessage;
      const key = this.chunkKey(cx, cz);

      if (type === "GENERATE_AND_MESH_RESULT") {
        if (!this.pendingChunks.delete(key)) {
          return;
        }
        if (!this.isChunkInRenderDistance(cx, cz)) {
          this.chunksToRemesh.delete(key);
          return;
        }

        let chunk = this.chunks.get(key);
        if (!chunk) {
          const savedBlocks = this.modifiedChunkBlocks.get(key);
          chunk = new Chunk(
            cx,
            cz,
            savedBlocks ? savedBlocks.slice() : (blocks ?? generateTerrain(cx, cz)),
          );
          this.chunks.set(key, chunk);
        }
        this.pendingMeshes.delete(key);
        if (this.chunksToRemesh.delete(key)) {
          this.requestChunkMesh(cx, cz);
          return;
        }
        this.applyChunkMesh(key, chunk, meshData);
      } else if (type === "MESH_ONLY_RESULT") {
        const chunk = this.chunks.get(key);
        this.pendingMeshes.delete(key);
        if (!chunk) {
          this.chunksToRemesh.delete(key);
          return;
        }
        if (this.chunksToRemesh.delete(key)) {
          this.requestChunkMesh(cx, cz);
          return;
        }
        this.applyChunkMesh(key, chunk, meshData);
      }
    });
  }

  private chunkKey(cx: number, cz: number): string {
    return `${cx},${cz}`;
  }

  private isChunkInRenderDistance(cx: number, cz: number): boolean {
    if (this.lastCenterCX === null || this.lastCenterCZ === null) return true;
    return (
      Math.abs(cx - this.lastCenterCX) <= RENDER_DISTANCE &&
      Math.abs(cz - this.lastCenterCZ) <= RENDER_DISTANCE
    );
  }

  private loadChunk(cx: number, cz: number): void {
    const key = this.chunkKey(cx, cz);
    if (this.chunks.has(key) || this.pendingChunks.has(key)) return;

    const savedBlocks = this.modifiedChunkBlocks.get(key);

    if (savedBlocks) {
      // Existing behavior for modified chunks - generate locally
      const blocks = savedBlocks.slice();
      const chunk = new Chunk(cx, cz, blocks);
      this.chunks.set(key, chunk);
      this.requestChunkMesh(cx, cz);
    } else {
      // New behavior: post GENERATE_AND_MESH to worker for terrain generation
      this.pendingChunks.add(key);
      try {
        this.worker.postMessage({
          type: "GENERATE_AND_MESH",
          cx,
          cz,
        });
      } catch {
        // Fallback to synchronous generation if worker fails
        this.pendingChunks.delete(key);
        const blocks = generateTerrain(cx, cz);
        const chunk = new Chunk(cx, cz, blocks);
        this.chunks.set(key, chunk);
        this.requestChunkMesh(cx, cz);
      }
      // Do NOT create chunk or call requestChunkMesh here
      // The GENERATE_AND_MESH_RESULT handler will create the chunk
    }
  }

  private requestChunkMesh(cx: number, cz: number): void {
    const key = this.chunkKey(cx, cz);
    const chunk = this.chunks.get(key);
    if (!chunk) return;

    if (this.pendingMeshes.has(key)) {
      this.chunksToRemesh.add(key);
      return;
    }

    this.pendingMeshes.add(key);
    this.worker.postMessage({
      type: "MESH_ONLY",
      cx,
      cz,
      blocks: chunk.blocks.slice(),
    });
  }

  private applyChunkMesh(key: string, chunk: Chunk, meshData: WorkerMeshData): void {
    const mesh = chunk.applyMeshData(meshData, this.materials);
    if (!this.chunkMeshes.has(key)) {
      this.scene.add(mesh);
    }
    this.chunkMeshes.set(key, mesh);
  }

  private disposeChunkMesh(key: string): void {
    const mesh = this.chunkMeshes.get(key);
    if (!mesh) return;

    this.scene.remove(mesh);
    mesh.traverse(child => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
      }
    });
    this.chunkMeshes.delete(key);
  }

  getBlock(worldX: number, worldY: number, worldZ: number): BlockType {
    const cx = Math.floor(worldX / CHUNK_SIZE);
    const cz = Math.floor(worldZ / CHUNK_SIZE);
    const key = this.chunkKey(cx, cz);

    if (this.pendingChunks.has(key)) {
      return BlockType.Air;
    }

    const chunk = this.chunks.get(key);
    if (!chunk) return BlockType.Air;

    const lx = ((worldX % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const ly = worldY;
    const lz = ((worldZ % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    return chunk.getBlock(lx, ly, lz);
  }

  setBlock(worldX: number, worldY: number, worldZ: number, type: BlockType): void {
    const cx = Math.floor(worldX / CHUNK_SIZE);
    const cz = Math.floor(worldZ / CHUNK_SIZE);
    const key = this.chunkKey(cx, cz);

    // Ignore block modifications for pending chunks
    if (this.pendingChunks.has(key)) {
      return;
    }

    const chunk = this.chunks.get(key);
    if (!chunk) return;

    const lx = ((worldX % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const ly = worldY;
    const lz = ((worldZ % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;

    const oldType = chunk.getBlock(lx, ly, lz);
    if (oldType === type) return;

    chunk.setBlock(lx, ly, lz, type);
    this.modifiedChunkBlocks.set(key, chunk.blocks.slice());

    this.requestChunkMesh(cx, cz);
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
        this.loadChunk(cx, cz);
      }
    }

    // Optional: unload far chunks to save memory
    this.unloadFarChunks(centerCX, centerCZ);
  }

  private unloadFarChunks(centerCX: number, centerCZ: number): void {
    const unloadDistance = RENDER_DISTANCE + 2;
    for (const [key, chunk] of this.chunks.entries()) {
      const dx = Math.abs(chunk.chunkX - centerCX);
      const dz = Math.abs(chunk.chunkZ - centerCZ);
      if (dx > unloadDistance || dz > unloadDistance) {
        if (this.modifiedChunkBlocks.has(key)) {
          this.modifiedChunkBlocks.set(key, chunk.blocks.slice());
        }
        this.disposeChunkMesh(key);
        this.chunks.delete(key);
      }
    }
  }
}
