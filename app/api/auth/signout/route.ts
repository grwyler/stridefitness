import { signedOutCookie } from "@/app/chatgpt-auth";

// Sign out at the application boundary as well as any identity provider. This
// prevents a stale provider header from immediately rendering the dashboard
// again after the browser returns here.
export async function GET(request: Request) {
  const headers = new Headers({ Location: new URL("/", request.url).toString(), "Cache-Control": "no-store" });
  headers.append("Set-Cookie", await signedOutCookie());
  headers.append("Set-Cookie", "stride_create_account=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0");
  headers.append("Set-Cookie", "stride_signin=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0");
  return new Response(null, { status: 303, headers });
}

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return Response.json({ error: "Use Stride to log out." }, { status: 403 });
  }
  const headers = new Headers({ "Cache-Control": "no-store" });
  headers.append("Set-Cookie", await signedOutCookie());
  headers.append("Set-Cookie", "stride_create_account=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0");
  headers.append("Set-Cookie", "stride_signin=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0");
  return Response.json({ ok: true }, { headers });
}
