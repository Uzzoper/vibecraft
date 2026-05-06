import * as THREE from "three";
import { BLOCKS, BlockDefinition } from "../Block";

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
  return new THREE.MeshLambertMaterial({ map: texture });
}

export function createAllMaterials(): Map<number, THREE.Material> {
  const materials = new Map<number, THREE.Material>();
  for (const def of Object.values(BLOCKS)) {
    materials.set(def.id, createBlockMaterial(def));
  }
  return materials;
}
