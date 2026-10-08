import type { AuditLog, Task } from '@prisma/client';
import type { AuditInsight, TaskStatus } from '@taskflow/shared';
import { AppError } from '../../lib/errors.js';

type DeepSeekResponse = { choices?: Array<{ message?: { content?: string } }> };

export function analyzeAudit(task: Task, logs: AuditLog[]): AuditInsight['facts'] {
  return {
    transitionCount: logs.length,
    actors: [...new Set(logs.map((log) => log.actor))].sort(),
    firstChangeAt: logs[0]?.createdAt.toISOString() ?? null,
    latestChangeAt: logs.at(-1)?.createdAt.toISOString() ?? null,
    currentStatus: task.status as TaskStatus,
  };
}

export async function createAuditInsight(task: Task, logs: AuditLog[]): Promise<AuditInsight> {
  const facts = analyzeAudit(task, logs);
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return { available: false, generatedBy: null, summary: null, facts };

  const model = process.env.DEEPSEEK_MODEL ?? 'deepseek-v4-flash';
  const events = logs.map((log) => ({ actor: log.actor, from: log.fromStatus, to: log.toStatus, at: log.createdAt.toISOString() }));
  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(12_000),
      body: JSON.stringify({
        model,
        thinking: { type: 'disabled' },
        temperature: 0.1,
        max_tokens: 220,
        messages: [
          { role: 'system', content: 'Explain the supplied task audit facts concisely. Never infer motivations, causes, intent, or events that are not present. Mention that the immutable activity timeline is the source of truth.' },
          { role: 'user', content: JSON.stringify({ task: { title: task.title, currentStatus: task.status }, facts, events }) },
        ],
      }),
    });
    if (!response.ok) throw new Error(`DeepSeek returned ${response.status}`);
    const payload = await response.json() as DeepSeekResponse;
    const summary = payload.choices?.[0]?.message?.content?.trim();
    if (!summary) throw new Error('DeepSeek returned an empty summary');
    return { available: true, generatedBy: model, summary, facts };
  } catch (error) {
    throw new AppError(503, 'AI_INSIGHT_UNAVAILABLE', 'AI Insights are temporarily unavailable. The verified activity timeline remains available.', error instanceof Error ? error.message : undefined);
  }
}
