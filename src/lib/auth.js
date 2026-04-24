// =============================================================================
// Auth — Origin allowlist (stage 1)
// =============================================================================
// This is THE PLACE to upgrade when the rest of the (k) Suite standardizes
// on signed-token auth. For now, we check Origin (and fall back to Referer)
// against the ALLOWED_ORIGINS env var.
//
// Trust model:
//   - Browser-originated calls: Origin header is set by the browser, not the
//     page's JS. Can't be forged from within the browser.
//   - Server-to-server calls: Origin can be forged. This is why signed tokens
//     are Phase 2 — origin alone isn't enough when the caller isn't a browser.
//
// Until then: treat this as a speedbump, not a lock. The data /render returns
// is non-sensitive (it's a PDF of data the caller already provided), so even
// a breach just means someone gets to render proposals — not exfiltrate data.
// =============================================================================

import { jsonError } from './http.js';

export function verifyOrigin(request, env) {
  const origin = request.headers.get('Origin')
    || request.headers.get('Referer')
    || '';
  const allowed = (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  // No allowlist configured → permissive mode (useful for local `wrangler dev`).
  if (!allowed.length) return null;

  const ok = allowed.some(a => origin.startsWith(a));
  if (!ok) {
    return jsonError(
      403,
      'ORIGIN_NOT_ALLOWED',
      `Origin "${origin}" is not in the allowlist. Configure ALLOWED_ORIGINS in wrangler.jsonc to include this caller.`
    );
  }
  return null;
}

// Future upgrade path (commented, for reference):
//
// export async function verifySignedToken(request, env) {
//   const token = request.headers.get('X-Auth-Token');
//   if (!token) return jsonError(401, 'MISSING_TOKEN', 'X-Auth-Token header required');
//   try {
//     const payload = await jwtVerify(token, env.KSUITE_JWT_PUBLIC_KEY);
//     // Check payload.module is a known (k) Suite module, payload.exp is valid, etc.
//     return null;
//   } catch (e) {
//     return jsonError(401, 'INVALID_TOKEN', e.message);
//   }
// }
