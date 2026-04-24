// =============================================================================
// GET /adapters — list registered partner adapters
// =============================================================================
// Useful for:
//   - Design(k) Pro's UI deciding whether to show the "Proposal(k)" menu item
//   - Operations debugging ("is my new partner adapter registered?")
//   - Documentation auto-generation
//
// When a new partner is added, they appear here automatically — no hardcoded
// client-side list to update.
// =============================================================================

import { corsHeaders } from './lib/http.js';
import { ADAPTER_REGISTRY } from './render.js';

export function handleAdapters(request, env) {
  const adapters = Object.entries(ADAPTER_REGISTRY).map(([key, adapter]) => ({
    vendor: key,
    name: adapter.name,
    status: adapter.status || 'active',
    dynamic_pages: adapter.dynamic_pages || null,
    boilerplate_pages: adapter.boilerplate_pages || null,
    version: adapter.version || '0.1.0'
  }));

  return new Response(JSON.stringify({ adapters }, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=60',
      ...corsHeaders(request, env)
    }
  });
}
