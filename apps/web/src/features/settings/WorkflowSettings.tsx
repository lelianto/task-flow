import { useState } from 'react';
import { allowedDestinations, type WorkflowPolicy } from '@taskflow/shared';
import { STATUS_LABELS } from '../tasks/status-labels';

export function WorkflowSettings({ settings, busy, onChange }: { settings: WorkflowPolicy; busy: boolean; onChange: (value: WorkflowPolicy) => void }) {
  const [draft, setDraft] = useState(settings);
  const changed = draft.allowBackwardTransitions !== settings.allowBackwardTransitions || draft.allowStatusSkipping !== settings.allowStatusSkipping;
  const fromToDo = allowedDestinations('to_do', draft);
  const fromDone = allowedDestinations('done', draft);
  return <section className="settings-page"><span className="eyebrow">WORKFLOW</span><h1>Workflow settings</h1><p>Control which status transitions your team can make. Same-status requests remain idempotent.</p>
    <div className="settings-card">
      <Setting title="Allow backward transitions" description="Move to an earlier stage. With skipping off, users can only move back one stage." checked={draft.allowBackwardTransitions} disabled={busy} onToggle={() => setDraft(value => ({ ...value, allowBackwardTransitions: !value.allowBackwardTransitions }))}/>
      <Setting title="Allow status skipping" description="Skip intermediate stages in an otherwise permitted direction." checked={draft.allowStatusSkipping} disabled={busy} onToggle={() => setDraft(value => ({ ...value, allowStatusSkipping: !value.allowStatusSkipping }))}/>
      <div className="workflow-preview"><span className="eyebrow">IMPACT PREVIEW</span><Preview label="From To Do" values={fromToDo}/><Preview label="From Done" values={fromDone}/><small>This preview is not active until you save.</small></div>
      <div className="settings-actions"><button className="button secondary" disabled={!changed || busy} onClick={() => setDraft(settings)}>Discard</button><button className="button primary" disabled={!changed || busy} onClick={() => onChange(draft)}>{busy ? 'Saving…' : 'Save changes'}</button></div>
    </div><p className="settings-note">The default policy allows one step forward only. Existing audit history is never rewritten.</p>
  </section>;
}

function Preview({ label, values }: { label: string; values: ReturnType<typeof allowedDestinations> }) {
  return <div className="preview-row"><strong>{label}</strong><span>{values.length ? values.map(value => STATUS_LABELS[value]).join(' · ') : 'No transitions available'}</span></div>;
}

function Setting({ title, description, checked, disabled, onToggle }: { title: string; description: string; checked: boolean; disabled: boolean; onToggle: () => void }) {
  return <div className="setting"><span><strong>{title}</strong><small>{description}</small></span><button type="button" className="switch" role="switch" aria-checked={checked} aria-label={title} disabled={disabled} onClick={onToggle}><span/></button></div>;
}
