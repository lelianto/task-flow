import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { AlignLeft, GripVertical } from 'lucide-react';
import type { Task } from '@taskflow/shared';

export function TaskCard({ task, onOpen }: { task: Task; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id, data: { task } });
  return <article ref={setNodeRef} className={`task-card ${isDragging ? 'dragging' : ''}`} style={{ transform: CSS.Translate.toString(transform) }}>
    <button className="drag-handle" aria-label={`Drag ${task.title}`} {...listeners} {...attributes}><GripVertical size={16}/></button>
    <button className="card-content" onClick={onOpen}>
      <strong>{task.title}</strong>
      {task.description && <span><AlignLeft size={14}/> {task.description}</span>}
      <small>TF-{task.id.slice(0, 5).toUpperCase()}</small>
    </button>
  </article>;
}
