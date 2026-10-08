import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { createPrisma } from '../src/lib/prisma.js';

const db = createPrisma(process.env.DATABASE_URL);
const app = createApp(db);

beforeEach(async () => {
  await db.$executeRawUnsafe('DROP TRIGGER IF EXISTS ActivityEvent_prevent_delete');
  await db.activityEvent.deleteMany();
  await db.$executeRawUnsafe("CREATE TRIGGER ActivityEvent_prevent_delete BEFORE DELETE ON ActivityEvent BEGIN SELECT RAISE(ABORT, 'Activity events are immutable'); END");
  await db.$executeRawUnsafe('DROP TRIGGER IF EXISTS AuditLog_fail_insert');
  await db.auditLog.deleteMany().catch(() => undefined);
  await db.$executeRawUnsafe('DROP TRIGGER IF EXISTS AuditLog_prevent_delete');
  await db.auditLog.deleteMany();
  await db.$executeRawUnsafe("CREATE TRIGGER AuditLog_prevent_delete BEFORE DELETE ON AuditLog BEGIN SELECT RAISE(ABORT, 'Audit logs are immutable'); END");
  await db.task.deleteMany();
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
    expect(task).toMatchObject({ priority: 'normal', source: 'manual', requiresHumanAttention: false });
    expect(await db.activityEvent.count({ where: { taskId: task.id, type: 'task.created' } })).toBe(1);
  });

  it('updates status and creates exactly one audit log', async () => {
    const task = await createTask();
    const update = await request(app).patch(`/api/tasks/${task.id}/status`).send({ status: 'pending', actor: 'john.doe' });
    expect(update.status).toBe(200);
    expect(update.body.data.changed).toBe(true);
    const logs = await request(app).get(`/api/tasks/${task.id}/audit-logs`);
    expect(logs.body.data).toMatchObject([{ actor: 'john.doe', fromStatus: 'to_do', toStatus: 'pending' }]);
    expect(await db.activityEvent.count({ where: { taskId: task.id, type: 'status.changed' } })).toBe(1);
  });

  it('updates operational details, records escalation, and reports metrics', async () => {
    const task = await createTask();
    const dueAt = new Date(Date.now() - 60_000).toISOString();
    const updated = await request(app).patch(`/api/tasks/${task.id}`).send({ assignee: 'jane.smith', priority: 'urgent', dueAt, requiresHumanAttention: true, escalationReason: 'Customer approval is blocked.', actor: 'john.doe' });
    expect(updated.status).toBe(200);
    expect(updated.body.data).toMatchObject({ assignee: 'jane.smith', priority: 'urgent', requiresHumanAttention: true });
    const activities = await request(app).get(`/api/tasks/${task.id}/activities`);
    expect(activities.body.data.map((event: { type: string }) => event.type)).toContain('human.escalation_requested');
    const metrics = await request(app).get('/api/metrics');
    expect(metrics.body.data).toMatchObject({ activeTasks: 1, overdueTasks: 1, attentionTasks: 1, completionRate: 0 });
  });

  it('requires a reason for human attention and validates operational enums', async () => {
    const task = await createTask();
    expect((await request(app).patch(`/api/tasks/${task.id}`).send({ requiresHumanAttention: true, actor: 'john.doe' })).status).toBe(400);
    expect((await request(app).patch(`/api/tasks/${task.id}`).send({ priority: 'critical', actor: 'john.doe' })).status).toBe(400);
  });

  it('filters activity by actor, source, status, and date', async () => {
    const task = await createTask();
    await request(app).patch(`/api/tasks/${task.id}/status`).send({ status: 'pending', actor: 'alex.chen' });
    const response = await request(app).get('/api/activities').query({ actor: 'alex.chen', source: 'manual', status: 'pending', from: '2000-01-01T00:00:00.000Z' });
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toMatchObject({ type: 'status.changed', actorId: 'alex.chen' });
  });

  it('shows legacy audit logs in a task activity timeline without duplicating current events', async () => {
    const legacyTask = await createTask('Legacy audit history');
    await db.task.update({ where: { id: legacyTask.id }, data: { status: 'pending' } });
    const legacyLog = await db.auditLog.create({ data: { taskId: legacyTask.id, actor: 'john.doe', fromStatus: 'to_do', toStatus: 'pending' } });

    const legacyTimeline = await request(app).get(`/api/tasks/${legacyTask.id}/activities`);
    expect(legacyTimeline.body.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: `audit-${legacyLog.id}`, type: 'status.changed', actorId: 'john.doe', payload: { fromStatus: 'to_do', toStatus: 'pending' } }),
    ]));

    const currentTask = await createTask('Current activity history');
    await request(app).patch(`/api/tasks/${currentTask.id}/status`).send({ status: 'pending', actor: 'john.doe' });
    const currentTimeline = await request(app).get(`/api/tasks/${currentTask.id}/activities`);
    expect(currentTimeline.body.data.filter((event: { type: string }) => event.type === 'status.changed')).toHaveLength(1);
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

  it('keeps the workflow strict even if legacy settings are relaxed', async () => {
    const task = await createTask();
    await db.workflowSettings.update({ where: { id: 1 }, data: { allowBackwardTransitions: true, allowStatusSkipping: true } });
    expect((await request(app).patch(`/api/tasks/${task.id}/status`).send({ status: 'done', actor: 'jane.smith' })).status).toBe(409);
    expect((await request(app).patch(`/api/tasks/${task.id}/status`).send({ status: 'pending', actor: 'jane.smith' })).status).toBe(200);
    expect((await request(app).patch(`/api/tasks/${task.id}/status`).send({ status: 'to_do', actor: 'jane.smith' })).status).toBe(409);
  });

  it('soft deletes tasks but retains audit history', async () => {
    const task = await createTask();
    await request(app).patch(`/api/tasks/${task.id}/status`).send({ status: 'pending', actor: 'alex.chen' });
    expect((await request(app).delete(`/api/tasks/${task.id}`)).status).toBe(204);
    expect((await request(app).get('/api/tasks')).body.data).toHaveLength(0);
    expect((await request(app).get('/api/tasks/deleted')).body.data).toMatchObject([{ id: task.id }]);
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

  it('database triggers reject activity updates and deletes', async () => {
    const task = await createTask();
    const event = await db.activityEvent.findFirstOrThrow({ where: { taskId: task.id } });
    await expect(db.activityEvent.update({ where: { id: event.id }, data: { actorId: 'tampered' } })).rejects.toThrow();
    await expect(db.activityEvent.delete({ where: { id: event.id } })).rejects.toThrow();
  });

  it('rolls back the task update when audit insertion fails', async () => {
    const task = await createTask();
    await db.$executeRawUnsafe("CREATE TRIGGER AuditLog_fail_insert BEFORE INSERT ON AuditLog BEGIN SELECT RAISE(ABORT, 'simulated audit failure'); END");
    const response = await request(app).patch(`/api/tasks/${task.id}/status`).send({ status: 'pending', actor: 'john.doe' });
    expect(response.status).toBe(500);
    expect((await db.task.findUniqueOrThrow({ where: { id: task.id } })).status).toBe('to_do');
    expect(await db.auditLog.count()).toBe(0);
  });

  it('returns deterministic audit facts when AI is not configured', async () => {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
    const task = await createTask();
    await request(app).patch(`/api/tasks/${task.id}/status`).send({ status: 'pending', actor: 'john.doe' });
    const response = await request(app).post(`/api/tasks/${task.id}/ai-summary`);
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      available: false,
      generatedBy: null,
      summary: null,
      facts: { transitionCount: 1, actors: ['john.doe'], currentStatus: 'pending' },
    });
    if (apiKey) process.env.DEEPSEEK_API_KEY = apiKey;
  });

  it('generates a labeled AI summary in non-thinking mode', async () => {
    const originalKey = process.env.DEEPSEEK_API_KEY;
    process.env.DEEPSEEK_API_KEY = 'test-key';
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: 'One verified status change occurred.' } }] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    try {
      const task = await createTask();
      await request(app).patch(`/api/tasks/${task.id}/status`).send({ status: 'pending', actor: 'john.doe' });
      const response = await request(app).post(`/api/tasks/${task.id}/ai-summary`);
      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({ available: true, generatedBy: 'deepseek-v4-flash', summary: 'One verified status change occurred.' });
      const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);
      expect(requestBody.thinking).toEqual({ type: 'disabled' });
      expect(requestBody.messages[0].content).toContain('Bahasa Indonesia');
      expect(requestBody.messages[0].content).toContain('riwayat aktivitas permanen');
      expect(requestBody.messages[0].content).not.toContain('source of truth');
      const promptData = JSON.parse(requestBody.messages[1].content);
      expect(promptData).toMatchObject({
        task: { title: 'Prepare invoice', currentStatus: 'Pending' },
        transitionCount: 1,
        events: [{ actor: 'john.doe', from: 'To Do', to: 'Pending' }],
      });
      expect(promptData.events[0].waktuWib).toMatch(/WIB$/);
      expect(promptData.events[0]).not.toHaveProperty('at');
    } finally {
      vi.unstubAllGlobals();
      if (originalKey) process.env.DEEPSEEK_API_KEY = originalKey;
      else delete process.env.DEEPSEEK_API_KEY;
    }
  });
});
