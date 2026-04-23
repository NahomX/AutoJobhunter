import { NextRequest, NextResponse } from 'next/server'
import { loadMeta } from '@/lib/storage'
import { fetchTaskStatus, MeshyStatus } from '@/lib/meshy'

export interface StatusPayload {
  status: MeshyStatus
  progress: number
  modelUrl?: string
  error?: string
  mock?: boolean
}

// In-process mock clock. Resets on cold start — fine for dev.
const mockCreatedAt = new Map<string, number>()
const MOCK_DURATION_MS = 6_000

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const meta = await loadMeta(params.id).catch(() => null)
  if (!meta?.meshyTaskId) {
    return NextResponse.json({ error: 'Job not found or generation not started' }, { status: 404 })
  }

  if (meta.mock) {
    const taskId = meta.meshyTaskId
    if (!mockCreatedAt.has(taskId)) mockCreatedAt.set(taskId, Date.now())
    const elapsed = Date.now() - mockCreatedAt.get(taskId)!

    if (elapsed < MOCK_DURATION_MS) {
      const progress = Math.round((elapsed / MOCK_DURATION_MS) * 90)
      return NextResponse.json<StatusPayload>({ status: 'IN_PROGRESS', progress, mock: true })
    }

    return NextResponse.json<StatusPayload>({
      status: 'SUCCEEDED',
      progress: 100,
      // modelUrl signals mock mode to the viewer — no real GLB is fetched
      modelUrl: 'mock://placeholder',
      mock: true,
    })
  }

  try {
    const task = await fetchTaskStatus(meta.meshyTaskId)
    const payload: StatusPayload = {
      status: task.status,
      progress: task.progress,
      modelUrl: task.model_urls?.glb,
      error: task.task_error?.message,
    }
    return NextResponse.json(payload)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Status check failed'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
