## Barrio Logan Guest Concierge (Next.js app)

A single-property Airbnb guest microsite with a curated local guide and an AI concierge chat, scoped to 325 S 30th St, San Diego, CA 92113 (Logan Heights / Barrio Logan).

### Setup

```bash
# 1. Install Node dependencies
npm install

# 2. Configure environment
cp .env.example .env.local
# Edit .env.local — for local dev the defaults (MODEL_PROVIDER=ollama) work as-is.
```

### Run Ollama locally (dev model)

```bash
# Install Ollama from https://ollama.com, then pull the default model:
ollama pull llama3.2

# Ollama server starts automatically; verify it's running:
curl http://localhost:11434/api/tags
```

### Dev server

```bash
npm run dev        # http://localhost:3000
npm run typecheck  # tsc --noEmit
npm run lint       # next lint
npm run build      # production build
```

### Swap to Claude Haiku for production

In your deployment environment (e.g., Vercel dashboard), set:
- `MODEL_PROVIDER=anthropic`
- `ANTHROPIC_API_KEY=<your-key>` (as a secret — never committed)
- `ANTHROPIC_MODEL=claude-haiku-4-5` (optional, this is the default)

### Key file paths

| File | Purpose |
|---|---|
| `src/lib/guide.ts` | Shared TypeScript types for guide.json (Contract A) |
| `src/data/guide.json` | Placeholder guide data (Phase 3 swaps in real content) |
| `src/lib/config.ts` | Model-provider helper (dev=Ollama, prod=Claude) |
| `src/app/api/chat/route.ts` | Streaming chat API route (Contract B) |
| `.env.example` | All required env vars documented |

---

# AutoJobhunter

An automated job-hunting pipeline for Data Science / Data Engineering roles. It scrapes
job postings (LinkedIn today; Indeed planned), scores them against a master resume,
generates ATS-optimized resumes via the OpenAI API, and tracks application outcomes in a
CSV tracker.

> **Status:** active early development. Several modules are stubs; `scraper.py` and
> `resume_generator.py` are the most complete.

## Repository layout

```
AutoJobhunter/
├── config.yaml            # Central configuration (cadence, filters, scoring weights)
├── requirements.txt       # Python dependencies
├── results_template.csv   # Schema for the application tracker CSV
└── job-matcher-system/
    ├── scraper.py             # LinkedIn scraper (Selenium + Chrome)
    ├── resume_generator.py    # OpenAI ATS resume generation + recruiter review
    ├── matcher.py             # (stub) job-to-resume scoring
    ├── database.py            # (stub) persistence layer
    ├── cover_letter.py        # (stub) cover letter generation
    ├── main.py                # (stub) pipeline entry point
    └── test.py                # Dev utility: lists available OpenAI models
```

## Setup

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

### Required environment variable

| Variable        | Purpose                                                          |
|-----------------|------------------------------------------------------------------|
| `Auto_job_gen`  | OpenAI API key — must be set before running resume generation.   |

```bash
export Auto_job_gen="sk-..."
```

### Browser driver

`scraper.py` uses Selenium + Chrome. A matching `chromedriver` must be on `PATH` (or
managed via `webdriver-manager`).

## Usage

Run scripts from inside `job-matcher-system/` so relative paths resolve correctly.

```bash
cd job-matcher-system

# Scrape LinkedIn → linkedin_jobs.csv
python scraper.py

# Generate a tailored resume:
#   1. Populate job_descriptions.txt with target JDs
#   2. Ensure master_resume.csv exists
python resume_generator.py   # → custom_resume_ats_optimized.txt + recruiter_feedback.txt

# Verify the OpenAI API key works
python test.py
```

## Configuration

All pipeline behavior is driven by `config.yaml` (run cadence, title filters, scoring
weights, score thresholds). Avoid hard-coding values that belong there.

## Notes on data & privacy

Personal and generated files are **git-ignored** and should never be committed:
`master_resume.csv` (PII), `custom_resume_*.txt`, `recruiter_feedback.txt`,
`job_descriptions.txt`, scraped CSVs, and `linkedin_debug.png`.

See [`CLAUDE.md`](CLAUDE.md) for detailed architecture, conventions, and known issues.
