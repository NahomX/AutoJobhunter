import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { loadMeta, saveMeta } from '@/lib/storage'
import { createImageTo3DTask } from '@/lib/meshy'

const MOCK_MODE = !process.env.MESHY_API_KEY

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const jobId = typeof body?.jobId === 'string' ? body.jobId : null
  if (!jobId) {
    return NextResponse.json({ error: 'jobId is required' }, { status: 400 })
  }

  let meta = await loadMeta(jobId).catch(() => null)
  if (!meta) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  if (MOCK_MODE) {
    const meshyTaskId = `mock_${uuidv4()}`
    await saveMeta(jobId, { ...meta, meshyTaskId, mock: true })
    return NextResponse.json({ taskId: meshyTaskId, mock: true })
  }

  // Build absolute photo URLs for Meshy (requires public access in production)
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
  const slots = ['front', 'back', 'left', 'right']
  const imageUrls = slots.map((s) => `${base}/api/photos/${jobId}/${s}`)

  try {
    const meshyTaskId = await createImageTo3DTask(imageUrls)
    await saveMeta(jobId, { ...meta, meshyTaskId, mock: false })
    return NextResponse.json({ taskId: meshyTaskId })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Generation request failed'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
