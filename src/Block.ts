import { t } from "./i18n/i18n";

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
    name: t("blockGrass"),
    texturePath: "/textures/grass.png",
  },
  [BlockType.Dirt]: {
    id: BlockType.Dirt,
    name: t("blockDirt"),
    texturePath: "/textures/dirt.png",
  },
  [BlockType.Stone]: {
    id: BlockType.Stone,
    name: t("blockStone"),
    texturePath: "/textures/stone.png",
  },
  [BlockType.Wood]: {
    id: BlockType.Wood,
    name: t("blockWood"),
    texturePath: "/textures/wood.png",
  },
  [BlockType.Leaves]: {
    id: BlockType.Leaves,
    name: t("blockLeaves"),
    texturePath: "/textures/leaves.png",
  },
  [BlockType.Water]: {
    id: BlockType.Water,
    name: t("blockWater"),
    texturePath: "/textures/water.png",
  },
};

export const BLOCK_TYPES = Object.values(BLOCKS).filter(
  (def): def is BlockDefinition => def !== undefined && def.id !== BlockType.Water,
);
export const DEFAULT_BLOCK = BlockType.Grass;
