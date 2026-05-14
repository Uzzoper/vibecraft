export enum BlockType {
  Air = 0,
  Grass = 1,
  Dirt = 2,
  Stone = 3,
  Wood = 4,
  Leaves = 5,
  Water = 6,
}

export interface BlockDefinition {
  id: BlockType;
  name: string;
  texturePath: string;
}

export const BLOCKS: Partial<Record<BlockType, BlockDefinition>> = {
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
  [BlockType.Water]: {
    id: BlockType.Water,
    name: "Water",
    texturePath: "/textures/water.png",
  },
};

export const BLOCK_TYPES = Object.values(BLOCKS).filter(
  (def): def is BlockDefinition => def !== undefined && def.id !== BlockType.Water,
);
export const DEFAULT_BLOCK = BlockType.Grass;
