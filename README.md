# Proposal(k) Worker

Cloudflare Worker that generates partner-branded plan services proposal PDFs for the (k) Suite. Accepts a JSON payload from Design(k) Pro, renders a dynamic HTML template via Cloudflare Browser Rendering, merges the output with a partner's static boilerplate PDF stored in R2, and returns the finished document.

**Version**: 0.1.0 · **Partners supported**: Cetera Retirement Plan Specialists (active)

---

## Deploying

**→ See [`DASHBOARD-DEPLOY.md`](./DASHBOARD-DEPLOY.md) for the step-by-step guide.**

Deployment is dashboard + GitHub. You don't need Wrangler, Node.js, or a terminal locally — everything happens through the Cloudflare dashboard and GitHub's web UI. Push to `main` → Cloudflare builds and deploys automatically.

---

## Architecture

```
Design(k) Pro SPA (waivz.ai)
       │ JSON payload (POST /render)
       ▼
┌──────────────────────────────────────────────────────┐
│ proposalk-worker                                     │
│                                                      │
│  1. Validate payload                                 │
│  2. Look up partner adapter (vendor key)             │
│  3. Load bundled template HTML (Cetera v0.1)         │
│  4. Inline partner assets from R2 as data URIs       │
│  5. Inject payload into <script id="proposalk-data"> │
│  6. Browser Rendering: HTML → 3-page PDF             │
│  7. Fetch boilerplate from R2                        │
│  8. pdf-lib merge: dynamic (3) + boilerplate (19)    │
│  9. Stream 22-page PDF back                          │
└──────────────────────────────────────────────────────┘
       │ application/pdf
       ▼
 Proposal(k) SPA (downloads + previews)
```

---

## Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `GET` | `/health` | — | Liveness + binding probe |
| `GET` | `/schema` | — | JSON Schema for the `/render` payload |
| `GET` | `/adapters` | — | List registered partner adapters |
| `POST` | `/render` | Origin allowlist | Generate proposal PDF |

---

## Bindings (configured in `wrangler.jsonc`)

| Binding | Type | Purpose |
|---------|------|---------|
| `BROWSER` | Browser Rendering | Headless Chromium for HTML→PDF |
| `PARTNER_ASSETS` | R2 bucket | Versioned partner boilerplates + images |

---

## File map

```
proposalk-worker/
├── DASHBOARD-DEPLOY.md     ← start here if deploying
├── README.md               ← you are here
├── wrangler.jsonc          ← Cloudflare config (read at build time)
├── package.json            ← npm deps: @cloudflare/puppeteer, pdf-lib
├── .gitignore
│
├── src/
│   ├── index.js            ← Worker entry — router
│   ├── render.js           ← /render handler (the pipeline)
│   ├── schema.js           ← /schema handler
│   ├── schema.json         ← authoritative payload schema
│   ├── health.js           ← /health handler
│   ├── adapters.js         ← /adapters handler
│   │
│   ├── lib/
│   │   ├── http.js         ← CORS + error response helpers
│   │   ├── auth.js         ← Origin allowlist (upgrade path to signed tokens)
│   │   ├── injectPayload.js  ← inlines payload into template
│   │   ├── inlineAssets.js   ← inlines R2 images as data URIs
│   │   └── validate.js     ← fast-fail payload checks
│   │
│   └── templates/
│       └── cetera-template.html  ← the Cetera-branded HTML template
│
├── test/
│   └── sample-payload.json ← Example Business, LLC smoke-test payload
│
└── scripts/                ← CLI helpers, optional, ignore if using dashboard
    ├── sync-template.sh
    ├── r2-seed.sh
    └── smoke-test.sh
```

---

## Adding a partner

When a second TPA format surfaces:

1. Upload the partner's boilerplate and images to R2 under a `<vendor>/` prefix via the R2 dashboard
2. Build the partner's HTML template (model on `src/templates/cetera-template.html`, keep the `<script id="proposalk-data">` placeholder intact)
3. Add the template file to `src/templates/` via GitHub's web editor
4. In `src/render.js`, add an import for the new template and an entry to `ADAPTER_REGISTRY`:
   ```js
   import newPartnerTemplate from './templates/new-partner-template.html';
   // ...
   export const ADAPTER_REGISTRY = {
     cetera: { /* ... */ },
     new_partner: {
       name: 'New Partner Full Name',
       status: 'active',
       version: '0.1.0',
       template: newPartnerTemplate,
       boilerplate_r2: 'new_partner/boilerplate.pdf',
       assets: [/* ... */],
       dynamic_pages: 3,
       boilerplate_pages: /* count */
     }
   };
   ```
5. Commit — Cloudflare redeploys automatically. `GET /adapters` will now list the new partner.

Upstream, Census(k) needs to detect the partner's file signature and set `vendor: "new_partner"` on matching census files. That flag rides through Eligibility(k) → Intent(k) → Design(k), and Design(k) routes matching payloads to `/render` with the vendor field populated.

---

## Design notes

- **Efficiency %** is recomputed by the template at render time from the scenario totals, using Cetera's convention (owner total / total, deferral included). The upstream `owner_share_pct` field is advisory and gets overridden if it doesn't match. This keeps Page 2 and Page 3 in sync regardless of what the adapter sends.
- **§318 attribution** flows through via `participants[].is_spouse_attribution`. Census(k) sets `_familyRel === 'SPOUSE' && _isAttributedOwner === true`; the Design(k)→Proposal(k) adapter translates that into `is_spouse_attribution: true` and adds a `‡` to `footnote_marks`.
- **Compliance notes** are positional — the first note gets `*`, the second `†`, the third `‡`. Marks on participant rows reference these by position.
- **Auth** is currently an origin allowlist only — a speedbump, not a lock. Phase 2 will add signed-token auth matching the rest of the (k) Suite. See `src/lib/auth.js` for the commented upgrade path.

---

## Advanced: CLI usage

If you (or a teammate) prefer the Wrangler CLI workflow, it works in parallel. Install Node.js 18+ and Wrangler (`npm install`), then use `npm run dev`, `npm run deploy`, etc. Keep `wrangler.jsonc` as the source of truth and don't edit bindings in the dashboard, or the next deploy will override them.
