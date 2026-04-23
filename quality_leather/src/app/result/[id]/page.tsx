'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import type { StatusPayload } from '@/app/api/status/[id]/route'

// ModelViewer can't SSR — three.js needs the browser
const ModelViewer = dynamic(() => import('@/components/ModelViewer'), { ssr: false })

const POLL_INTERVAL_MS = 2_500

export default function ResultPage() {
  const params = useParams()
  const jobId = params.id as string

  const [status, setStatus] = useState<StatusPayload>({ status: 'PENDING', progress: 0 })
  const [pollError, setPollError] = useState<string | null>(null)

  const poll = useCallback(async (signal: AbortSignal) => {
    while (!signal.aborted) {
      let payload: StatusPayload
      try {
        const res = await fetch(`/api/status/${jobId}`, { signal, cache: 'no-store' })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          setPollError((body as { error?: string }).error ?? 'Status check failed')
          return
        }
        payload = (await res.json()) as StatusPayload
      } catch (err) {
        if ((err as Error).name !== 'AbortError') setPollError('Network error while checking status')
        return
      }

      setStatus(payload)

      if (payload.status === 'SUCCEEDED' || payload.status === 'FAILED' || payload.status === 'EXPIRED') {
        return
      }

      await new Promise<void>((resolve) => {
        const t = setTimeout(resolve, POLL_INTERVAL_MS)
        signal.addEventListener('abort', () => { clearTimeout(t); resolve() })
      })
    }
  }, [jobId])

  useEffect(() => {
    const ctrl = new AbortController()
    poll(ctrl.signal)
    return () => ctrl.abort()
  }, [poll])

  const done = status.status === 'SUCCEEDED'
  const failed = status.status === 'FAILED' || status.status === 'EXPIRED'

  return (
    <main className="min-h-screen bg-stone-50">
      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <Link href="/" className="text-sm text-stone-500 hover:text-stone-800 transition-colors">
            ← Back
          </Link>
          <span className="text-xl font-bold text-stone-900">Quality Leather</span>
          <div className="w-12" aria-hidden />
        </div>

        {/* Poll error banner */}
        {pollError && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-5 py-4 mb-6 text-sm">
            {pollError}
          </div>
        )}

        {/* Loading state */}
        {!done && !failed && (
          <div className="bg-white rounded-2xl shadow-sm border border-stone-200 px-8 py-16 text-center">
            <div
              className="w-16 h-16 border-4 border-stone-200 border-t-stone-800 rounded-full animate-spin mx-auto mb-6"
              aria-label="Loading"
            />
            <h2 className="text-xl font-semibold text-stone-800 mb-2">Generating your leather preview…</h2>
            <p className="text-stone-500 mb-8 text-sm">This usually takes 30–90 seconds.</p>
            <div className="w-full max-w-xs mx-auto bg-stone-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-stone-800 h-2 rounded-full transition-all duration-700"
                style={{ width: `${Math.max(4, status.progress)}%` }}
              />
            </div>
            <p className="text-xs text-stone-400 mt-2">{status.progress}%</p>
          </div>
        )}

        {/* Error state */}
        {failed && (
          <div className="bg-white rounded-2xl shadow-sm border border-stone-200 px-8 py-16 text-center">
            <p className="text-5xl mb-4">✖</p>
            <h2 className="text-xl font-semibold text-stone-800 mb-2">Generation failed</h2>
            <p className="text-stone-500 mb-8 text-sm">
              {status.error ?? 'An unexpected error occurred.'}
            </p>
            <Link
              href="/"
              className="inline-block px-6 py-2.5 bg-stone-900 text-white text-sm font-semibold rounded-xl hover:bg-stone-700 transition-colors"
            >
              Try again
            </Link>
          </div>
        )}

        {/* Success state */}
        {done && status.modelUrl && (
          <div>
            <div className="mb-4 flex items-end justify-between">
              <div>
                <h2 className="text-xl font-bold text-stone-900">Your Leather Preview</h2>
                <p className="text-stone-500 text-sm mt-0.5">Drag to rotate · Scroll to zoom</p>
              </div>
              {status.mock && (
                <span className="text-xs bg-amber-100 text-amber-700 rounded-full px-3 py-1 font-medium">
                  Mock mode
                </span>
              )}
            </div>
            <ModelViewer modelUrl={status.modelUrl} isMock={status.mock} />
            {status.mock && (
              <p className="text-xs text-stone-400 text-center mt-3">
                Set <code className="bg-stone-100 px-1 rounded">MESHY_API_KEY</code> in{' '}
                <code className="bg-stone-100 px-1 rounded">.env.local</code> to enable real 3D
                generation.
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
