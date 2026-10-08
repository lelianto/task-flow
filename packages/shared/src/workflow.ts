export const TASK_STATUSES = ['to_do', 'pending', 'in_progress', 'done'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export type WorkflowPolicy = { allowBackwardTransitions: boolean; allowStatusSkipping: boolean };
export const STRICT_WORKFLOW_POLICY: WorkflowPolicy = { allowBackwardTransitions: false, allowStatusSkipping: false };

export function canTransition(from: TaskStatus, to: TaskStatus, policy: WorkflowPolicy): boolean {
  if (from === to) return true;
  const distance = TASK_STATUSES.indexOf(to) - TASK_STATUSES.indexOf(from);
  if (distance > 0) return policy.allowStatusSkipping || distance === 1;
  return policy.allowBackwardTransitions && (policy.allowStatusSkipping || distance === -1);
}

export function allowedDestinations(from: TaskStatus, policy: WorkflowPolicy): TaskStatus[] {
  return TASK_STATUSES.filter((to) => to !== from && canTransition(from, to, policy));
}

export function explainTransition(from: TaskStatus, to: TaskStatus, policy: WorkflowPolicy): string {
  if (from === to) return 'This task is already in that status. No change or audit event will be created.';
  const distance = TASK_STATUSES.indexOf(to) - TASK_STATUSES.indexOf(from);
  if (canTransition(from, to, policy)) {
    if (Math.abs(distance) > 1) return 'This move is allowed because status skipping is enabled.';
    if (distance < 0) return 'This move is allowed because backward transitions are enabled.';
    return 'This is the next step in the workflow.';
  }
  if (distance < 0 && !policy.allowBackwardTransitions) {
    return 'Backward transitions are not allowed. Tasks must follow the workflow in order.';
  }
  return 'Status skipping is not allowed. Move through each workflow stage in order.';
}
