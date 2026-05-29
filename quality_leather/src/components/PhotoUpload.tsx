'use client'

import { useState, useRef, DragEvent, ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'

const SLOTS = [
  { key: 'front', label: 'Front' },
  { key: 'back', label: 'Back' },
  { key: 'left', label: 'Left Side' },
  { key: 'right', label: 'Right Side' },
] as const

type SlotKey = (typeof SLOTS)[number]['key']

type PhotoMap = Record<SlotKey, File | null>
type PreviewMap = Record<SlotKey, string | null>

export default function PhotoUpload() {
  const router = useRouter()
  const [photos, setPhotos] = useState<PhotoMap>({ front: null, back: null, left: null, right: null })
  const [previews, setPreviews] = useState<PreviewMap>({ front: null, back: null, left: null, right: null })
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [wantMesh, setWantMesh] = useState(false)
  const refs = useRef<Record<SlotKey, HTMLInputElement | null>>({ front: null, back: null, left: null, right: null })

  function setFile(slot: SlotKey, file: File) {
    const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!ALLOWED.includes(file.type)) {
      setError(`${slot}: only JPEG, PNG, WebP, or GIF allowed`)
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError(`${slot}: file exceeds 10 MB`)
      return
    }
    setError(null)
    setPhotos((p) => ({ ...p, [slot]: file }))
    const url = URL.createObjectURL(file)
    setPreviews((p) => ({ ...p, [slot]: url }))
  }

  function onDrop(slot: SlotKey, e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) setFile(slot, file)
  }

  function onChange(slot: SlotKey, e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) setFile(slot, file)
  }

  async function submit() {
    const missing = SLOTS.filter((s) => !photos[s.key]).map((s) => s.label)
    if (missing.length) {
      setError(`Please upload: ${missing.join(', ')}`)
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const fd = new FormData()
      for (const { key } of SLOTS) fd.append(key, photos[key] as File)

      const upRes = await fetch('/api/upload', { method: 'POST', body: fd })
      if (!upRes.ok) {
        const j = await upRes.json().catch(() => ({}))
        throw new Error((j as { error?: string }).error ?? 'Upload failed')
      }
      const { jobId } = (await upRes.json()) as { jobId: string }

      const genRes = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, wantMesh }),
      })
      if (!genRes.ok) {
        const j = await genRes.json().catch(() => ({}))
        throw new Error((j as { error?: string }).error ?? 'Generation request failed')
      }

      router.push(`/result/${jobId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setSubmitting(false)
    }
  }

  const allReady = SLOTS.every((s) => photos[s.key] !== null)

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="grid grid-cols-2 gap-4 mb-6">
        {SLOTS.map(({ key, label }) => (
          <div
            key={key}
            role="button"
            tabIndex={0}
            aria-label={`Upload ${label} photo`}
            className="relative border-2 border-dashed border-stone-300 rounded-xl flex flex-col items-center justify-center min-h-48 cursor-pointer hover:border-stone-500 hover:bg-stone-50 transition-colors focus:outline-none focus:ring-2 focus:ring-stone-400"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => onDrop(key, e)}
            onClick={() => refs.current[key]?.click()}
            onKeyDown={(e) => e.key === 'Enter' && refs.current[key]?.click()}
          >
            <input
              ref={(el) => { refs.current[key] = el }}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => onChange(key, e)}
            />
            {previews[key] ? (
              <div className="w-full h-full p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previews[key]!}
                  alt={label}
                  className="w-full h-40 object-cover rounded-lg"
                />
                <p className="text-center text-sm font-medium text-stone-600 mt-2">{label}</p>
              </div>
            ) : (
              <div className="flex flex-col items-center py-8 px-4 text-center">
                <span className="text-4xl text-stone-300 mb-2 select-none">+</span>
                <span className="text-sm font-semibold text-stone-500">{label}</span>
                <span className="text-xs text-stone-400 mt-1">Drop or click to upload</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {error && (
        <p role="alert" className="text-red-600 text-sm mb-4 text-center">
          {error}
        </p>
      )}

      {/* Optional 3D mesh generation */}
      <label className="flex items-center gap-3 mb-5 cursor-pointer select-none group">
        <input
          type="checkbox"
          checked={wantMesh}
          onChange={(e) => setWantMesh(e.target.checked)}
          className="w-4 h-4 rounded border-stone-300 accent-stone-900 cursor-pointer"
        />
        <span className="text-sm text-stone-600 group-hover:text-stone-800 transition-colors">
          Also generate a 3D mesh{' '}
          <span className="text-stone-400 text-xs">(takes longer)</span>
        </span>
      </label>

      <button
        onClick={submit}
        disabled={!allReady || submitting}
        className="w-full py-3 px-6 bg-stone-900 text-white font-semibold rounded-xl disabled:opacity-40 disabled:cursor-not-allowed hover:bg-stone-700 active:bg-stone-800 transition-colors"
      >
        {submitting ? 'Uploading…' : 'Generate Leather Preview'}
      </button>

      {!allReady && !error && (
        <p className="text-center text-xs text-stone-400 mt-3">
          {SLOTS.filter((s) => photos[s.key]).length} / 4 photos added
        </p>
      )}
    </div>
  )
}
