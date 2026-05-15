import { t } from "../i18n/i18n";

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
  public isMobile = false;
  public rotateButton!: HTMLButtonElement;
  public forcedLandscape = false;

  private joystickTouch: TouchState | null = null;
  private cameraTouch: TouchState | null = null;
  private jumpButton!: HTMLButtonElement;
  private breakButton!: HTMLButtonElement;
  private placeButton!: HTMLButtonElement;
  private joystickElement!: HTMLDivElement;
  private joystickKnob!: HTMLDivElement;
  private isLandscape = false;
  private _isVisible = false;
  private actionContainer!: HTMLDivElement;

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
    overlay.textContent = t("orientationOverlay");
    document.body.appendChild(overlay);

    // Joystick container (floating)
    this.joystickElement = document.createElement("div");
    this.joystickElement.id = "joystick";

    this.joystickKnob = document.createElement("div");
    this.joystickKnob.id = "joystick-knob";
    this.joystickElement.appendChild(this.joystickKnob);
    document.body.appendChild(this.joystickElement);

    // Action buttons container
    this.actionContainer = document.createElement("div");
    this.actionContainer.id = "action-buttons";

    // Rotate button
    this.rotateButton = document.createElement("button");
    this.rotateButton.id = "rotate-btn";
    this.rotateButton.innerHTML = "🔄";
    this.rotateButton.title = t("rotateTooltip");
    document.body.appendChild(this.rotateButton);

    // Jump button
    this.jumpButton = document.createElement("button");
    this.jumpButton.id = "jump-btn";
    this.jumpButton.className = "action-btn";
    this.jumpButton.textContent = "⬆";
    this.jumpButton.title = t("jumpTooltip");
    this.actionContainer.appendChild(this.jumpButton);

    // Break block button
    this.breakButton = document.createElement("button");
    this.breakButton.id = "break-btn";
    this.breakButton.className = "action-btn";
    this.breakButton.textContent = "⛏";
    this.breakButton.title = t("breakTooltip");
    this.actionContainer.appendChild(this.breakButton);

    // Place block button
    this.placeButton = document.createElement("button");
    this.placeButton.id = "place-btn";
    this.placeButton.className = "action-btn";
    this.placeButton.textContent = "🧱";
    this.placeButton.title = t("placeTooltip");
    this.actionContainer.appendChild(this.placeButton);

    document.body.appendChild(this.actionContainer);

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
      if (joystick) joystick.style.display = this._isVisible ? "flex" : "none";
      if (actions) {
        actions.style.display = this._isVisible ? "flex" : "none";
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

  public show(): void {
    this._isVisible = true;
    this.repositionControls();
  }

  public hide(): void {
    this._isVisible = false;
    this.repositionControls();
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
            this.rotateButton.title = t("rotateLockedTooltip");
          })
          .catch(() => {
            this.forcedLandscape = false;
            this.rotateButton.innerHTML = "🔄";
          });
      } else {
        if (this.isPortrait()) {
          alert(t("portraitAlert"));
        }
        this.forcedLandscape = false;
      }
    } else {
      const locked = orientation;
      if (locked && typeof locked.unlock === "function") {
        locked.unlock();
      }
      this.rotateButton.innerHTML = "🔄";
      this.rotateButton.title = t("rotateTooltip");
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

  updateTooltips(): void {
    this.rotateButton.title = t("rotateTooltip");
    this.jumpButton.title = t("jumpTooltip");
    this.breakButton.title = t("breakTooltip");
    this.placeButton.title = t("placeTooltip");
  }
}
