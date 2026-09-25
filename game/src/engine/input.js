// Keyboard + gamepad + touch (virtual joystick) input, normalized into a
// single movement vector and a small set of action flags. Steam Deck and
// controller players get first-class support, not an afterthought.

export class InputManager {
  constructor() {
    this.keys = new Set();
    this.actions = { pause: false, dash: false, confirm: false };
    this._justPressed = new Set();
    this.touch = { active: false, x: 0, y: 0, originX: 0, originY: 0 };
    this._bindKeyboard();
    this._bindTouch();
  }

  _bindKeyboard() {
    window.addEventListener("keydown", (e) => {
      if (!this.keys.has(e.code)) this._justPressed.add(e.code);
      this.keys.add(e.code);
      if (e.code === "Escape" || e.code === "KeyP") this.actions.pause = true;
      if (e.code === "Space" || e.code === "ShiftLeft" || e.code === "ShiftRight") this.actions.dash = true;
      if (e.code === "Enter") this.actions.confirm = true;
    });
    window.addEventListener("keyup", (e) => {
      this.keys.delete(e.code);
    });
  }

  _bindTouch() {
    const zone = () => document.getElementById("touch-zone");
    window.addEventListener(
      "touchstart",
      (e) => {
        const el = zone();
        if (!el) return;
        const t = e.changedTouches[0];
        this.touch.active = true;
        this.touch.originX = t.clientX;
        this.touch.originY = t.clientY;
        this.touch.x = t.clientX;
        this.touch.y = t.clientY;
      },
      { passive: true }
    );
    window.addEventListener(
      "touchmove",
      (e) => {
        if (!this.touch.active) return;
        const t = e.changedTouches[0];
        this.touch.x = t.clientX;
        this.touch.y = t.clientY;
      },
      { passive: true }
    );
    window.addEventListener("touchend", () => {
      this.touch.active = false;
    });
  }

  justPressed(code) {
    return this._justPressed.has(code);
  }

  consumeFrame() {
    this._justPressed.clear();
    this.actions.pause = false;
    this.actions.dash = false;
    this.actions.confirm = false;
  }

  _gamepadVector() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const gp of pads) {
      if (!gp) continue;
      const lx = gp.axes[0] || 0;
      const ly = gp.axes[1] || 0;
      if (Math.abs(lx) > 0.15 || Math.abs(ly) > 0.15) return { x: lx, y: ly, gp };
      const dpadX = (gp.buttons[15]?.pressed ? 1 : 0) - (gp.buttons[14]?.pressed ? 1 : 0);
      const dpadY = (gp.buttons[13]?.pressed ? 1 : 0) - (gp.buttons[12]?.pressed ? 1 : 0);
      if (dpadX || dpadY) return { x: dpadX, y: dpadY, gp };
      return { x: 0, y: 0, gp };
    }
    return null;
  }

  getMoveVector() {
    let x = 0,
      y = 0;
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) x -= 1;
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) x += 1;
    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) y -= 1;
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) y += 1;

    const gpVec = this._gamepadVector();
    if (gpVec && (Math.abs(gpVec.x) > 0.15 || Math.abs(gpVec.y) > 0.15)) {
      x = gpVec.x;
      y = gpVec.y;
    } else if (this.touch.active) {
      const dx = this.touch.x - this.touch.originX;
      const dy = this.touch.y - this.touch.originY;
      const mag = Math.hypot(dx, dy);
      if (mag > 8) {
        x = dx / Math.max(mag, 40);
        y = dy / Math.max(mag, 40);
      }
    }

    const mag = Math.hypot(x, y);
    if (mag > 1) {
      x /= mag;
      y /= mag;
    }
    return { x, y };
  }

  gamepadDashPressed() {
    const gpVec = this._gamepadVector();
    return !!gpVec?.gp?.buttons?.[0]?.pressed; // A / Cross
  }

  vibrate(gp, weak = 0.3, strong = 0.5, duration = 120) {
    try {
      gp?.vibrationActuator?.playEffect?.("dual-rumble", {
        duration,
        weakMagnitude: weak,
        strongMagnitude: strong,
      });
    } catch {
      /* controller rumble is a nicety, never fatal */
    }
  }
}

export const input = new InputManager();
