# Dashboard Deploy Guide — Proposal(k) Worker

Deploy the Proposal(k) Worker to Cloudflare using only the GitHub web UI and the Cloudflare dashboard. No terminal, no Node.js install, no Wrangler CLI.

**What you'll do:**
1. Create a GitHub repository and upload the scaffold
2. Create an R2 bucket in Cloudflare and upload the Cetera assets
3. Connect the GitHub repo to Cloudflare via Workers Builds
4. Verify bindings and test the deployed Worker

**Estimated time:** 20–30 minutes for the first deploy, about 5 minutes for subsequent updates.

---

## Before you start

Make sure you have:
- [ ] A **GitHub account** (you confirmed this)
- [ ] A **Cloudflare account** with a Workers paid plan OR free plan
  - Browser Rendering works on both, but the free tier has lower concurrent-session limits. For production use you'll want the paid plan ($5/mo baseline).
- [ ] Three files from this project ready to upload:
  - `cetera-boilerplate.pdf`
  - `cover-handshake.jpg`
  - `cetera-logo-crop.png`

---

## Step 1 — Create the GitHub repository

1. Go to <https://github.com/new>
2. Fill in:
   - **Repository name**: `proposalk-worker`
   - **Visibility**: Private (recommended — the scaffold contains comments referencing internal workflow details)
   - **Initialize**: leave all checkboxes unchecked (we'll upload our own files)
3. Click **Create repository**
4. On the next screen, click the link **uploading an existing file** (it's in the quick-setup section, under the command-line options you're ignoring)
5. Drag the entire contents of the unzipped `proposalk-worker` folder into the upload area
   - Include: `src/`, `scripts/`, `test/`, `wrangler.jsonc`, `package.json`, `README.md`, `DASHBOARD-DEPLOY.md`, `.gitignore`
   - Do NOT include the `proposalk-worker/` top-level folder itself — GitHub wants the contents at the repo root
6. Scroll down, write a commit message like "Initial scaffold", and click **Commit changes**

**Verify:** Your repo should now show a file tree with `src/`, `scripts/`, etc. at the top level. Click `src/index.js` to confirm the code uploaded correctly.

---

## Step 2 — Create and populate the R2 bucket

R2 holds the partner assets (boilerplate PDF + images) that the Worker fetches at render time. Create the bucket BEFORE connecting to GitHub so the first deploy sees all its dependencies.

### 2a. Create the bucket

1. In the Cloudflare dashboard, click **R2 Object Storage** in the left sidebar
   - If it's not there, type "R2" in the dashboard search
   - First-time users will need to enable R2 and provide a payment method (the free tier includes 10GB/month — far more than this project needs)
2. Click **Create bucket**
3. **Bucket name**: `proposalk-partner-assets`
4. Leave other options at their defaults (Automatic location hint, Standard storage class)
5. Click **Create bucket**

### 2b. Upload the Cetera assets

Files need to be uploaded under a `cetera/` prefix so the Worker's adapter registry can find them. Here's how to do that in the R2 dashboard:

1. Open the new `proposalk-partner-assets` bucket
2. Click **Upload** → **Select from computer**
3. Select `cetera-boilerplate.pdf` from your machine
4. **Important:** In the upload dialog, there's a field for the object key or filename. Change it from `cetera-boilerplate.pdf` to `cetera/boilerplate.pdf` (adds the prefix and renames to just `boilerplate.pdf`)
5. Click **Upload**
6. Repeat for `cover-handshake.jpg` → key: `cetera/cover-handshake.jpg`
7. Repeat for `cetera-logo-crop.png` → key: `cetera/cetera-logo-crop.png`

**Verify:** Back in the bucket view, you should see a folder icon labeled `cetera/`. Click it — you should see all three files inside.

Alternate approach if the dashboard doesn't let you set the key at upload: upload the files with default names, then for each file click the "..." menu → **Rename** and change the key to include the `cetera/` prefix.

---

## Step 3 — Connect the GitHub repo to Cloudflare

This is the step that replaces `wrangler deploy`.

1. In the Cloudflare dashboard, click **Workers & Pages** in the left sidebar
2. Click **Create**
3. You'll see two tabs: "Start with a template" and "Import a repository" — click **Import a repository**
4. If this is your first time connecting GitHub to Cloudflare, click **Connect GitHub** and authorize the Cloudflare Workers app
   - When asked about repo access, you can grant access to "All repositories" OR just select `proposalk-worker`
5. Back in Cloudflare, select the `proposalk-worker` repo from the list
6. Cloudflare will detect the project:
   - **Project name**: accept `proposalk-worker` (this becomes part of your Worker URL)
   - **Production branch**: `main` (default)
   - **Build settings**: Cloudflare should auto-detect from `wrangler.jsonc`. If prompted:
     - **Build command**: (leave empty — there's no build step)
     - **Deploy command**: `npx wrangler deploy` (should be the default)
     - **Root directory**: `/` (default)
7. Click **Save and Deploy**

The first build takes 1–3 minutes. Cloudflare runs `npm install` (pulls `@cloudflare/puppeteer` and `pdf-lib`), then runs `wrangler deploy` on their infrastructure — which reads `wrangler.jsonc`, creates the bindings, and uploads the Worker.

**Verify:** You should see a green "Success" build status and a URL like `https://proposalk-worker.<your-subdomain>.workers.dev`. Click it. You'll likely see a `404 NOT_FOUND` response from the root path — that's expected (we only have `/health`, `/schema`, `/adapters`, `/render`).

---

## Step 4 — Check the bindings

After the first deploy, the Worker should have auto-created bindings based on `wrangler.jsonc`. Let's confirm.

1. In the Cloudflare dashboard, go to **Workers & Pages** → click your `proposalk-worker`
2. Click **Settings** → **Bindings**
3. You should see:
   - **Browser Rendering** binding named `BROWSER` ✓
   - **R2 bucket** binding named `PARTNER_ASSETS` pointing to `proposalk-partner-assets` ✓
4. Click **Variables and Secrets** in the same Settings area
5. You should see:
   - `VERSION` = `0.1.0`
   - `ALLOWED_ORIGINS` = `https://waivz.ai,https://designk.waivz.ai,http://localhost:8787,http://localhost:5173`

If any binding is missing, click **Add binding** and configure it manually:
- Browser Rendering: pick "Browser Rendering" → name it `BROWSER`
- R2 bucket: pick "R2 bucket" → name it `PARTNER_ASSETS` → select `proposalk-partner-assets`

After adding missing bindings, click **Deploy** at the top right to push the updated configuration.

---

## Step 5 — Smoke-test the Worker

Open your browser's address bar and visit each of these (replace `<your-subdomain>` with your actual Workers subdomain):

### 5a. Health check
```
https://proposalk-worker.<your-subdomain>.workers.dev/health
```
Expected JSON response:
```json
{
  "status": "ok",
  "service": "proposalk-worker",
  "version": "0.1.0",
  "bindings": {
    "browser": true,
    "partner_assets_r2": true
  }
}
```
**If `browser` or `partner_assets_r2` is `false`** → a binding is missing. Go back to Step 4.

### 5b. Adapters list
```
https://proposalk-worker.<your-subdomain>.workers.dev/adapters
```
Expected: a JSON object listing the Cetera adapter as active.

### 5c. Schema
```
https://proposalk-worker.<your-subdomain>.workers.dev/schema
```
Expected: the full JSON Schema for the `/render` payload.

### 5d. Render (the real test)

`/render` is a POST endpoint — can't hit it from the address bar. Use a browser-based REST client:

**Option A — Hoppscotch** (free, no signup): <https://hoppscotch.io>
1. Set method to **POST**
2. URL: `https://proposalk-worker.<your-subdomain>.workers.dev/render`
3. **Headers** tab: add `Content-Type: application/json` and `Origin: https://waivz.ai`
4. **Body** tab: select "Raw" + "application/json", paste the contents of `test/sample-payload.json` (you can view it on GitHub and copy it)
5. Click **Send**
6. In the response pane, click the download icon to save the returned PDF

**Option B — Postman web**: <https://www.postman.com/> — same idea, needs an account.

**Expected result:** a 22-page PDF (3 dynamic + 19 boilerplate) downloads. Open it — the cover page shows "Example Business, LLC" and the date "April 2026".

**First render is slow** — 5–10 seconds is normal while Browser Rendering warms up a Chrome instance. Subsequent renders should be 2–4 seconds.

---

## Updating the Worker

Once connected, any commit pushed to the `main` branch of your GitHub repo auto-deploys. Typical update flows:

### Editing code
1. On GitHub, navigate to the file you want to change
2. Click the pencil icon (top-right of the file view)
3. Make your edit
4. Scroll down, write a commit message, click **Commit changes**
5. Cloudflare picks up the push and deploys within ~60 seconds
6. Watch progress in **Workers & Pages** → your Worker → **Deployments**

### Updating the template (most common edit)

The template lives at `src/templates/cetera-template.html` inside the Worker repo. When you change it at the project root, mirror the change into the repo:

1. Open `src/templates/cetera-template.html` in GitHub's web UI
2. Click the pencil icon
3. Paste in the updated template
4. Commit

(If this ever gets annoying, the fallback is to move the template into R2 like the boilerplate — but that adds an R2 fetch per render and couples template changes to asset uploads instead of code reviews.)

### Swapping the Cetera boilerplate PDF

No code change, no redeploy:
1. R2 dashboard → `proposalk-partner-assets` → `cetera/` → click the existing `boilerplate.pdf`
2. Click **Delete**
3. Upload the new version with the same key (`cetera/boilerplate.pdf`)

Next `/render` call uses the new boilerplate.

### Changing ALLOWED_ORIGINS

Edit `wrangler.jsonc` in the repo directly — change the `vars.ALLOWED_ORIGINS` value and commit. The redeploy picks up the new value.

---

## Troubleshooting

### Build failed — "no such file or directory: wrangler.jsonc"
You uploaded the files inside a `proposalk-worker/` folder instead of at the repo root. Move them up one level (GitHub web UI makes this awkward — the easiest fix is to delete the repo and re-create it, uploading files individually from outside the folder).

### /health returns `partner_assets_r2: false`
The R2 binding didn't get created. Go to Step 4 and add it manually.

### /render returns `500 RENDER_FAILED` with message "R2 asset missing: cetera/boilerplate.pdf"
The boilerplate wasn't uploaded to R2 with the correct prefix. Go back to Step 2b and verify the object key is exactly `cetera/boilerplate.pdf` (case-sensitive, with the slash).

### /render returns `403 ORIGIN_NOT_ALLOWED`
The request's Origin header doesn't match `ALLOWED_ORIGINS`. Either:
- Add your origin to `wrangler.jsonc` → `vars.ALLOWED_ORIGINS` and redeploy, OR
- For testing only: add `Origin: https://waivz.ai` as a header in your REST client (already one of the allowed origins)

### Build succeeds but /health returns an HTML error page
The deploy probably overwrote bindings. Check Settings → Bindings and re-add if missing. Make sure `wrangler.jsonc` hasn't been accidentally corrupted.

### Browser Rendering quota exceeded
Free tier limits. Either throttle your testing or upgrade to the Workers Paid plan ($5/mo).

---

## What NOT to do from the dashboard

- **Don't edit the Worker code via the dashboard's Quick Edit.** Any changes you make there will be overwritten the next time someone pushes to GitHub. Edit the code on GitHub only.
- **Don't set variables in the dashboard's Variables and Secrets UI** unless you also add `keep_vars = true` to `wrangler.jsonc` — otherwise they get blown away on the next deploy.

Secrets (API tokens, signing keys) are an exception — those you DO set via the dashboard, since they shouldn't live in the GitHub repo. But we don't have any yet in this Worker.

---

## Optional — CLI helpers

The `scripts/` folder has three bash scripts (`sync-template.sh`, `r2-seed.sh`, `smoke-test.sh`) that are CLI-only conveniences. You don't need them for the dashboard workflow. They're there for whoever on the team might eventually use Wrangler directly. Ignore them.
