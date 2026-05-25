export class MockWorker {
  private handlers: Map<string, (e: any) => void> = new Map();
  public readonly messages: any[] = [];
  public onmessage?: (e: any) => void;

  constructor() {
    // Simulate worker initialization
  }

  postMessage(message: any) {
    this.messages.push(message);

    // Simulate async response
    setTimeout(() => {
      if (message.type === 'GENERATE_AND_MESH') {
        const { cx, cz } = message;
        // Create fake blocks array with correct length
        const fakeBlocks = new Uint8Array(16 * 64 * 16).fill(1); // fill with stone
        // Simulate response
        const event = {
          data: {
            type: 'GENERATE_AND_MESH_RESULT',
            cx,
            cz,
            blocks: fakeBlocks,
            meshData: {},
          },
        };
        if (this.onmessage) {
          this.onmessage(event);
        }
      } else if (message.type === 'MESH_ONLY') {
        const { cx, cz } = message;
        const event = {
          data: {
            type: 'MESH_ONLY_RESULT',
            cx,
            cz,
            meshData: {},
          },
        };
        if (this.onmessage) {
          this.onmessage(event);
        }
      }
    }, 10);
  }

  addEventListener(type: string, listener: (e: any) => void) {
    this.handlers.set(type, listener);
    this.onmessage = listener;
  }

  removeEventListener(type: string, listener: (e: any) => void) {
    this.handlers.delete(type);
  }

  terminate() {}
}
