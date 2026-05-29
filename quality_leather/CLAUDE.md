# Quality Leather — CLAUDE.md

## Product vision

Users upload 4 photos (front / back / left / right) of a garment they love.
The app generates a **leather-restyled, drag-to-spin preview** of that garment.
Optionally, a true 3D model is also produced. The preview + a paper pattern /
tech pack goes to a tailor who sources leather and produces the finished piece.

v0 ships only the core "magic moment": upload → leather turntable preview.

---

## v0.2 scope (built) — Gemini hybrid

- 4-photo upload widget (drag-and-drop, client + server validation)
- **Gemini multimodal garment analysis** (`gemini-2.5-flash`)
- **Nano Banana Pro turntable** (`gemini-3-pro-image-preview`): N consistent
  leather-restyled views → drag-to-spin viewer (the primary preview)
- **Optional background Meshy mesh** (hybrid) → "3D mesh" tab when a GLB is ready
- Background job runner with progressive frame streaming
- Mock mode when `GEMINI_API_KEY` is unset: the 4 uploaded photos become the
  turntable frames — full UI flow with no external call

## Out of scope (not started)

- Measurements form (height, chest, waist, hips)
- Tech pack / paper pattern PDF generation
- Auth / login
- Payments
- Order management
- Email notifications
- Admin views

---

## Stack decisions

| Concern | Choice | Why |
|---|---|---|
| Framework | Next.js 14 App Router | Server components, file routing, API routes in one repo |
| Styling | Tailwind CSS — utility classes only | Fast iteration, no stylesheet drift |
| Garment analysis | Gemini `gemini-2.5-flash` via `@google/genai` | Multimodal; grounds the restyle prompts + future tech pack |
| Leather preview | Nano Banana Pro `gemini-3-pro-image-preview` | SOTA identity-preserving multi-view image gen → turntable |
| 3D mesh (optional) | Meshy AI v2 image-to-3d | True GLB for the tailor handoff; runs in the background |
| 3D viewer | @react-three/fiber + @react-three/drei | Idiomatic React over Three.js |
| Storage | Local `tmp/` directory | Zero-config for v0; swap for S3 in `src/lib/storage.ts` |
| Auth | None in v0 | — |

### Why Gemini instead of Meshy as primary?

Gemini image models (Nano Banana / Pro) generate **2D images, not 3D meshes** —
they can't be a drop-in Meshy replacement. But for the v0 "magic moment" an
AI-generated multi-view *turntable* is faster, cheaper, and more photorealistic
for leather texture than a generated mesh. Meshy is kept as an optional
background mesh for the eventual tailor handoff (the hybrid).

---

## Architecture

### Shared contract — `src/lib/types.ts`

`Phase`, `GarmentAnalysis`, `JobMeta`, `StatusPayload`, `TARGET_VIEW_COUNT`.
SINGLE SOURCE OF TRUTH for job/status shapes — both API routes and the frontend
import from here. The result page imports `StatusPayload` from `@/lib/types`
(NOT from the status route).

### Server vs client

- `src/app/` pages are server components by default.
- `'use client'`: `PhotoUpload.tsx`, `TurntableViewer.tsx`, `result/[id]/page.tsx`, `ModelViewer.tsx`.
- `ModelViewer` is `dynamic(() => import(...), { ssr: false })` — Three.js needs the browser.

### Job lifecycle

1. `POST /api/upload` → validates 4 photos, generates `jobId`, saves files to
   `tmp/<jobId>/<slot>.<ext>`, writes `meta.json` with `{ phase:'pending', progress:0, views:[], mock:!GEMINI_API_KEY }`.
2. `POST /api/generate { jobId, wantMesh? }` → `patchMeta({ wantMesh })`,
   fire-and-forget `startJob(jobId)` (NOT awaited), returns `202 { started, mock }`.
3. `src/lib/job-runner.ts` runs the pipeline, `patchMeta`-ing progress:
   - **mock**: copies the 4 photos into `view_00..07` (spin order front/right/back/left), progressive delays, then `succeeded`.
   - **real**: `analyzing` (Gemini analysis) → `rendering` (loop `TARGET_VIEW_COUNT` angles via Nano Banana Pro, append each frame to `views`) → `succeeded`. On error → `failed` + `error`.
   - if `wantMesh && MESHY_API_KEY`: also starts a Meshy task; status polls it.
4. `GET /api/status/<jobId>` → builds `viewUrls` from `meta.views`, best-effort polls Meshy, returns `StatusPayload`.
5. `GET /api/views/<jobId>/<index>` → serves the frame at `meta.views[index]` (path-traversal guarded).
6. Result page polls every ~2.5 s (AbortController), renders the turntable as frames stream in.

### Gemini (`src/lib/gemini.ts`)

- Client: `new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })` (`@google/genai` v2.7).
- Model IDs are named constants (`ANALYSIS_MODEL`, `RENDER_MODEL`) for easy swapping.
- `analyzeGarment(photos)` → `gemini-2.5-flash`, returns strict-JSON `GarmentAnalysis` (parsed defensively).
- `generateLeatherView(photos, analysis, viewSpec)` → `gemini-3-pro-image-preview` with `inlineData` reference photos + `config.imageConfig.aspectRatio`; extracts the image from `response.candidates[].content.parts[].inlineData`.

### Keys & safety

`GEMINI_API_KEY` / `MESHY_API_KEY` are **server-only** — never sent to the
client, never committed. Keep `.env.local` gitignored; ship `.env.example`.

---

## Known limitation — background work on serverless

`startJob` runs in-process and isn't awaited by the route. This is fine for
local dev and a long-running Node server, but on serverless (e.g. Vercel
functions) the work is killed once the `202` response returns. Before deploying,
move the pipeline to a queue/worker (e.g. a durable task runner) and have
`/api/status` read shared state.

---

## What to build next (priority order)

1. **Measurements form** — height, chest, waist, hips; saved alongside `meta.json`
2. **Tech pack PDF** — generate from the garment analysis + measurements
3. **Durable job queue** — replace in-process `startJob` for serverless deploy
4. **S3 storage** — replace `tmp/` in `src/lib/storage.ts`
5. **Auth** — Clerk or NextAuth
6. **Payment flow** — Stripe; charge after preview is approved
7. **Order tracking + email** — tailor workflow status + notifications
