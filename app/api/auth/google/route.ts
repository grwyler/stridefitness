import { env } from "cloudflare:workers";
import { createGoogleSessionCookie } from "@/app/chatgpt-auth";

type GoogleTokenInfo = { aud?: string; email?: string; email_verified?: string | boolean; name?: string; sub?: string };

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "Use Stride to sign in." }, { status: 403 });
  const credential = (await request.json().catch(() => null) as { credential?: unknown } | null)?.credential;
  if (typeof credential !== "string" || credential.length > 12000) return Response.json({ error: "Invalid Google sign-in response." }, { status: 400 });
  const clientId = (env as unknown as { GOOGLE_CLIENT_ID?: string }).GOOGLE_CLIENT_ID;
  if (!clientId) return Response.json({ error: "Google sign-in is unavailable." }, { status: 503 });
  try {
    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) return Response.json({ error: "Google could not verify this sign-in." }, { status: 401 });
    const token = await response.json() as GoogleTokenInfo;
    if (token.aud !== clientId || !token.sub || !token.email || token.email_verified !== true && token.email_verified !== "true") return Response.json({ error: "Google account verification failed." }, { status: 401 });
    return Response.json({ ok: true }, { headers: { "Set-Cookie": await createGoogleSessionCookie({ subject: token.sub, email: token.email.toLowerCase(), fullName: typeof token.name === "string" ? token.name : null }), "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Google sign-in is temporarily unavailable." }, { status: 503 });
  }
}
