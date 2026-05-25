// test/mocks/three.mock.ts
export const NearestFilter = 1003;
export const DoubleSide = 2;

export class Texture {
  magFilter?: number;
  minFilter?: number;
}

export class TextureLoader {
  load(): Texture {
    return new Texture();
  }
}

export class MeshLambertMaterial {
  constructor(public options: any = {}) {}
}

export class BufferAttribute {
  constructor(
    public array: Float32Array | Uint32Array,
    public itemSize: number,
  ) {}
}

export class BufferGeometry {
  attributes = new Map<string, BufferAttribute>();
  index: BufferAttribute | null = null;

  setAttribute(name: string, attribute: BufferAttribute): void {
    this.attributes.set(name, attribute);
  }

  setIndex(attribute: BufferAttribute): void {
    this.index = attribute;
  }

  computeBoundingSphere(): void {}
  dispose(): void {}
}

export class Scene {
  private children: any[] = [];

  add(obj: any): void {
    this.children.push(obj);
  }

  remove(obj: any): void {
    this.children = this.children.filter(child => child !== obj);
  }

  traverse(callback: (child: any) => void): void {
    this.children.forEach(callback);
  }
}

export class Mesh {
  geometry: any;
  material: any;

  constructor(geometry?: any, material?: any) {
    this.geometry = geometry;
    this.material = material;
  }
}

export class Vector3 {
  x: number; y: number; z: number;
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }

  set(x: number, y: number, z: number): void {
    this.x = x;
    this.y = y;
    this.z = z;
  }
}

export class Group {
  children: any[] = [];
  position = new Vector3();

  constructor() {
  }

  add(obj: any): void {
    this.children.push(obj);
  }

  clear(): void {
    this.children = [];
  }

  traverse(callback: (child: any) => void): void {
    this.children.forEach(callback);
  }
}

// Exportar tudo que o World pode precisar
export default {
  Scene,
  Mesh,
  BufferGeometry,
  BufferAttribute,
  Vector3,
  Group,
  Texture,
  TextureLoader,
  MeshLambertMaterial,
  NearestFilter,
  DoubleSide,
};
