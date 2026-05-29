'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import type { StatusPayload } from '@/lib/types'
import TurntableViewer from '@/components/TurntableViewer'

// ModelViewer can't SSR — three.js requires the browser
const ModelViewer = dynamic(() => import('@/components/ModelViewer'), { ssr: false })

const POLL_INTERVAL_MS = 2_000

type PreviewTab = 'turntable' | 'mesh'

export default function ResultPage() {
  const params = useParams()
  const jobId = params.id as string

  const [status, setStatus] = useState<StatusPayload | null>(null)
  const [pollError, setPollError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<PreviewTab>('turntable')

  const poll = useCallback(
    async (signal: AbortSignal) => {
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
          if ((err as Error).name !== 'AbortError')
            setPollError('Network error while checking status')
          return
        }

        setStatus(payload)

        if (
          payload.phase === 'succeeded' ||
          payload.phase === 'failed'
        ) {
          return
        }

        await new Promise<void>((resolve) => {
          const t = setTimeout(resolve, POLL_INTERVAL_MS)
          signal.addEventListener('abort', () => {
            clearTimeout(t)
            resolve()
          })
        })
      }
    },
    [jobId],
  )

  useEffect(() => {
    const ctrl = new AbortController()
    poll(ctrl.signal)
    return () => ctrl.abort()
  }, [poll])

  // Derived state
  const phase = status?.phase ?? 'pending'
  const isLoading = phase === 'pending' || phase === 'analyzing' || phase === 'rendering'
  const isFailed = phase === 'failed'
  const isSucceeded = phase === 'succeeded'

  // Show turntable progressively once frames are streaming in
  const hasFrames = (status?.viewUrls?.length ?? 0) > 0
  const showProgressiveTurntable = isLoading && hasFrames

  const hasMesh = isSucceeded && !!status?.modelUrl && status.meshStatus === 'SUCCEEDED'

  // Phase-aware loading label
  function loadingLabel(): string {
    if (!status) return 'Starting up…'
    const { phase: p, progress, viewUrls } = status
    if (p === 'analyzing') return 'Analyzing your garment…'
    if (p === 'rendering') {
      const done = viewUrls?.length ?? 0
      return `Rendering leather views… ${done}/8`
    }
    return `Generating your leather preview… ${progress}%`
  }

  return (
    <main className="min-h-screen bg-stone-50">
      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <Link
            href="/"
            className="text-sm text-stone-500 hover:text-stone-800 transition-colors"
          >
            &#8592; Back
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

        {/* Loading state (no frames yet) */}
        {isLoading && !showProgressiveTurntable && (
          <div className="bg-white rounded-2xl shadow-sm border border-stone-200 px-8 py-16 text-center">
            <div
              className="w-16 h-16 border-4 border-stone-200 border-t-stone-800 rounded-full animate-spin mx-auto mb-6"
              aria-label="Loading"
            />
            <h2 className="text-xl font-semibold text-stone-800 mb-2">{loadingLabel()}</h2>
            <p className="text-stone-500 mb-8 text-sm">This usually takes 30–90 seconds.</p>
            <div className="w-full max-w-xs mx-auto bg-stone-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-stone-800 h-2 rounded-full transition-all duration-700"
                style={{ width: `${Math.max(4, status?.progress ?? 0)}%` }}
              />
            </div>
            <p className="text-xs text-stone-400 mt-2">{status?.progress ?? 0}%</p>
          </div>
        )}

        {/* Progressive turntable (frames streaming, not yet succeeded) */}
        {showProgressiveTurntable && (
          <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-stone-700">Generating…</h2>
              <span className="text-xs text-stone-400">{loadingLabel()}</span>
            </div>
            {/* Slim progress bar */}
            <div className="w-full bg-stone-100 rounded-full h-1.5 mb-5 overflow-hidden">
              <div
                className="bg-amber-500 h-1.5 rounded-full transition-all duration-700"
                style={{ width: `${Math.max(4, status?.progress ?? 0)}%` }}
              />
            </div>
            <TurntableViewer viewUrls={status!.viewUrls} />
          </div>
        )}

        {/* Error state */}
        {isFailed && (
          <div className="bg-white rounded-2xl shadow-sm border border-stone-200 px-8 py-16 text-center">
            <p className="text-5xl mb-4" aria-hidden>
              &#10006;
            </p>
            <h2 className="text-xl font-semibold text-stone-800 mb-2">Generation failed</h2>
            <p className="text-stone-500 mb-8 text-sm">
              {status?.error ?? 'An unexpected error occurred.'}
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
        {isSucceeded && status && (
          <div>
            {/* Title row */}
            <div className="mb-5 flex flex-wrap items-start gap-3 justify-between">
              <div>
                <h2 className="text-2xl font-bold text-stone-900">
                  Your Leather Preview&nbsp;
                  <span className="text-stone-400 font-normal text-base">· drag to spin</span>
                </h2>
                {status.analysis && (
                  <p className="text-stone-500 text-sm mt-1">{status.analysis.summary}</p>
                )}
              </div>

              <div className="flex items-center gap-2">
                {status.mock && (
                  <span className="text-xs bg-amber-100 text-amber-700 rounded-full px-3 py-1 font-medium">
                    Mock mode
                  </span>
                )}
              </div>
            </div>

            {/* Analysis chips */}
            {status.analysis && status.analysis.details.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-5">
                {[
                  status.analysis.type,
                  status.analysis.silhouette,
                  ...status.analysis.details,
                ]
                  .slice(0, 6)
                  .map((chip, i) => (
                    <span
                      key={i}
                      className="text-xs bg-stone-100 text-stone-600 rounded-full px-3 py-1 border border-stone-200"
                    >
                      {chip}
                    </span>
                  ))}
              </div>
            )}

            {/* Tab bar (only show if mesh is also ready) */}
            {hasMesh && (
              <div className="flex gap-1 bg-stone-100 rounded-xl p-1 mb-5 w-fit">
                <button
                  onClick={() => setActiveTab('turntable')}
                  className={`text-sm font-medium px-4 py-1.5 rounded-lg transition-colors ${
                    activeTab === 'turntable'
                      ? 'bg-white text-stone-900 shadow-sm'
                      : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  Leather views
                </button>
                <button
                  onClick={() => setActiveTab('mesh')}
                  className={`text-sm font-medium px-4 py-1.5 rounded-lg transition-colors ${
                    activeTab === 'mesh'
                      ? 'bg-white text-stone-900 shadow-sm'
                      : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  3D mesh
                </button>
              </div>
            )}

            {/* Primary viewer */}
            {(activeTab === 'turntable' || !hasMesh) && (
              <TurntableViewer viewUrls={status.viewUrls} />
            )}

            {/* Mesh viewer (secondary tab) */}
            {activeTab === 'mesh' && hasMesh && status.modelUrl && (
              <ModelViewer modelUrl={status.modelUrl} isMock={status.mock} />
            )}

            {/* Mock hint */}
            {status.mock && (
              <p className="text-xs text-stone-400 text-center mt-4">
                Set{' '}
                <code className="bg-stone-100 px-1 rounded">GEMINI_API_KEY</code> in{' '}
                <code className="bg-stone-100 px-1 rounded">.env.local</code> to enable real
                AI leather views.
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
