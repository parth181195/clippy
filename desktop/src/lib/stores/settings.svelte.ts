import { api, type Settings } from '../api';

class SettingsStore {
  s = $state<Settings | null>(null);
  async load() {
    this.s = await api.loadSettings();
    this.applyTheme();
  }
  async save(patch: Partial<Settings>) {
    if (!this.s) return;
    this.s = { ...this.s, ...patch };
    await api.saveSettings(this.s);
    this.applyTheme();
  }
  applyTheme() {
    if (!this.s) return;
    const theme =
      this.s.theme === 'auto'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
        : this.s.theme;
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.setProperty('--cm-accent', this.s.accent);
  }
}
export const settingsStore = new SettingsStore();
