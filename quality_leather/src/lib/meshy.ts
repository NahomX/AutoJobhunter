const MESHY_BASE = 'https://api.meshy.ai'

export type MeshyStatus = 'PENDING' | 'IN_PROGRESS' | 'SUCCEEDED' | 'FAILED' | 'EXPIRED'

export interface MeshyTask {
  id: string
  status: MeshyStatus
  progress: number
  created_at: number
  expires_at: number
  started_at?: number
  finished_at?: number
  model_urls?: {
    glb: string
    fbx?: string
    usdz?: string
    obj?: string
  }
  thumbnail_url?: string
  video_url?: string
  task_error?: { message: string }
}

interface CreateTaskBody {
  image_url: string
  ai_model?: string
  enable_pbr?: boolean
  surface_mode?: string
}

export async function createImageTo3DTask(imageUrls: string[]): Promise<string> {
  const apiKey = process.env.MESHY_API_KEY
  if (!apiKey) throw new Error('MESHY_API_KEY is not configured')

  const body: CreateTaskBody = {
    image_url: imageUrls[0],
    ai_model: 'meshy-4',
    enable_pbr: true,
  }

  const res = await fetch(`${MESHY_BASE}/v2/image-to-3d`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Meshy error ${res.status}: ${text}`)
  }

  const data = (await res.json()) as { result: string }
  return data.result
}

export async function fetchTaskStatus(meshyTaskId: string): Promise<MeshyTask> {
  const apiKey = process.env.MESHY_API_KEY
  if (!apiKey) throw new Error('MESHY_API_KEY is not configured')

  const res = await fetch(`${MESHY_BASE}/v2/image-to-3d/${meshyTaskId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: 'no-store',
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Meshy error ${res.status}: ${text}`)
  }

  return res.json() as Promise<MeshyTask>
}
