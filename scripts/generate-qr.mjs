#!/usr/bin/env node
/**
 * generate-qr.mjs — QR code helper for the Barrio Logan Guest Concierge.
 *
 * Run this AFTER you have a live deployed URL.
 * No additional npm dependencies required — it delegates to `npx qrcode`.
 *
 * Usage:
 *   node scripts/generate-qr.mjs https://your-project.vercel.app
 *
 * Output:
 *   room-qr.png  (saved in the current working directory)
 *
 * The QR PNG is suitable for printing on a small card to leave in the room.
 * Recommended print size: 5 cm × 5 cm or larger for reliable phone scanning.
 *
 * Equivalent one-liner (if you prefer to skip this script entirely):
 *   npx qrcode "https://your-project.vercel.app" -o room-qr.png
 */

import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const url = process.argv[2];

if (!url) {
  console.error(
    "Usage: node scripts/generate-qr.mjs <live-url>\n" +
    "Example: node scripts/generate-qr.mjs https://my-concierge.vercel.app"
  );
  process.exit(1);
}

if (!url.startsWith("http://") && !url.startsWith("https://")) {
  console.error(`Error: URL must start with http:// or https://\nReceived: ${url}`);
  process.exit(1);
}

const outFile = resolve(process.cwd(), "room-qr.png");

console.log(`Generating QR code for: ${url}`);
console.log(`Output: ${outFile}`);

// npx downloads qrcode on first run (it is not in package.json — intentional,
// keeping prod dependencies lean per the PRD's frugal stance).
const result = spawnSync(
  "npx",
  ["--yes", "qrcode", url, "-o", outFile],
  { stdio: "inherit", shell: true }
);

if (result.status !== 0) {
  console.error("\nQR generation failed. Try the direct one-liner instead:");
  console.error(`  npx qrcode "${url}" -o room-qr.png`);
  process.exit(result.status ?? 1);
}

console.log("\nDone! Print room-qr.png and place it in the room.");
console.log("Verify it scans on your phone before printing a batch.");
