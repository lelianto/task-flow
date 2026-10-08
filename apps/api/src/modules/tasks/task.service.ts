import type { PrismaClient } from '@prisma/client';
import { canTransition, STRICT_WORKFLOW_POLICY, TASK_PRIORITIES, TASK_STATUSES, type Actor, type TaskPriority, type TaskSource, type TaskStatus } from '@taskflow/shared';
import { AppError } from '../../lib/errors.js';

export class TaskService {
  constructor(private readonly db: PrismaClient) {}

  list() {
    return this.db.task.findMany({ where: { deletedAt: null }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
  }

  listDeleted() {
    return this.db.task.findMany({ where: { deletedAt: { not: null } }, orderBy: [{ deletedAt: 'desc' }, { id: 'desc' }] });
  }

  async get(id: string) {
    const task = await this.db.task.findFirst({ where: { id, deletedAt: null } });
    if (!task) throw new AppError(404, 'TASK_NOT_FOUND', 'Task was not found.');
    return task;
  }

  create(input: { title: string; description?: string | null; assignee?: Actor | null; priority?: TaskPriority; dueAt?: string | null; source?: TaskSource }) {
    return this.db.$transaction(async (tx) => {
      const task = await tx.task.create({ data: {
        title: input.title,
        description: input.description || null,
        assignee: input.assignee ?? null,
        priority: input.priority ?? 'normal',
        dueAt: input.dueAt ? new Date(input.dueAt) : null,
        source: input.source ?? 'manual',
      } });
      await tx.activityEvent.create({ data: { taskId: task.id, type: 'task.created', actorType: input.source && input.source !== 'manual' ? 'integration' : 'system', actorId: input.source ?? 'taskflow', payload: JSON.stringify({ source: task.source }) } });
      return task;
    });
  }

  async updateStatus(id: string, toStatus: TaskStatus, actor: Actor) {
    return this.db.$transaction(async (tx) => {
      await tx.$queryRawUnsafe('PRAGMA busy_timeout = 5000');
      const task = await tx.task.findFirst({ where: { id, deletedAt: null } });
      if (!task) throw new AppError(404, 'TASK_NOT_FOUND', 'Task was not found.');
      const fromStatus = task.status as TaskStatus;
      if (fromStatus === toStatus) return { task, changed: false };

      if (!canTransition(fromStatus, toStatus, STRICT_WORKFLOW_POLICY)) {
        throw new AppError(409, 'INVALID_STATUS_TRANSITION', `Cannot move from ${fromStatus} to ${toStatus} with the current workflow.`);
      }

      const result = await tx.task.updateMany({
        where: { id, status: fromStatus, deletedAt: null },
        data: { status: toStatus },
      });
      if (result.count !== 1) throw new AppError(409, 'CONCURRENT_MODIFICATION', 'Task changed while this request was processed.');
      const updated = await tx.task.findUniqueOrThrow({ where: { id } });
      await tx.auditLog.create({ data: { taskId: id, actor, fromStatus, toStatus } });
      await tx.activityEvent.create({ data: { taskId: id, type: 'status.changed', actorType: 'human', actorId: actor, payload: JSON.stringify({ fromStatus, toStatus }) } });
      return { task: updated, changed: true };
    });
  }

  async update(id: string, input: { assignee?: Actor | null; priority?: TaskPriority; dueAt?: string | null; requiresHumanAttention?: boolean; escalationReason?: string | null; actor: Actor }) {
    return this.db.$transaction(async (tx) => {
      const before = await tx.task.findFirst({ where: { id, deletedAt: null } });
      if (!before) throw new AppError(404, 'TASK_NOT_FOUND', 'Task was not found.');
      if (input.requiresHumanAttention === true && !input.escalationReason?.trim() && !before.escalationReason) {
        throw new AppError(400, 'ESCALATION_REASON_REQUIRED', 'An escalation reason is required when requesting human attention.');
      }
      const data = {
        ...(input.assignee !== undefined && { assignee: input.assignee }),
        ...(input.priority !== undefined && { priority: input.priority }),
        ...(input.dueAt !== undefined && { dueAt: input.dueAt ? new Date(input.dueAt) : null }),
        ...(input.requiresHumanAttention !== undefined && { requiresHumanAttention: input.requiresHumanAttention }),
        ...(input.escalationReason !== undefined && { escalationReason: input.escalationReason || null }),
      };
      const changed = Object.entries(data).filter(([key, value]) => {
        const prior = before[key as keyof typeof before];
        if (prior instanceof Date && value instanceof Date) return prior.getTime() !== value.getTime();
        return prior !== value;
      }).map(([key]) => key);
      if (!changed.length) return before;
      const task = await tx.task.update({ where: { id }, data });
      const attentionChanged = input.requiresHumanAttention !== undefined && input.requiresHumanAttention !== before.requiresHumanAttention;
      const type = attentionChanged ? (input.requiresHumanAttention ? 'human.escalation_requested' : 'human.escalation_resolved') : 'task.updated';
      await tx.activityEvent.create({ data: { taskId: id, type, actorType: 'human', actorId: input.actor, payload: JSON.stringify({ changed }) } });
      return task;
    });
  }

  async remove(id: string) {
    await this.db.$transaction(async (tx) => {
      const result = await tx.task.updateMany({ where: { id, deletedAt: null }, data: { deletedAt: new Date() } });
      if (result.count !== 1) throw new AppError(404, 'TASK_NOT_FOUND', 'Task was not found.');
      await tx.activityEvent.create({ data: { taskId: id, type: 'task.deleted', actorType: 'system', actorId: 'taskflow', payload: '{}' } });
    });
  }

  async auditLogs(id: string) {
    const exists = await this.db.task.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new AppError(404, 'TASK_NOT_FOUND', 'Task was not found.');
    return this.db.auditLog.findMany({ where: { taskId: id }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
  }

  async activities(filters: { taskId?: string; actor?: string; source?: string; status?: string; from?: Date; to?: Date }) {
    const rows = await this.db.activityEvent.findMany({
      where: {
        ...(filters.taskId && { taskId: filters.taskId }),
        ...(filters.actor && { actorId: filters.actor }),
        ...(filters.from || filters.to ? { createdAt: { ...(filters.from && { gte: filters.from }), ...(filters.to && { lte: filters.to }) } } : {}),
        task: {
          ...(filters.source && { source: filters.source }),
          ...(filters.status && { status: filters.status }),
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 250,
    });
    const activities = rows.map(row => ({ ...row, payload: JSON.parse(row.payload) as Record<string, unknown> }));
    if (!filters.taskId) return activities;

    // Tasks created before ActivityEvent was introduced still have immutable audit logs.
    // Expose unmatched logs as read-only activity items so their history is not hidden.
    const auditLogs = await this.db.auditLog.findMany({
      where: {
        taskId: filters.taskId,
        ...(filters.actor && { actor: filters.actor }),
        ...(filters.from || filters.to ? { createdAt: { ...(filters.from && { gte: filters.from }), ...(filters.to && { lte: filters.to }) } } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    const legacyActivities = auditLogs.filter(log => !activities.some(event => {
      if (event.type !== 'status.changed' || event.actorId !== log.actor) return false;
      return event.payload.fromStatus === log.fromStatus
        && event.payload.toStatus === log.toStatus
        && Math.abs(event.createdAt.getTime() - log.createdAt.getTime()) < 2_000;
    })).map(log => ({
      id: `audit-${log.id}`,
      taskId: log.taskId,
      type: 'status.changed',
      actorType: 'human',
      actorId: log.actor,
      payload: { fromStatus: log.fromStatus, toStatus: log.toStatus },
      createdAt: log.createdAt,
    }));

    return [...activities, ...legacyActivities]
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime() || right.id.localeCompare(left.id))
      .slice(0, 250);
  }

  async metrics() {
    const [tasks, completions] = await Promise.all([
      this.db.task.findMany({ where: { deletedAt: null } }),
      this.db.activityEvent.findMany({ where: { type: 'status.changed' }, orderBy: { createdAt: 'asc' } }),
    ]);
    const now = Date.now();
    const completed = tasks.filter(task => task.status === 'done').length;
    const cycleHours = tasks.filter(task => task.status === 'done').flatMap(task => {
      const event = completions.find(item => item.taskId === task.id && (JSON.parse(item.payload) as { toStatus?: string }).toStatus === 'done');
      return event ? [(event.createdAt.getTime() - task.createdAt.getTime()) / 3_600_000] : [];
    }).sort((a, b) => a - b);
    const middle = Math.floor(cycleHours.length / 2);
    const median = cycleHours.length === 0 ? null : cycleHours.length % 2 ? cycleHours[middle] : (cycleHours[middle - 1] + cycleHours[middle]) / 2;
    return {
      activeTasks: tasks.length,
      completedTasks: completed,
      overdueTasks: tasks.filter(task => task.status !== 'done' && task.dueAt && task.dueAt.getTime() < now).length,
      attentionTasks: tasks.filter(task => task.requiresHumanAttention).length,
      completionRate: tasks.length ? Math.round((completed / tasks.length) * 100) : 0,
      medianCycleTimeHours: median === null ? null : Math.round(median * 10) / 10,
      byStatus: Object.fromEntries(TASK_STATUSES.map(status => [status, tasks.filter(task => task.status === status).length])),
      byPriority: Object.fromEntries(TASK_PRIORITIES.map(priority => [priority, tasks.filter(task => task.priority === priority).length])),
    };
  }
}
