import { clearGoogleSessionCookie } from "@/app/chatgpt-auth";

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return Response.json({ error: "Use Stride to switch accounts." }, { status: 403 });
  }
  return Response.json({ ok: true }, { headers: { "Set-Cookie": clearGoogleSessionCookie(), "Cache-Control": "no-store" } });
}
