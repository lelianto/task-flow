import type { PrismaClient } from '@prisma/client';
import { canTransition, type Actor, type TaskStatus } from '@taskflow/shared';
import { AppError } from '../../lib/errors.js';

export class TaskService {
  constructor(private readonly db: PrismaClient) {}

  list() {
    return this.db.task.findMany({ where: { deletedAt: null }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
  }

  async get(id: string) {
    const task = await this.db.task.findFirst({ where: { id, deletedAt: null } });
    if (!task) throw new AppError(404, 'TASK_NOT_FOUND', 'Task was not found.');
    return task;
  }

  create(input: { title: string; description?: string | null }) {
    return this.db.task.create({ data: { title: input.title, description: input.description || null } });
  }

  async updateStatus(id: string, toStatus: TaskStatus, actor: Actor) {
    return this.db.$transaction(async (tx) => {
      await tx.$queryRawUnsafe('PRAGMA busy_timeout = 5000');
      const task = await tx.task.findFirst({ where: { id, deletedAt: null } });
      if (!task) throw new AppError(404, 'TASK_NOT_FOUND', 'Task was not found.');
      const fromStatus = task.status as TaskStatus;
      if (fromStatus === toStatus) return { task, changed: false };

      const settings = await tx.workflowSettings.findUnique({ where: { id: 1 } });
      if (!settings) throw new AppError(500, 'SETTINGS_NOT_FOUND', 'Workflow settings are unavailable.');
      if (!canTransition(fromStatus, toStatus, settings)) {
        throw new AppError(409, 'INVALID_STATUS_TRANSITION', `Cannot move from ${fromStatus} to ${toStatus} with the current workflow.`);
      }

      const result = await tx.task.updateMany({
        where: { id, status: fromStatus, deletedAt: null },
        data: { status: toStatus },
      });
      if (result.count !== 1) throw new AppError(409, 'CONCURRENT_MODIFICATION', 'Task changed while this request was processed.');
      const updated = await tx.task.findUniqueOrThrow({ where: { id } });
      await tx.auditLog.create({ data: { taskId: id, actor, fromStatus, toStatus } });
      return { task: updated, changed: true };
    });
  }

  async remove(id: string) {
    const result = await this.db.task.updateMany({ where: { id, deletedAt: null }, data: { deletedAt: new Date() } });
    if (result.count !== 1) throw new AppError(404, 'TASK_NOT_FOUND', 'Task was not found.');
  }

  async auditLogs(id: string) {
    const exists = await this.db.task.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new AppError(404, 'TASK_NOT_FOUND', 'Task was not found.');
    return this.db.auditLog.findMany({ where: { taskId: id }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
  }
}
