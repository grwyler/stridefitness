import { clearStrideSessionCookie, signedOutCookie } from "@/app/chatgpt-auth";

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return Response.json({ error: "Use Stride to switch accounts." }, { status: 403 });
  }
  const headers=new Headers({"Cache-Control":"no-store"});headers.append("Set-Cookie",clearStrideSessionCookie());headers.append("Set-Cookie",signedOutCookie());return Response.json({ ok: true }, { headers });
}

export function GET(request: Request) {
  const headers=new Headers({"Cache-Control":"no-store"});headers.append("Set-Cookie",clearStrideSessionCookie());headers.append("Set-Cookie",signedOutCookie());return Response.redirect(new URL("/", request.url), 303,{headers});
}
