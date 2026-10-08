import { ACTORS, TASK_PRIORITIES, TASK_SOURCES, TASK_STATUSES } from '@taskflow/shared';
import { z } from 'zod';

export const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional().nullable(),
  assignee: z.enum(ACTORS).optional().nullable(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  dueAt: z.string().datetime().optional().nullable(),
  source: z.enum(TASK_SOURCES).optional(),
}).strict();

export const updateTaskSchema = z.object({
  assignee: z.enum(ACTORS).nullable().optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  dueAt: z.string().datetime().nullable().optional(),
  requiresHumanAttention: z.boolean().optional(),
  escalationReason: z.string().trim().max(500).nullable().optional(),
  actor: z.enum(ACTORS),
}).strict().refine(value => Object.keys(value).some(key => key !== 'actor'), { message: 'At least one task field must be updated.' });

export const updateStatusSchema = z.object({
  status: z.enum(TASK_STATUSES),
  actor: z.enum(ACTORS),
}).strict();
