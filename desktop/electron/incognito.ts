export class Incognito {
  private active = false;
  private timer: NodeJS.Timeout | null = null;
  private autoDisableMs: number;
  private onChange: (on: boolean) => void;

  constructor(autoDisableSecs: number, onChange: (on: boolean) => void) {
    this.autoDisableMs = autoDisableSecs * 1000;
    this.onChange = onChange;
  }

  isActive(): boolean {
    return this.active;
  }

  toggle(): boolean {
    if (!this.active) {
      this.active = true;
      this.timer = setTimeout(() => {
        this.active = false;
        this.timer = null;
        this.onChange(false);
      }, this.autoDisableMs);
    } else {
      this.active = false;
      if (this.timer) {
        clearTimeout(this.timer);
        this.timer = null;
      }
    }
    this.onChange(this.active);
    return this.active;
  }
}
