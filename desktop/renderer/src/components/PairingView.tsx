import { useEffect, useState } from 'react';

export function PairingView({ onClose }: { onClose: () => void }) {
  const [deviceName, setDeviceName] = useState(() => 'desktop');
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [shortCode, setShortCode] = useState<string | null>(null);
  const [showCode, setShowCode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return window.clippy.onConnState((s) => {
      if (s.state === 'connected') setTimeout(onClose, 1500);
    });
  }, [onClose]);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const r = await window.clippy.pairingBegin(deviceName);
      setQrSvg(r.qrSvg);
      setShortCode(r.shortCode);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    try { await window.clippy.pairingCancel(); } catch {}
    onClose();
  }

  // Initial (name input) stage — single column, centered
  if (!qrSvg) {
    return (
      <div className="pairing-init">
        <h2>Pair with your phone</h2>
        <p className="hint">Give this desktop a name (the phone will display it):</p>
        <input
          type="text"
          value={deviceName}
          onChange={(e) => setDeviceName(e.target.value)}
          autoFocus
        />
        <div className="actions">
          <button type="button" className="cancel" onClick={cancel}>Cancel</button>
          <button type="button" className="primary" onClick={generate} disabled={busy}>
            {busy ? 'Generating…' : 'Generate QR'}
          </button>
        </div>
        {error && <div className="error">{error}</div>}
        <style>{pairingCss}</style>
      </div>
    );
  }

  // QR stage — 2 columns, no scrolling
  return (
    <div className="pairing-qr">
      <div className="qr-col">
        <div className="qr" dangerouslySetInnerHTML={{ __html: qrSvg }} />
      </div>
      <div className="info-col">
        <div className="label">PAIR A DEVICE</div>
        <h2>Scan with your phone</h2>
        <p className="hint">
          Open Clippy on your phone → <b>Pair</b> → point the camera at this code.
          Pairing happens over your local network; your clipboard never leaves it.
        </p>
        {!showCode ? (
          <button type="button" className="link" onClick={() => setShowCode(true)}>
            Use pairing code instead →
          </button>
        ) : (
          <>
            <p className="hint small">Type this on the phone:</p>
            <pre className="code">{shortCode}</pre>
          </>
        )}
        <div className="actions">
          <button type="button" className="cancel" onClick={cancel}>Cancel</button>
        </div>
      </div>
      <style>{pairingCss}</style>
    </div>
  );
}

const pairingCss = `
  /* Initial name-input stage */
  .pairing-init {
    display: flex; flex-direction: column; align-items: center;
    gap: 14px; padding: 28px 40px; height: 100%;
    overflow-y: auto;
  }
  .pairing-init h2 {
    margin: 0; font-size: 18px; font-weight: 600;
    color: var(--cm-text); letter-spacing: -0.3px;
  }
  .pairing-init .hint {
    margin: 0; font-size: 12px; color: var(--cm-text-secondary);
    text-align: center; max-width: 380px; line-height: 1.5;
  }
  .pairing-init input[type=text] {
    background: var(--cm-surface-sunken); color: var(--cm-text);
    border: 1px solid var(--cm-border-strong); border-radius: 8px;
    padding: 7px 12px; font-family: inherit; font-size: 13px;
    width: 220px; outline: none;
  }
  .pairing-init input[type=text]:focus { border-color: var(--cm-accent); }
  .pairing-init .actions { display: flex; gap: 8px; }

  /* QR + instructions stage, 2-column to fit 380px tall panel */
  .pairing-qr {
    display: flex; gap: 32px; padding: 18px 40px; height: 100%;
    align-items: center; justify-content: center;
  }
  .pairing-qr .qr-col {
    flex-shrink: 0;
  }
  .pairing-qr .qr {
    width: 200px; height: 200px;
    background: white; padding: 8px; border-radius: 12px;
  }
  .pairing-qr .qr svg { display: block; width: 100%; height: 100%; }
  .pairing-qr .info-col {
    min-width: 0;
    display: flex; flex-direction: column; gap: 10px;
    max-width: 480px;
  }
  .pairing-qr .label {
    font-size: 10px; font-weight: 600;
    color: var(--cm-accent);
    letter-spacing: 1.2px;
  }
  .pairing-qr h2 {
    margin: 0; font-size: 20px; font-weight: 600;
    color: var(--cm-text); letter-spacing: -0.4px;
  }
  .pairing-qr .hint {
    margin: 0; font-size: 13px; color: var(--cm-text-secondary);
    line-height: 1.55;
  }
  .pairing-qr .hint.small { font-size: 11.5px; margin-top: 4px; }
  .pairing-qr .actions { display: flex; gap: 8px; margin-top: 4px; }
  .pairing-qr .code {
    margin: 0; font-family: 'Geist Mono', ui-monospace, monospace;
    font-size: 12px; padding: 10px 14px;
    background: var(--cm-surface-sunken); border-radius: 8px;
    color: var(--cm-text); letter-spacing: 1px; user-select: all;
    white-space: pre-wrap; word-break: break-all;
  }

  /* Shared button styles */
  .pairing-init button, .pairing-qr button {
    padding: 7px 14px; border-radius: 8px;
    font-family: inherit; font-size: 12px; font-weight: 500;
    cursor: pointer; border: 1px solid var(--cm-border-subtle);
    background: transparent; color: var(--cm-text-secondary);
  }
  .pairing-init button.primary {
    background: var(--cm-accent); color: white; border: none;
  }
  .pairing-qr button.link, .pairing-init button.link {
    background: transparent; border: none;
    color: var(--cm-accent); text-decoration: underline;
    padding: 0; align-self: flex-start;
  }
  .pairing-init .error { color: var(--cm-warn); font-size: 12px; }
`;
