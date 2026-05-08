import { query } from '@/lib/db';
import { getSession } from '@/lib/session';
import { buildLLMConfig } from '@/lib/claude';
import { processImport } from '@/lib/processImport';

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function POST(request: Request): Promise<Response> {
  const user = await getSession();
  if (user === null) return jsonResponse({ error: 'Unauthorized' }, 401);

  const llmConfig = buildLLMConfig(user);
  if (llmConfig === null) {
    return jsonResponse({ error: 'API key not configured. Add your key in Settings.' }, 403);
  }

  const body = await request.json() as {
    title?: string;
    content?: string;
  };

  if (!body.title?.trim()) {
    return jsonResponse({ error: 'Title is required' }, 400);
  }

  const content = body.content ?? '';

  const textResult = await query<{ id: number }>(
    `INSERT INTO texts (user_id, title, raw_content, parsed_content, import_status)
     VALUES ($1, $2, $3, '[]'::jsonb, 'pending') RETURNING id`,
    [user.id, body.title.trim(), content],
  );
  const textId = textResult.rows[0].id;

  // Fire-and-forget — tokenization continues after this response returns
  void processImport(textId, user.id, content, llmConfig);

  return jsonResponse({ id: textId }, 202);
}
