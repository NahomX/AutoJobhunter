#!/usr/bin/env node
/**
 * Tiny MCP client that spawns the server, lists its tools, and calls
 * generate_leather_views in mock mode. Proves the round-trip works.
 *
 *   npm run demo
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const transport = new StdioClientTransport({
  command: "node",
  args: [path.join(__dirname, "server.mjs")],
});

const client = new Client({ name: "demo-client", version: "0.1.0" });
await client.connect(transport);

const { tools } = await client.listTools();
console.log("Tools advertised by the server:");
for (const t of tools) console.log(`  - ${t.name}: ${t.description}`);

console.log("\nCalling generate_leather_views (mock)…");
const res = await client.callTool({
  name: "generate_leather_views",
  arguments: { photoPaths: ["front.png", "back.png", "left.png", "right.png"], count: 8 },
});
console.log(res.content[0].text);

await client.close();
process.exit(0);
