import { ACTORS, TASK_STATUSES } from '@taskflow/shared';
import { z } from 'zod';

export const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional().nullable(),
}).strict();

export const updateStatusSchema = z.object({
  status: z.enum(TASK_STATUSES),
  actor: z.enum(ACTORS),
}).strict();
