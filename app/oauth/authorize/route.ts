import { getChatGPTUser, chatGPTSignInPath } from '@/app/chatgpt-auth';
import { accountScope } from '@/lib/account-scope';
import { issueAuthorizationCode, parseAuthorizationRequest, publicBase } from '@/lib/mcp-oauth';

const html = (value: string) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
function page(content: string, status = 200, formRedirectOrigin?: string) {
  const formAction = formRedirectOrigin ? `'self' ${formRedirectOrigin}` : "'self'";
  return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Connect Stride to ChatGPT</title><body style="font:16px system-ui;max-width:38rem;margin:12vh auto;padding:1rem;color:#18231d"><main>${content}</main></body></html>`, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Security-Policy': `default-src 'none'; style-src 'unsafe-inline'; form-action ${formAction}; base-uri 'none'; frame-ancestors 'none'`, 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' } });
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
    const granted = new Set(parsed.scope.split(/\s+/)), read = granted.has('fitness:read'), write = granted.has('fitness:write');
    const permissions = [read ? 'Read workouts, activities, nutrition logs, measurements, goals, profile, and workout plans.' : '', write ? 'Update your profile and nutrition targets, create or manage fitness goals, and create or edit workout plans.' : ''].filter(Boolean).join(' ');
    const authorizationLabel = read && write ? 'Authorize read and write access' : write ? 'Authorize write access' : 'Authorize read access';
    return page(`<h1>Connect Stride to ChatGPT?</h1><p><strong>${html(user.displayName || 'Your Stride account')}</strong></p><p>ChatGPT can ${html(permissions)}</p><p>You can revoke access in Stride. Deleting goals requires an explicit confirmation argument in the request.</p><form method="post" action="/oauth/authorize">${hidden}<button style="padding:.7rem 1rem;margin-right:.5rem">${authorizationLabel}</button><a href="/">Cancel</a></form>`, 200, new URL(parsed.redirectUri).origin);
  } catch { return errorPage(); }
}
export async function POST(request: Request) {
  try {
    const origin = request.headers.get('origin');
    const fetchSite = request.headers.get('sec-fetch-site');
    const exactOrigin = origin === new URL(request.url).origin;
    // ChatGPT's sandboxed connector form can serialize its opaque origin as
    // "null". Accept that only when browser Fetch Metadata says the POST is
    // same-origin; cross-site submissions and missing/ambiguous metadata stay
    // blocked. OAuth state, registered redirect URI, and authenticated session
    // are still validated below.
    const trustedOpaqueOrigin = origin === 'null' && fetchSite === 'same-origin';
    if ((!exactOrigin && !trustedOpaqueOrigin) || fetchSite === 'cross-site') return page('<h1>Authorization request rejected</h1><p>Return to ChatGPT and retry the connection.</p>', 403);
    const user = await getChatGPTUser(request);
    if (!user) return page('<h1>Sign in required</h1><p>Please sign in to Stride and retry the ChatGPT connection.</p>', 401);
    const form = await request.formData(), params = new URLSearchParams();
    for (const [key, value] of form.entries()) if (typeof value === 'string') params.append(key, value);
    const parsed = await parseAuthorizationRequest(new URL(`/oauth/authorize?${params}`, publicBase()));
    if (!parsed) return errorPage();
    const accountId = (await accountScope(user,request)).id;
    const code = await issueAuthorizationCode({ ...parsed, accountId });
    const callback = new URL(parsed.redirectUri);
    callback.searchParams.set('code', code); callback.searchParams.set('state', parsed.state); callback.searchParams.set('iss', publicBase());
    // The consent page submits by POST. 303 makes the client callback a GET
    // unambiguously, which is required for reliable OAuth authorization-code
    // handoff from embedded/sandboxed browsers.
    return Response.redirect(callback, 303);
  } catch { return errorPage(); }
}
