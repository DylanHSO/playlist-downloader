import { useEffect, useState } from 'react';
import { getSettings, saveSettings } from '../api';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function SettingsModal({ open, onClose }: Props) {
  const [token, setToken] = useState('');
  const [placeholder, setPlaceholder] = useState('Plak hier je Discogs-token');
  const [locked, setLocked] = useState(false);
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);

  // Laad de status zodra de modal opent.
  useEffect(() => {
    if (!open) return;
    setToken('');
    setStatus('');
    setLocked(false);
    setPlaceholder('Plak hier je Discogs-token');
    getSettings()
      .then((s) => {
        if (s.discogsLocked) {
          setLocked(true);
          setPlaceholder('Vastgezet via .env — niet wijzigbaar');
          setStatus('Token is via .env ingesteld.');
        } else if (s.discogsConfigured) {
          setPlaceholder('•••••••• (token is ingesteld — leeg laten om te behouden)');
          setStatus('Discogs is geconfigureerd.');
        }
      })
      .catch(() => {
        /* offline status is niet kritiek */
      });
  }, [open]);

  // Sluiten met Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function handleSave() {
    const trimmed = token.trim();
    if (!trimmed) {
      onClose();
      return;
    }
    setSaving(true);
    setStatus('Opslaan...');
    try {
      await saveSettings(trimmed);
      setStatus('Opgeslagen ✓');
      setTimeout(onClose, 600);
    } catch (err) {
      setStatus(`Fout: ${(err as Error).message}`);
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="settingsTitle">
        <div className="modal-header">
          <h2 id="settingsTitle">⚙️ Instellingen</h2>
          <button className="modal-close" aria-label="Sluiten" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-body">
          <label htmlFor="discogsToken">
            Discogs-token <span className="label-hint">— nodig voor de Album-tab</span>
          </label>
          <input
            id="discogsToken"
            type="password"
            className="channel-input"
            placeholder={placeholder}
            disabled={locked}
            autoComplete="off"
            spellCheck={false}
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
          <p className="modal-help">
            Gratis aan te maken op{' '}
            <a
              href="https://www.discogs.com/settings/developers"
              target="_blank"
              rel="noopener noreferrer"
            >
              discogs.com/settings/developers
            </a>{' '}
            → "Generate new token". Wordt lokaal op deze computer opgeslagen.
          </p>
          {status && <div className="modal-status">{status}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-primary" disabled={locked || saving} onClick={handleSave}>
            Opslaan
          </button>
        </div>
      </div>
    </div>
  );
}
