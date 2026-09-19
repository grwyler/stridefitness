import { signedOutCookie } from "@/app/chatgpt-auth";

// Sign out at the application boundary as well as any identity provider. This
// prevents a stale provider header from immediately rendering the dashboard
// again after the browser returns here.
export async function GET(request: Request) {
  return Response.redirect(new URL("/", request.url), 303, {
    headers: {
      "Set-Cookie": await signedOutCookie(),
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return Response.json({ error: "Use Stride to log out." }, { status: 403 });
  }
  return Response.json(
    { ok: true },
    {
      headers: {
        "Set-Cookie": await signedOutCookie(),
        "Cache-Control": "no-store",
      },
    },
  );
}
