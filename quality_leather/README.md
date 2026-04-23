# Quality Leather

Upload photos of a garment → get a rotatable 3D leather preview → hand the model + tech pack to a tailor.

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Mock mode

`MESHY_API_KEY` is **optional**. Leave it unset and the app runs in **mock mode**: uploads are saved locally, a fake Meshy job is created, and after ~6 seconds the result page shows a rotating leather-coloured 3D box. The full UI flow — upload → loading state → 3D viewer — works without any external API call.

To enable real 3D generation, add your key from [meshy.ai](https://www.meshy.ai/) to `.env.local`:

```
MESHY_API_KEY=your_key_here
```

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `MESHY_API_KEY` | No | Meshy AI API key. Unset = mock mode. |
| `NEXT_PUBLIC_BASE_URL` | Production only | Public URL used to build absolute photo URLs for Meshy. Default: `http://localhost:3000`. |

## Stack

- **Next.js 14** (App Router) + TypeScript
- **Tailwind CSS** — utility classes only
- **React Three Fiber** + **drei** — 3D viewer
- **Meshy AI** Image-to-3D v2 API

## Project structure

```
src/app/               # Pages and API routes
  page.tsx             # Landing / upload
  result/[id]/         # Result + 3D viewer
  api/upload/          # Receive and store 4 photos
  api/generate/        # Kick off Meshy job (or mock)
  api/status/[id]/     # Poll job status
  api/photos/          # Serve stored photos
src/components/
  PhotoUpload.tsx      # 4-slot drag-and-drop upload widget
  ModelViewer.tsx      # react-three-fiber canvas
src/lib/
  meshy.ts             # Typed Meshy REST client
  storage.ts           # Local filesystem helpers (tmp/)
tmp/                   # Uploaded photos — gitignored, created on first upload
```

## v0 scope

Only the "magic moment" is built: upload → 3D preview. Out of scope for v0:
measurements form, tech pack PDF, auth, payments, orders, email, admin.
