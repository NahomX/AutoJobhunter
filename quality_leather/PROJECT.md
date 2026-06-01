# Quality Leather — Single-File Project Spec

This one file holds the whole project (vision, PRD, contracts, conventions, the orchestrator plan, agent briefs, and owner run/deploy notes). It exists so it can be pasted into a fresh repo and rebuilt from scratch. Once a Claude Code session is running on this repo, it can split this into separate files if preferred (the live repo already keeps `README.md` + `CLAUDE.md` alongside it).

## How to run it (Claude Code session)

1. Make sure the keys you want are set (all optional — the app runs in mock mode with none).
1. Start a session on this repo.
1. Give it this prompt (include the word "workflow" to trigger a dynamic workflow if available; otherwise it runs the same plan as an orchestrator with subagents):

> "Build/extend Quality Leather per the Orchestrator Plan and PRD in PROJECT.md: lock the shared contracts, then build the Gemini backend and the turntable frontend in parallel, then integrate and locally verify in mock mode. Stop at handoff — I deploy myself."

1. Approve the phases and watch it run. When it finishes you get a built, locally-verified app; deploy is yours (see Owner Notes).

-----

# PRD — Quality Leather

## What it is

A web app that turns photos of a garment into a **leather-restyled, drag-to-spin preview**. A user uploads 4 photos (front / back / left / right) of a garment they love; the app generates a leather version of it shown as a rotatable turntable. Optionally it also produces a true 3D mesh. The preview + a paper pattern / tech pack is meant to go to a tailor who sources leather and produces the finished piece.

v0 ships only the core "magic moment": **upload → leather turntable preview.**

## Locked decisions — do not re-litigate

- **Primary preview = AI turntable, not a 3D mesh.** Gemini image models generate 2D images, not meshes. For the v0 magic moment an AI multi-view turntable is faster, cheaper, and more photorealistic for leather than a generated mesh.
- **Mesh is optional + background (hybrid).** Meshy AI image-to-3D is kept for the eventual tailor handoff, generated in the background and shown in a secondary "3D mesh" tab when ready.
- **Frugal + key-optional.** Everything runs in **mock mode** with no API keys (the 4 uploaded photos become the turntable frames). Keys unlock the real pipeline.
- **No database, no auth, no payments in v0.** Local `tmp/` storage; swap for S3 later.

## Stack

- **Next.js 14** (App Router) + TypeScript.
- **Tailwind CSS** — utility classes only, no custom stylesheets.
- **Google Gemini** via `@google/genai` (v2.7): `gemini-2.5-flash` for garment analysis, `gemini-3-pro-image-preview` (Nano Banana Pro) for leather-view image generation. Verify current model IDs / SDK shapes against current docs — do not hardcode from memory.
- **React Three Fiber** + **drei** — optional GLB mesh viewer.
- **Meshy AI** Image-to-3D v2 — optional background mesh.

## Geometry of the experience

- Upload 4 named slots: `front`, `back`, `left`, `right`.
- Generate `TARGET_VIEW_COUNT` (default **8**) leather-restyled views ≈ 45° apart → a drag-to-spin turntable.
- Frames stream in progressively (the UI shows them as they land).

## Contract A — shared types (`src/lib/types.ts`)

SINGLE SOURCE OF TRUTH. Both the API routes and the frontend import from `@/lib/types` — no duplicate shapes.

```ts
type Phase = 'pending' | 'analyzing' | 'rendering' | 'succeeded' | 'failed'
type MeshStatus = 'PENDING' | 'IN_PROGRESS' | 'SUCCEEDED' | 'FAILED' | 'EXPIRED'

interface GarmentAnalysis {
  type: string            // e.g. "bomber jacket"
  silhouette: string
  details: string[]
  colors: string[]
  summary: string
}

const TARGET_VIEW_COUNT = 8

interface JobMeta {            // persisted to tmp/<jobId>/meta.json
  jobId: string
  createdAt: number
  mock: boolean
  // Gemini preview
  phase: Phase
  progress: number            // 0..100
  views: string[]             // ordered frame filenames, e.g. ["view_00.png", ...]
  analysis?: GarmentAnalysis
  error?: string
  // Optional Meshy mesh (hybrid)
  wantMesh?: boolean
  meshyTaskId?: string
  meshStatus?: MeshStatus
  modelUrl?: string           // signed GLB url
}

interface StatusPayload {      // GET /api/status/<jobId>
  phase: Phase
  progress: number
  viewUrls: string[]          // /api/views/<jobId>/<index>, ordered
  analysis?: GarmentAnalysis
  meshStatus?: MeshStatus
  modelUrl?: string
  mock: boolean
  error?: string
}
```

