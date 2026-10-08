import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { AlertTriangle, AlignLeft, CalendarClock, GripVertical, UserRound } from 'lucide-react';
import type { Task } from '@taskflow/shared';

export function TaskCard({ task, onOpen }: { task: Task; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id, data: { task } });
  return <article ref={setNodeRef} className={`task-card ${isDragging ? 'dragging' : ''}`} style={{ transform: CSS.Translate.toString(transform) }}>
    <button className="card-content" onClick={onOpen} {...listeners} {...attributes} aria-label={`${task.title}. Drag to change status, or click to open details.`}>
      <GripVertical className="drag-handle" size={16} aria-hidden="true"/>
      <span className="card-copy">
      <strong>{task.title}</strong>
      {task.description && <span className="task-description"><AlignLeft size={14}/> <span>{task.description}</span></span>}
      <span className="task-meta">{task.assignee && <i><UserRound size={12}/>{task.assignee}</i>}{task.dueAt && <i className={task.status !== 'done' && new Date(task.dueAt) < new Date() ? 'overdue' : ''}><CalendarClock size={12}/>{new Date(task.dueAt).toLocaleDateString()}</i>}{task.requiresHumanAttention && <i className="attention"><AlertTriangle size={12}/>Attention</i>}</span>
      <em className={`priority ${task.priority}`}>{task.priority}</em>
      <small>TF-{task.id.slice(0, 5).toUpperCase()}</small>
      </span>
    </button>
  </article>;
}

export function TaskCardPreview({ task }: { task: Task }) {
  return <article className="task-card drag-preview" aria-hidden="true">
    <div className="card-content">
      <GripVertical className="drag-handle" size={16}/>
      <span className="card-copy">
        <strong>{task.title}</strong>
        {task.description && <span className="task-description"><AlignLeft size={14}/> <span>{task.description}</span></span>}
        <small>TF-{task.id.slice(0, 5).toUpperCase()}</small>
      </span>
    </div>
  </article>;
}
