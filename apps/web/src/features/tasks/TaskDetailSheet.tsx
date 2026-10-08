import { useQuery } from '@tanstack/react-query';
import { Clock3, Trash2, X } from 'lucide-react';
import { allowedDestinations, type Actor, type Task, type TaskStatus, type WorkflowPolicy } from '@taskflow/shared';
import { api } from '../../lib/api';
import { STATUS_LABELS } from './status-labels';

export function TaskDetailSheet({ task, actor, settings, busy, onClose, onStatus, onDelete }: { task: Task | null; actor: Actor; settings: WorkflowPolicy; busy: boolean; onClose: () => void; onStatus: (status: TaskStatus) => void; onDelete: () => void }) {
  const logs = useQuery({ queryKey: ['audit', task?.id], queryFn: () => api.auditLogs(task!.id), enabled: !!task });
  if (!task) return null;
  const options = allowedDestinations(task.status, settings);
  return <div className="sheet-overlay" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <aside className="sheet" role="dialog" aria-modal="true" aria-labelledby="task-title">
      <div className="sheet-head"><span className="task-key">TF-{task.id.slice(0, 5).toUpperCase()}</span><button className="icon-button" onClick={onClose} aria-label="Close details"><X/></button></div>
      <div className="sheet-content">
        <h2 id="task-title">{task.title}</h2><p className={task.description ? '' : 'muted'}>{task.description || 'No description provided.'}</p>
        <div className="field"><span>Status</span><select disabled={busy || options.length === 0} value={task.status} onChange={e => onStatus(e.target.value as TaskStatus)}><option value={task.status}>{STATUS_LABELS[task.status]}</option>{options.map(status => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}</select><small>Changes are recorded as {actor}</small></div>
        <div className="divider"/>
        <section className="activity"><h3><Clock3 size={17}/> Activity</h3>
          {logs.isLoading && <p className="muted">Loading history…</p>}
          {logs.isError && <p className="error">Could not load audit history.</p>}
          {logs.data?.length === 0 && <div className="empty-activity"><Clock3/><p>No status changes yet.</p></div>}
          <ol className="timeline">{logs.data?.map(log => <li key={log.id}><span className="timeline-dot"/><p><strong>{log.actor}</strong> changed status from <b>{STATUS_LABELS[log.fromStatus]}</b> to <b>{STATUS_LABELS[log.toStatus]}</b></p><time>{new Date(log.createdAt).toLocaleString()}</time></li>)}</ol>
        </section>
      </div>
      <footer><button className="danger-link" onClick={onDelete} disabled={busy}><Trash2 size={16}/> Delete task</button></footer>
    </aside>
  </div>;
}
