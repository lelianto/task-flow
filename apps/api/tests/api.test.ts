import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createPrisma } from '../src/lib/prisma.js';

const db = createPrisma(process.env.DATABASE_URL);
const app = createApp(db);

beforeEach(async () => {
  await db.$executeRawUnsafe('DROP TRIGGER IF EXISTS AuditLog_fail_insert');
  await db.auditLog.deleteMany().catch(() => undefined);
  await db.$executeRawUnsafe('DROP TRIGGER IF EXISTS AuditLog_prevent_delete');
  await db.auditLog.deleteMany();
  await db.$executeRawUnsafe("CREATE TRIGGER AuditLog_prevent_delete BEFORE DELETE ON AuditLog BEGIN SELECT RAISE(ABORT, 'Audit logs are immutable'); END");
  await db.task.deleteMany();
  await db.workflowSettings.update({ where: { id: 1 }, data: { allowBackwardTransitions: false, allowStatusSkipping: false } });
});
afterAll(() => db.$disconnect());

async function createTask(title = 'Prepare invoice') {
  const response = await request(app).post('/api/tasks').send({ title, description: 'For October' });
  expect(response.status).toBe(201);
  return response.body.data;
}

describe('task API', () => {
  it('creates a task in to_do and lists it', async () => {
    const task = await createTask();
    expect(task.status).toBe('to_do');
    const list = await request(app).get('/api/tasks');
    expect(list.body.data).toHaveLength(1);
  });

  it('updates status and creates exactly one audit log', async () => {
    const task = await createTask();
    const update = await request(app).patch(`/api/tasks/${task.id}/status`).send({ status: 'pending', actor: 'john.doe' });
    expect(update.status).toBe(200);
    expect(update.body.data.changed).toBe(true);
    const logs = await request(app).get(`/api/tasks/${task.id}/audit-logs`);
    expect(logs.body.data).toMatchObject([{ actor: 'john.doe', fromStatus: 'to_do', toStatus: 'pending' }]);
  });

  it('makes same-status updates idempotent without touching updatedAt', async () => {
    const task = await createTask();
    const update = await request(app).patch(`/api/tasks/${task.id}/status`).send({ status: 'to_do', actor: 'john.doe' });
    expect(update.body.data).toMatchObject({ changed: false, task: { updatedAt: task.updatedAt } });
    expect(await db.auditLog.count()).toBe(0);
  });

  it('rejects invalid transitions and actors', async () => {
    const task = await createTask();
    const skipped = await request(app).patch(`/api/tasks/${task.id}/status`).send({ status: 'done', actor: 'john.doe' });
    expect(skipped.status).toBe(409);
    expect(skipped.body.error.code).toBe('INVALID_STATUS_TRANSITION');
    const actor = await request(app).patch(`/api/tasks/${task.id}/status`).send({ status: 'pending', actor: 'mallory' });
    expect(actor.status).toBe(400);
  });

  it('respects configurable backward and skipping rules', async () => {
    const task = await createTask();
    await request(app).patch('/api/settings/workflow').send({ allowBackwardTransitions: false, allowStatusSkipping: true });
    expect((await request(app).patch(`/api/tasks/${task.id}/status`).send({ status: 'done', actor: 'jane.smith' })).status).toBe(200);
    expect((await request(app).patch(`/api/tasks/${task.id}/status`).send({ status: 'to_do', actor: 'jane.smith' })).status).toBe(409);
    await request(app).patch('/api/settings/workflow').send({ allowBackwardTransitions: true, allowStatusSkipping: true });
    expect((await request(app).patch(`/api/tasks/${task.id}/status`).send({ status: 'to_do', actor: 'jane.smith' })).status).toBe(200);
  });

  it('soft deletes tasks but retains audit history', async () => {
    const task = await createTask();
    await request(app).patch(`/api/tasks/${task.id}/status`).send({ status: 'pending', actor: 'alex.chen' });
    expect((await request(app).delete(`/api/tasks/${task.id}`)).status).toBe(204);
    expect((await request(app).get('/api/tasks')).body.data).toHaveLength(0);
    expect((await request(app).get(`/api/tasks/${task.id}/audit-logs`)).body.data).toHaveLength(1);
  });

  it('database triggers reject audit updates and deletes', async () => {
    const task = await createTask();
    await request(app).patch(`/api/tasks/${task.id}/status`).send({ status: 'pending', actor: 'john.doe' });
    const log = await db.auditLog.findFirstOrThrow();
    await expect(db.auditLog.update({ where: { id: log.id }, data: { actor: 'alex.chen' } })).rejects.toThrow();
    await expect(db.auditLog.delete({ where: { id: log.id } })).rejects.toThrow();
    expect(await db.auditLog.findUnique({ where: { id: log.id } })).toMatchObject({ actor: 'john.doe' });
  });

  it('rolls back the task update when audit insertion fails', async () => {
    const task = await createTask();
    await db.$executeRawUnsafe("CREATE TRIGGER AuditLog_fail_insert BEFORE INSERT ON AuditLog BEGIN SELECT RAISE(ABORT, 'simulated audit failure'); END");
    const response = await request(app).patch(`/api/tasks/${task.id}/status`).send({ status: 'pending', actor: 'john.doe' });
    expect(response.status).toBe(500);
    expect((await db.task.findUniqueOrThrow({ where: { id: task.id } })).status).toBe('to_do');
    expect(await db.auditLog.count()).toBe(0);
  });
});
