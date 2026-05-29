/**
 * Background job runner for Quality Leather v0.2 (Gemini hybrid).
 *
 * `startJob(jobId)` fires and forgets — it must be called WITHOUT await from
 * the /api/generate route so the HTTP response returns immediately.
 *
 * Mock path  (meta.mock === true, no GEMINI_API_KEY):
 *   Copies the 4 source photos into view frames in spin order [front, right,
 *   back, left] with small artificial delays, then marks phase:'succeeded'.
 *
 * Real path  (GEMINI_API_KEY set):
 *   1. analyzeGarment  → phase:'analyzing'
 *   2. generateLeatherView × TARGET_VIEW_COUNT → phase:'rendering', progress++
 *   3. phase:'succeeded'
 *   Optionally kicks off Meshy mesh in the background if meta.wantMesh is set.
 */

import { loadMeta, patchMeta, readPhoto, saveView } from '@/lib/storage'
import { analyzeGarment, generateLeatherView, VIEW_SPECS } from '@/lib/gemini'
import { createImageTo3DTask } from '@/lib/meshy'
import { TARGET_VIEW_COUNT } from '@/lib/types'

// ---------------------------------------------------------------------------
// In-flight guard — prevents double-starting the same job.
// ---------------------------------------------------------------------------
const inFlight = new Set<string>()

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Pause for `ms` milliseconds (used by mock path for realistic UI feel). */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ---------------------------------------------------------------------------
// Mock path
// ---------------------------------------------------------------------------

/**
 * Mock spin order: the 4 uploaded slots presented twice to fill 8 frames.
 * Slots come from storage.SLOTS = ['front','back','left','right'].
 * We want a clockwise turntable: front → right → back → left → (repeat).
 */
const MOCK_SPIN_SLOTS = ['front', 'right', 'back', 'left', 'front', 'right', 'back', 'left']

async function runMock(jobId: string): Promise<void> {
  await patchMeta(jobId, { phase: 'rendering', progress: 0 })

  const frameCount = Math.min(TARGET_VIEW_COUNT, MOCK_SPIN_SLOTS.length)

  for (let i = 0; i < frameCount; i++) {
    const slot = MOCK_SPIN_SLOTS[i]
    const photo = await readPhoto(jobId, slot)
    if (!photo) continue

    const filename = await saveView(jobId, i, photo.buffer, photo.ext)

    const progress = Math.round(((i + 1) / frameCount) * 100)
    const meta = await loadMeta(jobId)
    const views = [...meta.views, filename]
    await patchMeta(jobId, { views, progress })

    // Small delay so the loading UI shows meaningful progress
    await sleep(400)
  }

  await patchMeta(jobId, { phase: 'succeeded', progress: 100 })
}

// ---------------------------------------------------------------------------
// Real path
// ---------------------------------------------------------------------------

async function runReal(jobId: string): Promise<void> {
  // --- Step 1: Load photos ---
  const slots = ['front', 'back', 'left', 'right']
  const photos: { buffer: Buffer; mime: string }[] = []
  for (const slot of slots) {
    const photo = await readPhoto(jobId, slot)
    if (photo) {
      const mime = extToMime(photo.ext)
      photos.push({ buffer: photo.buffer, mime })
    }
  }

  if (photos.length === 0) {
    throw new Error('No source photos found for job ' + jobId)
  }

  // --- Step 2: Garment analysis ---
  await patchMeta(jobId, { phase: 'analyzing', progress: 5 })
  const analysis = await analyzeGarment(photos)
  await patchMeta(jobId, { analysis, progress: 15 })

  // --- Step 3: Render turntable views ---
  await patchMeta(jobId, { phase: 'rendering' })

  const viewSpecs = VIEW_SPECS.slice(0, TARGET_VIEW_COUNT)

  for (let i = 0; i < viewSpecs.length; i++) {
    const spec = viewSpecs[i]
    const result = await generateLeatherView(photos, analysis, spec)
    const filename = await saveView(jobId, i, result.buffer, result.ext)

    const meta = await loadMeta(jobId)
    const views = [...meta.views, filename]
    const progress = 15 + Math.round(((i + 1) / viewSpecs.length) * 80)
    await patchMeta(jobId, { views, progress })
  }

  await patchMeta(jobId, { phase: 'succeeded', progress: 100 })

  // --- Step 4: Optional Meshy mesh (fire-and-forget background task) ---
  const meta = await loadMeta(jobId)
  if (meta.wantMesh && process.env.MESHY_API_KEY) {
    try {
      const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
      const imageUrls = slots.map((s) => `${base}/api/photos/${jobId}/${s}`)
      const meshyTaskId = await createImageTo3DTask(imageUrls)
      await patchMeta(jobId, { meshyTaskId, meshStatus: 'IN_PROGRESS' })
    } catch (meshErr) {
      // Mesh failure must not affect the main result — log and continue.
      console.error(`[job-runner] Meshy task failed for ${jobId}:`, meshErr)
    }
  }
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Fire-and-forget pipeline starter. Safe to call without await.
 * Idempotent — will not double-start a job already in flight.
 */
export function startJob(jobId: string): void {
  if (inFlight.has(jobId)) {
    return
  }
  inFlight.add(jobId)

  void (async () => {
    try {
      const meta = await loadMeta(jobId)

      if (meta.mock) {
        await runMock(jobId)
      } else {
        await runReal(jobId)
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      console.error(`[job-runner] Job ${jobId} failed:`, error)
      try {
        await patchMeta(jobId, { phase: 'failed', error })
      } catch {
        // If we can't even write the error, there's nothing more to do.
      }
    } finally {
      inFlight.delete(jobId)
    }
  })()
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function extToMime(ext: string): string {
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
  }
  return map[ext.toLowerCase()] ?? 'image/jpeg'
}
