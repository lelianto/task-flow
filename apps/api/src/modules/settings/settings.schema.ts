import { z } from 'zod';
export const workflowSettingsSchema = z.object({
  allowBackwardTransitions: z.boolean(),
  allowStatusSkipping: z.boolean(),
}).strict();
