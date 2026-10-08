import { useDroppable } from '@dnd-kit/core';
import { canTransition, TASK_STATUSES, type Task, type TaskStatus, type WorkflowPolicy } from '@taskflow/shared';
import { TaskCard } from './TaskCard';
import { STATUS_LABELS } from './status-labels';

function Column({ status, tasks, onOpen, targetState }: { status: TaskStatus; tasks: Task[]; onOpen: (task: Task) => void; targetState?: 'valid' | 'invalid' }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return <section ref={setNodeRef} className={`column ${isOver ? 'over' : ''} ${targetState ? `target-${targetState}` : ''}`} aria-label={`${STATUS_LABELS[status]} tasks`}>
    <header><div><span className={`status-dot ${status}`}/><h2>{STATUS_LABELS[status]}</h2></div><span className="count">{tasks.length}</span></header>
    <div className="column-body">{tasks.map(task => <TaskCard key={task.id} task={task} onOpen={() => onOpen(task)}/>)}</div>
  </section>;
}

export function KanbanBoard({ tasks, onOpen, activeTask, settings }: { tasks: Task[]; onOpen: (task: Task) => void; activeTask: Task | null; settings: WorkflowPolicy }) {
  return <div className="board">{TASK_STATUSES.map(status => <Column key={status} status={status} tasks={tasks.filter(task => task.status === status)} onOpen={onOpen} targetState={activeTask && status !== activeTask.status ? (canTransition(activeTask.status, status, settings) ? 'valid' : 'invalid') : undefined}/>)}</div>;
}
