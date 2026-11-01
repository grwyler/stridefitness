import { metadataUrl, resourceUrl, authorizationIssuer, noStore } from '@/lib/mcp-oauth';

export function GET() {
  return noStore({
    resource: resourceUrl(),
    authorization_servers: [authorizationIssuer()],
    scopes_supported: ['fitness:read'],
    bearer_methods_supported: ['header'],
  }, 200, { 'Access-Control-Allow-Origin': '*' });
}
