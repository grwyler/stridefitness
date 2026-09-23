import { env } from "cloudflare:workers";
import { createStrideSessionCookie, getGuestSessionUser } from "@/app/chatgpt-auth";
import { ensureIdentityTables, resolvePermanentIdentity } from "@/lib/auth-identities";

async function hash(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function emailFailure(request: Request, state: string) {
  return Response.redirect(new URL(`/?auth=${state}`, request.url), 303);
}

async function signedInResponse(request: Request, email: string, fullName: string | null, json = false) {
  const guest = await getGuestSessionUser(request.headers.get("cookie"));
  const guestAccountId = guest?.accountType === "guest" && guest.accountId?.startsWith("guest:") ? guest.accountId : null;
  const resolved = await resolvePermanentIdentity({ provider: "email", subject: email, email, fullName, guestAccountId });
  if ("conflict" in resolved) {
    return json
      ? Response.json({ error: "That email already has a Stride account. Sign in with its existing method; your guest progress is still available on this device." }, { status: 409 })
      : emailFailure(request, "account-exists");
  }

  const responseHeaders = new Headers({
    Location: new URL("/", request.url).toString(),
    "Cache-Control": "no-store",
  });
  responseHeaders.append("Set-Cookie", await createStrideSessionCookie({ ...resolved, userId: `email:${email}`, displayName: email }));
  responseHeaders.append("Set-Cookie", "stride_create_account=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0");
  responseHeaders.append("Set-Cookie", "stride_signin=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0");
  if (json) return Response.json({ ok: true }, { headers: responseHeaders });
  return new Response(null, { status: 303, headers: responseHeaders });
}

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return Response.json({ error: "Use Stride to continue." }, { status: 403 });
  }
  const payload = await request.json().catch(() => null) as { email?: unknown; code?: unknown } | null;
  const email = typeof payload?.email === "string" ? payload.email.trim().toLowerCase() : "";
  const code = typeof payload?.code === "string" ? payload.code.trim() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || !/^\d{6}$/.test(code)) {
    return Response.json({ error: "Enter the email address and 6-digit code from your message." }, { status: 400 });
  }

  try {
    const config = env as unknown as { DB?: D1Database };
    if (!config.DB) throw new Error("Database unavailable");
    await ensureIdentityTables();
    const challenge = await config.DB.prepare(
      "SELECT token_hash, expires_at, consumed_at FROM email_login_challenges WHERE email=? ORDER BY requested_at DESC LIMIT 1",
    ).bind(email).first<{ token_hash: string; expires_at: string; consumed_at: string | null }>();
    if (!challenge || challenge.consumed_at || Date.parse(challenge.expires_at) <= Date.now()) {
      return Response.json({ error: "That code is invalid or expired. Request a new one." }, { status: 400 });
    }

    const attempt = await config.DB.prepare(
      "INSERT INTO email_login_challenge_attempts (challenge_hash,attempt_count) VALUES (?,1) ON CONFLICT(challenge_hash) DO UPDATE SET attempt_count=attempt_count+1 RETURNING attempt_count",
    ).bind(challenge.token_hash).first<{ attempt_count: number }>();
    if (!attempt || attempt.attempt_count > 5) {
      return Response.json({ error: "Too many attempts. Request a new code." }, { status: 429 });
    }
    if (await hash(code) !== challenge.token_hash) {
      return Response.json({ error: "That code is incorrect. Check your email and try again." }, { status: 400 });
    }

    const claimed = await config.DB.prepare(
      "UPDATE email_login_challenges SET consumed_at=? WHERE token_hash=? AND consumed_at IS NULL",
    ).bind(new Date().toISOString(), challenge.token_hash).run();
    if (!claimed.meta.changes) return Response.json({ error: "That code has already been used." }, { status: 409 });
    return await signedInResponse(request, email, null, true);
  } catch {
    return Response.json({ error: "Email sign-in could not be completed. Please try again." }, { status: 503 });
  }
}

// Keep previously sent magic links valid during the transition to email codes.
export async function GET(request: Request) {
  try {
    const token = new URL(request.url).searchParams.get("token") || "";
    if (token.length < 50) return emailFailure(request, "email-invalid");
    const config = env as unknown as { DB?: D1Database };
    if (!config.DB) throw new Error("Database unavailable");
    await ensureIdentityTables();
    const tokenHash = await hash(token);
    const row = await config.DB.prepare(
      "SELECT email,expires_at,consumed_at FROM email_login_challenges WHERE token_hash=?",
    ).bind(tokenHash).first<{ email: string; expires_at: string; consumed_at: string | null }>();
    if (!row || row.consumed_at || Date.parse(row.expires_at) <= Date.now()) return emailFailure(request, "email-invalid");
    const claimed = await config.DB.prepare(
      "UPDATE email_login_challenges SET consumed_at=? WHERE token_hash=? AND consumed_at IS NULL",
    ).bind(new Date().toISOString(), tokenHash).run();
    if (!claimed.meta.changes) return emailFailure(request, "email-invalid");
    return await signedInResponse(request, row.email, null);
  } catch {
    return emailFailure(request, "email-failed");
  }
}
