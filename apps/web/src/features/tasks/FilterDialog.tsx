import { useState } from 'react';
import { X } from 'lucide-react';
import { ACTORS, TASK_SOURCES, TASK_STATUSES, type Actor, type TaskSource, type TaskStatus } from '@taskflow/shared';
import { SelectMenu } from '../../components/SelectMenu';
import { STATUS_LABELS } from './status-labels';

export type TaskFilters = {
  status: TaskStatus | '';
  assignee: Actor | '';
  source: TaskSource | '';
  dueDate: string;
};

export function FilterDialog({ value, onClose, onApply }: { value: TaskFilters; onClose: () => void; onApply: (value: TaskFilters) => void }) {
  const [draft, setDraft] = useState(value);
  const clear = () => setDraft({ status: '', assignee: '', source: '', dueDate: '' });

  return <div className="overlay" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <div className="dialog filter-dialog" role="dialog" aria-modal="true" aria-labelledby="filter-title">
      <div className="dialog-head"><div><span className="eyebrow">TASK VIEW</span><h2 id="filter-title">Filter tasks</h2></div><button className="icon-button" onClick={onClose} aria-label="Close filters"><X/></button></div>
      <div className="filter-form">
        <label>Status<SelectMenu ariaLabel="Filter status" value={draft.status} onChange={status => setDraft(current => ({ ...current, status }))} options={[{ value: '' as const, label: 'All statuses' }, ...TASK_STATUSES.map(status => ({ value: status, label: STATUS_LABELS[status] }))]}/></label>
        <label>Assignee<SelectMenu ariaLabel="Filter assignee" value={draft.assignee} onChange={assignee => setDraft(current => ({ ...current, assignee }))} options={[{ value: '' as const, label: 'All assignees' }, ...ACTORS.map(assignee => ({ value: assignee, label: assignee }))]}/></label>
        <label>Source<SelectMenu ariaLabel="Filter source" value={draft.source} onChange={source => setDraft(current => ({ ...current, source }))} options={[{ value: '' as const, label: 'All sources' }, ...TASK_SOURCES.map(source => ({ value: source, label: source }))]}/></label>
        <label>Due date<input aria-label="Filter due date" type="date" value={draft.dueDate} onChange={event => setDraft(current => ({ ...current, dueDate: event.target.value }))}/></label>
      </div>
      <div className="dialog-actions filter-actions"><button type="button" className="button secondary" onClick={clear}>Clear</button><button type="button" className="button primary" onClick={() => onApply(draft)}>Apply filters</button></div>
    </div>
  </div>;
}
