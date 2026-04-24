// =============================================================================
// GET /schema — JSON Schema describing the /render payload contract
// =============================================================================
// Exposed so upstream callers (Design(k) adapter, future partners) can fetch
// the canonical contract instead of guessing at field names. Cached for 5 min
// at the edge since schema changes follow Worker deploys, not live updates.
// =============================================================================

import { corsHeaders } from './lib/http.js';
import schema from './schema.json';

export function handleSchema(request, env) {
  return new Response(JSON.stringify(schema, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/schema+json',
      'Cache-Control': 'public, max-age=300',
      ...corsHeaders(request, env)
    }
  });
}
