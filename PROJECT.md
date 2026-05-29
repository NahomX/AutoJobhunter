# Barrio Logan Guest Concierge — Single-File Project Spec

This one file holds the entire project (spec, conventions, orchestrator plan, agent briefs, deploy notes). It exists so it can be created in a GitHub repo from a phone with one paste. Once a Claude Code session is running on this repo, it can split this into separate files if preferred.

## How to run it (Claude Code cloud session)

1. Make sure the address tokens in the PRD section below are filled in (a dynamic workflow can’t pause to ask you mid-run).
1. Start a Claude Code session on this repo from your phone.
1. Give it this prompt (include the word “workflow” to trigger a dynamic workflow if available; if the trigger isn’t offered in the web session, drop the word “workflow” and it runs the same plan as an orchestrator with subagents):

> “Run a workflow that builds this project per the Orchestrator Plan and PRD in PROJECT.md: content + scaffold phases in parallel, then bot / frontend / rate-limit, then integrate and locally verify. Stop at handoff — I deploy myself.”
1. Approve the planned phases and watch it run. When it finishes you get a built, locally-verified app; deploy is yours (see Owner Deploy section).

-----

-----

# PRD — Barrio Logan Guest Concierge

## What it is

A single-property Airbnb guest microsite scoped to **{{HOST_ADDRESS}}**. Two parts:

1. A curated local guide (grocery, food, beaches, activities, getting around) centered on the address.
1. An AI concierge chat for anything not in the guide, capped at **4 questions per guest per day**.

Guests reach it by scanning a QR code in the room.

## Locked decisions — do not re-litigate

- **Audience:** real guests. Deployed, not a demo.
- **Content:** curated, baked in. **No database.** The concierge answers ONLY from the guide.
- **Rate limit:** soft, per-device, **client-side** (localStorage). 4/day, resets at local midnight. Trust-based — no server state.
- **Cost stance:** frugal. Free hosting tier + open-source framework. Open-weight models welcome.
- **Scope:** ONE property at {{HOST_ADDRESS}}. No multi-tenant, no auth, no accounts.

## Stack

- **Next.js (App Router) + Vercel AI SDK (`ai`)** — open source (Apache 2.0), provider-agnostic.
- **Model:** dev = local open-weight model via **Ollama**; prod = swappable (Claude Haiku is a one-line change). Agents must verify current AI SDK provider package names/versions against current docs — do **not** hardcode from memory.
- **Host:** Vercel Hobby (free) by default; Cloudflare as the more-frugal alternative. Deploy agent confirms current free-tier limits.
- **Content:** `guide.json` produced by the Cowork content agent, bundled in the repo.

## Scope & geography — the “narrow to my address” part

All distances/times are computed **from {{HOST_ADDRESS}}**. Every place is tiered:

- **walk** — ≤ ~15 min on foot
- **short-hop** — ≤ ~15 min by drive / transit / bike (beaches, larger grocery, etc.)

Do not include generic “things to do in San Diego.” Only what a guest staying at *this* address would actually use.

## Contract A — `guide.json` schema

```json
{
  "property": {
    "name": "{{PROPERTY_NAME}}",
    "address": "{{HOST_ADDRESS}}",
    "neighborhood": "Barrio Logan, San Diego, CA",
    "wifi": { "ssid": "{{WIFI_SSID}}", "password": "{{WIFI_PASSWORD}}" },
    "checkin": "{{CHECKIN}}",
    "checkout": "{{CHECKOUT}}",
    "houseRules": ["string"]
  },
  "categories": [
    {
      "id": "grocery | food | beaches | activities | transit",
      "label": "string",
      "places": [
        {
          "name": "string",
          "blurb": "string (1-2 sentences, guest-facing)",
          "tier": "walk | short-hop",
          "distanceText": "e.g. 6 min walk  /  10 min drive",
          "address": "string",
          "mapUrl": "https://maps.google.com/?q=...",
          "hours": "string",
          "priceLevel": "$ | $$ | $$$",
          "tags": ["string"],
          "hostTip": "string"
        }
      ]
    }
  ]
}
```

## Contract B — `/api/chat`

