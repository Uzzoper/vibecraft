export interface TouchState {
  active: boolean;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  identifier: number;
}

export class VirtualJoystick {
  public moveX = 0;
  public moveY = 0;
  public active = false;

  private joystickTouch: TouchState | null = null;
  private joystickElement!: HTMLDivElement;
  private joystickKnob!: HTMLDivElement;
  private _isVisible = false;

  constructor() {
    this.createUI();
  }

  private createUI(): void {
    this.joystickElement = document.createElement("div");
    this.joystickElement.id = "joystick";

    this.joystickKnob = document.createElement("div");
    this.joystickKnob.id = "joystick-knob";
    this.joystickElement.appendChild(this.joystickKnob);
    document.body.appendChild(this.joystickElement);
  }

  public onTouchStart(e: TouchEvent): void {
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
        this.show(x, y);
      }
    }
  }

  public onTouchMove(e: TouchEvent): void {
    for (const touch of Array.from(e.changedTouches)) {
      if (this.joystickTouch && touch.identifier === this.joystickTouch.identifier) {
        this.joystickTouch.currentX = touch.clientX;
        this.joystickTouch.currentY = touch.clientY;
        this.update();
      }
    }
  }

  public onTouchEnd(e: TouchEvent): void {
    for (const touch of Array.from(e.changedTouches)) {
      if (this.joystickTouch && touch.identifier === this.joystickTouch.identifier) {
        this.joystickTouch = null;
        this.moveX = 0;
        this.moveY = 0;
        this.hide();
      }
    }
  }

  private show(x: number, y: number): void {
    this.active = true;
    this.joystickElement.style.display = "flex";
    this.joystickElement.style.left = `${x - 60}px`;
    this.joystickElement.style.top = `${y - 60}px`;
    this.joystickKnob.style.transform = "translate(0px, 0px)";
  }

  private update(): void {
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

  private hide(): void {
    this.active = false;
    this.joystickElement.style.display = "none";
  }

  public showAtPosition(x: number, y: number): void {
    this._isVisible = true;
    this.joystickElement.style.display = "flex";
    this.joystickElement.style.left = `${x}px`;
    this.joystickElement.style.top = `${y}px`;
  }

  public hideAtPosition(): void {
    this._isVisible = false;
    this.joystickElement.style.display = "none";
  }

  public reposition(): void {
    const joystick = document.getElementById("joystick");
    if (!joystick) return;

    const display = this._isVisible ? "flex" : "none";
    joystick.style.display = display;

    if (!this._isVisible) return;

    const isPortrait = window.innerHeight > window.innerWidth;

    if (isPortrait) {
      joystick.style.left = "50%";
      joystick.style.right = "auto";
      joystick.style.top = "auto";
      joystick.style.bottom = "180px";
      joystick.style.transform = "translateX(-50%)";
    } else {
      joystick.style.left = "30px";
      joystick.style.top = "auto";
      joystick.style.bottom = "150px";
      joystick.style.transform = "none";
    }
  }

  public destroy(): void {
    this.joystickElement?.remove();
  }
}
