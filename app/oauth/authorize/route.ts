import { getChatGPTUser, chatGPTSignInPath } from '@/app/chatgpt-auth';
import { accountDataId } from '@/lib/admin-activity';
import { issueAuthorizationCode, parseAuthorizationRequest, publicBase } from '@/lib/mcp-oauth';

const html = (value: string) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
function page(content: string, status = 200) {
  return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Connect Stride to ChatGPT</title><body style="font:16px system-ui;max-width:38rem;margin:12vh auto;padding:1rem;color:#18231d"><main>${content}</main></body></html>`, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'", 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' } });
}
function errorPage() { return page('<h1>Unable to connect</h1><p>The authorization request is invalid or expired. Return to ChatGPT and try connecting again.</p>', 400); }
export async function GET(request: Request) {
  try {
    const current = new URL(request.url), parsed = await parseAuthorizationRequest(current);
    if (!parsed) return errorPage();
    const user = await getChatGPTUser(request);
    if (!user) {
      const returnTo = `${current.pathname}${current.search}`;
      return Response.redirect(new URL(chatGPTSignInPath(returnTo), publicBase()), 302);
    }
    const hidden = [...current.searchParams.entries()].map(([key, value]) => `<input type="hidden" name="${html(key)}" value="${html(value)}">`).join('');
    return page(`<h1>Connect Stride to ChatGPT?</h1><p><strong>${html(user.displayName || 'Your Stride account')}</strong></p><p>ChatGPT will be able to read your Stride workouts, exercise history, activities, nutrition logs, body measurements, and fitness goals. This connection cannot change your Stride data.</p><form method="post" action="/oauth/authorize">${hidden}<button style="padding:.7rem 1rem;margin-right:.5rem">Authorize read access</button><a href="/">Cancel</a></form>`);
  } catch { return errorPage(); }
}
export async function POST(request: Request) {
  try {
    if (request.headers.get('origin') !== new URL(request.url).origin || request.headers.get('sec-fetch-site') === 'cross-site') return page('<h1>Authorization request rejected</h1><p>Return to ChatGPT and retry the connection.</p>', 403);
    const user = await getChatGPTUser(request);
    if (!user) return page('<h1>Sign in required</h1><p>Please sign in to Stride and retry the ChatGPT connection.</p>', 401);
    const form = await request.formData(), params = new URLSearchParams();
    for (const [key, value] of form.entries()) if (typeof value === 'string') params.append(key, value);
    const parsed = await parseAuthorizationRequest(new URL(`/oauth/authorize?${params}`, publicBase()));
    if (!parsed) return errorPage();
    const accountId = await accountDataId(user);
    const code = await issueAuthorizationCode({ ...parsed, accountId });
    const callback = new URL(parsed.redirectUri);
    callback.searchParams.set('code', code); callback.searchParams.set('state', parsed.state); callback.searchParams.set('iss', publicBase());
    return Response.redirect(callback, 302);
  } catch { return errorPage(); }
}