- Frontend uses the AI SDK `useChat` hook; it POSTs `{ messages }` to `/api/chat`.
- The route runs server-side, injects the system prompt + full `guide.json` as grounding, and **streams** the reply.
- The model API key lives in a server env var / deployment secret. **NEVER in client code, never committed.**
- Off-topic questions → a warm decline. (The daily cap is enforced client-side — see `deploy-and-limits.md`.)
- No web/tool calls to the open internet at runtime; the guide is the only knowledge source.

## System prompt (concierge persona)

A friendly, concise local host for **{{PROPERTY_NAME}}** at **{{HOST_ADDRESS}}**. Answers only from the guide, about the immediate area and house basics. Warmly declines anything off-topic. Never invents places, prices, or hours. When the guest is out of questions for the day, gives a kind “back tomorrow” message.

## Definition of done

- Renders any valid `guide.json`, mobile-first.
- Chat streams, stays grounded in the guide, refuses off-topic gracefully.
- 4/day cap works and resets at local midnight; clear out-of-quota message.
- Deployed on a free tier, reachable via QR, key never exposed client-side.
- Typecheck + lint clean, no secrets in the repo.

-----

# CLAUDE.md — Barrio Logan Guest Concierge

Read `PRD.md` first — it is the source of truth. This file covers engineering conventions only.

## Stack

- Next.js App Router, TypeScript.
- Vercel AI SDK (`ai`) for the concierge. Provider-agnostic. **Verify current provider package names and versions against the current AI SDK docs before installing** — do not assume from memory.
- Dev model: local open-weight model via Ollama. Prod model: swappable (Claude Haiku default).
- **No database.** Content is `guide.json` in the repo. Rate limit is client-side localStorage.

## Commands

- Dev server: `npm run dev`
- Always run typecheck + lint before declaring a task done.

## Conventions

- TypeScript types for `guide.json` live in one shared module and are imported everywhere — no duplicate shapes.
- The model key is read from a **server** env var only. Never reference it in a client component. No keys committed; keep `.env.local` gitignored and ship `.env.example`.
- Mobile-first. Assume every guest is on a phone.
- Keep dependencies lean — this is a frugal single-page guest site, not an app platform.

## Guardrails (scope discipline)

- Concierge answers ONLY from `guide.json`. No open-internet calls at runtime.
- Do NOT add a database, user accounts, auth, or multi-tenant code — explicitly out of scope (see PRD).
- If a decision seems missing, check `PRD.md` first. Only escalate to the human PM if it is truly unspecified there.

## Definition of done

See PRD “Definition of done”, plus: typecheck + lint clean and no secrets in the repo.

-----

# Orchestrator Plan — Barrio Logan Guest Concierge (dynamic-workflow spec)

This is the plan a Claude Code **dynamic workflow** encodes. The runtime runs it in the background as a script that spawns subagents per phase. See `WORKFLOW.md` for how to launch it.

**Scope:** build + integrate + locally verify the app. **Deploy and all hosting/accounts/secrets are the owner’s job and are NOT part of this workflow.** End at handoff.

## Inputs — must be set BEFORE the run

A workflow cannot stop to ask anything mid-run. Therefore:

- The address tokens in `PRD.md` must already be filled. If `{{HOST_ADDRESS}}` is still a placeholder at preflight, **ABORT** the run and report that it must be filled in first. Do not guess or continue.

## Read

- `PRD.md` — spec + locked decisions (source of truth).
- `CLAUDE.md` — engineering conventions.
- `agents/*.md` — the per-workstream briefs each phase’s agents follow.

## Phases

**Phase 0 — Preflight.** Verify address tokens are filled (abort if not). Confirm the PRD stack choices. No code yet.

**Phase 1 — Parallel kickoff** (independent, run together):

- content agent → `agents/content.cowork.md` → `guide.json` (needs WebSearch).
- scaffold agent → `agents/scaffold.md` → repo + shared contracts + placeholder guide.

**Phase 2 — Parallel build** (after scaffold completes), three agents at once:

- `agents/bot-engine.md` · `agents/frontend.md` · `agents/deploy-and-limits.md` (rate-limit code only — deploy is owner-run).
- Build against the placeholder guide. Hold the PRD line: no database, no Azure, no multi-property.

