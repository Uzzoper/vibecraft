export enum BlockType {
  Grass = 0,
  Dirt = 1,
  Stone = 2,
  Wood = 3,
  Leaves = 4,
}

export interface BlockDefinition {
  id: BlockType;
  name: string;
  texturePath: string;
}

export const BLOCKS: Record<BlockType, BlockDefinition> = {
  [BlockType.Grass]: {
    id: BlockType.Grass,
    name: "Grass",
    texturePath: "/textures/grass.png",
  },
  [BlockType.Dirt]: {
    id: BlockType.Dirt,
    name: "Dirt",
    texturePath: "/textures/dirt.png",
  },
  [BlockType.Stone]: {
    id: BlockType.Stone,
    name: "Stone",
    texturePath: "/textures/stone.png",
  },
  [BlockType.Wood]: {
    id: BlockType.Wood,
    name: "Wood",
    texturePath: "/textures/wood.png",
  },
  [BlockType.Leaves]: {
    id: BlockType.Leaves,
    name: "Leaves",
    texturePath: "/textures/leaves.png",
  },
};

export const BLOCK_TYPES = Object.values(BLOCKS);
export const DEFAULT_BLOCK = BlockType.Grass;
