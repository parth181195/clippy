<script lang="ts">
  // Minimal placeholder shell. Replaced in Task 43 with the full panel layout.
</script>

<main>
  <div class="panel">
    <header>Clippy</header>
    <section>
      <p>Phase 1 scaffold. The real UI lands in Tasks 31–43.</p>
      <p class="hint">Window is currently <code>visible: true</code> for dev convenience; will switch to hidden + hotkey-toggle in Task 44.</p>
    </section>
  </div>
</main>

<style>
  main { height: 100%; display: flex; align-items: stretch; justify-content: stretch; padding: 0; }
  .panel {
    flex: 1; margin: 0;
    background: rgba(22, 22, 31, 0.85);
    backdrop-filter: blur(24px) saturate(140%);
    border-radius: 20px;
    border: 1px solid #2D2D3A;
    color: #ECECF1;
    display: flex; flex-direction: column;
  }
  header {
    padding: 12px 20px;
    border-bottom: 1px solid #2D2D3A;
    font-weight: 600;
    font-size: 14px;
  }
  section {
    padding: 20px;
    color: #9999A8;
    font-size: 13px;
  }
  .hint { color: #5C5C6B; font-size: 11px; margin-top: 8px; }
  code { background: #2A2A38; padding: 1px 5px; border-radius: 4px; font-family: ui-monospace, monospace; font-size: 11px; }
</style>