**Phase 3 — Integrate + verify** (orchestration step; agents don’t self-integrate):

- Swap the real `guide.json` from Phase 1 into the repo.
- Resolve conflicts, run typecheck + lint, check the PRD Definition of Done.
- Local smoke test: dev server boots, chat streams and stays on-topic, the 4/day cap blocks and resets.

**Phase 4 — Handoff.** Produce a short build report: what was built, how to run it locally, and a pointer to `OWNER-DEPLOY.md` for the deploy steps the owner runs. The workflow ends here — no deploy.

## Quality pattern (optional, workflow-friendly)

Where useful, have an independent reviewer agent check another’s output before it’s accepted — e.g. one validates `guide.json` against the schema and flags unverified places; another confirms the bot refuses off-topic prompts. This adversarial cross-check is a strength of the workflow model.

-----

# Cowork Task — Local Guide Content

**Goal:** produce `guide.json` (schema in `PRD.md`, Contract A) centered on **{{HOST_ADDRESS}}**.

## Method

1. Use {{HOST_ADDRESS}} as the origin. For every candidate place, find its real **walk time** and **drive/transit time** from that address.
1. Tier each place: `walk` (≤ ~15 min on foot) or `short-hop` (≤ ~15 min drive / transit / bike).
1. Fill these categories, 4–8 entries each, best first:
- **grocery** — nearest real grocery store plus any walkable markets / bodegas.
- **food** — Barrio Logan has a strong food scene; prioritize standout walkable spots, then short-hops worth it.
- **beaches** — these are short-hops, not walks. Be honest about how a guest gets there (trolley, drive, parking reality, the Coronado ferry, etc.).
- **activities** — Chicano Park, galleries, the waterfront, breweries, Mercado del Barrio, etc.
- **transit** — trolley/bus access, bike options, getting to the airport and downtown, parking notes for the room.
1. For each place: real current **hours**, a 1–2 sentence guest-facing **blurb**, a Google Maps URL, price level, useful tags, and a genuine **host tip** — the kind of thing a local would actually tell a friend.
1. **Verify everything.** No invented places, prices, or hours. Flag anything you couldn’t confirm.

## Output

- One valid `guide.json` matching Contract A exactly (leave the `property` block tokens as-is if the PM hasn’t filled them — the build agents handle those).
- A short `content-notes.md` listing anything unverified or seasonal (e.g., summer beach parking, places with shifting hours).

## Done when

`guide.json` validates against the schema, every entry is real and correctly tiered from the address, and the host tips read like a person wrote them — not a directory listing.

-----

# Claude Code Task — Scaffold + Contracts (RUN FIRST)

Read `PRD.md` and `CLAUDE.md` first.

**Goal:** stand up the repo and lock the shared contracts so `bot-engine`, `frontend`, and `deploy-and-limits` can run in parallel afterward.

## Do

1. Create a Next.js (App Router, TypeScript) app.
1. Add the Vercel AI SDK (`ai`) and a provider for **Ollama** (local dev model). Verify current package names/versions against the current AI SDK docs before installing.
1. Define shared TypeScript types for `guide.json` (Contract A) in one module. Add a placeholder `guide.json` with 1–2 sample entries per category so the other agents can build against real shapes.
1. Stub `/api/chat` (Contract B): an AI SDK **streaming** route that injects a placeholder system prompt + the guide and reads the model key from a server env var. Wire it to Ollama for local dev.
1. Add `.env.example`, `.gitignore` (ignore `.env.local`), run steps in the repo README, and lint + typecheck config.

## Do NOT

Build the real UI, the real system prompt, deployment, or the rate limit — those are separate tasks. Stay in your lane so the parallel agents don’t collide.

## Done when

`npm run dev` runs; `/api/chat` streams a reply from a local Ollama model against the placeholder guide; the `guide.json` types are importable across the app.

-----

# Claude Code Task — Concierge Engine

Read `PRD.md` and `CLAUDE.md` first. **Depends on:** `scaffold.md` merged. Build against the placeholder `guide.json`.

## Do

