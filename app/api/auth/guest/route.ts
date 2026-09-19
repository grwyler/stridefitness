import { createGuestIdentity } from "@/lib/auth-identities";
import { createStrideSessionCookie } from "@/app/chatgpt-auth";
export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "Use Stride to continue." }, { status: 403 });
  try { const guest = await createGuestIdentity(); return Response.json({ ok: true }, { status: 201, headers: { "Set-Cookie": await createStrideSessionCookie({ ...guest, userId: guest.accountId, displayName: "Guest" }), "Cache-Control": "no-store" } }); }
  catch { return Response.json({ error: "Guest access is temporarily unavailable." }, { status: 503 }); }
}
