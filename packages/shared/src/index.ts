export * from './workflow.js';

export const ACTORS = ['john.doe', 'jane.smith', 'alex.chen'] as const;
export type Actor = (typeof ACTORS)[number];

export type Task = {
  id: string;
  title: string;
  description: string | null;
  status: import('./workflow.js').TaskStatus;
  createdAt: string;
  updatedAt: string;
};

export type AuditLog = {
  id: string;
  taskId: string;
  actor: Actor;
  fromStatus: import('./workflow.js').TaskStatus;
  toStatus: import('./workflow.js').TaskStatus;
  createdAt: string;
};
