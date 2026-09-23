import { signedOutCookie } from "@/app/chatgpt-auth";

// Sign out at the application boundary as well as any identity provider. This
// prevents a stale provider header from immediately rendering the dashboard
// again after the browser returns here.
export async function GET(request: Request) {
  const response=Response.redirect(new URL("/", request.url),303);
  response.headers.append("Set-Cookie",await signedOutCookie());
  response.headers.append("Set-Cookie","stride_create_account=; Path=/; Secure; SameSite=Lax; Max-Age=0");
  response.headers.set("Cache-Control","no-store");
  return response;
}

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return Response.json({ error: "Use Stride to log out." }, { status: 403 });
  }
  const response = Response.json(
    { ok: true },
    {
      headers: {
        "Set-Cookie": await signedOutCookie(),
        "Cache-Control": "no-store",
      },
    },
  );
  response.headers.append("Set-Cookie","stride_create_account=; Path=/; Secure; SameSite=Lax; Max-Age=0");
  return response;
}
