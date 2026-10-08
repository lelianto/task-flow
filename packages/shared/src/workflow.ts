export const TASK_STATUSES = ['to_do', 'pending', 'in_progress', 'done'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export type WorkflowPolicy = { allowBackwardTransitions: boolean; allowStatusSkipping: boolean };

export function canTransition(from: TaskStatus, to: TaskStatus, policy: WorkflowPolicy): boolean {
  if (from === to) return true;
  const distance = TASK_STATUSES.indexOf(to) - TASK_STATUSES.indexOf(from);
  if (distance > 0) return policy.allowStatusSkipping || distance === 1;
  return policy.allowBackwardTransitions && (policy.allowStatusSkipping || distance === -1);
}

export function allowedDestinations(from: TaskStatus, policy: WorkflowPolicy): TaskStatus[] {
  return TASK_STATUSES.filter((to) => to !== from && canTransition(from, to, policy));
}
