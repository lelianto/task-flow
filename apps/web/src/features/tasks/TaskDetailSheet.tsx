import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Bot, Clock3, Info, Sparkles, Trash2, X } from 'lucide-react';
import { ACTORS, allowedDestinations, explainTransition, TASK_PRIORITIES, TASK_STATUSES, type Actor, type Task, type TaskPriority, type TaskStatus, type WorkflowPolicy } from '@taskflow/shared';
import { api } from '../../lib/api';
import { STATUS_LABELS } from './status-labels';
import { SelectMenu } from '../../components/SelectMenu';

export function TaskDetailSheet({ task, actor, settings, busy, readOnly = false, onClose, onStatus, onUpdate, onDelete }: { task: Task | null; actor: Actor; settings: WorkflowPolicy; busy: boolean; readOnly?: boolean; onClose: () => void; onStatus: (status: TaskStatus) => void; onUpdate: (input: { assignee?: Actor | null; priority?: TaskPriority; dueAt?: string | null; requiresHumanAttention?: boolean; escalationReason?: string | null }) => void; onDelete: () => void }) {
  const activities = useQuery({ queryKey: ['activities', task?.id], queryFn: () => api.taskActivities(task!.id), enabled: !!task });
  const insight = useMutation({ mutationFn: () => api.auditInsight(task!.id) });
  const [assignee, setAssignee] = useState<Actor | ''>(task?.assignee ?? '');
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? 'normal');
  const [dueAt, setDueAt] = useState(task?.dueAt ? localDateTimeInput(task.dueAt) : '');
  const [attention, setAttention] = useState(task?.requiresHumanAttention ?? false);
  const [reason, setReason] = useState(task?.escalationReason ?? '');
  if (!task) return null;
  const options = allowedDestinations(task.status, settings);
  return <div className="sheet-overlay" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <aside className="sheet" role="dialog" aria-modal="true" aria-labelledby="task-title">
      <div className="sheet-head"><span className="task-key">TF-{task.id.slice(0, 5).toUpperCase()}</span><button className="icon-button" onClick={onClose} aria-label="Close details"><X/></button></div>
      <div className="sheet-content">
        <h2 id="task-title">{task.title}</h2><p className={task.description ? '' : 'muted'}>{task.description || 'No description provided.'}</p>
        <div className="field"><span>Status</span><SelectMenu ariaLabel="Task status" disabled={readOnly || busy || options.length === 0} value={task.status} onChange={onStatus} options={[task.status, ...options].map(status => ({ value: status, label: STATUS_LABELS[status] }))}/><small>{readOnly ? 'Deleted task · history is read-only' : `Changes are recorded as ${actor}`}</small></div>
        {!readOnly && <section className="operations"><div className="section-label"><span>Operational details</span></div><div className="form-grid"><label>Assignee<SelectMenu ariaLabel="Assignee" disabled={busy} value={assignee} onChange={setAssignee} options={[{ value: '' as const, label: 'Unassigned' }, ...ACTORS.map(item => ({ value: item, label: item }))]}/></label><label>Priority<SelectMenu ariaLabel="Priority" disabled={busy} value={priority} onChange={setPriority} options={TASK_PRIORITIES.map(item => ({ value: item, label: item }))}/></label></div><label>Due date<input disabled={busy} type="datetime-local" value={dueAt} onChange={e => setDueAt(e.target.value)}/></label><label className="attention-toggle"><input type="checkbox" checked={attention} onChange={e => setAttention(e.target.checked)}/><span>Needs human attention</span></label>{attention && <label>Escalation reason<textarea maxLength={500} required value={reason} onChange={e => setReason(e.target.value)} placeholder="Explain what needs intervention"/></label>}<button className="button secondary" disabled={busy || (attention && !reason.trim())} onClick={() => onUpdate({ assignee: assignee || null, priority, dueAt: dueAt ? new Date(dueAt).toISOString() : null, requiresHumanAttention: attention, escalationReason: attention ? reason.trim() : null })}>Save operational details</button></section>}
        {!readOnly && <section className="guidance" aria-label="Workflow guidance"><div className="section-label"><Info size={15}/><span>Workflow guidance</span></div>
          {options.length > 0 ? <p>Available next {options.length === 1 ? 'status is' : 'statuses are'} <strong>{options.map(status => STATUS_LABELS[status]).join(', ')}</strong>.</p> : <p>This task has no available status transition under the current policy.</p>}
          <ul>{TASK_STATUSES.filter(status => status !== task.status && !options.includes(status)).map(status => <li key={status}><span>{STATUS_LABELS[status]}</span>{explainTransition(task.status, status, settings)}</li>)}</ul>
        </section>}
        <div className="divider"/>
        <section className="activity"><div className="activity-heading"><h3><Clock3 size={17}/> Verified activity</h3><span>Source of truth</span></div>
          {activities.isLoading && <p className="muted">Loading history…</p>}
          {activities.isError && <p className="error">Could not load activity history.</p>}
          {activities.data?.length === 0 && <div className="empty-activity"><Clock3/><p>No activity yet.</p></div>}
          <ol className="timeline">{activities.data?.map(event => <li key={event.id}><span className="timeline-dot"/><p><strong>{event.actorId}</strong> {activityLabel(event.type, event.payload)}</p><time>{new Date(event.createdAt).toLocaleString()}</time></li>)}</ol>
        </section>
        {!readOnly && <section className="ai-insight"><div className="activity-heading"><h3><Sparkles size={17}/> AI Insights</h3><span>Optional interpretation</span></div>
          {!insight.data && !insight.isPending && !insight.isError && <><p>Generate a concise explanation from the verified events above. AI cannot change this task or its history.</p><button className="button secondary" onClick={() => insight.mutate()}><Bot size={16}/> Generate insight</button></>}
          {insight.isPending && <p className="muted">Reviewing verified audit events…</p>}
          {insight.isError && <div className="insight-state error"><p>{insight.error.message}</p><button onClick={() => insight.mutate()}>Try again</button></div>}
          {insight.data && <div className="insight-result"><div className="fact-row"><span>{insight.data.facts.transitionCount} transitions</span><span>{insight.data.facts.actors.length} actors</span></div>{insight.data.available ? <p>{insight.data.summary}</p> : <><p>AI is not configured. Verified facts remain available: this task has {insight.data.facts.transitionCount} recorded status {insight.data.facts.transitionCount === 1 ? 'change' : 'changes'} involving {insight.data.facts.actors.length || 0} {insight.data.facts.actors.length === 1 ? 'actor' : 'actors'}.</p><small>Deterministic backend analysis · No AI-generated claims</small></>}</div>}
        </section>}
      </div>
      {!readOnly && <footer><button className="danger-link" onClick={onDelete} disabled={busy}><Trash2 size={16}/> Delete task</button></footer>}
    </aside>
  </div>;
}

function activityLabel(type: string, payload: Record<string, unknown>) {
  if (type === 'task.created') return 'created this task';
  if (type === 'task.deleted') return 'deleted this task';
  if (type === 'human.escalation_requested') return 'requested human attention';
  if (type === 'human.escalation_resolved') return 'resolved the human-attention request';
  if (type === 'status.changed') return `changed status from ${String(payload.fromStatus).replaceAll('_', ' ')} to ${String(payload.toStatus).replaceAll('_', ' ')}`;
  return `updated ${Array.isArray(payload.changed) ? payload.changed.join(', ') : 'task details'}`;
}

function localDateTimeInput(value: string) {
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}