1. Write the real **system prompt** (PRD “System prompt”): scoped host persona for {{PROPERTY_NAME}} at {{HOST_ADDRESS}}, answers only from the guide, warm off-topic refusal, never invents places/prices/hours.
1. Inject the full `guide.json` into context **server-side** inside `/api/chat`. Confirm the route streams.
1. Add a **tool-calling scaffold** to demonstrate the pattern — e.g. a `directions` tool that returns a Google Maps URL for a named place. Keep it minimal but real; this is the bridge from “chatbot” to “agent.”
1. Make the model **swappable**: dev = Ollama, prod = a one-line swap to Claude Haiku via env config. Document the swap clearly in code comments and the repo README.
1. Cooperate with the client-side daily cap: if the client signals the guest is out of quota, return the warm “back tomorrow” message rather than a model call. (The cap itself lives in `deploy-and-limits.md`.)

## Done when

Chat answers correctly and only from the placeholder guide, refuses off-topic warmly, streams token-by-token, and the model swaps via env with no code changes.

-----

# Claude Code Task — Guide + Chat UI

Read `PRD.md` and `CLAUDE.md` first. **Depends on:** `scaffold.md` merged (uses the shared types + `/api/chat`). Build against the placeholder `guide.json`.

## Do

1. **Home / landing:** clean header with {{PROPERTY_NAME}}, wifi, and check-in/out basics up top — the first thing a guest sees after scanning the QR.
1. **Guide:** browse the categories (grocery / food / beaches / activities / transit). Each place is a card with its blurb, a **tier badge** (walk vs short-hop), distance text, hours, a map link, and the host tip.
1. **Chat:** use the AI SDK `useChat` hook — streaming messages, input box, typing state.
1. **Questions-left indicator:** show how many of the 4 daily questions remain (reads the client-side counter from `deploy-and-limits.md`); disable the input at 0 with the out-of-quota message.
1. Mobile-first, fast, legible on a phone. No heavy UI dependencies.

## Done when

Any valid `guide.json` renders cleanly on a phone, chat streams via `/api/chat`, and the questions-left indicator reflects the counter accurately.

-----

# Claude Code Task — Rate Limit (deploy is owner-run)

Read `PRD.md` and `CLAUDE.md` first. **Depends on:** `scaffold.md` merged.

**In scope for the workflow:** the client-side rate limit (code) + deploy-ready config.
**Out of scope / owner-run:** actual deployment, hosting accounts, secrets, the live QR — see `OWNER-DEPLOY.md`. Do NOT create accounts or deploy inside the workflow.

## Do

1. **Soft daily cap:** a client-side counter in localStorage — 4 questions/day, resets at local midnight, per device. Trust-based, no server state, no database. Expose a small client helper the frontend uses to read “questions left today” and decrement on each sent question; at 0, block sending and surface the “back tomorrow” copy (see PRD).
1. **Deploy-ready config (but do NOT deploy):** add the config + `.env.example` so the owner can ship in a few steps — default targeting Vercel Hobby, with notes for the Cloudflare alternative. Read the model key from a server env var only; never commit a key. Document the prod model swap to Claude Haiku.
1. **QR helper (no live URL):** add a small script/note so the owner can generate the QR once they have the deployed URL. Don’t hardcode a URL that doesn’t exist yet.

## Done when

The 4/day cap works and resets at local midnight, deploy config + `.env.example` are present and documented, and nothing in the repo assumes a live URL or contains a secret.

-----

# Owner Deploy Runbook

The workflow builds and locally verifies the app but does **not** deploy — that’s yours. After the build report lands:

1. **Pick the host.** Vercel Hobby (free) is the default; Cloudflare is the more-frugal alternative. Connect the repo.
1. **Set the model key as a secret** in the host’s env settings — never in the repo. Set the prod model (Claude Haiku is the documented default; one-line swap from the dev Ollama model).
1. **Deploy** and grab the live URL.
1. **Generate the QR** for that URL (the build includes a helper) and print a small card for the room.
1. **Smoke-test on your phone:** load via the QR, browse the guide, ask the concierge, confirm the 4/day cap trips and resets.

Free-tier limits shift — confirm current Vercel/Cloudflare limits when you set up.
