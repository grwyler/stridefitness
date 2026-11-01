import { registerClient, noStore } from '@/lib/mcp-oauth';

export async function POST(request: Request) {
  try {
    if (Number(request.headers.get('content-length') || 0) > 16384) return noStore({ error: 'invalid_client_metadata' }, 413);
    const body = await request.json();
    const client = await registerClient(body);
    if (!client) return noStore({ error: 'invalid_client_metadata' }, 400);
    return noStore(client, 201);
  } catch {
    return noStore({ error: 'invalid_client_metadata' }, 400);
  }
}
