import { query } from '@/lib/db';
import { getSession } from '@/lib/session';

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function POST(request: Request): Promise<Response> {
  const user = await getSession();
  if (user === null) return jsonResponse({ error: 'Unauthorized' }, 401);

  const body = await request.json() as { word_id?: unknown; surface_form?: unknown; corrected_reading?: unknown };
  const { word_id, surface_form, corrected_reading } = body;

  if (typeof word_id !== 'number' || typeof surface_form !== 'string' || typeof corrected_reading !== 'string') {
    return jsonResponse({ error: 'Invalid params' }, 400);
  }

  await query(
    `INSERT INTO furigana_overrides (user_id, word_id, surface_form, corrected_reading)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, word_id, surface_form) DO UPDATE SET corrected_reading = EXCLUDED.corrected_reading`,
    [user.id, word_id, surface_form, corrected_reading],
  );

  return jsonResponse({ ok: true });
}
