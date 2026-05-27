// Main canvas assembly. All sections + tweaks panel.

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "mode": "dark",
  "accent": "#E95678",
  "density": "comfortable",
  "showChips": "shown",
  "position": "bottom",
  "hideSourceIcon": false,
  "noHighlight": false
}/*EDITMODE-END*/;

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  // Expose accent to all components via window before any descendant renders
  window.CM_ACCENT = t.accent || CM_TOKENS.accents.coral;

  const mode = t.mode;
  const density = t.density;
  const showChips = t.showChips === 'shown' || t.showChips === true;
  const hideSourceIcon = t.hideSourceIcon;
  const noHighlight = t.noHighlight;

  return (
    <>
      <DesignCanvas>

        {/* ═══════════ HERO ═══════════ */}
        <DCSection id="hero" title="The Panel" subtitle="Hero shots — panel summoned over the desktop. Bottom-third placement, backdrop blur.">
          <DCArtboard id="hero-context" label="In context · dark" width={1280} height={720}>
            <div style={{ position: 'relative', width: 1280, height: 720, overflow: 'hidden' }}>
              <FauxDesktop mode="dark" width={1280} height={720} />
              <div style={{
                position: 'absolute',
                ...(t.position === 'bottom' ? { bottom: 8, left: 20, right: 20 } :
                    t.position === 'top' ? { top: 40, left: 20, right: 20 } :
                    { top: '50%', left: 20, right: 20, transform: 'translateY(-50%)' }),
              }}>
                <Panel mode="dark" density={density} showChips={showChips}
                  hideSourceIcon={hideSourceIcon} noHighlight={noHighlight}
                  width={1240} height={340} />
              </div>
            </div>
          </DCArtboard>
          <DCArtboard id="hero-context-light" label="In context · light" width={1280} height={720}>
            <div style={{ position: 'relative', width: 1280, height: 720, overflow: 'hidden' }}>
              <FauxDesktop mode="light" width={1280} height={720} />
              <div style={{ position: 'absolute', bottom: 8, left: 20, right: 20 }}>
                <Panel mode="light" density={density} showChips={showChips}
                  hideSourceIcon={hideSourceIcon} noHighlight={noHighlight}
                  width={1240} height={340} />
              </div>
            </div>
          </DCArtboard>
        </DCSection>

        {/* ═══════════ PANEL — close-up ═══════════ */}
        <DCSection id="panel" title="Panel — close-up" subtitle="Just the panel, both themes. Mixed clipboard history showing all seven content types.">
          <DCArtboard id="panel-dark" label="Dark · default" width={1280} height={340}>
            <Panel mode="dark" density={density} showChips={showChips}
              hideSourceIcon={hideSourceIcon} noHighlight={noHighlight} width={1280} height={340} />
          </DCArtboard>
          <DCArtboard id="panel-light" label="Light · default" width={1280} height={340}>
            <Panel mode="light" density={density} showChips={showChips}
              hideSourceIcon={hideSourceIcon} noHighlight={noHighlight} width={1280} height={340} />
          </DCArtboard>
          <DCArtboard id="panel-compact" label="Compact density" width={1280} height={340}>
            <Panel mode={mode} density="compact" showChips={showChips}
              hideSourceIcon={hideSourceIcon} noHighlight={noHighlight} width={1280} height={340} />
          </DCArtboard>
          <DCArtboard id="panel-spacious" label="Spacious density" width={1280} height={340}>
            <Panel mode={mode} density="spacious" showChips={showChips}
              hideSourceIcon={hideSourceIcon} noHighlight={noHighlight} width={1280} height={340} />
          </DCArtboard>
        </DCSection>

        {/* ═══════════ STATES ═══════════ */}
        <DCSection id="states" title="States" subtitle="Every state worth designing — search, filter, settings, pairing, empty, incognito, offline.">
          <DCArtboard id="search-active" label="Search · active" width={1280} height={340}>
            <Panel mode={mode} density={density} showChips={showChips} width={1280} height={340}
              search="migration" searchFocused selectedIndex={0}
              itemCount={500} />
          </DCArtboard>
          <DCArtboard id="filter-code" label="Filter · Code only" width={1280} height={340}>
            <Panel mode={mode} density={density} showChips={showChips} width={1280} height={340}
              activeFilter="code" selectedIndex={0} itemCount={500} />
          </DCArtboard>
          <DCArtboard id="hover" label="Card · hovered" width={1280} height={340}>
            <Panel mode={mode} density={density} showChips={showChips} width={1280} height={340}
              bodyOverride={
                <div style={{ display: 'flex', gap: 12, padding: '16px 20px', overflow: 'hidden', height: '100%' }}>
                  <ClipCard clip={SAMPLE_CLIPS[0]} mode={mode} width={200} height={240} state="default" />
                  <ClipCard clip={SAMPLE_CLIPS[1]} mode={mode} width={200} height={240} state="default" />
                  <HoverActionCard mode={mode} />
                  <ClipCard clip={SAMPLE_CLIPS[3]} mode={mode} width={200} height={240} state="default" />
                  <ClipCard clip={SAMPLE_CLIPS[4]} mode={mode} width={200} height={240} state="default" />
                  <ClipCard clip={SAMPLE_CLIPS[5]} mode={mode} width={200} height={240} state="default" />
                </div>
              }
            />
          </DCArtboard>
          <DCArtboard id="transfer" label="File · sending" width={1280} height={340}>
            <Panel mode={mode} density={density} showChips={showChips} width={1280} height={340}
              bodyOverride={
                <div style={{ display: 'flex', gap: 12, padding: '16px 20px', overflow: 'hidden', height: '100%' }}>
                  <TransferCard mode={mode} />
                  <ClipCard clip={SAMPLE_CLIPS[0]} mode={mode} width={200} height={240} />
                  <ClipCard clip={SAMPLE_CLIPS[1]} mode={mode} width={200} height={240} />
                  <ClipCard clip={SAMPLE_CLIPS[2]} mode={mode} width={200} height={240} />
                  <ClipCard clip={SAMPLE_CLIPS[3]} mode={mode} width={200} height={240} />
                  <ClipCard clip={SAMPLE_CLIPS[4]} mode={mode} width={200} height={240} />
                </div>
              } />
          </DCArtboard>
          <DCArtboard id="settings" label="Settings · general" width={1280} height={340}>
            <Panel mode={mode} density={density} showChips={showChips} width={1280} height={340}
              bodyOverride={<SettingsView mode={mode} section="general" />} />
          </DCArtboard>
          <DCArtboard id="settings-hotkeys" label="Settings · hotkeys" width={1280} height={340}>
            <Panel mode={mode} density={density} showChips={showChips} width={1280} height={340}
              bodyOverride={<SettingsView mode={mode} section="hotkeys" />} />
          </DCArtboard>
          <DCArtboard id="settings-devices" label="Settings · devices" width={1280} height={340}>
            <Panel mode={mode} density={density} showChips={showChips} width={1280} height={340}
              bodyOverride={<SettingsView mode={mode} section="devices" />} />
          </DCArtboard>
          <DCArtboard id="pair" label="Pairing · scan" width={1280} height={340}>
            <Panel mode={mode} density={density} showChips={showChips} width={1280} height={340}
              bodyOverride={<PairingView mode={mode} />} />
          </DCArtboard>
          <DCArtboard id="paired" label="Pairing · success" width={1280} height={340}>
            <Panel mode={mode} density={density} showChips={showChips} width={1280} height={340}
              bodyOverride={<PairingView mode={mode} paired deviceName="Pixel 7" />} />
          </DCArtboard>
          <DCArtboard id="empty" label="Empty · first run" width={1280} height={340}>
            <Panel mode={mode} density={density} showChips={showChips} width={1280} height={340}
              connectionState="unpaired" itemCount={0}
              bodyOverride={<EmptyState mode={mode} variant="no-history" />} />
          </DCArtboard>
          <DCArtboard id="no-results" label="Search · no results" width={1280} height={340}>
            <Panel mode={mode} density={density} showChips={showChips} width={1280} height={340}
              search="kubernetes" itemCount={500}
              bodyOverride={<EmptyState mode={mode} variant="no-results" search="kubernetes" />} />
          </DCArtboard>
          <DCArtboard id="filter-empty" label="Filter · empty type" width={1280} height={340}>
            <Panel mode={mode} density={density} showChips={showChips} width={1280} height={340}
              activeFilter="code" itemCount={500}
              bodyOverride={<EmptyState mode={mode} variant="no-filter" />} />
          </DCArtboard>
          <DCArtboard id="incognito" label="Incognito · 12m left" width={1280} height={340}>
            <Panel mode={mode} density={density} showChips={showChips} width={1280} height={340}
              incognito itemCount={0}
              bodyOverride={
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8, fontFamily: 'Geist, system-ui, sans-serif' }}>
                  <I.eyeOff size={36} color={mode === 'dark' ? CM_TOKENS.dark.warn : CM_TOKENS.light.warn} />
                  <div style={{ fontSize: 14, color: mode === 'dark' ? CM_TOKENS.dark.text : CM_TOKENS.light.text, fontWeight: 500, marginTop: 6 }}>Incognito on</div>
                  <div style={{ fontSize: 12, color: mode === 'dark' ? CM_TOKENS.dark.textSecondary : CM_TOKENS.light.textSecondary, lineHeight: 1.5, textAlign: 'center', maxWidth: 360 }}>
                    Anything you copy in the next 12 minutes won&rsquo;t be saved to history or sent to paired devices.
                  </div>
                </div>
              } />
          </DCArtboard>
          <DCArtboard id="disconnected" label="Phone · offline" width={1280} height={340}>
            <Panel mode={mode} density={density} showChips={showChips} width={1280} height={340}
              connectionState="disconnected" deviceName="Pixel 7" itemCount={500} />
          </DCArtboard>
          <DCArtboard id="unpaired" label="No device paired" width={1280} height={340}>
            <Panel mode={mode} density={density} showChips={showChips} width={1280} height={340}
              connectionState="unpaired" itemCount={500} />
          </DCArtboard>
        </DCSection>

        {/* ═══════════ BOLDER VARIANTS ═══════════ */}
        <DCSection id="variants" title="Bolder variants" subtitle="Same product, different visual vocabulary. Each shown across multiple states.">
          {/* A — Spotlight */}
          <DCArtboard id="spotlight-default" label="A · Spotlight · default" width={1280} height={340}>
            <SpotlightPanel mode={mode} state="default" />
          </DCArtboard>
          <DCArtboard id="spotlight-search" label="A · Spotlight · search · 1 match" width={1280} height={340}>
            <SpotlightPanel mode={mode} state="search" />
          </DCArtboard>
          <DCArtboard id="spotlight-link" label="A · Spotlight · link clip focused" width={1280} height={340}>
            <SpotlightPanel mode={mode} state="link" />
          </DCArtboard>
          <DCArtboard id="spotlight-filter" label="A · Spotlight · filter · code only" width={1280} height={340}>
            <SpotlightPanel mode={mode} state="filter" />
          </DCArtboard>
          <DCArtboard id="spotlight-empty" label="A · Spotlight · empty" width={1280} height={340}>
            <SpotlightPanel mode={mode} state="empty" />
          </DCArtboard>

          {/* B — Sectioned */}
          <DCArtboard id="sectioned-default" label="B · Sectioned list · default" width={1280} height={340}>
            <SectionedPanel mode={mode} state="default" />
          </DCArtboard>
          <DCArtboard id="sectioned-search" label="B · Sectioned · search results" width={1280} height={340}>
            <SectionedPanel mode={mode} state="search" />
          </DCArtboard>
          <DCArtboard id="sectioned-filter" label="B · Sectioned · code only" width={1280} height={340}>
            <SectionedPanel mode={mode} state="filter" />
          </DCArtboard>
          <DCArtboard id="sectioned-empty" label="B · Sectioned · empty" width={1280} height={340}>
            <SectionedPanel mode={mode} state="empty" />
          </DCArtboard>

          {/* C — Mosaic */}
          <DCArtboard id="mosaic-default" label="C · Mosaic · default" width={1280} height={340}>
            <MosaicPanel mode={mode} state="default" />
          </DCArtboard>
          <DCArtboard id="mosaic-search" label="C · Mosaic · search results" width={1280} height={340}>
            <MosaicPanel mode={mode} state="search" />
          </DCArtboard>
          <DCArtboard id="mosaic-filter" label="C · Mosaic · link only" width={1280} height={340}>
            <MosaicPanel mode={mode} state="filter" />
          </DCArtboard>
          <DCArtboard id="mosaic-transfer" label="C · Mosaic · file sending" width={1280} height={340}>
            <MosaicPanel mode={mode} state="transfer" />
          </DCArtboard>
        </DCSection>

        {/* ═══════════ CARD LIBRARY ═══════════ */}
        <DCSection id="cards" title="ClipCard — type library" subtitle="All 7 content variants, side-by-side. Default state.">
          <DCArtboard id="card-lib" label="All types" width={1520} height={300}>
            <div style={{ width: '100%', height: '100%', background: mode === 'dark' ? CM_TOKENS.dark.bg : CM_TOKENS.light.bg, padding: 24, display: 'flex', gap: 12, alignItems: 'center', overflow: 'hidden' }}>
              <ClipCard clip={SAMPLE_CLIPS[4]} mode={mode} width={200} height={240} />
              <ClipCard clip={SAMPLE_CLIPS[1]} mode={mode} width={200} height={240} />
              <ClipCard clip={SAMPLE_CLIPS[0]} mode={mode} width={200} height={240} />
              <ClipCard clip={SAMPLE_CLIPS[2]} mode={mode} width={200} height={240} />
              <ClipCard clip={SAMPLE_CLIPS[3]} mode={mode} width={200} height={240} />
              <ClipCard clip={SAMPLE_CLIPS[6]} mode={mode} width={200} height={240} />
              <ClipCard clip={SAMPLE_CLIPS[7]} mode={mode} width={200} height={240} />
            </div>
          </DCArtboard>
          <DCArtboard id="card-states" label="States · default → selected → hover → pressed" width={900} height={300}>
            <div style={{ width: '100%', height: '100%', background: mode === 'dark' ? CM_TOKENS.dark.bg : CM_TOKENS.light.bg, padding: 24, display: 'flex', gap: 12, alignItems: 'center' }}>
              <ClipCard clip={SAMPLE_CLIPS[4]} mode={mode} width={180} height={240} state="default" />
              <ClipCard clip={SAMPLE_CLIPS[4]} mode={mode} width={180} height={240} state="selected" />
              <ClipCard clip={SAMPLE_CLIPS[4]} mode={mode} width={180} height={240} state="hover" />
              <ClipCard clip={SAMPLE_CLIPS[4]} mode={mode} width={180} height={240} state="pressed" />
            </div>
          </DCArtboard>
        </DCSection>

        {/* ═══════════ MOBILE ═══════════ */}
        <DCSection id="mobile" title="Android · Phase 2" subtitle="Companion app. Same visual vocabulary, platform-respectful structure.">
          <DCArtboard id="m-recent" label="Recent · synced" width={PHONE_W} height={PHONE_H}>
            <MobileRecent mode={mode} />
          </DCArtboard>
          <DCArtboard id="m-swipe-copy" label="Swipe right → copy" width={PHONE_W} height={PHONE_H}>
            <MobileRecent mode={mode} revealedAction="copy" />
          </DCArtboard>
          <DCArtboard id="m-swipe-delete" label="Swipe left → delete" width={PHONE_W} height={PHONE_H}>
            <MobileRecent mode={mode} revealedAction="delete" />
          </DCArtboard>
          <DCArtboard id="m-send" label="Send · composer" width={PHONE_W} height={PHONE_H}>
            <MobileSend mode={mode} />
          </DCArtboard>
          <DCArtboard id="m-settings" label="Settings · paired" width={PHONE_W} height={PHONE_H}>
            <MobileSettings mode={mode} />
          </DCArtboard>
          <DCArtboard id="m-pair-scan" label="Pair · scanning" width={PHONE_W} height={PHONE_H}>
            <MobilePairing mode={mode} stage="scan" />
          </DCArtboard>
          <DCArtboard id="m-pair-done" label="Pair · success" width={PHONE_W} height={PHONE_H}>
            <MobilePairing mode={mode} stage="paired" />
          </DCArtboard>
          <DCArtboard id="m-notif-clip" label="Notification · clip" width={PHONE_W} height={PHONE_H}>
            <MobileNotification mode={mode} type="clip" />
          </DCArtboard>
          <DCArtboard id="m-notif-file" label="Notification · file" width={PHONE_W} height={PHONE_H}>
            <MobileNotification mode={mode} type="file" />
          </DCArtboard>
        </DCSection>

        {/* Notes */}
        <div style={{ padding: '0 60px', maxWidth: 920, marginTop: -40 }}>
          <DCPostIt top={-160} left={680} rotate={-3} width={220}>
            Coral accent is bold for a utility app — sub it for indigo or bone in the Tweaks panel to see the calmer read.
          </DCPostIt>
        </div>
      </DesignCanvas>

      <Tweaks t={t} setTweak={setTweak} />
    </>
  );
}

