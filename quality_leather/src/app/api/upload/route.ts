import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { savePhoto, saveMeta } from '@/lib/storage'

const MAX_BYTES = 10 * 1024 * 1024 // 10 MB
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const SLOTS = ['front', 'back', 'left', 'right'] as const

export async function POST(request: NextRequest) {
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid multipart form data' }, { status: 400 })
  }

  // Validate all four slots before touching the filesystem
  const files: Record<string, File> = {}
  for (const slot of SLOTS) {
    const entry = formData.get(slot)
    if (!(entry instanceof File)) {
      return NextResponse.json({ error: `Missing photo for slot: ${slot}` }, { status: 400 })
    }
    if (!ALLOWED_MIME.has(entry.type)) {
      return NextResponse.json(
        { error: `${slot}: unsupported type "${entry.type}". Use JPEG, PNG, WebP, or GIF.` },
        { status: 400 },
      )
    }
    if (entry.size > MAX_BYTES) {
      return NextResponse.json({ error: `${slot}: file exceeds 10 MB limit` }, { status: 400 })
    }
    files[slot] = entry
  }

  const jobId = uuidv4()

  for (const slot of SLOTS) {
    const file = files[slot]
    const ext = file.type.split('/')[1].replace('jpeg', 'jpg')
    const buffer = Buffer.from(await file.arrayBuffer())
    await savePhoto(jobId, slot, buffer, ext)
  }

  await saveMeta(jobId, { jobId, createdAt: Date.now() })

  return NextResponse.json({ jobId }, { status: 201 })
}
