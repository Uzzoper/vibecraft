import { World } from "../src/world/World";
import { MockScene } from "./mocks/scene.mock";
import { MockWorker } from "./mocks/worker.mock";

function getChunks(world: World): Map<string, { blocks: Uint8Array }> {
  return (world as unknown as { chunks: Map<string, { blocks: Uint8Array }> }).chunks;
}

async function waitFor(predicate: () => boolean, timeout = 5000): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeout) {
      throw new Error(`Condition not met after ${timeout}ms`);
    }
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

describe('World integration', () => {
  let world: World;
  let scene: MockScene;
  let worker: MockWorker;

  beforeEach(() => {
    scene = new MockScene();
    worker = new MockWorker();
    world = new World(scene, worker as unknown as Worker);
  });

  it('should queue the initial render distance without blocking on terrain generation', () => {
    const start = performance.now();
    world.update(0, 0);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(50);
    expect(worker.messages.filter(message => message.type === 'GENERATE_AND_MESH')).toHaveLength(81);
  });

  it('should generate a chunk asynchronously', async () => {
    const cx = 0, cz = 0;
    const key = `${cx},${cz}`;
    const chunks = getChunks(world);

    // Ensure chunk does not exist
    chunks.delete(key);

    // Request generation
    world.update(0, 0);

    // Wait for chunk to be ready (with timeout)
    await waitFor(() => {
      world.processQueuedWorkerMessages(8);
      return chunks.has(key);
    });

    const chunk = chunks.get(key);
    expect(chunk).toBeDefined();
    expect(chunk?.blocks.length).toBe(16 * 64 * 16); // 16384 blocks
  });
});
