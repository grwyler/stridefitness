import { signedOutCookie } from "@/app/chatgpt-auth";

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return Response.json({ error: "Use Stride to switch accounts." }, { status: 403 });
  }
  return Response.json({ ok: true }, { headers: { "Set-Cookie": await signedOutCookie(), "Cache-Control": "no-store" } });
}

export async function GET(request: Request) {
  const response=Response.redirect(new URL("/", request.url),303);
  response.headers.set("Set-Cookie",await signedOutCookie());
  response.headers.set("Cache-Control","no-store");
  return response;
}
