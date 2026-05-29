/**
 * Tool-calling scaffold for the Barrio Logan Guest Concierge.
 *
 * Defines AI SDK v6 tools that the model can invoke during a chat turn.
 * This bridges the chatbot → agent pattern: instead of the model
 * hallucinating a URL, it calls `directions` and gets the real mapUrl
 * from the guide.
 *
 * Current tools
 * ─────────────
 * • directions — looks up a place by name in the guide and returns its
 *   Google Maps URL. Falls back to a generic Maps query if the place is
 *   not found in the guide (so the model can still help for nearby but
 *   unlisted places without inventing data itself).
 *
 * Wiring
 * ──────
 * Import `buildTools` in route.ts and pass the result to streamText's
 * `tools` option.  The model decides when to call them; the framework
 * executes the `execute` function server-side and returns the result as
 * a tool message before the model continues streaming.
 *
 * AI SDK v6 API notes
 * ───────────────────
 * • tool() uses `inputSchema` (not `parameters`) for the schema definition.
 * • The execute function receives (input, options) — not a destructured arg.
 * • z from "zod" works; the SDK supports both zod v3 and v4 via FlexibleSchema.
 *
 * Model-swap note
 * ───────────────
 * Tools are provider-agnostic in the AI SDK: the same ToolSet works
 * with Ollama (dev) or Anthropic (prod). Switch MODEL_PROVIDER in the
 * deployment env — no code changes required (see src/lib/config.ts).
 */

import { tool } from "ai";
import { z } from "zod";
import type { Guide } from "@/lib/guide";

/**
 * Build the tool set grounded in the provided guide.
 *
 * Called once at module load (from route.ts) so each tool's closure
 * has access to the current guide data.
 */
export function buildTools(guide: Guide) {
  return {
    /**
     * directions — return a Google Maps URL for a named place.
     *
     * The model calls this when a guest asks "how do I get to X?" or
     * "can you send me the map link for Y?".  The execute function looks
     * up the place in the guide and returns its canonical mapUrl, or
     * falls back to a constructed Google Maps search URL so the guest
     * always gets a usable link.
     *
     * AI SDK v6: uses `inputSchema` (a zod schema) and execute receives
     * the validated input as the first argument.
     */
    directions: tool({
      description:
        "Look up the Google Maps URL for a place the guest wants to navigate to. " +
        "Use this whenever the guest asks for directions or a map link to a place " +
        "mentioned in the guide.",
      inputSchema: z.object({
        placeName: z
          .string()
          .describe(
            "The name of the place the guest wants directions to, " +
              "exactly as mentioned in the guide (e.g. 'Chicano Park', " +
              "'Las Cuatro Milpas', 'Coronado Beach')."
          ),
      }),
      execute: async (input) => {
        const { placeName } = input;
        // Search all categories for the named place (case-insensitive).
        const normalised = placeName.toLowerCase().trim();

        for (const category of guide.categories) {
          for (const place of category.places) {
            if (
              place.name.toLowerCase().includes(normalised) ||
              normalised.includes(place.name.toLowerCase())
            ) {
              return {
                found: true,
                name: place.name,
                mapUrl: place.mapUrl,
                address: place.address,
                distanceText: place.distanceText,
              };
            }
          }
        }

        // Place not in the guide — return a generic Google Maps search URL
        // so the guest still gets a useful link, but we flag it as not-in-guide
        // so the model can caveat appropriately.
        const encodedName = encodeURIComponent(
          `${placeName} ${guide.property.neighborhood}`
        );
        return {
          found: false,
          name: placeName,
          mapUrl: `https://maps.google.com/?q=${encodedName}`,
          address: null,
          distanceText: null,
        };
      },
    }),
  } as const;
}

/** The type of the tool set returned by buildTools — for use in streamText typing. */
export type ConciergeTools = ReturnType<typeof buildTools>;
