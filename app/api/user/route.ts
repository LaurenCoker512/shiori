import { query } from '@/lib/db';
import { getSession } from '@/lib/session';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function PATCH(request: Request): Promise<Response> {
  const user = await getSession();
  if (user === null) return json({ error: 'Unauthorized' }, 401);

  const body = await request.json() as { name?: unknown };

  if (typeof body.name !== 'string' || body.name.trim() === '') {
    return json({ error: 'Name is required' }, 400);
  }

  await query(
    'UPDATE users SET name = $1 WHERE id = $2',
    [body.name.trim(), user.id],
  );

  return json({ ok: true, name: body.name.trim() });
}
