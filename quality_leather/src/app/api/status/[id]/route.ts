/**
 * GET /api/status/[id]
 *
 * Returns a StatusPayload describing the current state of a Gemini hybrid job.
 * viewUrls are built as /api/views/<jobId>/<index> for each saved frame.
 * If a Meshy task ID is recorded, best-effort polls it and updates the meta.
 */
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { loadMeta, patchMeta } from '@/lib/storage'
import { fetchTaskStatus } from '@/lib/meshy'
import type { StatusPayload, MeshStatus } from '@/lib/types'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const jobId = params.id
  const meta = await loadMeta(jobId).catch(() => null)
  if (!meta) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  // Build view URLs — one per saved frame.
  const viewUrls = meta.views.map((_filename, i) => `/api/views/${jobId}/${i}`)

  // Best-effort Meshy poll — only when a real task exists.
  let meshStatus: MeshStatus | undefined = meta.meshStatus
  let modelUrl: string | undefined = meta.modelUrl

  if (meta.meshyTaskId && !meta.mock) {
    try {
      const task = await fetchTaskStatus(meta.meshyTaskId)
      meshStatus = task.status as MeshStatus
      if (task.model_urls?.glb) {
        modelUrl = task.model_urls.glb
      }
      // Persist the updated mesh state (best-effort — don't fail the response).
      await patchMeta(jobId, { meshStatus, modelUrl }).catch(() => undefined)
    } catch {
      // Swallow Meshy errors — they must not block the turntable response.
    }
  }

  const payload: StatusPayload = {
    phase: meta.phase,
    progress: meta.progress,
    viewUrls,
    analysis: meta.analysis,
    meshStatus,
    modelUrl,
    mock: meta.mock,
    error: meta.error,
  }

  return NextResponse.json(payload)
}
