import { signedOutCookie } from "@/app/chatgpt-auth";

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return Response.json({ error: "Use Stride to switch accounts." }, { status: 403 });
  }
  const response = Response.json({ ok: true }, { headers: { "Set-Cookie": await signedOutCookie(), "Cache-Control": "no-store" } });
  response.headers.append("Set-Cookie", "stride_create_account=; Path=/; Secure; SameSite=Lax; Max-Age=0");
  return response;
}

export async function GET(request: Request) {
  const response=Response.redirect(new URL("/", request.url),303);
  response.headers.set("Set-Cookie",await signedOutCookie());
  response.headers.append("Set-Cookie", "stride_create_account=; Path=/; Secure; SameSite=Lax; Max-Age=0");
  response.headers.set("Cache-Control","no-store");
  return response;
}
