import fs from 'fs/promises'
import path from 'path'
import type { JobMeta } from '@/lib/types'

const TMP_DIR = path.join(process.cwd(), 'tmp')

/** Original upload slots. */
export const SLOTS = ['front', 'back', 'left', 'right'] as const
export type Slot = (typeof SLOTS)[number]

async function jobDir(jobId: string): Promise<string> {
  const dir = path.join(TMP_DIR, jobId)
  await fs.mkdir(dir, { recursive: true })
  return dir
}

// ---------------------------------------------------------------------------
// Uploaded source photos
// ---------------------------------------------------------------------------

export async function savePhoto(
  jobId: string,
  slot: string,
  buffer: Buffer,
  ext: string,
): Promise<void> {
  const dir = await jobDir(jobId)
  await fs.writeFile(path.join(dir, `${slot}.${ext}`), buffer)
}

export async function readPhoto(
  jobId: string,
  slot: string,
): Promise<{ buffer: Buffer; ext: string } | null> {
  const dir = path.join(TMP_DIR, jobId)
  let entries: string[]
  try {
    entries = await fs.readdir(dir)
  } catch {
    return null
  }
  const match = entries.find((f) => f.startsWith(`${slot}.`))
  if (!match) return null
  const ext = path.extname(match).slice(1)
  const buffer = await fs.readFile(path.join(dir, match))
  return { buffer, ext }
}

// ---------------------------------------------------------------------------
// Generated turntable view frames (view_00.png, view_01.png, ...)
// ---------------------------------------------------------------------------

/** Save a generated frame and return its filename (e.g. "view_03.png"). */
export async function saveView(
  jobId: string,
  index: number,
  buffer: Buffer,
  ext: string,
): Promise<string> {
  const dir = await jobDir(jobId)
  const filename = `view_${String(index).padStart(2, '0')}.${ext}`
  await fs.writeFile(path.join(dir, filename), buffer)
  return filename
}

/** Read a generated frame by its stored filename. */
export async function readView(
  jobId: string,
  filename: string,
): Promise<{ buffer: Buffer; ext: string } | null> {
  // Guard against path traversal — only allow simple view_*.ext names.
  if (!/^view_\d{2,}\.[a-z0-9]+$/i.test(filename)) return null
  const filepath = path.join(TMP_DIR, jobId, filename)
  try {
    const buffer = await fs.readFile(filepath)
    return { buffer, ext: path.extname(filename).slice(1) }
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Job metadata (meta.json)
// ---------------------------------------------------------------------------

export async function saveMeta(jobId: string, meta: JobMeta): Promise<void> {
  const dir = await jobDir(jobId)
  await fs.writeFile(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2))
}

export async function loadMeta(jobId: string): Promise<JobMeta> {
  const filepath = path.join(TMP_DIR, jobId, 'meta.json')
  const raw = await fs.readFile(filepath, 'utf-8')
  return JSON.parse(raw) as JobMeta
}

/** Read-modify-write a job's meta atomically enough for the in-process runner. */
export async function patchMeta(
  jobId: string,
  patch: Partial<JobMeta>,
): Promise<JobMeta> {
  const current = await loadMeta(jobId)
  const next = { ...current, ...patch }
  await saveMeta(jobId, next)
  return next
}
