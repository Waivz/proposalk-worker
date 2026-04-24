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
/**
 * Structured error response with CORS headers. Caller gets a consistent shape
 * across endpoints: { "error": { "code": "...", "message": "...", ...extra } }
 *
 * Pass the request and env to get origin-specific CORS headers. When they're
 * not passed, falls back to wildcard CORS so browser clients can at least
 * read the error body instead of getting a generic "No Access-Control-Allow-Origin
 * header is present" browser-side error that masks the real problem.
 */
export function jsonError(status, code, message, extra = {}, request = null, env = null) {
  const body = { error: { code, message, ...extra } };
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store'
  };
  if (request && env) {
    Object.assign(headers, corsHeaders(request, env));
  } else {
    headers['Access-Control-Allow-Origin'] = '*';
  }
  return new Response(JSON.stringify(body, null, 2), { status, headers });
}
