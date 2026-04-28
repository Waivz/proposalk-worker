// =============================================================================
// POST /render — the main event
// =============================================================================
// Pipeline (per the PROPOSALK-TODO.md Session 2 spec):
//
//   1. Parse + validate the incoming JSON payload
//   2. Route to the partner adapter keyed on payload.vendor
//   3. Load the partner template (bundled with this Worker)
//   4. Inline partner assets (images → base64 data URIs, fetched from R2)
//   5. Inject the payload into the template's inline <script> block
//   6. Render HTML → PDF via Browser Rendering binding (headless Chromium)
//   7. Fetch the partner's boilerplate PDF from R2
//   8. Merge dynamic (front) + boilerplate (back) with pdf-lib
//   9. Stream the merged PDF back to the caller
//
// Scale-to-fit note: the boilerplate is assumed to already be 11×8.5" landscape
// (Cetera's native format — matches our template). If a future partner's
// boilerplate is a different size, handle it in the adapter entry, not here.
// =============================================================================

import puppeteer from '@cloudflare/puppeteer';
import { PDFDocument } from 'pdf-lib';

import ceteraTemplate from './templates/cetera-template.html';

import { corsHeaders, jsonError } from './lib/http.js';
import { normalizePayload, validatePayload } from './lib/validate.js';
import { injectPayload } from './lib/injectPayload.js';
import { inlineAssets } from './lib/inlineAssets.js';

// -----------------------------------------------------------------------------
// Adapter registry — keyed on payload.vendor. Exported so /adapters can enumerate.
// -----------------------------------------------------------------------------
// Each adapter declares:
//   template          — bundled HTML string (tightly coupled to schema)
//   boilerplate_r2    — R2 key for the static boilerplate PDF
//   assets            — relative URLs in the template + their R2 keys & MIMEs
//                       (inlined as data URIs at render time)
//   dynamic_pages     — count of pages generated from the template
//   boilerplate_pages — count of pages in the boilerplate
// -----------------------------------------------------------------------------
export const ADAPTER_REGISTRY = {
  cetera: {
    name: 'Cetera Retirement Plan Specialists',
    status: 'active',
    version: '0.1.0',
    template: ceteraTemplate,
    boilerplate_r2: 'cetera/boilerplate.pdf',
    assets: [
      { ref: './cover-handshake.jpg', r2: 'cetera/cover-handshake.jpg', mime: 'image/jpeg' },
      { ref: './cetera-logo.svg', r2: 'cetera/cetera-logo.svg', mime: 'image/svg+xml' }
    ],
    dynamic_pages: 3,
    boilerplate_pages: 19
  }
  // When a second partner arrives, add an entry here. No other code changes
  // are needed unless the partner's rendering needs differ from Cetera's.
};

