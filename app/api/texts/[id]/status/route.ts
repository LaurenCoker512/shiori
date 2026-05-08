import { query } from '@/lib/db';
import { getSession } from '@/lib/session';

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

interface StatusRow {
  import_status: string;
  import_error: string | null;
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  const user = await getSession();
  if (user === null) return json({ error: 'Unauthorized' }, 401);

  const id = parseInt(params.id, 10);
  if (isNaN(id)) return json({ error: 'Invalid id' }, 400);

  const result = await query<StatusRow>(
    'SELECT import_status, import_error FROM texts WHERE id = $1 AND user_id = $2',
    [id, user.id],
  );

  if (result.rows.length === 0) return json({ error: 'Not found' }, 404);

  const { import_status, import_error } = result.rows[0];
  return json({
    status: import_status,
    ...(import_error !== null ? { error: import_error } : {}),
  });
}
