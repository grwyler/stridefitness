import { exchangeAuthorizationCode, oauthError, refreshOAuthToken } from '@/lib/mcp-oauth';

export async function POST(request: Request) {
  try {
    const form = await request.formData(), grantType = String(form.get('grant_type') || ''), clientId = String(form.get('client_id') || ''), resource = String(form.get('resource') || '');
    if (form.get('client_secret')) return oauthError('invalid_client', 'Public clients must not send a client secret.', 401);
    if (grantType === 'authorization_code') {
      const result = await exchangeAuthorizationCode(String(form.get('code') || ''), clientId, String(form.get('redirect_uri') || ''), String(form.get('code_verifier') || ''), resource);
      return result ? Response.json(result, { headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' } }) : oauthError('invalid_grant', 'Authorization code is invalid, expired, or already used.');
    }
    if (grantType === 'refresh_token') {
      const result = await refreshOAuthToken(String(form.get('refresh_token') || ''), clientId, resource);
      return result ? Response.json(result, { headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' } }) : oauthError('invalid_grant', 'Refresh token is invalid, expired, revoked, or already used.');
    }
    return oauthError('unsupported_grant_type', 'Use authorization_code or refresh_token.');
  } catch { return oauthError('invalid_request', 'Malformed token request.'); }
}
