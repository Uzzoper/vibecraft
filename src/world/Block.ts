import { t } from "../i18n/i18n";
import { BlockType } from "./BlockType";

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
  [BlockType.Sand]: {
    id: BlockType.Sand,
    name: t("blockSand"),
    texturePath: "/textures/sand.png",
  },
  [BlockType.Snow]: {
    id: BlockType.Snow,
    name: t("blockSnow"),
    texturePath: "/textures/snow.png",
  },
  [BlockType.Glass]: {
    id: BlockType.Glass,
    name: t("blockGlass"),
    texturePath: "/textures/glass.png",
  },
  [BlockType.Brick]: {
    id: BlockType.Brick,
    name: t("blockBrick"),
    texturePath: "/textures/brick.png",
  },
  [BlockType.Sandstone]: {
    id: BlockType.Sandstone,
    name: t("blockSandstone"),
    texturePath: "/textures/sandstone.png",
  },
};

export const BLOCK_TYPES = Object.values(BLOCKS).filter(
  (def): def is BlockDefinition => def !== undefined && def.id !== BlockType.Water,
);
export const DEFAULT_BLOCK = BlockType.Grass;
