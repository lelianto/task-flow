export * from './workflow.js';

export const ACTORS = ['john.doe', 'jane.smith', 'alex.chen'] as const;
export type Actor = (typeof ACTORS)[number];
export const TASK_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];
export const TASK_SOURCES = ['manual', 'whatsapp', 'email', 'webhook', 'automation'] as const;
export type TaskSource = (typeof TASK_SOURCES)[number];
export const ACTIVITY_TYPES = ['task.created', 'status.changed', 'task.updated', 'task.deleted', 'human.escalation_requested', 'human.escalation_resolved'] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export type Task = {
  id: string;
  title: string;
  description: string | null;
  status: import('./workflow.js').TaskStatus;
  assignee: Actor | null;
  priority: TaskPriority;
  dueAt: string | null;
  source: TaskSource;
  requiresHumanAttention: boolean;
  escalationReason: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type ActivityEvent = {
  id: string;
  taskId: string;
  type: ActivityType;
  actorType: 'human' | 'system' | 'integration';
  actorId: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type OperationalMetrics = {
  activeTasks: number;
  completedTasks: number;
  overdueTasks: number;
  attentionTasks: number;
  completionRate: number;
  medianCycleTimeHours: number | null;
  byStatus: Record<import('./workflow.js').TaskStatus, number>;
  byPriority: Record<TaskPriority, number>;
};

export type AuditLog = {
  id: string;
  taskId: string;
  actor: Actor;
  fromStatus: import('./workflow.js').TaskStatus;
  toStatus: import('./workflow.js').TaskStatus;
  createdAt: string;
};

export type AuditInsight = {
  available: boolean;
  generatedBy: string | null;
  summary: string | null;
  facts: {
    transitionCount: number;
    actors: string[];
    firstChangeAt: string | null;
    latestChangeAt: string | null;
    currentStatus: import('./workflow.js').TaskStatus;
  };
};
