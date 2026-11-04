import { env } from 'cloudflare:workers';

type Db = D1Database;
type Client = { client_id: string; redirect_uris: string[]; client_name?: string; token_endpoint_auth_method?: string };
const ACCESS_TTL = 60 * 60;
const REFRESH_TTL = 60 * 60 * 24 * 30;
const READ_SCOPE = 'fitness:read';
const WRITE_SCOPE = 'fitness:write';

function db(): Db {
  const value = (env as unknown as { DB?: Db }).DB;
  if (!value) throw new Error('MCP authorization storage is unavailable.');
  return value;
}
export function publicBase() {
  const configured = (env as unknown as { MCP_PUBLIC_BASE_URL?: string }).MCP_PUBLIC_BASE_URL;
  const value = configured || 'https://stridefitness.app';
  const url = new URL(value);
  if (url.protocol !== 'https:' && url.hostname !== 'localhost') throw new Error('MCP_PUBLIC_BASE_URL must use HTTPS.');
  return url.origin;
}
export const resourceUrl = () => `${publicBase()}/api/mcp`;
export const authorizationIssuer = () => publicBase();
export const metadataUrl = () => `${publicBase()}/.well-known/oauth-protected-resource/api/mcp`;
export function noStore(body: unknown, status = 200, headers: HeadersInit = {}) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache', ...headers } });
}
export function oauthError(error: string, description: string, status = 400) {
  return noStore({ error, error_description: description }, status);
}
function b64(bytes: Uint8Array) {
  let raw = ''; for (const byte of bytes) raw += String.fromCharCode(byte);
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
export async function digest(value: string) {
  return b64(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))));
}
function randomToken() { return b64(crypto.getRandomValues(new Uint8Array(32))); }

export async function ensureOAuthTables() {
  const database = db();
  await database.batch([
    database.prepare(`CREATE TABLE IF NOT EXISTS mcp_oauth_clients (client_id TEXT PRIMARY KEY, redirect_uris TEXT NOT NULL, client_name TEXT, created_at TEXT NOT NULL)`),
    database.prepare(`CREATE TABLE IF NOT EXISTS mcp_oauth_codes (code_hash TEXT PRIMARY KEY, client_id TEXT NOT NULL, redirect_uri TEXT NOT NULL, account_id TEXT NOT NULL, scope TEXT NOT NULL, code_challenge TEXT NOT NULL, expires_at INTEGER NOT NULL)`),
    database.prepare(`CREATE TABLE IF NOT EXISTS mcp_oauth_grants (id TEXT PRIMARY KEY, client_id TEXT NOT NULL, account_id TEXT NOT NULL, scope TEXT NOT NULL, created_at INTEGER NOT NULL, revoked_at INTEGER)`),
    database.prepare(`CREATE TABLE IF NOT EXISTS mcp_oauth_tokens (token_hash TEXT PRIMARY KEY, grant_id TEXT NOT NULL, token_type TEXT NOT NULL, expires_at INTEGER NOT NULL, consumed_at INTEGER)`),
    database.prepare(`CREATE INDEX IF NOT EXISTS idx_mcp_oauth_tokens_grant ON mcp_oauth_tokens(grant_id)`),
    database.prepare(`CREATE TABLE IF NOT EXISTS mcp_oauth_rate_limits (grant_id TEXT NOT NULL, window_start INTEGER NOT NULL, request_count INTEGER NOT NULL, PRIMARY KEY (grant_id, window_start))`),
  ]);
  return database;
}

