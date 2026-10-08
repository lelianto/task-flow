import type { Actor, AuditLog, Task, TaskStatus, WorkflowPolicy } from '@taskflow/shared';

type Envelope<T> = { data: T };
type ErrorEnvelope = { error?: { message?: string } };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as ErrorEnvelope;
    throw new Error(payload.error?.message ?? `Request failed (${response.status})`);
  }
  if (response.status === 204) return undefined as T;
  return ((await response.json()) as Envelope<T>).data;
}

export const api = {
  tasks: () => request<Task[]>('/api/tasks'),
  createTask: (input: { title: string; description?: string }) => request<Task>('/api/tasks', { method: 'POST', body: JSON.stringify(input) }),
  deleteTask: (id: string) => request<void>(`/api/tasks/${id}`, { method: 'DELETE' }),
  updateStatus: (id: string, status: TaskStatus, actor: Actor) => request<{ task: Task; changed: boolean }>(`/api/tasks/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, actor }) }),
  auditLogs: (id: string) => request<AuditLog[]>(`/api/tasks/${id}/audit-logs`),
  settings: () => request<WorkflowPolicy>('/api/settings/workflow'),
  updateSettings: (settings: WorkflowPolicy) => request<WorkflowPolicy>('/api/settings/workflow', { method: 'PATCH', body: JSON.stringify(settings) }),
};
