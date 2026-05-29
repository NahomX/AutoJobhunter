# Quality Leather

Upload photos of a garment → get a **drag-to-spin leather preview** → hand the model + tech pack to a tailor.

> **v0.2 — Gemini hybrid.** The primary preview is an AI-generated leather *turntable* (Google's Nano Banana Pro), with an optional background 3D mesh (Meshy) for the tailor handoff.

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Mock mode

`GEMINI_API_KEY` is **optional**. Leave it unset and the app runs in **mock mode**: the 4 uploaded photos become the 8 turntable frames, so the full flow — upload → progressive loading → drag-to-spin viewer — works with no external API call.

To enable real generation, add your key from [Google AI Studio](https://aistudio.google.com/apikey) to `.env.local`:

```
GEMINI_API_KEY=your_key_here
```

## How it works (pipeline)

1. **Upload** — `POST /api/upload` validates and stores 4 photos (front/back/left/right) under `tmp/<jobId>/`, writes `meta.json`.
2. **Generate** — `POST /api/generate { jobId, wantMesh? }` kicks off a background job (`src/lib/job-runner.ts`) and returns `202` immediately.
3. **Analyze** — Gemini multimodal (`gemini-2.5-flash`) describes the garment (type, silhouette, details) to ground the restyle prompts.
4. **Render** — Nano Banana Pro (`gemini-3-pro-image-preview`) generates `TARGET_VIEW_COUNT` (8) consistent leather-restyled views around the garment. Frames stream into `meta.views` as they finish.
5. **Poll** — `GET /api/status/<jobId>` returns the `StatusPayload` (phase, progress, `viewUrls`, analysis, optional mesh). The result page polls every ~2 s and shows the turntable progressively.
6. **(Optional) Mesh** — if `MESHY_API_KEY` is set and the job requested it, a true 3D GLB is generated in the background and shown in a "3D mesh" tab.

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | No | Google AI Studio key. Unset = mock mode. Powers analysis + turntable. |
| `MESHY_API_KEY` | No | Enables the optional background 3D mesh (hybrid). Unset = turntable only. |
| `NEXT_PUBLIC_BASE_URL` | Production only | Public URL used to build absolute photo URLs for Meshy. Default `http://localhost:3000`. |

### Cost note

Each real preview renders ~8 Nano Banana Pro images. Tune `TARGET_VIEW_COUNT` in `src/lib/types.ts` to trade smoothness for cost.

## Stack

- **Next.js 14** (App Router) + TypeScript
- **Tailwind CSS** — utility classes only
- **Google Gemini** via `@google/genai` — `gemini-2.5-flash` (analysis) + `gemini-3-pro-image-preview` / Nano Banana Pro (image generation)
- **React Three Fiber** + **drei** — optional GLB mesh viewer
- **Meshy AI** Image-to-3D v2 — optional background mesh

## Project structure

```
src/app/                       # Pages and API routes
  page.tsx                     # Landing / upload
  result/[id]/                 # Result + turntable (+ optional mesh tab)
  api/upload/                  # Receive and store 4 photos
  api/generate/                # Start the background job (202)
  api/status/[id]/             # Poll job status (StatusPayload)
  api/views/[jobId]/[index]/   # Serve a generated turntable frame
  api/photos/                  # Serve stored source photos
src/components/
  PhotoUpload.tsx              # 4-slot upload + "also make a 3D mesh" toggle
  TurntableViewer.tsx          # Drag-to-spin frame viewer (primary preview)
  ModelViewer.tsx              # react-three-fiber GLB viewer (mesh tab)
src/lib/
  types.ts                     # Shared contract (Phase, JobMeta, StatusPayload)
  gemini.ts                    # Gemini analysis + leather-view generation
  job-runner.ts                # Background pipeline (mock + real paths)
  meshy.ts                     # Meshy REST client (optional mesh)
  storage.ts                   # Local filesystem helpers (tmp/)
tmp/                           # Uploads + generated frames — gitignored
```

## Deployment note

The background job runner is in-process — fine for local dev and a long-running Node server. On serverless (e.g. Vercel functions), work is killed after the response; a real deployment should move the pipeline to a queue/worker. See `CLAUDE.md`.

## v0 scope

Only the "magic moment" is built: upload → leather turntable (+ optional mesh). Out of scope: measurements form, tech pack PDF, auth, payments, orders, email, admin.
