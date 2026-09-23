export async function GET(request: Request) {
  return new Response(null, {
    status: 303,
    headers: {
      Location: new URL("/?createAccount=1", request.url).toString(),
      "Cache-Control": "no-store",
      "Set-Cookie": "stride_create_account=1; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=1800",
    },
  });
}
