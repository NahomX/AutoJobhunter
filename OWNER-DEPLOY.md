# Owner Deploy Runbook — Barrio Logan Guest Concierge

The build workflow produces a locally-verified Next.js app. Deployment is yours.
This document is the step-by-step guide.

---

## Prerequisites

- The app builds cleanly: `npm run build` passes with no errors.
- You have a GitHub account and the repo is pushed there (or on another Git host Vercel can connect to).
- You have an Anthropic API key (get one at https://console.anthropic.com).

---

## Step 1 — Pick your host

### Option A: Vercel Hobby (default — easiest)

**Current free-tier limits (verified May 2026):**

| Resource | Hobby (free) limit |
|---|---|
| Bandwidth | 100 GB / month |
| Serverless function invocations | 1,000,000 / month |
| Edge requests | 1,000,000 / month |
| Active CPU time | 4 hours / month |
| Provisioned memory | 360 GB-hours / month |
| Blob storage | 1 GB |
| Deployments | Unlimited (personal projects) |
| Custom domains | Supported |

For a single Airbnb property with a handful of guests per day, you will not come close to any of these limits. The `/api/chat` route is the only serverless function; each streaming request counts as one invocation.

**Important:** Vercel Hobby is for personal/non-commercial use. If this property is a professional rental business, review Vercel's terms or use Cloudflare instead.

---

### Option B: Cloudflare Pages (more frugal — recommended if commercial)

**Current free-tier limits (verified May 2026):**

| Resource | Free limit |
|---|---|
| Bandwidth (static assets) | Unlimited |
| Workers requests (API/functions) | 100,000 / day |
| Builds | 500 / month |
| Files per site | 20,000 |
| Max file size | 25 MiB |
| Custom domains | Supported |

Static pages (the guide) are served for free with no request cap. The concierge
API calls count against the Workers 100 k/day free quota — again, far more than
a single property needs. Cloudflare has no commercial-use restriction on free tier.

**Cloudflare deploy note:** Cloudflare Pages supports Next.js App Router via
`@cloudflare/next-on-pages`. The build command changes to
`npx @cloudflare/next-on-pages` and you add `export const runtime = "edge"` to
`src/app/api/chat/route.ts`. See https://developers.cloudflare.com/pages/framework-guides/nextjs/ for current instructions.

---

## Step 2 — Connect the repo and deploy

### Vercel

1. Go to https://vercel.com → New Project → Import your Git repo.
2. Vercel auto-detects Next.js. The `vercel.json` in the repo is already configured.
3. Leave the build command as the Vercel default (`next build`).
4. Do NOT set any env vars yet — do that in step 3.
5. Click Deploy. The first deploy will fail or fall back to Ollama (no key set) — that is fine; you fix it in step 3.

### Cloudflare Pages

1. Go to https://dash.cloudflare.com → Workers & Pages → Create → Pages → Connect to Git.
2. Set the build command to `npx @cloudflare/next-on-pages` and the output directory to `.vercel/output/static`.
3. Add `NODE_VERSION=20` as a build env var.
4. Deploy once (it may fail on the chat route without the key — fix in step 3).

---

## Step 3 — Set the model key as a deployment secret

**Never put your API key in the repo or in `.env.example`.**

### Vercel

1. Project → Settings → Environment Variables.
2. Add:
   - `MODEL_PROVIDER` = `anthropic`
   - `ANTHROPIC_API_KEY` = `sk-ant-...` (mark as **Secret**)
   - `ANTHROPIC_MODEL` = `claude-haiku-4-5` (or leave unset — that is the default)
3. Redeploy (Deployments → Redeploy, or push a commit).

### Cloudflare

```bash
wrangler secret put ANTHROPIC_API_KEY
# paste your key at the prompt — it never appears in logs
wrangler pages deploy --project-name <your-project>
```

Also set plain vars in the dashboard:
- `MODEL_PROVIDER` = `anthropic`
- `ANTHROPIC_MODEL` = `claude-haiku-4-5`

---

## Step 4 — Grab the live URL

After a successful deploy Vercel shows a URL like `https://barrio-logan-concierge.vercel.app`.
Copy it.

---

## Step 5 — Generate the QR code

Once you have the live URL:

```bash
node scripts/generate-qr.mjs https://your-project.vercel.app
```

This writes `room-qr.png` to your working directory.

Alternatively, the direct one-liner (no script needed):

```bash
npx qrcode "https://your-project.vercel.app" -o room-qr.png
```

Print the PNG at 5 cm × 5 cm or larger on a small card and place it in the room.

---

## Step 6 — Smoke-test on your phone

Scan the QR with your phone (not the browser on your laptop — a real mobile device):

1. The landing page loads with property name, wifi, check-in/out info.
2. Browse the guide categories (grocery, food, beaches, activities, transit).
3. Open the chat tab and ask a question about the neighborhood. Confirm it answers from the guide and streams the response.
4. Ask 4 questions total. On the 4th, confirm the "out of questions" message appears.
5. Confirm the chat input is disabled at 0 questions remaining.
6. To test the midnight reset without waiting: open DevTools → Application → Local Storage → delete the `concierge.questions` key → reload. The counter should be back at 4.
7. Ask an off-topic question (e.g., "what is the capital of France?"). The concierge should warmly decline.

---

## Prod model swap summary

| Setting | Dev (.env.local) | Prod (host secrets) |
|---|---|---|
| `MODEL_PROVIDER` | `ollama` | `anthropic` |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | not needed |
| `OLLAMA_MODEL` | `llama3.2` | not needed |
| `ANTHROPIC_API_KEY` | not set | set as secret |
| `ANTHROPIC_MODEL` | not set | `claude-haiku-4-5` (or omit for default) |

Zero code changes between dev and prod — only env vars differ.

---

## Rate-limit verification notes

The 4/day cap is client-side (localStorage). It is trust-based and by design has
no server-side enforcement. Key behaviors to verify:

- Counter key: `concierge.questions`, format `YYYY-MM-DD:count` (local date, not UTC).
- Stale day (yesterday's date in the key) is treated as 0 — fresh day, counter reset.
- At 0 remaining, the frontend disables the input and shows the out-of-quota message.
- localStorage errors (private browsing, storage full) fail open — the guest is NOT blocked.
- The cap is intentionally easy to bypass; it is a polite daily governor, not a paywall.

Manual reset for testing: DevTools → Application → Local Storage → delete `concierge.questions`.

---

## Secrets checklist

- [ ] `ANTHROPIC_API_KEY` set as a deployment secret (never in the repo)
- [ ] `.env.local` is in `.gitignore` (already configured)
- [ ] No real keys appear in `.env.example` (only placeholder comments)
- [ ] `git log --all -p | grep "sk-ant"` returns nothing before first push

---

## Free-tier sources (verified May 2026)

- Vercel Hobby limits: https://vercel.com/docs/plans/hobby
- Vercel limits reference: https://vercel.com/docs/limits
- Cloudflare Pages limits: https://developers.cloudflare.com/pages/platform/limits/
- Cloudflare Workers pricing: https://developers.cloudflare.com/workers/platform/pricing/
