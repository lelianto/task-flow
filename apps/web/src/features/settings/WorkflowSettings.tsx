import type { WorkflowPolicy } from '@taskflow/shared';

export function WorkflowSettings({ settings, busy, onChange }: { settings: WorkflowPolicy; busy: boolean; onChange: (value: WorkflowPolicy) => void }) {
  return <section className="settings-page"><span className="eyebrow">WORKFLOW</span><h1>Workflow settings</h1><p>Control which status transitions your team can make. Same-status requests remain idempotent.</p>
    <div className="settings-card">
      <Setting title="Allow backward transitions" description="Move one step back, such as In Progress to Pending." checked={settings.allowBackwardTransitions} disabled={busy} onToggle={() => onChange({ ...settings, allowBackwardTransitions: !settings.allowBackwardTransitions })}/>
      <Setting title="Allow status skipping" description="Skip intermediate stages in an allowed direction." checked={settings.allowStatusSkipping} disabled={busy} onToggle={() => onChange({ ...settings, allowStatusSkipping: !settings.allowStatusSkipping })}/>
    </div><p className="settings-note">By default both options are off, enforcing the required one-step forward workflow.</p>
  </section>;
}

function Setting({ title, description, checked, disabled, onToggle }: { title: string; description: string; checked: boolean; disabled: boolean; onToggle: () => void }) {
  return <div className="setting"><span><strong>{title}</strong><small>{description}</small></span><button type="button" className="switch" role="switch" aria-checked={checked} aria-label={title} disabled={disabled} onClick={onToggle}><span/></button></div>;
}
