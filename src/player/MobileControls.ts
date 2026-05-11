export interface TouchState {
  active: boolean;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  identifier: number;
}

interface ScreenOrientationAPI {
  lock(
    orientation:
      | "portrait"
      | "landscape"
      | "portrait-primary"
      | "portrait-secondary"
      | "landscape-primary"
      | "landscape-secondary",
  ): Promise<void>;
  unlock(): void;
  type: OrientationType;
  angle: number;
}

export class MobileControls {
  public moveX = 0;
  public moveY = 0;
  public jump = false;
  public breakBlock = false;
  public placeBlock = false;
  public cameraDeltaX = 0;
  public cameraDeltaY = 0;

  private joystickTouch: TouchState | null = null;
  private cameraTouch: TouchState | null = null;
  private jumpButton!: HTMLButtonElement;
  private breakButton!: HTMLButtonElement;
  private placeButton!: HTMLButtonElement;
  private joystickElement!: HTMLDivElement;
  private joystickKnob!: HTMLDivElement;
  private rotateButton!: HTMLButtonElement;
  private isMobile = false;
  private forcedLandscape = false;
  private isLandscape = false;

  constructor() {
    this.isMobile = this.detectTouch();
    if (!this.isMobile) return;

    this.isLandscape = window.innerWidth > window.innerHeight;
    this.createUI();
    this.setupEventListeners();
    this.onOrientationChange();
  }

  private detectTouch(): boolean {
    return "ontouchstart" in globalThis || navigator.maxTouchPoints > 0;
  }

  private isPortrait(): boolean {
    return window.innerHeight > window.innerWidth;
  }

  get enabled(): boolean {
    return this.isMobile;
  }

  private createUI(): void {
    // Orientation info overlay
    const overlay = document.createElement("div");
    overlay.id = "orientation-overlay";
    overlay.style.cssText = `
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.8);
      color: white;
      display: flex;
      justify-content: center;
      align-items: center;
      font-size: 24px;
      z-index: 9999;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.3s;
    `;
    overlay.textContent = "🔄 Gire o dispositivo para modo paisagem";
    document.body.appendChild(overlay);

    // Joystick container (floating)
    this.joystickElement = document.createElement("div");
    this.joystickElement.id = "joystick";
    this.joystickElement.style.cssText = `
      position: fixed;
      width: 120px;
      height: 120px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.15);
      border: 2px solid rgba(255, 255, 255, 0.3);
      display: none;
      justify-content: center;
      align-items: center;
      z-index: 1000;
      touch-action: none;
    `;

    this.joystickKnob = document.createElement("div");
    this.joystickKnob.style.cssText = `
      width: 50px;
      height: 50px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.5);
      position: absolute;
    `;
    this.joystickElement.appendChild(this.joystickKnob);
    document.body.appendChild(this.joystickElement);

    // Action buttons container
    const actionContainer = document.createElement("div");
    actionContainer.id = "action-buttons";
    actionContainer.style.cssText = `
      position: fixed;
      z-index: 1000;
      display: flex;
      gap: 12px;
      touch-action: none;
    `;

    // Rotate button
    this.rotateButton = document.createElement("button");
    this.rotateButton.id = "rotate-btn";
    this.rotateButton.innerHTML = "🔄";
    this.rotateButton.title = "Alternar paisagem";
    this.rotateButton.style.cssText = `
      position: fixed;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: rgba(100, 100, 255, 0.4);
      border: 2px solid rgba(255, 255, 255, 0.5);
      color: white;
      font-size: 24px;
      z-index: 1001;
      touch-action: none;
      user-select: none;
      cursor: pointer;
    `;
    document.body.appendChild(this.rotateButton);

    // Jump button
    this.jumpButton = document.createElement("button");
    this.jumpButton.textContent = "⬆";
    this.jumpButton.title = "Pular";
    this.jumpButton.style.cssText = `
      width: 70px;
      height: 70px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.3);
      border: 2px solid rgba(255, 255, 255, 0.5);
      color: white;
      font-weight: bold;
      font-size: 18px;
      z-index: 1000;
      touch-action: none;
      user-select: none;
      cursor: pointer;
    `;
    actionContainer.appendChild(this.jumpButton);

    // Break block button
    this.breakButton = document.createElement("button");
    this.breakButton.textContent = "⛏";
    this.breakButton.title = "Quebrar bloco";
    this.breakButton.style.cssText = `
      width: 70px;
      height: 70px;
      border-radius: 50%;
      background: rgba(255, 68, 68, 0.5);
      border: 2px solid rgba(255, 255, 255, 0.5);
      color: white;
      font-size: 24px;
      z-index: 1000;
      touch-action: none;
      user-select: none;
      cursor: pointer;
    `;
    actionContainer.appendChild(this.breakButton);

    // Place block button
    this.placeButton = document.createElement("button");
    this.placeButton.textContent = "🧱";
    this.placeButton.title = "Colocar bloco";
    this.placeButton.style.cssText = `
      width: 70px;
      height: 70px;
      border-radius: 50%;
      background: rgba(68, 255, 68, 0.5);
      border: 2px solid rgba(255, 255, 255, 0.5);
      color: white;
      font-size: 24px;
      z-index: 1000;
      touch-action: none;
      user-select: none;
      cursor: pointer;
    `;
    actionContainer.appendChild(this.placeButton);

    document.body.appendChild(actionContainer);

    this.repositionControls();
  }

