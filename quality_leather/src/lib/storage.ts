import fs from 'fs/promises'
import path from 'path'

const TMP_DIR = path.join(process.cwd(), 'tmp')

export interface JobMeta {
  jobId: string
  createdAt: number
  meshyTaskId?: string
  mock?: boolean
}

async function jobDir(jobId: string): Promise<string> {
  const dir = path.join(TMP_DIR, jobId)
  await fs.mkdir(dir, { recursive: true })
  return dir
}

export async function savePhoto(
  jobId: string,
  slot: string,
  buffer: Buffer,
  ext: string,
): Promise<void> {
  const dir = await jobDir(jobId)
  await fs.writeFile(path.join(dir, `${slot}.${ext}`), buffer)
}

export async function readPhoto(jobId: string, slot: string): Promise<{ buffer: Buffer; ext: string } | null> {
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

export async function saveMeta(jobId: string, meta: JobMeta): Promise<void> {
  const dir = await jobDir(jobId)
  await fs.writeFile(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2))
}

export async function loadMeta(jobId: string): Promise<JobMeta> {
  const filepath = path.join(TMP_DIR, jobId, 'meta.json')
  const raw = await fs.readFile(filepath, 'utf-8')
  return JSON.parse(raw) as JobMeta
}
