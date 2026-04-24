// =============================================================================
// HTTP helpers — CORS, preflight, structured error responses
// =============================================================================

export function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  // If the request's origin matches the allowlist, echo it back. Otherwise
  // fall back to the first allowlist entry — this keeps non-browser callers
  // (curl, server-side handoffs) working without enforcing a fake Origin.
  const allowOrigin = allowed.includes(origin)
    ? origin
    : (allowed[0] || '*');
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token, X-Suite-Module',
    'Access-Control-Expose-Headers': 'X-Render-Time-Ms, X-Vendor, X-Page-Count',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

export function handlePreflight(request, env) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, env)
  });
}

/**
 * Structured error response. Caller gets a consistent shape across endpoints:
 *   { "error": { "code": "...", "message": "...", ...extra } }
 */
export function jsonError(status, code, message, extra = {}) {
  const body = { error: { code, message, ...extra } };
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    }
  });
}
