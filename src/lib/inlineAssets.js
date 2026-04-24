// =============================================================================
// inlineAssets — replace relative asset URLs with base64 data URIs
// =============================================================================
// The template references its partner assets by relative URL:
//
//   <img src="./cetera-logo-crop.png">
//   background-image: url('./cover-handshake.jpg')
//
// When we send the template HTML to the Browser Rendering engine, those
// relative URLs have no base to resolve against — the browser would try to
// fetch them and fail. Rather than hosting the assets at a public URL (adds
// moving parts, CDN cache issues), we inline them as base64 data URIs so the
// template is fully self-contained at render time.
//
// Assets live in R2 (the partner_assets bucket) under partner-keyed prefixes.
// Loading happens in parallel — they're independent fetches.
// =============================================================================

/**
 * @param {string} html - The template HTML (payload already injected or not)
 * @param {Array<{ref: string, r2: string, mime: string}>} assets - Asset descriptors
 * @param {R2Bucket} r2Bucket - The env.PARTNER_ASSETS binding
 * @returns {Promise<string>} - HTML with all asset refs rewritten
 */
export async function inlineAssets(html, assets, r2Bucket) {
  if (!assets || !assets.length) return html;

  const loaded = await Promise.all(
    assets.map(async (asset) => {
      const obj = await r2Bucket.get(asset.r2);
      if (!obj) {
        throw new Error(`R2 asset missing: ${asset.r2} (referenced as ${asset.ref})`);
      }
      const bytes = await obj.arrayBuffer();
      return {
        ...asset,
        dataUri: `data:${asset.mime};base64,${arrayBufferToBase64(bytes)}`
      };
    })
  );

  let out = html;
  for (const asset of loaded) {
    // Replace all occurrences — both src="..." and url('...') patterns get hit
    // by a literal substring replacement. We escape the ref for regex use even
    // though we're not using regex features; belt-and-suspenders if the pattern
    // is ever tightened (e.g. to require quote boundaries).
    const literal = asset.ref;
    out = splitAndJoin(out, literal, asset.dataUri);
  }
  return out;
}

/**
 * Chunked base64 encoding. Doing `String.fromCharCode(...bytes)` on a large
 * buffer (>64KB or so) blows the JS call stack, so we process in 32KB chunks.
 */
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const CHUNK = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const slice = bytes.subarray(i, Math.min(i + CHUNK, bytes.length));
    binary += String.fromCharCode.apply(null, slice);
  }
  return btoa(binary);
}

/**
 * All-occurrence literal-string replace without regex. String.replaceAll exists
 * in modern V8 but we avoid it to stay portable to any weirder runtime variant.
 */
function splitAndJoin(haystack, needle, replacement) {
  return haystack.split(needle).join(replacement);
}