// -----------------------------------------------------------------------------
// Handler
// -----------------------------------------------------------------------------
export async function handleRender(request, env, ctx) {
  // --- 1. Parse payload ---------------------------------------------------
  let payload;
  try {
    payload = await request.json();
  } catch (e) {
    return jsonError(400, 'BAD_JSON', 'Request body is not valid JSON');
  }

  // --- 2. Identify vendor + look up adapter ------------------------------
  const vendor = String(payload.vendor || 'cetera').toLowerCase();
  const adapter = ADAPTER_REGISTRY[vendor];
  if (!adapter) {
    return jsonError(
      400,
      'UNKNOWN_VENDOR',
      `No adapter registered for vendor "${vendor}". Available: ${Object.keys(ADAPTER_REGISTRY).join(', ')}`
    );
  }

  // --- 3. Validate payload -----------------------------------------------
  normalizePayload(payload);
  const validation = validatePayload(payload);
  if (!validation.ok) {
    return jsonError(400, 'INVALID_PAYLOAD', validation.message, { errors: validation.errors });
  }

  // --- 4-9. The pipeline --------------------------------------------------
  const t0 = Date.now();
  try {
    // 4. Load template (already a string via text-import rule)
    let html = adapter.template;

    // 5. Inline partner assets — must happen BEFORE payload injection so
    //    that if the payload itself somehow contained a string matching an
    //    asset ref (unlikely but possible), we don't accidentally mangle it.
    html = await inlineAssets(html, adapter.assets, env.PARTNER_ASSETS);

    // 6. Inject the JSON payload into the <script id="proposalk-data"> block
    html = injectPayload(html, payload);

    // 7. Render HTML → PDF
    const dynamicBytes = await renderHtmlToPdf(html, env.BROWSER);

    // 8. Fetch boilerplate from R2
    const boilerObj = await env.PARTNER_ASSETS.get(adapter.boilerplate_r2);
    if (!boilerObj) {
      throw new Error(`Boilerplate missing in R2: ${adapter.boilerplate_r2}`);
    }
    const boilerBytes = await boilerObj.arrayBuffer();

    // 9. Merge — dynamic in front, boilerplate after
    const mergedBytes = await mergePdfs(dynamicBytes, boilerBytes);

    const elapsed = Date.now() - t0;
    const pageCount = await countPages(mergedBytes);
    console.log(`[proposalk-worker] /render vendor=${vendor} pages=${pageCount} ms=${elapsed}`);

    // Build a clean filename from the sponsor name (or fall back)
    const sponsorRaw = payload?.sponsor?.legal_name || 'proposal';
    const sponsorSlug = sponsorRaw
      .replace(/[^a-z0-9-]+/gi, '_')
      .replace(/^_+|_+$/g, '')
      .toLowerCase() || 'proposal';
    const dateSlug = new Date().toISOString().slice(0, 10);
    const filename = `proposalk-${vendor}-${sponsorSlug}-${dateSlug}.pdf`;

    return new Response(mergedBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-Render-Time-Ms': String(elapsed),
        'X-Vendor': vendor,
        'X-Page-Count': String(pageCount),
        ...corsHeaders(request, env)
      }
    });
  } catch (err) {
    console.error('[proposalk-worker] /render failed:', err);
    return jsonError(500, 'RENDER_FAILED', err?.message || 'PDF generation failed');
  }
}

// -----------------------------------------------------------------------------
// HTML → PDF via Browser Rendering binding
// -----------------------------------------------------------------------------
// Uses @cloudflare/puppeteer (Cloudflare's fork of puppeteer-core, optimized
// for the Workers runtime). `networkidle0` waits for zero in-flight requests —
// safe here since we've pre-inlined all assets as data URIs; there should be
// no external fetches at render time.
//
// Viewport set to 1056×816 (11"×8.5" @ 96 DPI) matches the @page landscape
// dimensions declared in the template CSS. `printBackground: true` is required
// for the purple blocks and cover image to render — Chromium skips backgrounds
// by default when printing.
// -----------------------------------------------------------------------------
async function renderHtmlToPdf(html, browserBinding) {
  const browser = await puppeteer.launch(browserBinding, { protocolTimeout: 120000 });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1056, height: 816, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
    const pdfBytes = await page.pdf({
      width: '11in',
      height: '8.5in',
      printBackground: true,
      preferCSSPageSize: false,
      margin: { top: 0, right: 0, bottom: 0, left: 0 }
    });
    return pdfBytes;
  } finally {
    // Always release the browser — sessions are a scarce resource.
    await browser.close();
  }
}

// -----------------------------------------------------------------------------
// Merge two PDFs with pdf-lib
// -----------------------------------------------------------------------------
// Dynamic (our rendered template — 3 pages) goes first, boilerplate (static
// partner content — 19 pages for Cetera) goes after. That order matches the
// Cetera reference PDF and preserves the cover → summary → detail flow.
// -----------------------------------------------------------------------------
async function mergePdfs(dynamicBytes, boilerBytes) {
  const merged = await PDFDocument.create();

  const dynamicDoc = await PDFDocument.load(dynamicBytes);
  const dynamicPages = await merged.copyPages(dynamicDoc, dynamicDoc.getPageIndices());
  for (const p of dynamicPages) merged.addPage(p);

  const boilerDoc = await PDFDocument.load(boilerBytes);
  const boilerPages = await merged.copyPages(boilerDoc, boilerDoc.getPageIndices());
  for (const p of boilerPages) merged.addPage(p);

  // Set some doc-level metadata that shows up in PDF viewers.
  merged.setTitle('Plan Services Proposal');
  merged.setProducer('Proposal(k) v0.1 via (k) Suite');
  merged.setCreator('Proposal(k) Worker');
  merged.setCreationDate(new Date());

  return await merged.save();
}

async function countPages(pdfBytes) {
  const doc = await PDFDocument.load(pdfBytes);
  return doc.getPageCount();
}
