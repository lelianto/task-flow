import { useMemo, useState } from 'react';
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, BarChart3, CheckSquare2, Filter, KanbanSquare, List, Plus, Search, UserRound } from 'lucide-react';
import { ACTORS, STRICT_WORKFLOW_POLICY, canTransition, explainTransition, type Actor, type Task, type TaskSource, type TaskStatus } from '@taskflow/shared';
import { api } from '../lib/api';
import { CreateTaskDialog } from '../features/tasks/CreateTaskDialog';
import { KanbanBoard } from '../features/tasks/KanbanBoard';
import { TaskCardPreview } from '../features/tasks/TaskCard';
import { STATUS_LABELS } from '../features/tasks/status-labels';
import { TaskDetailSheet } from '../features/tasks/TaskDetailSheet';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { OperationalDashboard } from '../features/insights/OperationalDashboard';
import { SelectMenu } from '../components/SelectMenu';
import { FilterDialog, type TaskFilters } from '../features/tasks/FilterDialog';

type View = 'board' | 'tasks' | 'insights' | 'deleted';

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
  const [filtering, setFiltering] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [notice, setNotice] = useState<{ type: 'error' | 'success'; message: string } | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const tasksQuery = useQuery({ queryKey: ['tasks'], queryFn: api.tasks });
  const deletedTasksQuery = useQuery({ queryKey: ['deleted-tasks'], queryFn: api.deletedTasks });
  const tasks = useMemo(() => (tasksQuery.data ?? []).filter(task => {
    const matchesSearch = `${task.title} ${task.description ?? ''}`.toLowerCase().includes(search.toLowerCase());
    const matchesDue = !dueFilter || (task.dueAt && localDate(task.dueAt) === dueFilter);
    return matchesSearch && (!statusFilter || task.status === statusFilter) && (!sourceFilter || task.source === sourceFilter) && (!assigneeFilter || task.assignee === assigneeFilter) && matchesDue;
  }), [tasksQuery.data, search, statusFilter, sourceFilter, assigneeFilter, dueFilter]);
  const selected = [...(tasksQuery.data ?? []), ...(deletedTasksQuery.data ?? [])].find(task => task.id === selectedId) ?? null;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));
  const activeFilterCount = [statusFilter, sourceFilter, assigneeFilter, dueFilter].filter(Boolean).length;

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
    onSuccess: async (data, input) => { await refresh(input.id); flash('success', data.changed ? 'Status updated and recorded.' : 'Status unchanged. No audit event created.'); },
    onError: (error, _input, context) => {
      if (context?.previous) client.setQueryData(['tasks'], context.previous);
      flash('error', error.message);
    },
    onSettled: () => client.invalidateQueries({ queryKey: ['tasks'] }),
  });
  const remove = useMutation({ mutationFn: api.deleteTask, onSuccess: async () => { setConfirmingDelete(false); setSelectedId(null); await refresh(); await client.invalidateQueries({ queryKey: ['deleted-tasks'] }); flash('success', 'Task deleted. Audit history is available under Deleted.'); }, onError: error => flash('error', error.message) });
  const updateTask = useMutation({ mutationFn: ({ id, input }: { id: string; input: Parameters<typeof api.updateTask>[1] }) => api.updateTask(id, input), onSuccess: async task => { await refresh(task.id); await client.invalidateQueries({ queryKey: ['metrics'] }); flash('success', 'Task details updated and recorded.'); }, onError: error => flash('error', error.message) });
  function flash(type: 'error' | 'success', message: string) { setNotice({ type, message }); window.setTimeout(() => setNotice(null), 3500); }
  function move(task: Task, status: TaskStatus) {
    if (!canTransition(task.status, status, STRICT_WORKFLOW_POLICY)) return flash('error', explainTransition(task.status, status, STRICT_WORKFLOW_POLICY));
    update.mutate({ id: task.id, status });
  }
  function dragEnd(event: DragEndEvent) {
    const task = event.active.data.current?.task as Task | undefined;
    const status = event.over?.id as TaskStatus | undefined;
    if (task && status && task.status !== status) move(task, status);
    setActiveTask(null);
  }
  function confirmDelete() { if (selected) setConfirmingDelete(true); }
  function applyFilters(filters: TaskFilters) {
    setStatusFilter(filters.status);
    setAssigneeFilter(filters.assignee);
    setSourceFilter(filters.source);
    setDueFilter(filters.dueDate);
    setFiltering(false);
  }

  return <div className="app-shell">
    <header className="topbar"><button className="brand" onClick={() => setView('board')}><span><CheckSquare2/></span>TaskFlow</button>
      <nav aria-label="Main navigation"><Nav active={view === 'board'} icon={<KanbanSquare/>} label="Board" onClick={() => setView('board')}/><Nav active={view === 'tasks'} icon={<List/>} label="All Tasks" onClick={() => setView('tasks')}/><Nav active={view === 'insights'} icon={<BarChart3/>} label="Insights" onClick={() => setView('insights')}/><Nav active={view === 'deleted'} icon={<Archive/>} label="Deleted" onClick={() => setView('deleted')}/></nav>
      <div className="actor"><UserRound size={16}/><SelectMenu compact ariaLabel="Current actor" value={actor} onChange={setActor} options={ACTORS.map(item => ({ value: item, label: item }))}/></div>
    </header>
    <main>
      {view === 'insights' ? <OperationalDashboard/> : view === 'deleted' ? <DeletedTasks tasks={deletedTasksQuery.data ?? []} loading={deletedTasksQuery.isLoading} error={deletedTasksQuery.isError} onOpen={task => setSelectedId(task.id)}/> : <>
        <div className="page-head"><div><span className="eyebrow">WORKSPACE</span><h1>{view === 'board' ? 'Task Board' : 'All Tasks'}</h1><p>{tasksQuery.data?.length ?? 0} active tasks · Changes by <strong>{actor}</strong></p></div><button className="button primary" onClick={() => setCreating(true)}><Plus size={18}/> Create task</button></div>
        <div className="toolbar"><label className="search"><Search size={18}/><input aria-label="Search tasks" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tasks…"/></label><button type="button" className={`button secondary filter-button ${activeFilterCount ? 'active' : ''}`} onClick={() => setFiltering(true)}><Filter size={17}/> Filters{activeFilterCount > 0 && <span>{activeFilterCount}</span>}</button></div>
        {tasksQuery.isLoading && <State message="Loading your workspace…"/>}
        {tasksQuery.isError && <State message="Could not load tasks. Make sure the API is running." error/>}
        {tasksQuery.isSuccess && tasks.length === 0 && <State message={search ? 'No tasks match your search.' : 'No tasks yet. Create your first task to get started.'}/>} 
        {tasksQuery.isSuccess && tasks.length > 0 && view === 'board' && <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={event => setActiveTask(event.active.data.current?.task as Task ?? null)} onDragCancel={() => setActiveTask(null)} onDragEnd={dragEnd}><KanbanBoard tasks={tasks} onOpen={task => setSelectedId(task.id)} activeTask={activeTask} settings={STRICT_WORKFLOW_POLICY}/><DragOverlay dropAnimation={{ duration: 180, easing: 'ease-out' }}>{activeTask ? <TaskCardPreview task={activeTask}/> : null}</DragOverlay></DndContext>}
        {tasksQuery.isSuccess && tasks.length > 0 && view === 'tasks' && <div className="table-wrap"><table><thead><tr><th>Task</th><th>Status</th><th>Priority</th><th>Assignee</th><th>Due</th><th>Source</th></tr></thead><tbody>{tasks.map(task => <tr key={task.id} onClick={() => setSelectedId(task.id)}><td><strong>{task.title}</strong><small>TF-{task.id.slice(0,5).toUpperCase()}</small></td><td><span className={`badge ${task.status}`}>{STATUS_LABELS[task.status]}</span></td><td><span className={`priority ${task.priority}`}>{task.priority}</span></td><td>{task.assignee ?? 'Unassigned'}</td><td className={task.dueAt && task.status !== 'done' && new Date(task.dueAt) < new Date() ? 'overdue-text' : ''}>{task.dueAt ? new Date(task.dueAt).toLocaleDateString() : '—'}</td><td>{task.source}</td></tr>)}</tbody></table></div>}
      </>}
    </main>
    {notice && <div role="status" className={`toast ${notice.type}`}>{notice.message}</div>}
    {creating && <CreateTaskDialog open busy={create.isPending} onClose={() => setCreating(false)} onCreate={input => create.mutate(input)}/>}
    {filtering && <FilterDialog
      value={{ status: statusFilter, assignee: assigneeFilter, source: sourceFilter, dueDate: dueFilter }}
      onClose={() => setFiltering(false)}
      onApply={applyFilters}
    />}
    <TaskDetailSheet key={selected?.id ?? 'empty'} task={selected} actor={actor} settings={STRICT_WORKFLOW_POLICY} readOnly={!!selected?.deletedAt} busy={update.isPending || updateTask.isPending || remove.isPending} onClose={() => setSelectedId(null)} onStatus={status => selected && move(selected, status)} onUpdate={input => selected && updateTask.mutate({ id: selected.id, input: { ...input, actor } })} onDelete={confirmDelete}/>
    <ConfirmDialog open={confirmingDelete && !!selected} title="Delete this task?" description={selected ? `“${selected.title}” will be removed, while its audit history remains retained.` : ''} confirmLabel="Delete task" busy={remove.isPending} onCancel={() => setConfirmingDelete(false)} onConfirm={() => selected && remove.mutate(selected.id)}/>
  </div>;
}