  private repositionControls(): void {
    const overlay = document.getElementById("orientation-overlay");
    const joystick = document.getElementById("joystick");
    const actions = document.getElementById("action-buttons");
    const rotateBtn = document.getElementById("rotate-btn");

    if (this.isPortrait()) {
      // Portrait: show overlay, hide game-related UI
      if (overlay) overlay.style.opacity = "1";
      if (joystick) joystick.style.display = "none";
      if (actions) {
        actions.style.display = "none";
        actions.style.flexDirection = "row";
      }
      if (rotateBtn) {
        rotateBtn.style.display = "block";
        rotateBtn.style.top = "max(24px, env(safe-area-inset-top))";
        rotateBtn.style.right = "max(24px, env(safe-area-inset-right))";
        rotateBtn.style.bottom = "auto";
        rotateBtn.style.left = "auto";
        rotateBtn.style.transform = "none";
      }
    } else {
      // Landscape: normal layout
      if (overlay) overlay.style.opacity = "0";
      if (joystick) joystick.style.display = "flex";
      if (actions) {
        actions.style.display = "flex";
        actions.style.top = "auto";
        actions.style.right = "max(24px, env(safe-area-inset-right))";
        actions.style.left = "auto";
        actions.style.transform = "none";
        actions.style.flexDirection = "row";
      }
      if (rotateBtn) {
        rotateBtn.style.display = "block";
        rotateBtn.style.top = "max(24px, env(safe-area-inset-top))";
        rotateBtn.style.right = "max(24px, env(safe-area-inset-right))";
        rotateBtn.style.bottom = "auto";
        rotateBtn.style.left = "auto";
        rotateBtn.style.transform = "none";
      }

      // Position joystick bottom-left
      if (joystick) {
        joystick.style.left = "30px";
        joystick.style.top = "auto";
        joystick.style.bottom = "150px";
      }

      // Position action buttons bottom-right
      if (actions) {
        actions.style.bottom = "40px";
      }
    }
  }

  private setupEventListeners(): void {
    const screen = document.body;

    screen.addEventListener("touchstart", e => this.onTouchStart(e), { passive: false });
    screen.addEventListener("touchmove", e => this.onTouchMove(e), { passive: false });
    screen.addEventListener("touchend", e => this.onTouchEnd(e), { passive: false });
    screen.addEventListener("touchcancel", e => this.onTouchEnd(e), { passive: false });

    // Button listeners
    this.jumpButton.addEventListener("touchstart", e => {
      e.preventDefault();
      e.stopPropagation();
      this.jump = true;
    });
    this.jumpButton.addEventListener("touchend", e => {
      e.preventDefault();
      this.jump = false;
    });

    this.breakButton.addEventListener("touchstart", e => {
      e.preventDefault();
      e.stopPropagation();
      this.breakBlock = true;
    });
    this.breakButton.addEventListener("touchend", e => {
      e.preventDefault();
      this.breakBlock = false;
    });

    this.placeButton.addEventListener("touchstart", e => {
      e.preventDefault();
      e.stopPropagation();
      this.placeBlock = true;
    });
    this.placeButton.addEventListener("touchend", e => {
      e.preventDefault();
      this.placeBlock = false;
    });

    // Rotate button
    this.rotateButton.addEventListener("touchstart", e => {
      e.preventDefault();
      e.stopPropagation();
      this.toggleOrientation();
    });

    // Orientation change detection
    window.addEventListener("resize", () => {
      const nowLandscape = !this.isPortrait();
      if (nowLandscape !== this.isLandscape) {
        this.isLandscape = nowLandscape;
        this.repositionControls();
      }
    });
  }

  private getOrientation(): ScreenOrientationAPI | null {
    try {
      return (screen.orientation as unknown as ScreenOrientationAPI) ?? null;
    } catch {
      return null;
    }
  }

