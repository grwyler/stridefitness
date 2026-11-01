import { revokeOAuthToken, noStore } from '@/lib/mcp-oauth';

export async function POST(request: Request) {
  try {
    const form = await request.formData(), token = String(form.get('token') || '');
    if (token.length > 512) return noStore({ error: 'invalid_request' }, 400);
    if (token) await revokeOAuthToken(token);
    return new Response(null, { status: 200, headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' } });
  } catch { return noStore({ error: 'invalid_request' }, 400); }
}
