import { useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { SelectMenu } from '../../components/SelectMenu';
import { ACTORS, TASK_PRIORITIES, type Actor, type TaskPriority } from '@taskflow/shared';

export function CreateTaskDialog({ open, busy, onClose, onCreate }: { open: boolean; busy: boolean; onClose: () => void; onCreate: (input: { title: string; description?: string; assignee?: Actor | null; priority?: TaskPriority; dueAt?: string | null }) => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignee, setAssignee] = useState<Actor | ''>('');
  const [priority, setPriority] = useState<TaskPriority>('normal');
  const [dueAt, setDueAt] = useState('');
  if (!open) return null;
  function submit(event: FormEvent) { event.preventDefault(); onCreate({ title: title.trim(), description: description.trim() || undefined, assignee: assignee || null, priority, dueAt: dueAt ? new Date(dueAt).toISOString() : null }); }
  return <div className="overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="create-title">
      <div className="dialog-head"><div><span className="eyebrow">NEW TASK</span><h2 id="create-title">Create a task</h2></div><button className="icon-button" onClick={onClose} aria-label="Close"><X/></button></div>
      <form onSubmit={submit}>
        <label>Title<input autoFocus required maxLength={120} value={title} onChange={e => setTitle(e.target.value)} placeholder="What needs to be done?"/></label>
        <label>Description <span className="optional">Optional</span><textarea maxLength={2000} value={description} onChange={e => setDescription(e.target.value)} placeholder="Add context for your team"/></label>
        <div className="form-grid">
          <label>Assignee<SelectMenu ariaLabel="Assignee" value={assignee} onChange={setAssignee} options={[{ value: '' as const, label: 'Unassigned' }, ...ACTORS.map(item => ({ value: item, label: item }))]}/></label>
          <label>Priority<SelectMenu ariaLabel="Priority" value={priority} onChange={setPriority} options={TASK_PRIORITIES.map(item => ({ value: item, label: item }))}/></label>
        </div>
        <label>Due date <span className="optional">Optional</span><input type="datetime-local" value={dueAt} onChange={e => setDueAt(e.target.value)}/></label>
        <div className="dialog-actions"><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" disabled={busy || !title.trim()}>{busy ? 'Creating…' : 'Create task'}</button></div>
      </form>
    </div>
  </div>;
}