## Contract B — API routes

- `POST /api/upload` — multipart form with 4 image slots. Validates type (jpeg/png/webp/gif) + size (≤10MB), stores under `tmp/<jobId>/<slot>.<ext>`, writes initial `JobMeta` (`phase:'pending'`, `progress:0`, `views:[]`, `mock:!GEMINI_API_KEY`). Returns `201 { jobId }`.
- `POST /api/generate` — body `{ jobId, wantMesh? }`. `patchMeta({ wantMesh })`, fire-and-forget `startJob(jobId)` (NOT awaited), returns `202 { started, mock }`.
- `GET /api/status/[id]` — builds `viewUrls` from `meta.views`; best-effort polls Meshy if a mesh task exists; returns `StatusPayload`.
- `GET /api/views/[jobId]/[index]` — serves the frame at `meta.views[index]` with the right MIME type (path-traversal guarded). 404 if absent.
- `GET /api/photos/[jobId]/[slot]` — serves a stored source photo (also used to build absolute URLs for Meshy in production).

## Pipeline (`src/lib/job-runner.ts`)

`startJob(jobId)` runs the pipeline and is NOT awaited by the route (fire-and-forget with full try/catch). A module-level in-flight `Set<string>` prevents double-starting.

- **Mock path** (`meta.mock === true`): copy the 4 uploaded photos into `view_00..07` in spin order [front, right, back, left] (repeated to fill `TARGET_VIEW_COUNT`), bumping `phase`/`progress`/`views` with small delays, then `phase:'succeeded'`. No external calls.
- **Real path**: `analyzing` (`analyzeGarment`) → `rendering` (loop angles calling `generateLeatherView`, `saveView` each, append filename to `views`, bump `progress`) → `succeeded`. On any error → `patchMeta({ phase:'failed', error })`.
- **Optional mesh**: if `wantMesh && MESHY_API_KEY`, also start a Meshy task; `/api/status` polls it.

## Gemini integration (`src/lib/gemini.ts`)

- Client: `new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })`.
- Model IDs as named constants (`ANALYSIS_MODEL = 'gemini-2.5-flash'`, `RENDER_MODEL = 'gemini-3-pro-image-preview'`) for easy swapping.
- `analyzeGarment(photos)` → multimodal call returning strict-JSON `GarmentAnalysis` (parse defensively).
- `generateLeatherView(photos, analysis, viewSpec)` → image call with `inlineData` reference photos + a prompt ("restyle THIS garment in realistic leather, render from <angle>, neutral studio background, consistent identity") + `config.imageConfig.aspectRatio`; extract the image from `response.candidates[].content.parts[].inlineData` (base64 → Buffer).

## Definition of done

- Mobile-first; renders cleanly on a phone.
- Upload → progressive loading → drag-to-spin turntable works end-to-end **in mock mode with no keys**.
- With `GEMINI_API_KEY`: real garment analysis + leather views render and stream in.
- With `MESHY_API_KEY` + `wantMesh`: a background GLB appears in a "3D mesh" tab.
- Keys are server-only, never committed. Typecheck/lint/build clean.

-----

# Engineering conventions (CLAUDE.md summary)

- Next.js App Router, TypeScript. `'use client'` only where needed (`PhotoUpload`, `TurntableViewer`, `result/[id]/page`, `ModelViewer`). `ModelViewer` is `dynamic(..., { ssr: false })` (Three.js needs the browser).
- Shared types live ONLY in `src/lib/types.ts`; import everywhere. The result page imports `StatusPayload` from `@/lib/types`, NOT from the status route.
- `GEMINI_API_KEY` / `MESHY_API_KEY` are read server-side only; keep `.env.local` gitignored, ship `.env.example`.
- Tailwind utilities only (stone/amber palette). Keep dependencies lean.
- No database / auth / payments / multi-tenant in v0 — out of scope.

