const SOUND_PATHS: Record<string, string> = {
  break: "/sounds/break.ogg",
  jump: "/sounds/jump.ogg",
  place: "/sounds/place.ogg",
  zombie: "/sounds/zombie.ogg",
  underwater: "/sounds/underwater.ogg",
};

export class AudioManager {
  private ctx: AudioContext;
  private buffers: Map<string, AudioBuffer> = new Map();
  private stepTimer = 0;
  private stepInterval = 0.35;
  private underwaterSource: AudioBufferSourceNode | null = null;
  private underwaterGain: GainNode | null = null;

  constructor() {
    const AC =
      globalThis.AudioContext ??
      (globalThis as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AC();
  }

  /**
   * Removes silent samples from the start of the buffer.
   * threshold: minimum amplitude to consider "not silent" (0.0 to 1.0)
   */
  private trimStart(buffer: AudioBuffer, threshold: number = 0.01): AudioBuffer {
    const channels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;

    // Finds the first non-silent sample in any channel
    let startOffset = buffer.length;
    for (let ch = 0; ch < channels; ch++) {
      const data = buffer.getChannelData(ch);
      for (const [i, sample] of data.entries()) {
        if (Math.abs(sample) > threshold) {
          if (i < startOffset) startOffset = i;
          break;
        }
      }
    }

    if (startOffset === 0 || startOffset >= buffer.length) return buffer;

    // Cria novo buffer a partir do offset
    const trimmedLength = buffer.length - startOffset;
    const trimmed = this.ctx.createBuffer(channels, trimmedLength, sampleRate);
    for (let ch = 0; ch < channels; ch++) {
      const src = buffer.getChannelData(ch);
      const dst = trimmed.getChannelData(ch);
      dst.set(src.subarray(startOffset));
    }
    return trimmed;
  }

  async loadAll(): Promise<void> {
    const promises = Object.entries(SOUND_PATHS).map(async ([name, path]) => {
      const buffer = await this.loadSound(path);
      this.buffers.set(name, this.trimStart(buffer));
    });
    await Promise.all(promises);
  }

  private loadSound(path: string): Promise<AudioBuffer> {
    return fetch(path)
      .then(res => res.arrayBuffer())
      .then(data => this.ctx.decodeAudioData(data));
  }

  play(name: string, volume: number = 0.5): AudioBufferSourceNode | null {
    const buffer = this.buffers.get(name);
    if (!buffer) return null;

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    const gain = this.ctx.createGain();
    gain.gain.value = volume;

    source.connect(gain);
    gain.connect(this.ctx.destination);
    source.start(0);
    return source;
  }

  startUnderwaterSound(volume: number = 0.3): void {
    if (this.underwaterSource) return;
    const buffer = this.buffers.get("underwater");
    if (!buffer) return;

    this.underwaterSource = this.ctx.createBufferSource();
    this.underwaterSource.buffer = buffer;
    this.underwaterSource.loop = true;

    this.underwaterGain = this.ctx.createGain();
    this.underwaterGain.gain.value = volume;

    this.underwaterSource.connect(this.underwaterGain);
    this.underwaterGain.connect(this.ctx.destination);
    this.underwaterSource.start(0);
  }

  stopUnderwaterSound(): void {
    if (this.underwaterSource) {
      this.underwaterSource.stop();
      this.underwaterSource = null;
      this.underwaterGain = null;
    }
  }

  resumeContext(): void {
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  /**
   * Plays a step sound if the player is moving on the ground.
   * @param dt delta time in seconds
   * @param onGround whether the player is on the ground
   * @param moving whether the player is moving
   */
  updateFootsteps(dt: number, onGround: boolean, moving: boolean): void {
    if (onGround && moving) {
      this.stepTimer += dt;
      if (this.stepTimer >= this.stepInterval) {
        this.stepTimer = 0;
        this.play("place", 0.25); // reutiliza som de place como passo
      }
    } else {
      this.stepTimer = 0;
    }
  }
}
