import { NextRequest, NextResponse } from 'next/server'
import { readPhoto } from '@/lib/storage'

const EXT_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { jobId: string; slot: string } },
) {
  const { jobId, slot } = params
  const result = await readPhoto(jobId, slot)
  if (!result) {
    return NextResponse.json({ error: 'Photo not found' }, { status: 404 })
  }
  const contentType = EXT_TO_MIME[result.ext] ?? 'application/octet-stream'
  return new NextResponse(new Uint8Array(result.buffer), {
    headers: { 'Content-Type': contentType, 'Cache-Control': 'private, max-age=3600' },
  })
}
