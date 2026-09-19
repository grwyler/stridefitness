import { clearStrideSessionCookie } from "@/app/chatgpt-auth";

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return Response.json({ error: "Use Stride to switch accounts." }, { status: 403 });
  }
  return Response.json({ ok: true }, { headers: { "Set-Cookie": clearStrideSessionCookie(), "Cache-Control": "no-store" } });
}

export function GET(request: Request) {
  return Response.redirect(new URL("/", request.url), 303, {
    headers: { "Set-Cookie": clearStrideSessionCookie(), "Cache-Control": "no-store" },
  });
}