-----

# Orchestrator Plan (how it was / is built)

**Scope:** build + integrate + locally verify. **Deploy, hosting, accounts, and secrets are the owner's job** and are NOT part of the run. End at handoff.

**Phase 0 — Preflight.** Confirm stack choices and that `@google/genai` installs. No code yet.

**Phase 1 — Lock contracts (orchestrator, serial).** Write `src/lib/types.ts`, extend `src/lib/storage.ts` (view-frame helpers + `patchMeta`), set `.env.example`, add the Gemini SDK, initialize the new `JobMeta` shape in `/api/upload`. Build must stay green so parallel agents can't collide on shapes.

**Phase 2 — Parallel build** (two agents, strict file ownership):
- **Backend agent** → `src/lib/gemini.ts`, `src/lib/job-runner.ts`, rewrite `/api/generate` + `/api/status`, new `/api/views`. Owns only those files.
- **Frontend agent** → `src/components/TurntableViewer.tsx`, rewrite `src/app/result/[id]/page.tsx`, update `src/app/page.tsx`, light edit `PhotoUpload.tsx` (`wantMesh` toggle). Owns only those files.

**Phase 3 — Integrate + verify** (orchestrator). Full build + lint. End-to-end **mock** smoke test: upload → generate (202) → status streams `TARGET_VIEW_COUNT` frames → succeeded; fetch a frame (200 image); result page (200).

**Phase 4 — Handoff.** Update `README` + `CLAUDE.md`; build report; stop. No deploy.

## Quality pattern

Where useful, have one agent verify another's output (e.g. confirm the SDK call shapes against the installed `@google/genai` types; confirm the turntable renders the mock frames).

-----

# Agent Brief — Backend (Gemini hybrid)

Read this spec first. Build against the locked `src/lib/types.ts` + `src/lib/storage.ts`. **Own only:** `src/lib/gemini.ts`, `src/lib/job-runner.ts`, `/api/generate`, `/api/status/[id]`, `/api/views/[jobId]/[index]`. Verify `@google/genai` v2.7 methods against current docs. `runtime = 'nodejs'` on fs/Gemini routes. Keys server-only. Defensive parsing of all model output. Done when build + lint clean and the mock path yields a working turntable with no key.

# Agent Brief — Frontend (turntable)

Read this spec first. Import `StatusPayload` from `@/lib/types`. **Own only:** `TurntableViewer.tsx`, `result/[id]/page.tsx`, `page.tsx`, light edits to `PhotoUpload.tsx`, and `globals.css` if needed. KEEP `ModelViewer.tsx` for the optional mesh tab. Mobile-first, Tailwind utilities, stone/amber palette. Drag horizontally to spin (map delta → frame index, wrap); show frames progressively as `viewUrls` grows. Done when build + lint clean and the mock turntable drag-spins.

-----

# Owner Notes — run & deploy

The build is local-verified in mock mode; running the **real** pipeline and deploying are yours.

1. **Keys (optional).** `GEMINI_API_KEY` from [Google AI Studio](https://aistudio.google.com/apikey) unlocks analysis + turntable. `MESHY_API_KEY` from [meshy.ai](https://www.meshy.ai/) unlocks the optional background mesh. Put them in `.env.local` (gitignored) — never commit. Each real preview renders ~`TARGET_VIEW_COUNT` Nano Banana Pro images (a few cents/job); tune the count in `src/lib/types.ts`.
2. **Run.** `npm install && cp .env.example .env.local && npm run dev` → http://localhost:3000.
3. **Verify the real render.** With `GEMINI_API_KEY` set, upload 4 photos and confirm the leather views + the `inlineData` extraction (the image model is a preview — its response shape can shift).
4. **Background-job caveat (important for serverless).** `startJob` runs in-process and isn't awaited. Fine for local dev / a long-running Node server, but on serverless (Vercel functions) the work is killed once the `202` returns. Before deploying there, move the pipeline to a durable queue/worker and have `/api/status` read shared state.
5. **Storage.** v0 uses local `tmp/`. Swap `src/lib/storage.ts` for S3 (or similar) before any real multi-user deploy.
