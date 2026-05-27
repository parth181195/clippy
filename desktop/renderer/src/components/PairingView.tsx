import { useEffect, useState } from 'react';

export function PairingView({ onClose }: { onClose: () => void }) {
  const [deviceName, setDeviceName] = useState(() => 'desktop');
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [shortCode, setShortCode] = useState<string | null>(null);
  const [showCode, setShowCode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Listen for connection state changes so we can auto-dismiss when the phone
  // completes the HELLO handshake.
  useEffect(() => {
    return window.clippy.onConnState((s) => {
      if (s.state === 'connected') {
        // Stay on the success view briefly, then close.
        setTimeout(onClose, 1500);
      }
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

  return (
    <div className="pairing">
      {!qrSvg ? (
        <>
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
        </>
      ) : (
        <>
          <h2>Scan with your phone</h2>
          <div className="qr" dangerouslySetInnerHTML={{ __html: qrSvg }} />
          <p className="hint">
            Open Clippy on your phone → <b>Pair</b> → scan this code. Pairing happens over your local
            network; your clipboard never leaves it.
          </p>
          {!showCode ? (
            <button type="button" className="link" onClick={() => setShowCode(true)}>
              Use pairing code instead →
            </button>
          ) : (
            <>
              <p className="hint">Type this on the phone instead of scanning:</p>
              <pre className="code">{shortCode}</pre>
            </>
          )}
          <div className="actions">
            <button type="button" className="cancel" onClick={cancel}>Cancel</button>
          </div>
        </>
      )}
      <style>{pairingCss}</style>
    </div>
  );
}

const pairingCss = `
  .pairing {
    display: flex; flex-direction: column; align-items: center;
    gap: 14px; padding: 28px 40px; height: 100%;
    overflow-y: auto;
  }
  .pairing h2 {
    margin: 0; font-size: 18px; font-weight: 600;
    color: var(--cm-text); letter-spacing: -0.3px;
  }
  .pairing .hint {
    margin: 0; font-size: 12px; color: var(--cm-text-secondary);
    text-align: center; max-width: 380px; line-height: 1.5;
  }
  .pairing input[type=text] {
    background: var(--cm-surface-sunken); color: var(--cm-text);
    border: 1px solid var(--cm-border-strong); border-radius: 8px;
    padding: 7px 12px; font-family: inherit; font-size: 13px;
    width: 220px; outline: none;
  }
  .pairing input[type=text]:focus { border-color: var(--cm-accent); }
  .pairing .qr {
    width: 200px; height: 200px;
    background: white; padding: 8px; border-radius: 12px;
  }
  .pairing .qr svg { display: block; width: 100%; height: 100%; }
  .pairing .actions { display: flex; gap: 8px; }
  .pairing button {
    padding: 7px 14px; border-radius: 8px;
    font-family: inherit; font-size: 12px; font-weight: 500;
    cursor: pointer; border: 1px solid var(--cm-border-subtle);
    background: transparent; color: var(--cm-text-secondary);
  }
  .pairing button.primary {
    background: var(--cm-accent); color: white; border: none;
  }
  .pairing button.link {
    background: transparent; border: none;
    color: var(--cm-accent); text-decoration: underline;
  }
  .pairing .code {
    margin: 0; font-family: 'Geist Mono', ui-monospace, monospace;
    font-size: 13px; padding: 12px 16px;
    background: var(--cm-surface-sunken); border-radius: 8px;
    color: var(--cm-text); letter-spacing: 1px; user-select: all;
  }
  .pairing .error { color: var(--cm-warn); font-size: 12px; }
`;