// ─── Tweaks panel ──────────────────────────────────────────
function Tweaks({ t, setTweak }) {
  const accentSwatches = [
    CM_TOKENS.accents.coral,
    CM_TOKENS.accents.indigo,
    CM_TOKENS.accents.teal,
    CM_TOKENS.accents.violet,
    CM_TOKENS.accents.bone,
  ];

  return (
    <TweaksPanel title="Tweaks">
      <TweakSection label="Theme" />
      <TweakRadio label="Mode" value={t.mode}
        options={['dark', 'light']}
        onChange={(v) => setTweak('mode', v)} />

      <TweakColor label="Accent" value={t.accent}
        options={accentSwatches}
        onChange={(v) => setTweak('accent', v)} />

      <TweakSection label="Layout" />
      <TweakRadio label="Density" value={t.density}
        options={['compact', 'comfortable', 'spacious']}
        onChange={(v) => setTweak('density', v)} />

      <TweakRadio label="Filter chips" value={t.showChips}
        options={[
          { value: 'shown', label: 'Always' },
          { value: 'hidden', label: 'Button' },
        ]}
        onChange={(v) => setTweak('showChips', v)} />

      <TweakSelect label="Panel position" value={t.position}
        options={[
          { value: 'bottom', label: 'Bottom · default' },
          { value: 'center', label: 'Center' },
          { value: 'top', label: 'Top' },
        ]}
        onChange={(v) => setTweak('position', v)} />

      <TweakSection label="Card details" />
      <TweakToggle label="Hide source-app icon" value={t.hideSourceIcon}
        onChange={(v) => setTweak('hideSourceIcon', v)} />
      <TweakToggle label="Plain monospace (no syntax HL)" value={t.noHighlight}
        onChange={(v) => setTweak('noHighlight', v)} />
    </TweaksPanel>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
