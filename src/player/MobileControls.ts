import { t, subscribeLocaleChange } from "../i18n/i18n";

export interface TouchState {
  active: boolean;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  identifier: number;
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

  private joystickTouch: TouchState | null = null;
  private cameraTouch: TouchState | null = null;
  private jumpButton!: HTMLButtonElement;
  private breakButton!: HTMLButtonElement;
  private placeButton!: HTMLButtonElement;
  private joystickElement!: HTMLDivElement;
  private joystickKnob!: HTMLDivElement;
  private _isVisible = false;
  private actionContainer!: HTMLDivElement;
  private unsubscribeLocaleChange: (() => void) | null = null;

  constructor() {
    this.isMobile = this.detectTouch();
    if (!this.isMobile) return;

    this.createUI();
    this.setupEventListeners();
    this.unsubscribeLocaleChange = subscribeLocaleChange(() => this.updateTooltips());
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
    const joystick = document.getElementById("joystick");
    const actions = document.getElementById("action-buttons");

    if (!joystick || !actions) return;

    const display = this._isVisible ? "flex" : "none";
    joystick.style.display = display;
    actions.style.display = display;

    if (!this._isVisible) return;

    if (this.isPortrait()) {
      // Portrait: center-bottom layout
      joystick.style.left = "50%";
      joystick.style.right = "auto";
      joystick.style.top = "auto";
      joystick.style.bottom = "180px";
      joystick.style.transform = "translateX(-50%)";

      actions.style.left = "auto";
      actions.style.right = "max(24px, env(safe-area-inset-right))";
      actions.style.top = "auto";
      actions.style.bottom = "40px";
      actions.style.transform = "none";
      actions.style.flexDirection = "column";
    } else {
      // Landscape: bottom-left joystick, bottom-right actions
      joystick.style.left = "30px";
      joystick.style.top = "auto";
      joystick.style.bottom = "150px";
      joystick.style.transform = "none";

      actions.style.right = "max(24px, env(safe-area-inset-right))";
      actions.style.left = "auto";
      actions.style.top = "auto";
      actions.style.bottom = "40px";
      actions.style.transform = "none";
      actions.style.flexDirection = "row";
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

    // Reposition on orientation change
    window.addEventListener("resize", () => {
      this.repositionControls();
    });
  }

  private onTouchStart(e: TouchEvent): void {
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
    this.jumpButton.title = t("jumpTooltip");
    this.breakButton.title = t("breakTooltip");
    this.placeButton.title = t("placeTooltip");
  }

  destroy(): void {
    this.unsubscribeLocaleChange?.();
    this.unsubscribeLocaleChange = null;
  }
}
