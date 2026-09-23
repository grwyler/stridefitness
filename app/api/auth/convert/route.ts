export async function GET(request: Request) {
  const response = Response.redirect(new URL("/?createAccount=1", request.url), 303);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
