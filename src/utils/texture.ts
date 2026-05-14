import * as THREE from "three";
import { BLOCKS, BlockDefinition, BlockType } from "../Block";

const textureLoader = new THREE.TextureLoader();
const cache = new Map<string, THREE.Texture>();

export function loadBlockTexture(def: BlockDefinition): THREE.Texture {
  if (cache.has(def.texturePath)) {
    return cache.get(def.texturePath)!;
  }
  const texture = textureLoader.load(def.texturePath);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  cache.set(def.texturePath, texture);
  return texture;
}

export function createBlockMaterial(def: BlockDefinition): THREE.Material {
  const texture = loadBlockTexture(def);
  if (def.id === BlockType.Water) {
    return new THREE.MeshLambertMaterial({
      map: texture,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
    });
  }
  return new THREE.MeshLambertMaterial({ map: texture });
}

export function createAllMaterials(): Map<number, THREE.Material> {
  const materials = new Map<number, THREE.Material>();
  for (const def of Object.values(BLOCKS).filter(
    (def): def is BlockDefinition => def !== undefined,
  )) {
    materials.set(def.id, createBlockMaterial(def));
  }
  return materials;
}
