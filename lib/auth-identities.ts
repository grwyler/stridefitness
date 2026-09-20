import { env } from "cloudflare:workers";

export type AccountType = "google" | "email" | "guest" | "chatgpt" | "test";
export type Identity = { accountId: string; accountType: AccountType; email: string; fullName: string | null };

function db() { const value = (env as unknown as { DB?: D1Database }).DB; if (!value) throw new Error("Database unavailable"); return value; }
export async function legacyAccountId(email: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(email.trim().toLowerCase()));
  return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, "0")).join("");
}
export async function ensureIdentityTables() {
  const database = db();
  await database.batch([
    database.prepare("CREATE TABLE IF NOT EXISTS stride_users (id TEXT PRIMARY KEY, account_type TEXT NOT NULL, created_at TEXT NOT NULL, last_active_at TEXT NOT NULL, converted_at TEXT)"),
    database.prepare("CREATE TABLE IF NOT EXISTS auth_identities (provider TEXT NOT NULL, provider_subject TEXT NOT NULL, user_id TEXT NOT NULL, email TEXT, display_name TEXT, created_at TEXT NOT NULL, last_used_at TEXT NOT NULL, PRIMARY KEY(provider, provider_subject), UNIQUE(provider, email))"),
    database.prepare("CREATE TABLE IF NOT EXISTS email_login_challenges (token_hash TEXT PRIMARY KEY, email TEXT NOT NULL, expires_at TEXT NOT NULL, consumed_at TEXT, requested_at TEXT NOT NULL)"),
    database.prepare("CREATE INDEX IF NOT EXISTS idx_auth_identities_user ON auth_identities(user_id)"),
  ]);
}
export async function resolvePermanentIdentity(input: { provider: "google" | "email" | "chatgpt"; subject: string; email: string; fullName: string | null; guestAccountId?: string | null }) : Promise<Identity | { conflict: true }> {
  await ensureIdentityTables(); const database = db(), now = new Date().toISOString(), email = input.email.trim().toLowerCase();
  const found = await database.prepare("SELECT user_id FROM auth_identities WHERE provider=? AND provider_subject=?").bind(input.provider, input.subject).first<{ user_id: string }>();
  const emailFound = await database.prepare("SELECT user_id FROM auth_identities WHERE email=?").bind(email).first<{ user_id: string }>();
  if (input.guestAccountId && (found?.user_id || emailFound?.user_id) && (found?.user_id || emailFound?.user_id) !== input.guestAccountId) return { conflict: true };
  const accountId = found?.user_id || emailFound?.user_id || input.guestAccountId || await legacyAccountId(email);
  await database.batch([
    database.prepare("INSERT OR IGNORE INTO stride_users (id,account_type,created_at,last_active_at,converted_at) VALUES (?,?,?,?,?)").bind(accountId, input.guestAccountId ? "guest" : input.provider, now, now, input.guestAccountId ? now : null),
    database.prepare("INSERT INTO auth_identities (provider,provider_subject,user_id,email,display_name,created_at,last_used_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(provider,provider_subject) DO UPDATE SET last_used_at=excluded.last_used_at, email=excluded.email, display_name=excluded.display_name").bind(input.provider, input.subject, accountId, email, input.fullName, now, now),
    database.prepare("UPDATE stride_users SET account_type=?,last_active_at=?,converted_at=CASE WHEN account_type='guest' THEN ? ELSE converted_at END WHERE id=?").bind(input.provider, now, now, accountId),
  ]);
  return { accountId, accountType: input.provider, email, fullName: input.fullName };
}
export async function createGuestIdentity() : Promise<Identity> {
  await ensureIdentityTables(); const accountId = `guest:${crypto.randomUUID()}`, now = new Date().toISOString();
  await db().prepare("INSERT INTO stride_users (id,account_type,created_at,last_active_at) VALUES (?,?,?,?)").bind(accountId,"guest",now,now).run();
  return { accountId, accountType: "guest", email: "", fullName: null };
}
export async function touchIdentity(accountId: string) { try { await ensureIdentityTables(); await db().prepare("UPDATE stride_users SET last_active_at=? WHERE id=?").bind(new Date().toISOString(),accountId).run(); } catch {} }
