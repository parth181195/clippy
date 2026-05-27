<script lang="ts">
  import { settingsStore } from '../stores/settings.svelte';
  let section = $state<'general' | 'hotkeys' | 'exclusions' | 'layout' | 'actions' | 'about'>(
    'general'
  );
  const accentSwatches = ['#E95678', '#7C7CFF', '#5BC0BE', '#C792EA', '#ECECF1'];
  async function set<K extends keyof NonNullable<typeof settingsStore.s>>(k: K, v: any) {
    if (settingsStore.s) await settingsStore.save({ [k]: v } as any);
  }
</script>

<div class="settings">
  <nav>
    {#each ['general', 'hotkeys', 'exclusions', 'layout', 'actions', 'about'] as id}
      <button class:active={section === id} onclick={() => (section = id as typeof section)}
        >{id}</button
      >
    {/each}
  </nav>
  <div class="body">
    {#if !settingsStore.s}
      <div>Loading…</div>
    {:else if section === 'general'}
      <h3>General</h3>
      <div class="row">
        <label>Sound on copy</label>
        <input
          type="checkbox"
          checked={settingsStore.s.sound_on_copy}
          onchange={(e) => set('sound_on_copy', (e.target as HTMLInputElement).checked)}
        />
      </div>
      <div class="row">
        <label>Notifications on copy</label>
        <input
          type="checkbox"
          checked={settingsStore.s.notifications_on_copy}
          onchange={(e) => set('notifications_on_copy', (e.target as HTMLInputElement).checked)}
        />
      </div>
      <div class="row">
        <label>Link previews (network egress on view)</label>
        <input
          type="checkbox"
          checked={settingsStore.s.link_previews_enabled}
          onchange={(e) => set('link_previews_enabled', (e.target as HTMLInputElement).checked)}
        />
      </div>
      <div class="row">
        <label>Auto-sync outgoing (text-shaped → phone)</label>
        <input
          type="checkbox"
          checked={settingsStore.s.auto_sync_outgoing}
          onchange={(e) => set('auto_sync_outgoing', (e.target as HTMLInputElement).checked)}
        />
      </div>
      <div class="row">
        <label>Auto-sync incoming (text-shaped ← phone)</label>
        <input
          type="checkbox"
          checked={settingsStore.s.auto_sync_incoming}
          onchange={(e) => set('auto_sync_incoming', (e.target as HTMLInputElement).checked)}
        />
      </div>
      <div class="row">
        <label>History size</label>
        <input
          type="number"
          min="50"
          max="10000"
          value={settingsStore.s.history_size}
          onchange={(e) => set('history_size', parseInt((e.target as HTMLInputElement).value, 10))}
        />
      </div>
      <div class="row">
        <label>Polling interval (ms)</label>
        <input
          type="number"
          min="100"
          max="1000"
          value={settingsStore.s.polling_ms}
          onchange={(e) => set('polling_ms', parseInt((e.target as HTMLInputElement).value, 10))}
        />
      </div>
      <div class="row">
        <label>Incognito auto-disable (sec)</label>
        <input
          type="number"
          min="60"
          max="3600"
          value={settingsStore.s.incognito_auto_disable_secs}
          onchange={(e) =>
            set('incognito_auto_disable_secs', parseInt((e.target as HTMLInputElement).value, 10))}
        />
      </div>
    {:else if section === 'layout'}
      <h3>Layout</h3>
      <div class="row">
        <label>Layout</label>
        <select
          value={settingsStore.s.layout}
          onchange={(e) => set('layout', (e.target as HTMLSelectElement).value)}
        >
          <option value="cards">Cards (default)</option>
          <option value="spotlight">Spotlight</option>
          <option value="sectioned">Sectioned</option>
          <option value="mosaic">Mosaic</option>
        </select>
      </div>
      <div class="row">
        <label>Density</label>
        <select
          value={settingsStore.s.density}
          onchange={(e) => set('density', (e.target as HTMLSelectElement).value)}
        >
          <option value="compact">Compact</option>
          <option value="comfortable">Comfortable</option>
          <option value="spacious">Spacious</option>
        </select>
      </div>
      <div class="row">
        <label>Panel position</label>
        <select
          value={settingsStore.s.panel_position}
          onchange={(e) => set('panel_position', (e.target as HTMLSelectElement).value)}
        >
          <option value="bottom">Bottom</option>
          <option value="top">Top</option>
          <option value="left">Left</option>
          <option value="right">Right</option>
        </select>
      </div>
      <div class="row">
        <label>Theme</label>
        <select
          value={settingsStore.s.theme}
          onchange={(e) => set('theme', (e.target as HTMLSelectElement).value)}
        >
          <option value="auto">Auto</option>
          <option value="dark">Dark</option>
          <option value="light">Light</option>
        </select>
      </div>
      <div class="row">
        <label>Accent</label>
        <div class="swatches">
          {#each accentSwatches as sw}
            <button
              class="swatch"
              style:background={sw}
              class:active={settingsStore.s.accent === sw}
              onclick={() => set('accent', sw)}
              aria-label={sw}
              type="button"
            ></button>
          {/each}
        </div>
      </div>
    {:else if section === 'hotkeys'}
      <h3>Hotkeys (rebindable)</h3>
      <div class="row">
        <label>Open panel</label>
        <input
          type="text"
          value={settingsStore.s.hotkey_panel}
          onchange={(e) => set('hotkey_panel', (e.target as HTMLInputElement).value)}
        />
      </div>
      <div class="row">
        <label>Quick-paste last clip</label>
        <input
          type="text"
          value={settingsStore.s.hotkey_paste_last}
          onchange={(e) => set('hotkey_paste_last', (e.target as HTMLInputElement).value)}
        />
      </div>
      <div class="row">
        <label>Toggle incognito</label>
        <input
          type="text"
          value={settingsStore.s.hotkey_incognito}
          onchange={(e) => set('hotkey_incognito', (e.target as HTMLInputElement).value)}
        />
      </div>
    {:else if section === 'exclusions'}
      <h3>Exclusions</h3>
      <p class="hint">Clips copied while one of these apps is focused are skipped.</p>
    {:else if section === 'actions'}
      <h3>Per-type Actions</h3>
      <p class="hint">Editor lands in a follow-up.</p>
    {:else if section === 'about'}
      <h3>About</h3>
      <p>Clippy v0.1.0 — LAN-only clipboard manager</p>
    {/if}
  </div>
</div>

<style>
  .settings {
    display: flex;
    height: 100%;
  }
  nav {
    width: 180px;
    border-right: 1px solid var(--cm-border-subtle);
    padding: 14px 8px;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  nav button {
    padding: 7px 11px;
    border-radius: 7px;
    font-size: 13px;
    font-weight: 500;
    color: var(--cm-text-secondary);
    background: transparent;
    border: none;
    cursor: pointer;
    text-align: left;
    text-transform: capitalize;
    font-family: inherit;
  }
  nav button.active {
    color: var(--cm-text);
    background: var(--cm-surface-raised);
  }
  .body {
    flex: 1;
    padding: 18px 28px;
    overflow: auto;
    color: var(--cm-text);
  }
  h3 {
    margin: 0 0 14px;
    font-size: 15px;
    font-weight: 600;
  }
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 0;
    border-bottom: 1px solid var(--cm-border-subtle);
    gap: 12px;
  }
  label {
    font-size: 13px;
    font-weight: 500;
  }
  input[type='number'],
  input[type='text'],
  select {
    background: var(--cm-surface-raised);
    color: var(--cm-text);
    border: 1px solid var(--cm-border-strong);
    border-radius: 7px;
    padding: 5px 10px;
    font-family: inherit;
    font-size: 12px;
  }
  .hint {
    font-size: 11.5px;
    color: var(--cm-text-secondary);
  }
  .swatches {
    display: flex;
    gap: 6px;
  }
  .swatch {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: 2px solid transparent;
    cursor: pointer;
  }
  .swatch.active {
    border-color: var(--cm-text);
  }
</style>
