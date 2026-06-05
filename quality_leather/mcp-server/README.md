# Quality Leather — MCP server (example)

A standalone **Model Context Protocol** server that wraps the Quality Leather
pipeline as **agent-callable tools**. It exists to illustrate the difference
between a *package* (code you import) and an *MCP server* (a capability an AI
agent discovers and calls).

> **Isolated by design.** This folder has its own `package.json` and
> dependencies. It does **not** touch or affect the Next.js app in the parent
> directory. Delete it freely.

## Tools exposed

| Tool | What it does |
|---|---|
| `analyze_garment` | Describe a garment from photos (type, silhouette, details, colors). |
| `generate_leather_views` | Generate N consistent leather-restyled turntable views. |

Both run **key-free in mock mode**. Set `GEMINI_API_KEY` to call the real
Gemini models (`gemini-2.5-flash` for analysis, `gemini-3-pro-image-preview`
for image generation).

## Try it

```bash
cd quality_leather/mcp-server
npm install
npm run demo        # spawns the server, lists tools, calls one in mock mode
```

To run the server itself (stdio):

```bash
npm start
# optionally: GEMINI_API_KEY=... npm start   (live mode)
```

## Register it with an MCP client

Add to a client's MCP config (e.g. Claude Desktop's `claude_desktop_config.json`,
or `.mcp.json` for Claude Code):

```jsonc
{
  "mcpServers": {
    "quality-leather": {
      "command": "node",
      "args": ["/absolute/path/to/quality_leather/mcp-server/src/server.mjs"],
      "env": { "GEMINI_API_KEY": "your_key_here" }   // omit for mock mode
    }
  }
}
```

Then any connected agent can call `analyze_garment` / `generate_leather_views`
on its own — the same logic the app uses internally, now available to *any*
MCP-compatible agent.

## The point

`src/server.mjs` is thin: it imports the pipeline logic and exposes it via
`server.registerTool(...)`. The *package* is the reusable code; the *MCP server*
is that code made discoverable and callable by an AI agent over a protocol.
