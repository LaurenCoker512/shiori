import { deleteSession } from '@/lib/session';

export async function POST(): Promise<Response> {
  await deleteSession();
  return new Response(null, { status: 302, headers: { Location: '/login' } });
}
