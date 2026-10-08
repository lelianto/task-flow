import { useMemo, useState } from 'react';
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BarChart3, CheckSquare2, KanbanSquare, List, Plus, Search, Settings, UserRound } from 'lucide-react';
import { ACTORS, TASK_SOURCES, TASK_STATUSES, canTransition, explainTransition, type Actor, type Task, type TaskSource, type TaskStatus, type WorkflowPolicy } from '@taskflow/shared';
import { api } from '../lib/api';
import { CreateTaskDialog } from '../features/tasks/CreateTaskDialog';
import { KanbanBoard } from '../features/tasks/KanbanBoard';
import { TaskCardPreview } from '../features/tasks/TaskCard';
import { STATUS_LABELS } from '../features/tasks/status-labels';
import { TaskDetailSheet } from '../features/tasks/TaskDetailSheet';
import { WorkflowSettings } from '../features/settings/WorkflowSettings';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { OperationalDashboard } from '../features/insights/OperationalDashboard';
import { SelectMenu } from '../components/SelectMenu';

type View = 'board' | 'tasks' | 'insights' | 'settings';
const defaultSettings: WorkflowPolicy = { allowBackwardTransitions: false, allowStatusSkipping: false };

export function App() {
  const client = useQueryClient();
  const [view, setView] = useState<View>('board');
  const [actor, setActor] = useState<Actor>('john.doe');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | ''>('');
  const [sourceFilter, setSourceFilter] = useState<TaskSource | ''>('');
  const [assigneeFilter, setAssigneeFilter] = useState<Actor | ''>('');
  const [dueFilter, setDueFilter] = useState('');
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [notice, setNotice] = useState<{ type: 'error' | 'success'; message: string } | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const tasksQuery = useQuery({ queryKey: ['tasks'], queryFn: api.tasks });
  const settingsQuery = useQuery({ queryKey: ['settings'], queryFn: api.settings });
  const tasks = useMemo(() => (tasksQuery.data ?? []).filter(task => {
    const matchesSearch = `${task.title} ${task.description ?? ''}`.toLowerCase().includes(search.toLowerCase());
    const matchesDue = !dueFilter || (task.dueAt && localDate(task.dueAt) === dueFilter);
    return matchesSearch && (!statusFilter || task.status === statusFilter) && (!sourceFilter || task.source === sourceFilter) && (!assigneeFilter || task.assignee === assigneeFilter) && matchesDue;
  }), [tasksQuery.data, search, statusFilter, sourceFilter, assigneeFilter, dueFilter]);
  const selected = (tasksQuery.data ?? []).find(task => task.id === selectedId) ?? null;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));

  const refresh = async (id?: string) => { await client.invalidateQueries({ queryKey: ['tasks'] }); await client.invalidateQueries({ queryKey: ['metrics'] }); if (id) { await client.invalidateQueries({ queryKey: ['audit', id] }); await client.invalidateQueries({ queryKey: ['activities', id] }); } };
  const create = useMutation({ mutationFn: api.createTask, onSuccess: async () => { setCreating(false); await refresh(); flash('success', 'Task created.'); }, onError: error => flash('error', error.message) });
  const update = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus }) => api.updateStatus(id, status, actor),
    onMutate: async ({ id, status }) => {
      await client.cancelQueries({ queryKey: ['tasks'] });
      const previous = client.getQueryData<Task[]>(['tasks']);
      client.setQueryData<Task[]>(['tasks'], current => current?.map(task => task.id === id ? { ...task, status } : task));
      return { previous };
    },
    onSuccess: async (_data, input) => { await refresh(input.id); flash('success', 'Status updated and recorded.'); },
    onError: (error, _input, context) => {
      if (context?.previous) client.setQueryData(['tasks'], context.previous);
      flash('error', error.message);
    },
    onSettled: () => client.invalidateQueries({ queryKey: ['tasks'] }),
  });
  const remove = useMutation({ mutationFn: api.deleteTask, onSuccess: async () => { setConfirmingDelete(false); setSelectedId(null); await refresh(); flash('success', 'Task deleted. Audit history is retained.'); }, onError: error => flash('error', error.message) });
  const updateTask = useMutation({ mutationFn: ({ id, input }: { id: string; input: Parameters<typeof api.updateTask>[1] }) => api.updateTask(id, input), onSuccess: async task => { await refresh(task.id); await client.invalidateQueries({ queryKey: ['metrics'] }); flash('success', 'Task details updated and recorded.'); }, onError: error => flash('error', error.message) });
  const saveSettings = useMutation({
    mutationFn: api.updateSettings,
    onMutate: (next) => {
      void client.cancelQueries({ queryKey: ['settings'] });
      const previous = client.getQueryData<WorkflowPolicy>(['settings']);
      client.setQueryData(['settings'], next);
      return { previous };
    },
    onSuccess: () => flash('success', 'Workflow settings saved.'),
    onError: (error, _next, context) => {
      if (context?.previous) client.setQueryData(['settings'], context.previous);
      flash('error', error.message);
    },
    onSettled: () => client.invalidateQueries({ queryKey: ['settings'] }),
  });
  const settings = saveSettings.isPending && saveSettings.variables
    ? saveSettings.variables
    : settingsQuery.data ?? defaultSettings;

  function flash(type: 'error' | 'success', message: string) { setNotice({ type, message }); window.setTimeout(() => setNotice(null), 3500); }
  function move(task: Task, status: TaskStatus) {
    if (!canTransition(task.status, status, settings)) return flash('error', explainTransition(task.status, status, settings));
    update.mutate({ id: task.id, status });
  }
  function dragEnd(event: DragEndEvent) {
    const task = event.active.data.current?.task as Task | undefined;
    const status = event.over?.id as TaskStatus | undefined;
    if (task && status && task.status !== status) move(task, status);
    setActiveTask(null);
  }
  function confirmDelete() { if (selected) setConfirmingDelete(true); }

  return <div className="app-shell">
    <header className="topbar"><button className="brand" onClick={() => setView('board')}><span><CheckSquare2/></span>TaskFlow</button>
      <nav aria-label="Main navigation"><Nav active={view === 'board'} icon={<KanbanSquare/>} label="Board" onClick={() => setView('board')}/><Nav active={view === 'tasks'} icon={<List/>} label="All Tasks" onClick={() => setView('tasks')}/><Nav active={view === 'insights'} icon={<BarChart3/>} label="Insights" onClick={() => setView('insights')}/><Nav active={view === 'settings'} icon={<Settings/>} label="Settings" onClick={() => setView('settings')}/></nav>
      <div className="actor"><UserRound size={16}/><SelectMenu compact ariaLabel="Current actor" value={actor} onChange={setActor} options={ACTORS.map(item => ({ value: item, label: item }))}/></div>
    </header>
    <main>
      {view === 'settings' ? <WorkflowSettings key={`${settings.allowBackwardTransitions}-${settings.allowStatusSkipping}`} settings={settings} busy={saveSettings.isPending} onChange={value => saveSettings.mutate(value)}/> : view === 'insights' ? <OperationalDashboard/> : <>
        <div className="page-head"><div><span className="eyebrow">WORKSPACE</span><h1>{view === 'board' ? 'Task Board' : 'All Tasks'}</h1><p>{tasksQuery.data?.length ?? 0} active tasks · Changes by <strong>{actor}</strong></p></div><button className="button primary" onClick={() => setCreating(true)}><Plus size={18}/> Create task</button></div>
        <div className="toolbar"><label className="search"><Search size={18}/><input aria-label="Search tasks" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tasks…"/></label><SelectMenu ariaLabel="Filter by status" value={statusFilter} onChange={setStatusFilter} options={[{ value: '' as const, label: 'All statuses' }, ...TASK_STATUSES.map(value => ({ value, label: STATUS_LABELS[value] }))]}/><SelectMenu ariaLabel="Filter by assignee" value={assigneeFilter} onChange={setAssigneeFilter} options={[{ value: '' as const, label: 'All assignees' }, ...ACTORS.map(value => ({ value, label: value }))]}/><SelectMenu ariaLabel="Filter by source" value={sourceFilter} onChange={setSourceFilter} options={[{ value: '' as const, label: 'All sources' }, ...TASK_SOURCES.map(value => ({ value, label: value }))]}/><input aria-label="Filter by due date" type="date" value={dueFilter} onChange={e => setDueFilter(e.target.value)}/></div>
        {tasksQuery.isLoading && <State message="Loading your workspace…"/>}
        {tasksQuery.isError && <State message="Could not load tasks. Make sure the API is running." error/>}
        {tasksQuery.isSuccess && tasks.length === 0 && <State message={search ? 'No tasks match your search.' : 'No tasks yet. Create your first task to get started.'}/>} 
        {tasksQuery.isSuccess && tasks.length > 0 && view === 'board' && <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={event => setActiveTask(event.active.data.current?.task as Task ?? null)} onDragCancel={() => setActiveTask(null)} onDragEnd={dragEnd}><KanbanBoard tasks={tasks} onOpen={task => setSelectedId(task.id)} activeTask={activeTask} settings={settings}/><DragOverlay dropAnimation={{ duration: 180, easing: 'ease-out' }}>{activeTask ? <TaskCardPreview task={activeTask}/> : null}</DragOverlay></DndContext>}
        {tasksQuery.isSuccess && tasks.length > 0 && view === 'tasks' && <div className="table-wrap"><table><thead><tr><th>Task</th><th>Status</th><th>Priority</th><th>Assignee</th><th>Due</th><th>Source</th></tr></thead><tbody>{tasks.map(task => <tr key={task.id} onClick={() => setSelectedId(task.id)}><td><strong>{task.title}</strong><small>TF-{task.id.slice(0,5).toUpperCase()}</small></td><td><span className={`badge ${task.status}`}>{STATUS_LABELS[task.status]}</span></td><td><span className={`priority ${task.priority}`}>{task.priority}</span></td><td>{task.assignee ?? 'Unassigned'}</td><td className={task.dueAt && task.status !== 'done' && new Date(task.dueAt) < new Date() ? 'overdue-text' : ''}>{task.dueAt ? new Date(task.dueAt).toLocaleDateString() : '—'}</td><td>{task.source}</td></tr>)}</tbody></table></div>}
      </>}
    </main>
    {notice && <div role="status" className={`toast ${notice.type}`}>{notice.message}</div>}
    <CreateTaskDialog open={creating} busy={create.isPending} onClose={() => setCreating(false)} onCreate={input => create.mutate(input)}/>
    <TaskDetailSheet key={selected?.id ?? 'empty'} task={selected} actor={actor} settings={settings} busy={update.isPending || updateTask.isPending || remove.isPending} onClose={() => setSelectedId(null)} onStatus={status => selected && move(selected, status)} onUpdate={input => selected && updateTask.mutate({ id: selected.id, input: { ...input, actor } })} onDelete={confirmDelete}/>
    <ConfirmDialog open={confirmingDelete && !!selected} title="Delete this task?" description={selected ? `“${selected.title}” will be removed, while its audit history remains retained.` : ''} confirmLabel="Delete task" busy={remove.isPending} onCancel={() => setConfirmingDelete(false)} onConfirm={() => selected && remove.mutate(selected.id)}/>
  </div>;
}

function Nav({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) { return <button className={active ? 'active' : ''} onClick={onClick}>{icon}<span>{label}</span></button>; }
function State({ message, error = false }: { message: string; error?: boolean }) { return <div className={`state ${error ? 'error' : ''}`}><CheckSquare2/><p>{message}</p></div>; }
function localDate(value: string) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