function Nav({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) { return <button className={active ? 'active' : ''} onClick={onClick}>{icon}<span>{label}</span></button>; }
function State({ message, error = false }: { message: string; error?: boolean }) { return <div className={`state ${error ? 'error' : ''}`}><CheckSquare2/><p>{message}</p></div>; }
function DeletedTasks({ tasks, loading, error, onOpen }: { tasks: Task[]; loading: boolean; error: boolean; onOpen: (task: Task) => void }) {
  return <><div className="page-head"><div><span className="eyebrow">ARCHIVE</span><h1>Deleted Tasks</h1><p>Read-only access to retained audit history.</p></div></div>{loading ? <State message="Loading deleted tasks…"/> : error ? <State message="Could not load deleted tasks." error/> : tasks.length === 0 ? <State message="No deleted tasks."/> : <div className="table-wrap"><table><thead><tr><th>Task</th><th>Last status</th><th>Deleted</th></tr></thead><tbody>{tasks.map(task => <tr key={task.id} onClick={() => onOpen(task)}><td><strong>{task.title}</strong><small>TF-{task.id.slice(0,5).toUpperCase()}</small></td><td><span className={`badge ${task.status}`}>{STATUS_LABELS[task.status]}</span></td><td>{task.deletedAt ? new Date(task.deletedAt).toLocaleString() : '—'}</td></tr>)}</tbody></table></div>}</>;
}
function localDate(value: string) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
