'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

interface TurntableViewerProps {
  viewUrls: string[]
}

// How many pixels of horizontal drag map to one full revolution
const DRAG_PIXELS_PER_REVOLUTION = 300

// Auto-advance frame interval in ms (when idle)
const AUTO_ADVANCE_MS = 120

export default function TurntableViewer({ viewUrls }: TurntableViewerProps) {
  const [frameIndex, setFrameIndex] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [showHint, setShowHint] = useState(true)

  // Keep a ref to the current frameIndex for use inside event handlers
  const frameIndexRef = useRef(0)
  frameIndexRef.current = frameIndex

  // Track accumulated drag delta
  const dragStartXRef = useRef<number | null>(null)
  const dragStartFrameRef = useRef<number>(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const frameCount = viewUrls.length

  // Preload all frames
  useEffect(() => {
    viewUrls.forEach((url) => {
      const img = new Image()
      img.src = url
    })
  }, [viewUrls])

  // Auto-advance when idle
  useEffect(() => {
    if (frameCount <= 1 || isDragging) return
    const timer = setInterval(() => {
      setFrameIndex((i) => (i + 1) % frameCount)
    }, AUTO_ADVANCE_MS)
    return () => clearInterval(timer)
  }, [frameCount, isDragging])

  // Dismiss hint on first interaction
  const dismissHint = useCallback(() => setShowHint(false), [])

  // --- Pointer / mouse drag ---
  const onPointerDown = useCallback(
    (clientX: number) => {
      if (frameCount <= 1) return
      dragStartXRef.current = clientX
      dragStartFrameRef.current = frameIndexRef.current
      setIsDragging(true)
      dismissHint()
    },
    [frameCount, dismissHint],
  )

  const onPointerMove = useCallback(
    (clientX: number) => {
      if (!isDragging || dragStartXRef.current === null || frameCount <= 1) return
      const delta = clientX - dragStartXRef.current
      // Map drag delta to frame offset
      const frameOffset = Math.round((delta / DRAG_PIXELS_PER_REVOLUTION) * frameCount)
      const newIndex = ((dragStartFrameRef.current - frameOffset) % frameCount + frameCount) % frameCount
      setFrameIndex(newIndex)
    },
    [isDragging, frameCount],
  )

  const onPointerUp = useCallback(() => {
    setIsDragging(false)
    dragStartXRef.current = null
  }, [])

  // Mouse events
  const onMouseDown = (e: React.MouseEvent) => onPointerDown(e.clientX)
  const onMouseMove = (e: React.MouseEvent) => onPointerMove(e.clientX)
  const onMouseUp = () => onPointerUp()
  const onMouseLeave = () => { if (isDragging) onPointerUp() }

  // Touch events
  const onTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0]
    if (touch) onPointerDown(touch.clientX)
  }
  const onTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0]
    if (touch) onPointerMove(touch.clientX)
  }
  const onTouchEnd = () => onPointerUp()

  if (frameCount === 0) {
    return (
      <div className="w-full aspect-[4/3] bg-stone-100 rounded-2xl flex items-center justify-center">
        <span className="text-stone-400 text-sm">No frames yet…</span>
      </div>
    )
  }

  const currentUrl = viewUrls[frameIndex] ?? viewUrls[0]

  return (
    <div className="w-full select-none">
      {/* Main frame container */}
      <div
        ref={containerRef}
        className={`relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-stone-100 ${
          frameCount > 1 ? 'cursor-ew-resize' : 'cursor-default'
        }`}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        // Prevent native scroll while dragging on touch
        style={{ touchAction: frameCount > 1 ? 'none' : 'auto' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={currentUrl}
          alt={`Leather preview — frame ${frameIndex + 1} of ${frameCount}`}
          className="w-full h-full object-cover"
          draggable={false}
        />

        {/* Drag hint overlay */}
        {showHint && frameCount > 1 && (
          <div className="absolute inset-x-0 bottom-4 flex justify-center pointer-events-none">
            <div className="flex items-center gap-2 bg-black/50 text-white text-xs font-medium rounded-full px-4 py-2">
              {/* Left/right arrows hint */}
              <span aria-hidden>&#8592;</span>
              <span>drag to spin</span>
              <span aria-hidden>&#8594;</span>
            </div>
          </div>
        )}
      </div>

      {/* Frame indicator dots */}
      {frameCount > 1 && (
        <div className="flex justify-center gap-1.5 mt-3" role="tablist" aria-label="Frame indicator">
          {Array.from({ length: frameCount }, (_, i) => (
            <button
              key={i}
              role="tab"
              aria-selected={i === frameIndex}
              aria-label={`Frame ${i + 1}`}
              onClick={() => { setFrameIndex(i); dismissHint() }}
              className={`rounded-full transition-all duration-200 ${
                i === frameIndex
                  ? 'w-4 h-2 bg-stone-800'
                  : 'w-2 h-2 bg-stone-300 hover:bg-stone-500'
              }`}
            />
          ))}
        </div>
      )}

      {/* Frame counter text */}
      {frameCount > 1 && (
        <p className="text-center text-xs text-stone-400 mt-1">
          {frameIndex + 1} / {frameCount}
        </p>
      )}
    </div>
  )
}
