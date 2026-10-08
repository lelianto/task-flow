import { useMemo, useState } from 'react';
import { DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckSquare2, KanbanSquare, List, Plus, Search, Settings, UserRound } from 'lucide-react';
import { ACTORS, canTransition, type Actor, type Task, type TaskStatus, type WorkflowPolicy } from '@taskflow/shared';
import { api } from '../lib/api';
import { CreateTaskDialog } from '../features/tasks/CreateTaskDialog';
import { KanbanBoard } from '../features/tasks/KanbanBoard';
import { STATUS_LABELS } from '../features/tasks/status-labels';
import { TaskDetailSheet } from '../features/tasks/TaskDetailSheet';
import { WorkflowSettings } from '../features/settings/WorkflowSettings';

type View = 'board' | 'tasks' | 'settings';
const defaultSettings: WorkflowPolicy = { allowBackwardTransitions: false, allowStatusSkipping: false };

export function App() {
  const client = useQueryClient();
  const [view, setView] = useState<View>('board');
  const [actor, setActor] = useState<Actor>('john.doe');
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: 'error' | 'success'; message: string } | null>(null);
  const tasksQuery = useQuery({ queryKey: ['tasks'], queryFn: api.tasks });
  const settingsQuery = useQuery({ queryKey: ['settings'], queryFn: api.settings });
  const tasks = useMemo(() => (tasksQuery.data ?? []).filter(task => `${task.title} ${task.description ?? ''}`.toLowerCase().includes(search.toLowerCase())), [tasksQuery.data, search]);
  const selected = (tasksQuery.data ?? []).find(task => task.id === selectedId) ?? null;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));

  const refresh = async (id?: string) => { await client.invalidateQueries({ queryKey: ['tasks'] }); if (id) await client.invalidateQueries({ queryKey: ['audit', id] }); };
  const create = useMutation({ mutationFn: api.createTask, onSuccess: async () => { setCreating(false); await refresh(); flash('success', 'Task created.'); }, onError: error => flash('error', error.message) });
  const update = useMutation({ mutationFn: ({ id, status }: { id: string; status: TaskStatus }) => api.updateStatus(id, status, actor), onSuccess: async (_data, input) => { await refresh(input.id); flash('success', 'Status updated and recorded.'); }, onError: error => flash('error', error.message) });
  const remove = useMutation({ mutationFn: api.deleteTask, onSuccess: async () => { setSelectedId(null); await refresh(); flash('success', 'Task deleted. Audit history is retained.'); }, onError: error => flash('error', error.message) });
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
    if (!canTransition(task.status, status, settings)) return flash('error', `Cannot move from ${STATUS_LABELS[task.status]} to ${STATUS_LABELS[status]} with the current workflow.`);
    update.mutate({ id: task.id, status });
  }
  function dragEnd(event: DragEndEvent) {
    const task = event.active.data.current?.task as Task | undefined;
    const status = event.over?.id as TaskStatus | undefined;
    if (task && status && task.status !== status) move(task, status);
  }
  function confirmDelete() { if (selected && window.confirm(`Delete “${selected.title}”? Its audit history will be retained.`)) remove.mutate(selected.id); }

  return <div className="app-shell">
    <header className="topbar"><button className="brand" onClick={() => setView('board')}><span><CheckSquare2/></span>TaskFlow</button>
      <nav aria-label="Main navigation"><Nav active={view === 'board'} icon={<KanbanSquare/>} label="Board" onClick={() => setView('board')}/><Nav active={view === 'tasks'} icon={<List/>} label="All Tasks" onClick={() => setView('tasks')}/><Nav active={view === 'settings'} icon={<Settings/>} label="Settings" onClick={() => setView('settings')}/></nav>
      <label className="actor"><UserRound size={16}/><select aria-label="Current actor" value={actor} onChange={e => setActor(e.target.value as Actor)}>{ACTORS.map(item => <option key={item}>{item}</option>)}</select></label>
    </header>
    <main>
      {view === 'settings' ? <WorkflowSettings settings={settings} busy={saveSettings.isPending} onChange={value => saveSettings.mutate(value)}/> : <>
        <div className="page-head"><div><span className="eyebrow">WORKSPACE</span><h1>{view === 'board' ? 'Task Board' : 'All Tasks'}</h1><p>{tasksQuery.data?.length ?? 0} active tasks · Changes by <strong>{actor}</strong></p></div><button className="button primary" onClick={() => setCreating(true)}><Plus size={18}/> Create task</button></div>
        <div className="toolbar"><label className="search"><Search size={18}/><input aria-label="Search tasks" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tasks…"/></label></div>
        {tasksQuery.isLoading && <State message="Loading your workspace…"/>}
        {tasksQuery.isError && <State message="Could not load tasks. Make sure the API is running." error/>}
        {tasksQuery.isSuccess && tasks.length === 0 && <State message={search ? 'No tasks match your search.' : 'No tasks yet. Create your first task to get started.'}/>} 
        {tasksQuery.isSuccess && tasks.length > 0 && view === 'board' && <DndContext sensors={sensors} onDragEnd={dragEnd}><KanbanBoard tasks={tasks} onOpen={task => setSelectedId(task.id)}/></DndContext>}
        {tasksQuery.isSuccess && tasks.length > 0 && view === 'tasks' && <div className="table-wrap"><table><thead><tr><th>Task</th><th>Status</th><th>Updated</th></tr></thead><tbody>{tasks.map(task => <tr key={task.id} onClick={() => setSelectedId(task.id)}><td><strong>{task.title}</strong><small>TF-{task.id.slice(0,5).toUpperCase()}</small></td><td><span className={`badge ${task.status}`}>{STATUS_LABELS[task.status]}</span></td><td>{new Date(task.updatedAt).toLocaleDateString()}</td></tr>)}</tbody></table></div>}
      </>}
    </main>
    {notice && <div role="status" className={`toast ${notice.type}`}>{notice.message}</div>}
    <CreateTaskDialog open={creating} busy={create.isPending} onClose={() => setCreating(false)} onCreate={input => create.mutate(input)}/>
    <TaskDetailSheet task={selected} actor={actor} settings={settings} busy={update.isPending || remove.isPending} onClose={() => setSelectedId(null)} onStatus={status => selected && move(selected, status)} onDelete={confirmDelete}/>
  </div>;
}

function Nav({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) { return <button className={active ? 'active' : ''} onClick={onClick}>{icon}<span>{label}</span></button>; }
function State({ message, error = false }: { message: string; error?: boolean }) { return <div className={`state ${error ? 'error' : ''}`}><CheckSquare2/><p>{message}</p></div>; }
