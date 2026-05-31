export const maxDuration = 300;

import { waitUntil } from '@vercel/functions';
import { query } from '@/lib/db';
import { getSession } from '@/lib/session';
import { buildLLMConfig } from '@/lib/llm';
import { processImport } from '@/lib/processImport';
import { jsonResponse } from '@/lib/api';

export async function GET(): Promise<Response> {
  const user = await getSession();
  if (user === null) return jsonResponse({ error: 'Unauthorized' }, 401);

  const result = await query<{ id: number; title: string }>(
    'SELECT id, title FROM texts WHERE user_id = $1 ORDER BY id DESC',
    [user.id],
  );

  return jsonResponse({ texts: result.rows });
}

export async function POST(request: Request): Promise<Response> {
  const user = await getSession();
  if (user === null) return jsonResponse({ error: 'Unauthorized' }, 401);

  const body = await request.json() as {
    title?: string;
    content?: string;
  };

  if (!body.title?.trim()) {
    return jsonResponse({ error: 'Title is required' }, 400);
  }

  const content = body.content ?? '';

  if (content.length > 500_000) {
    return jsonResponse({ error: 'Content must be 500 KB or less' }, 413);
  }

  const llmConfig = buildLLMConfig(user);

  const textResult = await query<{ id: number }>(
    `INSERT INTO texts (user_id, title, raw_content, parsed_content, import_status)
     VALUES ($1, $2, $3, '[]'::jsonb, 'pending') RETURNING id`,
    [user.id, body.title.trim(), content],
  );
  const textId = textResult.rows[0].id;

  // waitUntil keeps the serverless function alive after the response is sent
  waitUntil(processImport(textId, user.id, content, llmConfig, user.use_llm_parsing));

  return jsonResponse({ id: textId }, 202);
}
