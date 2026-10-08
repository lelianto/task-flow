import { AlertTriangle, X } from 'lucide-react';

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  busy = false,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;
  return <div className="overlay confirm-overlay" role="presentation" onMouseDown={event => event.target === event.currentTarget && !busy && onCancel()}>
    <section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-description">
      <div className="confirm-icon"><AlertTriangle/></div>
      <div className="confirm-copy"><h2 id="confirm-title">{title}</h2><p id="confirm-description">{description}</p></div>
      <button type="button" className="icon-button confirm-close" onClick={onCancel} disabled={busy} aria-label="Close confirmation"><X/></button>
      <div className="confirm-actions">
        <button type="button" className="button secondary" onClick={onCancel} disabled={busy}>Cancel</button>
        <button type="button" className="button danger" onClick={onConfirm} disabled={busy}>{busy ? 'Deleting…' : confirmLabel}</button>
      </div>
    </section>
  </div>;
}
