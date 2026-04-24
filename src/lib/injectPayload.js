// =============================================================================
// injectPayload — inline the /render payload into the template
// =============================================================================
// The template has a placeholder block:
//
//   <script id="proposalk-data" type="application/json">
//     { ...default/dev payload... }
//   </script>
//
// At render time, we replace the contents with the incoming payload. Using
// an inline JSON block (rather than, say, URL parameters or base64) keeps
// the template self-testing — you can open it in a browser with the default
// payload and see exactly what the Worker will render.
//
// Boundary-based replacement rather than naive regex or concatenation: we
// find the exact open/close tags and splice only the content between them.
// That's robust against payloads that happen to contain `</script` or other
// HTML-significant substrings (still defensively escaped below).
// =============================================================================

const OPEN_TAG = '<script id="proposalk-data" type="application/json">';
const CLOSE_TAG = '</script>';

export function injectPayload(html, payload) {
  const openIdx = html.indexOf(OPEN_TAG);
  if (openIdx === -1) {
    throw new Error(
      'Template is missing the <script id="proposalk-data"> placeholder block. ' +
      'Check that src/templates/*.html has not been modified to remove it.'
    );
  }
  const contentStart = openIdx + OPEN_TAG.length;
  const closeIdx = html.indexOf(CLOSE_TAG, contentStart);
  if (closeIdx === -1) {
    throw new Error('Template has unclosed <script id="proposalk-data"> block.');
  }

  // Escape any </script in the payload. The HTML parser will close the script
  // tag at the first </script it sees regardless of context, including inside
  // a JSON string. Our schema shouldn't contain such strings, but a future
  // free-text field (e.g. a comment) could — so we guard unconditionally.
  const safeJson = JSON.stringify(payload).replace(/<\/script/gi, '<\\/script');

  return html.slice(0, contentStart)
    + '\n'
    + safeJson
    + '\n'
    + html.slice(closeIdx);
}
