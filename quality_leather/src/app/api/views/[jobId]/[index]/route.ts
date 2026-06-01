/**
 * GET /api/views/[jobId]/[index]
 *
 * Serves a single turntable frame by its ordinal index.
 * Resolves meta.views[index] → readView → returns the image bytes.
 * Returns 404 for missing jobs, out-of-range indices, or unwritten frames.
 */
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { loadMeta, readView, isValidJobId } from '@/lib/storage'

const EXT_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { jobId: string; index: string } },
) {
  const { jobId, index: indexStr } = params

  if (!isValidJobId(jobId)) {
    return NextResponse.json({ error: 'Invalid job id' }, { status: 400 })
  }

  // Validate index is a non-negative integer.
  const index = parseInt(indexStr, 10)
  if (!Number.isInteger(index) || index < 0) {
    return NextResponse.json({ error: 'Invalid frame index' }, { status: 400 })
  }

  const meta = await loadMeta(jobId).catch(() => null)
  if (!meta) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  const filename = meta.views[index]
  if (!filename) {
    return NextResponse.json({ error: 'Frame not yet available' }, { status: 404 })
  }

  const result = await readView(jobId, filename)
  if (!result) {
    return NextResponse.json({ error: 'Frame file not found' }, { status: 404 })
  }

  const contentType = EXT_TO_MIME[result.ext.toLowerCase()] ?? 'application/octet-stream'

  return new NextResponse(new Uint8Array(result.buffer), {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
