/// <reference lib="webworker" />
import { BlockType } from "./BlockType";
import { generateTerrain } from "./terrain";

const CHUNK_SIZE = 16;
const MAX_HEIGHT = 64;

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

interface MeshDataPayload {
  [key: number]: {
    positions: Float32Array;
    normals: Float32Array;
    uvs: Float32Array;
    indices: Uint32Array;
  };
}

type WorkerRequest =
  | {
      type: "GENERATE_AND_MESH";
      cx: number;
      cz: number;
    }
  | {
      type: "MESH_ONLY";
      cx: number;
      cz: number;
      blocks: Uint8Array;
    };

function getIndex(x: number, y: number, z: number): number {
  return (y * CHUNK_SIZE + z) * CHUNK_SIZE + x;
}

function isFaceVisible(
  blocks: Uint8Array,
  x: number,
  y: number,
  z: number,
  currentBlockType: BlockType,
): boolean {
  if (y < 0) return false;
  if (x < 0 || x >= CHUNK_SIZE || y >= MAX_HEIGHT || z < 0 || z >= CHUNK_SIZE) return true;
  const neighbor = blocks[getIndex(x, y, z)];
  if (neighbor === BlockType.Air) return true;
  if (neighbor === BlockType.Water) return currentBlockType !== BlockType.Water;
  return false;
}

function addFace(
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

function buildMeshData(blocks: Uint8Array): Record<number, MeshBuffers> {
  const buffersByType: Record<number, MeshBuffers> = {};

  for (let y = 0; y < MAX_HEIGHT; y++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const type = blocks[getIndex(x, y, z)];
        if (type === 0) continue;

        if (!buffersByType[type]) {
          buffersByType[type] = { positions: [], normals: [], uvs: [], indices: [] };
        }

        const buffers = buffersByType[type];

        for (const face of FACE_DEFINITIONS) {
          const nx = x + face.neighbor[0];
          const ny = y + face.neighbor[1];
          const nz = z + face.neighbor[2];
          if (!isFaceVisible(blocks, nx, ny, nz, type)) continue;

          addFace(buffers, x, y, z, face.corners, face.normal);
        }
      }
    }
  }

  return buffersByType;
}

function createMeshDataPayload(
  meshData: Record<number, MeshBuffers>,
  transferables: Transferable[],
): MeshDataPayload {
  const finalMeshData: MeshDataPayload = {};

  for (const [type, buffers] of Object.entries(meshData)) {
    const pos = new Float32Array(buffers.positions);
    const norm = new Float32Array(buffers.normals);
    const uv = new Float32Array(buffers.uvs);
    const idx = new Uint32Array(buffers.indices);

    finalMeshData[Number(type)] = {
      positions: pos,
      normals: norm,
      uvs: uv,
      indices: idx,
    };

    transferables.push(pos.buffer, norm.buffer, uv.buffer, idx.buffer);
  }

  return finalMeshData;
}

const workerScope = globalThis as unknown as DedicatedWorkerGlobalScope;

workerScope.addEventListener("message", e => {
  const message = e.data as WorkerRequest;
  const { type, cx, cz } = message;

  if (type === "GENERATE_AND_MESH") {
    const blocks = generateTerrain(cx, cz);
    const transferables: Transferable[] = [blocks.buffer];
    const finalMeshData = createMeshDataPayload(buildMeshData(blocks), transferables);

    workerScope.postMessage(
      {
        type: "GENERATE_AND_MESH_RESULT",
        cx,
        cz,
        blocks,
        meshData: finalMeshData,
      },
      transferables,
    );
  } else if (type === "MESH_ONLY") {
    const transferables: Transferable[] = [];
    const finalMeshData = createMeshDataPayload(buildMeshData(message.blocks), transferables);

    workerScope.postMessage(
      {
        type: "MESH_ONLY_RESULT",
        cx,
        cz,
        meshData: finalMeshData,
      },
      transferables,
    );
  }
});
