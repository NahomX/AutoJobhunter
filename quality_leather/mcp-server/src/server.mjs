#!/usr/bin/env node
/**
 * Quality Leather — example MCP server.
 *
 * This demonstrates the package -> MCP relationship: the SAME pipeline logic
 * that the Next.js app calls directly in `src/lib/gemini.ts` is here *wrapped*
 * as tools an AI agent can discover and call over the Model Context Protocol.
 *
 * Two tools are exposed:
 *   - analyze_garment        (Gemini multimodal description)
 *   - generate_leather_views (Nano Banana Pro leather turntable frames)
 *
 * Runs key-free in MOCK mode (set GEMINI_API_KEY to call the real models).
 *
 * IMPORTANT (stdio rule): stdout carries the MCP JSON-RPC stream, so all
 * human/log output goes to stderr (console.error), never console.log.
 *
 * NOTE: For brevity this file inlines slim versions of the analysis/render
 * helpers. In a real setup you'd import them from the app's shared package so
 * there is one implementation behind both the app and the MCP server.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const ANALYSIS_MODEL = "gemini-2.5-flash";
const RENDER_MODEL = "gemini-3-pro-image-preview";
const MOCK = !process.env.GEMINI_API_KEY;

const EXT_TO_MIME = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

/** 45°-apart camera angles for an 8-frame turntable. */
function viewSpecs(count) {
  const base = [
    "front view, straight on",
    "rotated 45° clockwise (front-right 3/4)",
    "right side profile",
    "rotated 135° (back-right 3/4)",
    "back view, straight on",
    "rotated 225° (back-left 3/4)",
    "left side profile",
    "rotated 315° (front-left 3/4)",
  ];
  return Array.from({ length: count }, (_, i) => base[i % base.length]);
}

async function loadImageParts(photoPaths) {
  const parts = [];
  for (const p of photoPaths) {
    const buf = await readFile(p);
    const ext = path.extname(p).slice(1).toLowerCase();
    parts.push({
      inlineData: {
        mimeType: EXT_TO_MIME[ext] ?? "application/octet-stream",
        data: buf.toString("base64"),
      },
    });
  }
  return parts;
}

let _ai = null;
async function getAI() {
  if (_ai) return _ai;
  const { GoogleGenAI } = await import("@google/genai");
  _ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return _ai;
}

// --- the wrapped "package" logic -------------------------------------------

async function analyzeGarment(photoPaths) {
  if (MOCK) {
    return {
      mock: true,
      type: "unknown garment",
      silhouette: "(mock) run with GEMINI_API_KEY for a real description",
      details: ["mock-mode placeholder"],
      colors: ["n/a"],
      summary: `Mock analysis of ${photoPaths.length} photo(s).`,
    };
  }
  const ai = await getAI();
  const imageParts = await loadImageParts(photoPaths);
  const res = await ai.models.generateContent({
    model: ANALYSIS_MODEL,
    contents: [
      {
        text:
          "Describe this garment for a leather-restyle pipeline. Reply with STRICT JSON: " +
          '{"type","silhouette","details":[],"colors":[],"summary"}.',
      },
      ...imageParts,
    ],
  });
  const text = res.text ?? "";
  const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  return { mock: false, ...JSON.parse(json) };
}

async function generateLeatherViews(photoPaths, count, outDir) {
  const specs = viewSpecs(count);
  if (MOCK) {
    // Mock: no API call — report the plan the real path would execute.
    return {
      mock: true,
      requested: count,
      note: "Mock mode: no images generated. Set GEMINI_API_KEY to render.",
      plannedViews: specs.map((angle, i) => ({ index: i, angle })),
      sources: photoPaths.map((p) => path.basename(p)),
    };
  }
  const ai = await getAI();
  const imageParts = await loadImageParts(photoPaths);
  await mkdir(outDir, { recursive: true });
  const written = [];
  for (let i = 0; i < count; i++) {
    const res = await ai.models.generateContent({
      model: RENDER_MODEL,
      contents: [
        {
          text:
            "Restyle THIS exact garment in realistic leather. Render it from: " +
            `${specs[i]}. Neutral studio background. Keep identity consistent across angles.`,
        },
        ...imageParts,
      ],
      config: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "3:4" } },
    });
    const parts = res.candidates?.[0]?.content?.parts ?? [];
    const img = parts.find((p) => p.inlineData?.data);
    if (!img) throw new Error(`No image returned for view ${i}`);
    const ext = (img.inlineData.mimeType ?? "image/png").split("/")[1];
    const file = path.join(outDir, `view_${String(i).padStart(2, "0")}.${ext}`);
    await writeFile(file, Buffer.from(img.inlineData.data, "base64"));
    written.push(file);
  }
  return { mock: false, requested: count, views: written };
}

// --- MCP wiring ------------------------------------------------------------

const server = new McpServer({ name: "quality-leather", version: "0.1.0" });

server.registerTool(
  "analyze_garment",
  {
    title: "Analyze garment",
    description:
      "Describe a garment from photos (type, silhouette, details, colors) to ground a leather restyle. Returns JSON.",
    inputSchema: {
      photoPaths: z.array(z.string()).min(1).describe("Local file paths to garment photos"),
    },
  },
  async ({ photoPaths }) => {
    const analysis = await analyzeGarment(photoPaths);
    return { content: [{ type: "text", text: JSON.stringify(analysis, null, 2) }] };
  },
);

server.registerTool(
  "generate_leather_views",
  {
    title: "Generate leather turntable views",
    description:
      "Generate N consistent leather-restyled views (a turntable) of a garment from photos. " +
      "Mock-safe: runs without an API key. With GEMINI_API_KEY, writes images to outDir.",
    inputSchema: {
      photoPaths: z.array(z.string()).min(1).describe("Local file paths to garment photos"),
      count: z.number().int().min(1).max(24).default(8).describe("Number of turntable frames"),
      outDir: z.string().default("./out").describe("Directory to write generated frames (real mode)"),
    },
  },
  async ({ photoPaths, count, outDir }) => {
    const result = await generateLeatherViews(photoPaths, count, outDir);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    `[quality-leather-mcp] ready on stdio — mode=${MOCK ? "MOCK (no GEMINI_API_KEY)" : "LIVE"}`,
  );
}

main().catch((err) => {
  console.error("[quality-leather-mcp] fatal:", err);
  process.exit(1);
});
