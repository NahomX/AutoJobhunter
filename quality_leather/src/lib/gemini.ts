/**
 * Gemini helpers for Quality Leather v0.2 (Gemini hybrid).
 *
 * API verified against @google/genai v2.7.0 (dist/genai.d.ts):
 *   - Client:    new GoogleGenAI({ apiKey })
 *   - Inference: ai.models.generateContent({ model, contents, config })
 *   - Contents:  ContentListUnion → Content[] where Content.parts is Part[]
 *   - Inline img: Part.inlineData = { mimeType, data }  (Blob_2 shape)
 *   - Image out:  config.responseModalities = ['TEXT', 'IMAGE'] (string[])
 *                 config.imageConfig = { aspectRatio: '3:4' }  (ImageConfig)
 *   - Extract:   response.candidates[0].content.parts[].inlineData.{data,mimeType}
 *   - Text out:  response.text shorthand OR parts[].text
 */

import { GoogleGenAI } from '@google/genai'
import type { GarmentAnalysis } from '@/lib/types'

// ---------------------------------------------------------------------------
// Model constants — swap here only.
// ---------------------------------------------------------------------------
const ANALYSIS_MODEL = 'gemini-2.5-flash'
const RENDER_MODEL = 'gemini-3-pro-image-preview'

// Lazy singleton so the module can be imported without crashing when no key.
let _ai: GoogleGenAI | null = null
function getClient(): GoogleGenAI {
  if (!_ai) {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) throw new Error('GEMINI_API_KEY is not set')
    _ai = new GoogleGenAI({ apiKey })
  }
  return _ai
}

// ---------------------------------------------------------------------------
// analyzeGarment
// ---------------------------------------------------------------------------

const ANALYSIS_PROMPT = `You are a professional garment analyst. Examine the provided photos of a garment and respond with ONLY a valid JSON object — no markdown fences, no prose — that exactly matches this TypeScript interface:

{
  "type": string,       // e.g. "bomber jacket", "A-line dress"
  "silhouette": string, // short silhouette description
  "details": string[],  // notable construction / style details (3-6 items)
  "colors": string[],   // dominant colors observed (2-4 items)
  "summary": string     // one guest-facing sentence describing the garment
}

Be concise and factual. Do not include any text outside the JSON object.`

/**
 * Analyzes garment photos with Gemini multimodal and returns structured data.
 * Defensively parses the JSON; returns a fallback object on failure.
 */
export async function analyzeGarment(
  photos: { buffer: Buffer; mime: string }[],
): Promise<GarmentAnalysis> {
  const ai = getClient()

  // Build inline-data parts for each photo.
  const imageParts = photos.map((p) => ({
    inlineData: {
      mimeType: p.mime,
      data: p.buffer.toString('base64'),
    },
  }))

  const response = await ai.models.generateContent({
    model: ANALYSIS_MODEL,
    contents: [
      {
        role: 'user',
        parts: [{ text: ANALYSIS_PROMPT }, ...imageParts],
      },
    ],
    config: {
      responseMimeType: 'application/json',
      temperature: 0.2,
    },
  })

  // Extract text from response defensively.
  const raw = response.text ?? ''

  // Strip any accidental markdown fences before parsing.
  const jsonText = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()

  try {
    const parsed = JSON.parse(jsonText) as Partial<GarmentAnalysis>
    return {
      type: typeof parsed.type === 'string' ? parsed.type : 'unknown garment',
      silhouette: typeof parsed.silhouette === 'string' ? parsed.silhouette : '',
      details: Array.isArray(parsed.details) ? parsed.details.filter((d) => typeof d === 'string') : [],
      colors: Array.isArray(parsed.colors) ? parsed.colors.filter((c) => typeof c === 'string') : [],
      summary: typeof parsed.summary === 'string' ? parsed.summary : 'A garment ready for leather transformation.',
    }
  } catch {
    // Fallback: return minimal valid structure rather than crashing.
    return {
      type: 'garment',
      silhouette: 'classic',
      details: [],
      colors: [],
      summary: 'A garment ready for leather transformation.',
    }
  }
}

// ---------------------------------------------------------------------------
// generateLeatherView
// ---------------------------------------------------------------------------

/** Camera angle descriptors for the turntable. Index maps to viewSpec string. */
export const VIEW_SPECS = [
  'front view, facing camera directly',
  'rotated 45° clockwise from front (front-right diagonal)',
  'right side profile',
  'rotated 45° counter-clockwise from back (back-right diagonal)',
  'back view, facing away from camera',
  'rotated 45° clockwise from back (back-left diagonal)',
  'left side profile',
  'rotated 45° counter-clockwise from front (front-left diagonal)',
] as const

/**
 * Generates a single leather-restyled turntable frame using Gemini image generation.
 *
 * @param photos     The 4 uploaded garment photos as inline data.
 * @param analysis   Structured garment analysis from analyzeGarment().
 * @param viewSpec   Camera angle description for this frame.
 */
export async function generateLeatherView(
  photos: { buffer: Buffer; mime: string }[],
  analysis: GarmentAnalysis,
  viewSpec: string,
): Promise<{ buffer: Buffer; ext: string }> {
  const ai = getClient()

  const prompt = `You are a product visualisation artist specialising in luxury leather goods.

Garment being restyled:
- Type: ${analysis.type}
- Silhouette: ${analysis.silhouette}
- Key details: ${analysis.details.join(', ')}
- Original colours: ${analysis.colors.join(', ')}
- Summary: ${analysis.summary}

Task: Restyle this exact garment in premium matte black leather. Preserve every construction detail, seam, and proportion of the original. Render a photorealistic studio image from this camera angle: **${viewSpec}**. Use a clean neutral grey gradient studio background, professional product lighting. The leather texture should be consistent and realistic. Do NOT show a person wearing it — show the garment displayed on an invisible form or floating. Output only the image.`

  const imageParts = photos.map((p) => ({
    inlineData: {
      mimeType: p.mime,
      data: p.buffer.toString('base64'),
    },
  }))

  const response = await ai.models.generateContent({
    model: RENDER_MODEL,
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }, ...imageParts],
      },
    ],
    config: {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: {
        aspectRatio: '3:4',
      },
      temperature: 0.4,
    },
  })

  // Walk candidates → parts → inlineData to find the image.
  const candidates = response.candidates ?? []
  for (const candidate of candidates) {
    const parts = candidate.content?.parts ?? []
    for (const part of parts) {
      const inline = part.inlineData
      if (inline?.data && inline?.mimeType?.startsWith('image/')) {
        const buffer = Buffer.from(inline.data, 'base64')
        const ext = mimeToExt(inline.mimeType)
        return { buffer, ext }
      }
    }
  }

  throw new Error(`Gemini returned no image for view: ${viewSpec}`)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mimeToExt(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
  }
  return map[mime] ?? 'jpg'
}
