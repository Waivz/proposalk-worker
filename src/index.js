// =============================================================================
// Proposal(k) Worker — entry point
// =============================================================================
// Routes:
//   GET  /health     — liveness + binding probe
//   GET  /schema     — JSON Schema for the /render payload contract
//   GET  /adapters   — list registered partner adapters + status
//   POST /render     — main endpoint. JSON payload → merged partner-branded PDF
//
// The /render endpoint is auth-guarded via Origin allowlist (see lib/auth.js).
// Everything else is unauthenticated and safe to expose publicly.
// =============================================================================

import { handleRender } from './render.js';
import { handleSchema } from './schema.js';
import { handleHealth } from './health.js';
import { handleAdapters } from './adapters.js';
import { handlePreflight, jsonError } from './lib/http.js';
import { verifyOrigin } from './lib/auth.js';

export default {
  async fetch(request, env, ctx) {
    // CORS preflight passes through unauthenticated — browsers send these
    // without cookies/auth headers, so blocking them breaks every cross-origin
    // POST before the real request even gets a chance.
    if (request.method === 'OPTIONS') {
      return handlePreflight(request, env);
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // --- Public endpoints (no auth) ------------------------------------
      if (path === '/health' && request.method === 'GET') {
        return handleHealth(request, env);
      }
      if (path === '/schema' && request.method === 'GET') {
        return handleSchema(request, env);
      }
      if (path === '/adapters' && request.method === 'GET') {
        return handleAdapters(request, env);
      }

      // --- Authenticated endpoints --------------------------------------
      const authError = verifyOrigin(request, env);
      if (authError) return authError;

      if (path === '/render' && request.method === 'POST') {
        return handleRender(request, env, ctx);
      }

      return jsonError(404, 'NOT_FOUND', `No handler for ${request.method} ${path}`);
    } catch (err) {
      // Last-resort catch. Individual handlers should catch their own
      // expected errors and return structured responses — this is for
      // the unexpected ones so we don't bleed stack traces to callers.
      console.error('[proposalk-worker] unhandled error:', err);
      return jsonError(500, 'INTERNAL', err?.message || 'Internal server error');
    }
  }
};
