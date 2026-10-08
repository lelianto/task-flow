import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import type { PrismaClient } from '@prisma/client';
import { ACTORS } from '@taskflow/shared';
import { ZodError } from 'zod';
import { prisma as defaultPrisma } from './lib/prisma.js';
import { AppError } from './lib/errors.js';
import { createTaskSchema, updateStatusSchema, updateTaskSchema } from './modules/tasks/task.schema.js';
import { TaskService } from './modules/tasks/task.service.js';
import { createAuditInsight } from './modules/insights/audit-insight.service.js';

const ok = (data: unknown) => ({ data });

export function createApp(db: PrismaClient = defaultPrisma) {
  const app = express();
  const tasks = new TaskService(db);
  app.use(cors());
  app.use(express.json());

  app.get('/api/health', (_req, res) => res.json(ok({ status: 'ok' })));
  app.get('/api/actors', (_req, res) => res.json(ok(ACTORS)));
  app.get('/api/tasks', async (_req, res) => res.json(ok(await tasks.list())));
  app.get('/api/tasks/deleted', async (_req, res) => res.json(ok(await tasks.listDeleted())));
  app.get('/api/tasks/:id', async (req, res) => res.json(ok(await tasks.get(req.params.id))));
  app.post('/api/tasks', async (req, res) => {
    const task = await tasks.create(createTaskSchema.parse(req.body));
    res.status(201).json(ok(task));
  });
  app.patch('/api/tasks/:id/status', async (req, res) => {
    const body = updateStatusSchema.parse(req.body);
    res.json(ok(await tasks.updateStatus(req.params.id, body.status, body.actor)));
  });
  app.patch('/api/tasks/:id', async (req, res) => res.json(ok(await tasks.update(req.params.id, updateTaskSchema.parse(req.body)))));
  app.delete('/api/tasks/:id', async (req, res) => {
    await tasks.remove(req.params.id);
    res.status(204).send();
  });
  app.get('/api/tasks/:id/audit-logs', async (req, res) => res.json(ok(await tasks.auditLogs(req.params.id))));
  app.get('/api/tasks/:id/activities', async (req, res) => res.json(ok(await tasks.activities({ taskId: req.params.id }))));
  app.get('/api/activities', async (req, res) => res.json(ok(await tasks.activities({
    actor: typeof req.query.actor === 'string' ? req.query.actor : undefined,
    source: typeof req.query.source === 'string' ? req.query.source : undefined,
    status: typeof req.query.status === 'string' ? req.query.status : undefined,
    from: typeof req.query.from === 'string' ? new Date(req.query.from) : undefined,
    to: typeof req.query.to === 'string' ? new Date(req.query.to) : undefined,
  }))));
  app.get('/api/metrics', async (_req, res) => res.json(ok(await tasks.metrics())));
  app.post('/api/tasks/:id/ai-summary', async (req, res) => {
    const task = await tasks.get(req.params.id);
    const logs = await db.auditLog.findMany({ where: { taskId: task.id }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
    res.json(ok(await createAuditInsight(task, logs)));
  });

  app.use((_req, _res, next) => next(new AppError(404, 'ROUTE_NOT_FOUND', 'Route was not found.')));
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    void _next;
    if (error instanceof ZodError) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Request validation failed.', details: error.issues } });
    if (error instanceof AppError) return res.status(error.status).json({ error: { code: error.code, message: error.message, details: error.details } });
    console.error(error);
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } });
  });
  return app;
}
