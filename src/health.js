// =============================================================================
// GET /health — liveness probe + binding check
// =============================================================================
// Confirms the Worker is responsive AND that its runtime bindings are wired.
// If binding flags are false here, /render will fail — this lets Tony (or
// whoever) verify deployment health from the browser without needing to post
// a payload.
// =============================================================================

import { corsHeaders } from './lib/http.js';

export function handleHealth(request, env) {
  const body = {
    status: 'ok',
    service: 'proposalk-worker',
    version: env.VERSION || '0.0.0',
    timestamp: new Date().toISOString(),
    bindings: {
      browser: Boolean(env.BROWSER),
      partner_assets_r2: Boolean(env.PARTNER_ASSETS)
    }
  };

  return new Response(JSON.stringify(body, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...corsHeaders(request, env)
    }
  });
}
