/**
 * Shared contract types for Quality Leather (v0.2 — Gemini hybrid).
 *
 * SINGLE SOURCE OF TRUTH for the job/status shapes. The API routes and the
 * frontend both import from here — no duplicate definitions.
 *
 * Canonical import path: @/lib/types
 *
 * Pipeline overview:
 *   upload → analyze (Gemini multimodal) → render N leather views
 *   (Nano Banana Pro) → drag-to-spin turntable.  Optionally, a Meshy
 *   image-to-3D mesh is generated in the background (hybrid) for the
 *   eventual tailor handoff.
 */

/** Coarse lifecycle phase for the Gemini preview pipeline. */
export type Phase =
  | "pending" // job created, work not started
  | "analyzing" // Gemini multimodal describing the garment
  | "rendering" // Nano Banana Pro generating turntable views
  | "succeeded" // views ready
  | "failed"; // something went wrong (see `error`)

/** Status of the optional background Meshy mesh (hybrid mode). */
export type MeshStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "SUCCEEDED"
  | "FAILED"
  | "EXPIRED";

/** Structured garment description from Gemini multimodal ("omni") analysis. */
export interface GarmentAnalysis {
  /** e.g. "bomber jacket", "A-line dress" */
  type: string;
  /** short silhouette description */
  silhouette: string;
  /** notable construction/style details */
  details: string[];
  /** dominant colors observed (informational; output is restyled to leather) */
  colors: string[];
  /** one-sentence guest-facing summary */
  summary: string;
}

/**
 * Number of turntable frames a full (non-mock) render targets.
 * 8 frames ≈ 45° apart — smooth enough to drag-spin, modest cost.
 */
export const TARGET_VIEW_COUNT = 8;

/**
 * Persisted job record (meta.json). Written by /api/generate + the background
 * runner, read by /api/status and /api/views.
 */
export interface JobMeta {
  jobId: string;
  createdAt: number;
  mock: boolean;

  // --- Gemini preview pipeline ---
  phase: Phase;
  /** 0..100 across analyze + render */
  progress: number;
  /** ordered frame filenames stored on disk, e.g. ["view_00.png", ...] */
  views: string[];
  analysis?: GarmentAnalysis;
  error?: string;

  // --- Optional Meshy mesh (hybrid) ---
  wantMesh?: boolean;
  meshyTaskId?: string;
  meshStatus?: MeshStatus;
  /** signed GLB url once the mesh succeeds */
  modelUrl?: string;
}

/** Response shape of GET /api/status/<jobId>. */
export interface StatusPayload {
  phase: Phase;
  progress: number;
  /** ordered URLs to turntable frames: /api/views/<jobId>/<index> */
  viewUrls: string[];
  analysis?: GarmentAnalysis;
  /** optional background mesh */
  meshStatus?: MeshStatus;
  modelUrl?: string;
  mock: boolean;
  error?: string;
}
