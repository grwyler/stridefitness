import { getGuestSessionUser } from "@/app/chatgpt-auth";

export async function GET(request: Request) {
  const guest = await getGuestSessionUser(request.headers.get("cookie"));
  if (!guest || guest.accountType !== "guest") {
    return Response.redirect(new URL("/", request.url), 303);
  }
  const response = Response.redirect(new URL("/?createAccount=1", request.url), 303);
  response.headers.append("Set-Cookie", "stride_create_account=1; Path=/; Secure; SameSite=Lax; Max-Age=1800");
  response.headers.set("Cache-Control", "no-store");
  return response;
}
