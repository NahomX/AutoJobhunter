# Quality Leather — CLAUDE.md

## Product vision

Users upload 4 photos (front / back / left / right) of a garment they love.
Meshy AI generates a 3D model. The user sees a rotatable leather-textured preview.
The 3D model + a paper pattern / tech pack goes to a tailor who sources leather and produces the finished piece.

v0 ships only the core "magic moment": upload → 3D preview.

---

## v0 scope (built)

- 4-photo upload widget (drag-and-drop, client-side validation, server-side validation)
- Meshy AI Image-to-3D v2 integration
- Rotatable react-three-fiber 3D viewer
- Mock mode when `MESHY_API_KEY` is unset: full UI flow with placeholder geometry

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
| Framework | Next.js 14 App Router | Server components, file-based routing, API routes in one repo |
| Styling | Tailwind CSS — utility classes only, no custom CSS | Fast iteration, no stylesheet drift |
| 3D | @react-three/fiber + @react-three/drei | Idiomatic React API over Three.js |
| 3D generation | Meshy AI v2 image-to-3d | Best-in-class garment-friendly image-to-3D, REST API |
| Storage | Local `tmp/` directory | Zero-config for v0; swap for S3 (`src/lib/storage.ts`) |
| Auth | None in v0 | — |

---

## Key implementation details

### Server vs client

- All `src/app/` pages are server components by default.
- `'use client'` only where required: `PhotoUpload.tsx`, `result/[id]/page.tsx`, `ModelViewer.tsx`.
- `ModelViewer` is `dynamic(() => import(...), { ssr: false })` — Three.js requires the browser.

### Job lifecycle

1. `POST /api/upload` → validates 4 photos, generates UUID `jobId`, saves files to `tmp/<jobId>/<slot>.<ext>`, saves `meta.json`.
2. `POST /api/generate` → reads `meta.json`, calls Meshy (or mocks), saves `meshyTaskId` + `mock` flag back to `meta.json`.
3. `GET /api/status/<jobId>` → reads `meta.json`, polls Meshy (or advances mock timer), returns `{ status, progress, modelUrl }`.
4. Result page polls every 2.5 s with `AbortController` cleanup.

### Mock mode

- Active when `MESHY_API_KEY` is unset.
- `/api/generate` returns `{ taskId: "mock_<uuid>", mock: true }`.
- `/api/status` uses an in-process `Map<taskId, createdAt>` to simulate 6 s of progress, then returns `SUCCEEDED` with `modelUrl: "mock://placeholder"`.
- `ModelViewer` receives `isMock: true` and renders a slowly-rotating leather-coloured box instead of fetching a GLB.

### Meshy API

- Base URL: `https://api.meshy.ai`
- Create: `POST /v2/image-to-3d` — `{ image_url, ai_model: "meshy-4", enable_pbr: true }`
- Poll: `GET /v2/image-to-3d/<task_id>`
- Status values: `PENDING | IN_PROGRESS | SUCCEEDED | FAILED | EXPIRED`
- On success: `task.model_urls.glb` is a signed CDN URL to the GLB file.
- Currently sends only the front-view photo as primary. Multi-view support can be added when confirmed available on the plan.

### Photo serving

`GET /api/photos/<jobId>/<slot>` reads from `tmp/` and returns the image with the correct MIME type. This URL is used to build absolute URLs for the Meshy API in production (set `NEXT_PUBLIC_BASE_URL`).

---

## What to build next (priority order)

1. **Measurements form** — height, chest, waist, hips; saved alongside `meta.json`
2. **Tech pack PDF** — generate from 3D model metadata + measurements
3. **S3 storage** — replace `tmp/` in `src/lib/storage.ts` with S3 SDK calls
4. **Auth** — Clerk or NextAuth (add after storage is stable)
5. **Payment flow** — Stripe; charge after 3D preview is approved
6. **Order tracking** — status page for tailor workflow
7. **Email notifications** — Resend or Postmark for order updates
