import type { AuditLog, Task } from '@prisma/client';
import type { AuditInsight, TaskStatus } from '@taskflow/shared';
import { AppError } from '../../lib/errors.js';

type DeepSeekResponse = { choices?: Array<{ message?: { content?: string } }> };

const STATUS_LABELS: Record<TaskStatus, string> = {
  to_do: 'To Do',
  pending: 'Pending',
  in_progress: 'In Progress',
  done: 'Done',
};

const wibFormatter = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta',
  dateStyle: 'long',
  timeStyle: 'short',
  hourCycle: 'h23',
});

const AI_SUMMARY_INSTRUCTIONS = [
  'Buat ringkasan riwayat status task dalam Bahasa Indonesia yang natural, ringkas, dan mudah dipahami pengguna nonteknis.',
  'Gunakan hanya fakta dan events yang diberikan. Jangan menebak motivasi, penyebab, niat, atau kejadian lain.',
  'Sebutkan status saat ini, jumlah perubahan, actor, lalu urutkan setiap transisi secara kronologis.',
  'Gunakan label status dan waktuWib persis seperti yang diberikan. Jangan tampilkan timestamp ISO mentah.',
  'Akhiri dengan kalimat bahwa riwayat aktivitas permanen dan tidak dapat diubah atau dihapus. Hindari jargon teknis dan frasa berbahasa Inggris.',
  'Jika tidak ada perubahan status, nyatakan hal tersebut dengan singkat.',
  'Tulis sebagai paragraf singkat; gunakan daftar bernomor hanya jika ada lebih dari satu transisi.',
].join(' ');

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
  const events = logs.map((log) => ({
    actor: log.actor,
    from: STATUS_LABELS[log.fromStatus as TaskStatus],
    to: STATUS_LABELS[log.toStatus as TaskStatus],
    waktuWib: `${wibFormatter.format(log.createdAt)} WIB`,
  }));
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
          { role: 'system', content: AI_SUMMARY_INSTRUCTIONS },
          { role: 'user', content: JSON.stringify({ task: { title: task.title, currentStatus: STATUS_LABELS[task.status as TaskStatus] }, transitionCount: facts.transitionCount, events }) },
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
