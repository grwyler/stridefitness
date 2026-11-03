const challengeToken = 'SvAPynienkZnoAQcw2nNZsV_fW2ke3XHLPMB4JxMA-I';

export function GET() {
  return new Response(challengeToken, {
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}
