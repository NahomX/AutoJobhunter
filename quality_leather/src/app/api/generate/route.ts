/**
 * POST /api/generate
 *
 * Body: { jobId: string, wantMesh?: boolean }
 *
 * Patches the job meta with wantMesh, then fires the background pipeline
 * (startJob) WITHOUT awaiting it, and returns 202 immediately.
 * The client polls /api/status/<id> to track progress.
 */
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { loadMeta, patchMeta, isValidJobId } from '@/lib/storage'
import { startJob } from '@/lib/job-runner'

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const jobId =
    body !== null && typeof body === 'object' && 'jobId' in body && typeof (body as Record<string, unknown>).jobId === 'string'
      ? (body as Record<string, unknown>).jobId as string
      : null

  if (!jobId) {
    return NextResponse.json({ error: 'jobId is required' }, { status: 400 })
  }
  if (!isValidJobId(jobId)) {
    return NextResponse.json({ error: 'Invalid jobId' }, { status: 400 })
  }

  const wantMesh =
    body !== null && typeof body === 'object' && 'wantMesh' in body
      ? Boolean((body as Record<string, unknown>).wantMesh)
      : false

  const meta = await loadMeta(jobId).catch(() => null)
  if (!meta) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  // Persist the wantMesh preference before kicking off the runner.
  await patchMeta(jobId, { wantMesh })

  // Fire-and-forget — do NOT await.
  startJob(jobId)

  return NextResponse.json({ started: true, mock: meta.mock }, { status: 202 })
}
