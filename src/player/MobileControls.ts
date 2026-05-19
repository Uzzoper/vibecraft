import { t, subscribeLocaleChange } from "../i18n/i18n";
import { VirtualJoystick, TouchState } from "./VirtualJoystick";

export class MobileControls {
  public moveX = 0;
  public moveY = 0;
  public jump = false;
  public breakBlock = false;
  public placeBlock = false;
  public cameraDeltaX = 0;
  public cameraDeltaY = 0;
  public isMobile = false;

  private joystick: VirtualJoystick;
  private cameraTouch: TouchState | null = null;
  private jumpButton!: HTMLButtonElement;
  private breakButton!: HTMLButtonElement;
  private placeButton!: HTMLButtonElement;
  private _isVisible = false;
  private actionContainer!: HTMLDivElement;
  private unsubscribeLocaleChange: (() => void) | null = null;

  constructor() {
    this.isMobile = this.detectTouch();
    this.joystick = new VirtualJoystick();
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
    this.actionContainer = document.createElement("div");
    this.actionContainer.id = "action-buttons";

    this.jumpButton = document.createElement("button");
    this.jumpButton.id = "jump-btn";
    this.jumpButton.className = "action-btn";
    this.jumpButton.textContent = "⬆";
    this.jumpButton.title = t("jumpTooltip");
    this.actionContainer.appendChild(this.jumpButton);

    this.breakButton = document.createElement("button");
    this.breakButton.id = "break-btn";
    this.breakButton.className = "action-btn";
    this.breakButton.textContent = "⛏";
    this.breakButton.title = t("breakTooltip");
    this.actionContainer.appendChild(this.breakButton);

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
    const actions = document.getElementById("action-buttons");

    if (!actions) return;

    const display = this._isVisible ? "flex" : "none";
    actions.style.display = display;

    this.joystick.reposition();

    if (!this._isVisible) return;

    if (this.isPortrait()) {
      actions.style.left = "auto";
      actions.style.right = "max(24px, env(safe-area-inset-right))";
      actions.style.top = "auto";
      actions.style.bottom = "40px";
      actions.style.transform = "none";
      actions.style.flexDirection = "column";
    } else {
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

    window.addEventListener("resize", () => {
      this.repositionControls();
    });
  }

  private onTouchStart(e: TouchEvent): void {
    e.preventDefault();

    this.joystick.onTouchStart(e);

    for (const touch of Array.from(e.changedTouches)) {
      const x = touch.clientX;

      if (x >= window.innerWidth / 2 && !this.cameraTouch) {
        this.cameraTouch = {
          active: true,
          startX: touch.clientX,
          startY: touch.clientY,
          currentX: touch.clientX,
          currentY: touch.clientY,
          identifier: touch.identifier,
        };
      }
    }
  }

  private onTouchMove(e: TouchEvent): void {
    e.preventDefault();

    this.joystick.onTouchMove(e);

    for (const touch of Array.from(e.changedTouches)) {
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
    this.joystick.onTouchEnd(e);

    for (const touch of Array.from(e.changedTouches)) {
      if (this.cameraTouch && touch.identifier === this.cameraTouch.identifier) {
        this.cameraTouch = null;
        this.cameraDeltaX = 0;
        this.cameraDeltaY = 0;
      }
    }
  }

  update(): void {
    this.moveX = this.joystick.moveX;
    this.moveY = this.joystick.moveY;
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
    this.joystick.destroy();
  }
}