export function validRedirect(uri: string) {
  try {
    const value = new URL(uri);
    return value.protocol === 'https:' || (['http:', 'http:'].includes(value.protocol) && ['localhost', '127.0.0.1', '[::1]'].includes(value.hostname));
  } catch { return false; }
}
export function validResource(value: string | null) { return value === resourceUrl(); }
export async function oauthClient(clientId: string): Promise<Client | null> {
  const database = await ensureOAuthTables();
  const saved = await database.prepare('SELECT redirect_uris, client_name FROM mcp_oauth_clients WHERE client_id=?').bind(clientId).first<{ redirect_uris: string; client_name: string | null }>();
  if (saved) {
    try { return { client_id: clientId, redirect_uris: JSON.parse(saved.redirect_uris), client_name: saved.client_name || undefined, token_endpoint_auth_method: 'none' }; } catch { return null; }
  }
  let url: URL;
  try { url = new URL(clientId); } catch { return null; }
  if (url.protocol !== 'https:' || url.username || url.password) return null;
  try {
    const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(5000), redirect: 'error' });
    if (!response.ok || Number(response.headers.get('content-length') || 0) > 65536) return null;
    const text = await response.text(); if (text.length > 65536) return null;
    const doc = JSON.parse(text) as Client;
    if (!Array.isArray(doc.redirect_uris) || !doc.redirect_uris.length || !doc.redirect_uris.every((item) => typeof item === 'string' && validRedirect(item))) return null;
    if (doc.client_id && doc.client_id !== clientId) return null;
    if (doc.token_endpoint_auth_method && doc.token_endpoint_auth_method !== 'none') return null;
    return { ...doc, client_id: clientId, token_endpoint_auth_method: 'none' };
  } catch { return null; }
}
export async function registerClient(input: unknown) {
  if (!input || typeof input !== 'object') return null;
  const body = input as { redirect_uris?: unknown; client_name?: unknown; token_endpoint_auth_method?: unknown; grant_types?: unknown; response_types?: unknown };
  if (!Array.isArray(body.redirect_uris) || !body.redirect_uris.length || body.redirect_uris.length > 10 || !body.redirect_uris.every((uri) => typeof uri === 'string' && validRedirect(uri))) return null;
  if (body.token_endpoint_auth_method && body.token_endpoint_auth_method !== 'none') return null;
  if (body.grant_types && (!Array.isArray(body.grant_types) || !body.grant_types.includes('authorization_code') || body.grant_types.some((grant) => !['authorization_code', 'refresh_token'].includes(String(grant))))) return null;
  if (body.response_types && (!Array.isArray(body.response_types) || !body.response_types.includes('code') || body.response_types.some((type) => type !== 'code'))) return null;
  const clientId = `stride-${randomToken()}`;
  const database = await ensureOAuthTables();
  await database.prepare('INSERT INTO mcp_oauth_clients (client_id, redirect_uris, client_name, created_at) VALUES (?,?,?,?)').bind(clientId, JSON.stringify(body.redirect_uris), typeof body.client_name === 'string' ? body.client_name.slice(0, 100) : null, new Date().toISOString()).run();
  return { client_id: clientId, client_id_issued_at: Math.floor(Date.now() / 1000), redirect_uris: body.redirect_uris, token_endpoint_auth_method: 'none', grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'], client_name: typeof body.client_name === 'string' ? body.client_name.slice(0, 100) : 'MCP client' };
}

export type AuthorizationRequest = { clientId: string; redirectUri: string; state: string; challenge: string; resource: string; scope: string };
export async function parseAuthorizationRequest(url: URL): Promise<AuthorizationRequest | null> {
  const p = url.searchParams;
  const clientId = p.get('client_id') || '', redirectUri = p.get('redirect_uri') || '', state = p.get('state') || '', challenge = p.get('code_challenge') || '', resource = p.get('resource') || '', scope = p.has('scope') ? (p.get('scope') || '') : READ_SCOPE;
  const requestedScopes = [...new Set(scope.split(/\s+/).filter(Boolean))].sort();
  // Read and write are independent capabilities. A write-only authorization is
  // valid; tools that read data still require fitness:read at request time.
  if (p.get('response_type') !== 'code' || p.get('code_challenge_method') !== 'S256' || !/^[A-Za-z0-9_-]{43,128}$/.test(challenge) || !state || state.length > 2048 || !validResource(resource) || requestedScopes.length === 0 || requestedScopes.some((item) => item !== READ_SCOPE && item !== WRITE_SCOPE)) return null;
  const client = await oauthClient(clientId);
  if (!client || !client.redirect_uris.includes(redirectUri)) return null;
  return { clientId, redirectUri, state, challenge, resource, scope: requestedScopes.join(' ') };
}
export async function issueAuthorizationCode(input: AuthorizationRequest & { accountId: string }) {
  const code = randomToken(), database = await ensureOAuthTables();
  await database.prepare('INSERT INTO mcp_oauth_codes (code_hash,client_id,redirect_uri,account_id,scope,code_challenge,expires_at) VALUES (?,?,?,?,?,?,?)').bind(await digest(code), input.clientId, input.redirectUri, input.accountId, input.scope, input.challenge, Math.floor(Date.now() / 1000) + 300).run();
  return code;
}
export async function exchangeAuthorizationCode(code: string, clientId: string, redirectUri: string, verifier: string, resource: string) {
  if (!validResource(resource) || !/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) return null;
  const database = await ensureOAuthTables(), hash = await digest(code);
  const row = await database.prepare('SELECT * FROM mcp_oauth_codes WHERE code_hash=?').bind(hash).first<{ client_id: string; redirect_uri: string; account_id: string; scope: string; code_challenge: string; expires_at: number }>();
  if (!row || row.client_id !== clientId || row.redirect_uri !== redirectUri || row.expires_at <= Math.floor(Date.now() / 1000) || await digest(verifier) !== row.code_challenge) return null;
  const removed = await database.prepare('DELETE FROM mcp_oauth_codes WHERE code_hash=? AND expires_at>?').bind(hash, Math.floor(Date.now() / 1000)).run();
  if (!removed.meta.changes) return null;
  const grantId = crypto.randomUUID(), now = Math.floor(Date.now() / 1000), access = randomToken(), refresh = randomToken();
  await database.batch([
    database.prepare('INSERT INTO mcp_oauth_grants (id,client_id,account_id,scope,created_at,revoked_at) VALUES (?,?,?,?,?,NULL)').bind(grantId, clientId, row.account_id, row.scope, now),
    database.prepare('INSERT INTO mcp_oauth_tokens (token_hash,grant_id,token_type,expires_at,consumed_at) VALUES (?,?,?,?,NULL)').bind(await digest(access), grantId, 'access', now + ACCESS_TTL),
    database.prepare('INSERT INTO mcp_oauth_tokens (token_hash,grant_id,token_type,expires_at,consumed_at) VALUES (?,?,?,?,NULL)').bind(await digest(refresh), grantId, 'refresh', now + REFRESH_TTL),
  ]);
  return { access_token: access, token_type: 'Bearer', expires_in: ACCESS_TTL, refresh_token: refresh, scope: row.scope };
}
export async function refreshOAuthToken(refreshToken: string, clientId: string, resource: string) {
  if (!validResource(resource)) return null;
  const database = await ensureOAuthTables(), hash = await digest(refreshToken);
  const row = await database.prepare(`SELECT t.grant_id,t.expires_at,g.client_id,g.scope,g.revoked_at FROM mcp_oauth_tokens t JOIN mcp_oauth_grants g ON g.id=t.grant_id WHERE t.token_hash=? AND t.token_type='refresh' AND t.consumed_at IS NULL`).bind(hash).first<{ grant_id: string; expires_at: number; client_id: string; scope: string; revoked_at: number | null }>();
  const now = Math.floor(Date.now() / 1000);
  if (!row) {
    const reused = await database.prepare("SELECT grant_id FROM mcp_oauth_tokens WHERE token_hash=? AND token_type='refresh' AND consumed_at IS NOT NULL").bind(hash).first<{ grant_id: string }>();
    if (reused) await database.prepare('UPDATE mcp_oauth_grants SET revoked_at=? WHERE id=? AND revoked_at IS NULL').bind(now, reused.grant_id).run();
    return null;
  }
  if (row.client_id !== clientId || row.revoked_at || row.expires_at <= now) return null;
  const consumed = await database.prepare('UPDATE mcp_oauth_tokens SET consumed_at=? WHERE token_hash=? AND consumed_at IS NULL').bind(Math.floor(Date.now() / 1000), hash).run();
  if (!consumed.meta.changes) return null;
  const issuedAt = Math.floor(Date.now() / 1000), access = randomToken(), refresh = randomToken();
  await database.batch([
    database.prepare('INSERT INTO mcp_oauth_tokens (token_hash,grant_id,token_type,expires_at,consumed_at) VALUES (?,?,?,?,NULL)').bind(await digest(access), row.grant_id, 'access', issuedAt + ACCESS_TTL),
    database.prepare('INSERT INTO mcp_oauth_tokens (token_hash,grant_id,token_type,expires_at,consumed_at) VALUES (?,?,?,?,NULL)').bind(await digest(refresh), row.grant_id, 'refresh', issuedAt + REFRESH_TTL),
  ]);
  return { access_token: access, token_type: 'Bearer', expires_in: ACCESS_TTL, refresh_token: refresh, scope: row.scope };
}
export async function revokeOAuthToken(token: string) {
  const database = await ensureOAuthTables(), hash = await digest(token), now = Math.floor(Date.now() / 1000);
  const row = await database.prepare('SELECT grant_id FROM mcp_oauth_tokens WHERE token_hash=?').bind(hash).first<{ grant_id: string }>();
  if (row) await database.batch([
    database.prepare('UPDATE mcp_oauth_grants SET revoked_at=? WHERE id=? AND revoked_at IS NULL').bind(now, row.grant_id),
    database.prepare('UPDATE mcp_oauth_tokens SET consumed_at=? WHERE grant_id=? AND consumed_at IS NULL').bind(now, row.grant_id),
  ]);
}
export async function authenticateAccessToken(request: Request) {
  const token = request.headers.get('authorization')?.match(/^Bearer\s+([A-Za-z0-9_-]{40,})$/i)?.[1];
  if (!token) return null;
  const database = await ensureOAuthTables(), now = Math.floor(Date.now() / 1000);
  return database.prepare(`SELECT g.id AS grant_id,g.account_id,g.scope FROM mcp_oauth_tokens t JOIN mcp_oauth_grants g ON g.id=t.grant_id WHERE t.token_hash=? AND t.token_type='access' AND t.expires_at>? AND t.consumed_at IS NULL AND g.revoked_at IS NULL`).bind(await digest(token), now).first<{ grant_id: string; account_id: string; scope: string }>();
}
export async function consumeMcpRateLimit(grantId: string) {
  const database = await ensureOAuthTables(), now = Math.floor(Date.now() / 1000), windowStart = Math.floor(now / 60) * 60;
  const row = await database.prepare('INSERT INTO mcp_oauth_rate_limits (grant_id,window_start,request_count) VALUES (?,?,1) ON CONFLICT(grant_id,window_start) DO UPDATE SET request_count=request_count+1 RETURNING request_count').bind(grantId, windowStart).first<{ request_count: number }>();
  return (row?.request_count || 0) <= 60;
}
