import { createGuestIdentity } from "@/lib/auth-identities";
import { createStrideSessionCookie, clearStrideSessionCookie } from "@/app/chatgpt-auth";
export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "Use Stride to continue." }, { status: 403 });
  try { const guest = await createGuestIdentity(); const response = Response.json({ ok: true }, { status: 201, headers: { "Set-Cookie": await createStrideSessionCookie({ ...guest, userId: guest.accountId, displayName: "Guest" }), "Cache-Control": "no-store" } }); response.headers.append("Set-Cookie", clearStrideSessionCookie().replace("stride_session=", "stride_create_account=")); response.headers.append("Set-Cookie", "stride_signin=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0"); return response; }
  catch { return Response.json({ error: "Guest access is temporarily unavailable." }, { status: 503 }); }
}
