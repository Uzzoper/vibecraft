// test/mocks/scene.mock.ts
export class MockScene {
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