  private toggleOrientation(): void {
    const orientation = this.getOrientation();

    this.forcedLandscape = !this.forcedLandscape;

    if (this.forcedLandscape) {
      const locked = orientation;
      if (locked && typeof locked.lock === "function") {
        locked
          .lock("landscape")
          .then(() => {
            this.isLandscape = true;
            this.repositionControls();
            this.rotateButton.innerHTML = "🔒";
            this.rotateButton.title = "Desbloquear orientação";
          })
          .catch(() => {
            this.forcedLandscape = false;
            this.rotateButton.innerHTML = "🔄";
          });
      } else {
        if (this.isPortrait()) {
          alert("Por favor, gire o dispositivo para modo paisagem para jogar.");
        }
        this.forcedLandscape = false;
      }
    } else {
      const locked = orientation;
      if (locked && typeof locked.unlock === "function") {
        locked.unlock();
      }
      this.rotateButton.innerHTML = "🔄";
      this.rotateButton.title = "Alternar paisagem";
      // Re-detect
      setTimeout(() => {
        this.isLandscape = !this.isPortrait();
        this.repositionControls();
      }, 300);
    }
  }

  private onOrientationChange(): void {
    // Auto-detect after a short delay
    setTimeout(() => {
      this.isLandscape = !this.isPortrait();
      this.repositionControls();
    }, 500);
  }

  private onTouchStart(e: TouchEvent): void {
    if (this.isPortrait()) return; // ignore touches in portrait mode (only rotate button works)
    e.preventDefault();

    for (const touch of Array.from(e.changedTouches)) {
      const x = touch.clientX;
      const y = touch.clientY;

      // Left half of screen = joystick
      if (x < window.innerWidth / 2 && !this.joystickTouch) {
        this.joystickTouch = {
          active: true,
          startX: x,
          startY: y,
          currentX: x,
          currentY: y,
          identifier: touch.identifier,
        };
        this.showJoystick(x, y);
      }
      // Right half of screen = camera
      else if (x >= window.innerWidth / 2 && !this.cameraTouch) {
        this.cameraTouch = {
          active: true,
          startX: x,
          startY: y,
          currentX: x,
          currentY: y,
          identifier: touch.identifier,
        };
      }
    }
  }

  private onTouchMove(e: TouchEvent): void {
    if (this.isPortrait()) return;
    e.preventDefault();

    for (const touch of Array.from(e.changedTouches)) {
      if (this.joystickTouch && touch.identifier === this.joystickTouch.identifier) {
        this.joystickTouch.currentX = touch.clientX;
        this.joystickTouch.currentY = touch.clientY;
        this.updateJoystick();
      }
      if (this.cameraTouch && touch.identifier === this.cameraTouch.identifier) {
        const deltaX = touch.clientX - this.cameraTouch.currentX;
        const deltaY = touch.clientY - this.cameraTouch.currentY;
        this.cameraDeltaX = deltaX;
        this.cameraDeltaY = deltaY;
        this.cameraTouch.currentX = touch.clientX;
        this.cameraTouch.currentY = touch.clientY;
      }
    }
  }

  private onTouchEnd(e: TouchEvent): void {
    for (const touch of Array.from(e.changedTouches)) {
      if (this.joystickTouch && touch.identifier === this.joystickTouch.identifier) {
        this.joystickTouch = null;
        this.moveX = 0;
        this.moveY = 0;
        this.hideJoystick();
      }
      if (this.cameraTouch && touch.identifier === this.cameraTouch.identifier) {
        this.cameraTouch = null;
        this.cameraDeltaX = 0;
        this.cameraDeltaY = 0;
      }
    }
  }

  private showJoystick(x: number, y: number): void {
    this.joystickElement.style.display = "flex";
    this.joystickElement.style.left = `${x - 60}px`;
    this.joystickElement.style.top = `${y - 60}px`;
    this.joystickKnob.style.transform = "translate(0px, 0px)";
  }

  private updateJoystick(): void {
    if (!this.joystickTouch) return;

    const maxDist = 35;
    let dx = this.joystickTouch.currentX - this.joystickTouch.startX;
    let dy = this.joystickTouch.currentY - this.joystickTouch.startY;

    const dist = Math.hypot(dx, dy);
    if (dist > maxDist) {
      dx = (dx / dist) * maxDist;
      dy = (dy / dist) * maxDist;
    }

    this.joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;

    // Normalize to -1 to 1
    this.moveX = dx / maxDist;
    this.moveY = dy / maxDist;
  }

  private hideJoystick(): void {
    this.joystickElement.style.display = "none";
  }

  update(): void {
    // Reset camera deltas after they're consumed
    this.cameraDeltaX = 0;
    this.cameraDeltaY = 0;
  }
}
