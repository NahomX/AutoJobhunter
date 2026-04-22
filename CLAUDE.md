# AutoJobhunter — CLAUDE.md

## Project Overview

AutoJobhunter is a Python-based automated job hunting pipeline for Data Science / Data Engineering roles. It scrapes job postings from LinkedIn (and planned: Indeed), scores them against a master resume, generates ATS-optimized resumes via the OpenAI API, and tracks application outcomes in a CSV tracker.

The project is in **active early development**. Several modules are stubs; `scraper.py` and `resume_generator.py` are the most complete.

---

## Repository Layout

```
AutoJobhunter/
├── config.yaml                        # Central configuration (run cadence, filters, scoring weights)
├── main.py                            # Root-level placeholder — not used by the pipeline
├── requirements (1).txt               # Python dependencies
├── results_template.csv               # Schema for the application tracker CSV
├── README_addon.md                    # Quick-start CLI reference
├── project_structure.txt              # Windows-generated tree (UTF-16, ignore for dev)
└── job-matcher-system/
    ├── scraper.py                     # LinkedIn scraper (Selenium + Chrome)
    ├── resume_generator.py            # OpenAI ATS resume generation + recruiter review
    ├── cover_letter.py                # STUB — cover letter generation
    ├── matcher.py                     # STUB — job-to-resume scoring
    ├── database.py                    # STUB — persistence layer
    ├── main.py                        # STUB — pipeline entry point
    ├── test.py                        # Dev utility: lists available OpenAI models
    ├── master_resume.csv              # Source-of-truth resume (structured CSV)
    ├── job_descriptions.txt           # Paste target job descriptions here
    ├── google_jobs.csv                # Scraped Google jobs output
    ├── linkedin_jobs.csv              # Scraped LinkedIn jobs output
    ├── custom_resume_ats_optimized.txt # Most recent generated resume
    ├── recruiter_feedback.txt         # Most recent recruiter-review output
    └── custom_resume_*.txt            # Archived generated resumes (per-jd snapshots)
```

---

## Environment Setup

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r "requirements (1).txt"
```

### Required environment variable

| Variable | Purpose |
|---|---|
| `Auto_job_gen` | OpenAI API key — **must** be set before running resume_generator.py or test.py |

```bash
export Auto_job_gen="sk-..."
```

### Browser driver

`scraper.py` uses **Selenium + Chrome**. A matching `chromedriver` must be on `PATH` or managed via `webdriver-manager`.

---

## Dependencies

| Package | Role |
|---|---|
| `selenium` | LinkedIn job scraping |
| `playwright` | Planned scraping (not yet wired) |
| `beautifulsoup4` + `requests` | HTML parsing / HTTP fallback |
| `openai` | Resume generation and recruiter review (GPT-4o) |
| `pandas` | Data manipulation, CSV I/O |
| `numpy` | Numerical support |
| `scikit-learn` | Planned scoring model |
| `python-docx` | Planned resume DOCX export |
| `PyYAML` | config.yaml parsing |
| `tqdm` | Progress bars |
| `pytest` | Test runner |

---

## Core Configuration (`config.yaml`)

All pipeline behavior is driven by `config.yaml`. Key sections:

```yaml
run:
  cadence: daily
  weekly_rollup_day: Saturday
  timezone: America/Los_Angeles

filters:
  title_keywords_include: ["Data Scientist", "Data Engineer", "ML Engineer", "Analytics"]
  title_keywords_exclude: ["Senior Director", "VP", "Principal"]
  min_score: 70           # jobs below this are dropped
  max_per_day: 50
  recency_days: 7

scoring:
  weights:
    skills_match: 0.35
    tools_match: 0.20
    domain_match: 0.20
    keywords_coverage: 0.15
    seniority_alignment: 0.10
```

Do not hard-code values that belong in `config.yaml`. All thresholds, weights, and paths should be read from there.

---

## Running the System

### Job scraping (implemented)
```bash
cd job-matcher-system
python scraper.py          # Scrapes LinkedIn for roles defined in the script, saves linkedin_jobs.csv
```

### Resume generation (implemented)
```bash
cd job-matcher-system
# 1. Populate job_descriptions.txt with target JDs
# 2. Ensure master_resume.csv exists
python resume_generator.py # Outputs custom_resume_ats_optimized.txt + recruiter_feedback.txt
```

### Planned CLI (per README_addon.md — not yet implemented)
```bash
python -m src.cli daily --dry-run
python -m src.cli weekly
python -m src.cli feedback --id <job_id> --resume 4 --selection 5 --notes "..."
```

### Dev utility
```bash
python job-matcher-system/test.py   # Lists available OpenAI models to verify API key
```

---

## Key Module Details

### `scraper.py` — `LinkedInJobScraper`

- Uses headless-disabled Chrome (anti-bot: hides `navigator.webdriver`)
- `search_jobs(title)` → navigates to LinkedIn job search URL
- `scrape_jobs()` → extracts title, company, link from result cards; returns DataFrame
- `save_jobs(df, filename)` → saves to CSV
- Random `time.sleep` delays (1–2s per card, 5–8s between searches) to avoid rate-limiting
- **Limitation**: relies on CSS selectors that LinkedIn changes frequently; expect breakage

### `resume_generator.py` — Two-pass OpenAI workflow

1. `generate_resume_with_openai(master_resume_text, job_descriptions_text)` — produces a tailored ATS resume
2. `recruiter_review_with_openai(custom_resume_text, job_descriptions_text)` — evaluates the output as a recruiter, listing gaps and questions
- Both calls use `model="gpt-4o"`
- API key read from `os.getenv("Auto_job_gen")`
- Outputs are saved as plain `.txt` files in the working directory

### `results_template.csv` — Application tracker schema

Columns: `id, date_found, role, company, location, industry, source, jd_link, salary, post_date, score, score_breakdown, resume_path, status, feedback_resume_quality, feedback_selection_quality, feedback_notes`

---

## Development Conventions

- **Working directory**: run scripts from inside `job-matcher-system/` so relative file paths (`master_resume.csv`, `job_descriptions.txt`) resolve correctly
- **No packaging**: there is no `setup.py` / `pyproject.toml`. The planned `src.cli` module does not exist yet — build it before wiring the CLI commands
- **Stubs to implement**: `cover_letter.py`, `matcher.py`, `database.py`, `job-matcher-system/main.py` are all empty single-line files
- **File naming for generated resumes**: generated files are named with a snippet of the JD text as a suffix (e.g. `custom_resume_Strong_understanding_of_CPT.txt`); keep this convention or update `resume_generator.py` if switching to a date/company scheme
- **No test suite yet**: `test.py` is a dev utility, not a pytest file. Add `tests/` with actual pytest tests as modules are completed
- **Linting**: no linter config present; use `ruff` or `flake8` — avoid bare `except:` clauses (currently in `scraper.py`)

---

## Planned Architecture (from config.yaml intent)

```
config.yaml
    └── src/
        ├── cli.py          # Entry point: daily / weekly / feedback commands
        ├── scraper.py      # LinkedIn + Indeed scrapers
        ├── matcher.py      # Weighted scoring against master resume
        ├── resume.py       # Resume tailoring + DOCX/PDF export
        ├── cover_letter.py # Cover letter generation
        ├── database.py     # SQLite or CSV persistence
        └── feedback.py     # Moving-average model for score calibration
```

Priority build order: `matcher.py` → `database.py` → `cli.py` → `cover_letter.py`

---

## Data Files (do not commit to git)

- `master_resume.csv` — personal PII; treat as sensitive
- `job_descriptions.txt` — temporary working file
- `custom_resume_*.txt` — generated outputs
- `recruiter_feedback.txt` — generated outputs
- `google_jobs.csv`, `linkedin_jobs.csv` — scraped data
- `linkedin_debug.png` — screenshot artifact from scraping sessions

Consider adding these to `.gitignore`.

---

## Known Issues / Gotchas

1. **LinkedIn CSS selectors break frequently** — `scraper.py` uses `ul.jobs-search__results-list li`, `h3`, `h4` selectors that LinkedIn changes. When scraping fails silently, check selectors first.
2. **No `.gitignore`** — `venv/`, `*.pyc`, `__pycache__`, API output files, and PII data are not excluded.
3. **`requirements (1).txt`** — the filename has a space; quote it in shell commands or rename to `requirements.txt`.
4. **`project_structure.txt`** is 4.8 MB of UTF-16 encoded Windows `tree` output — safe to delete or gitignore.
5. **Root `main.py`** is a PyCharm template placeholder — not part of the pipeline.
6. **OpenAI model is hard-coded** to `gpt-4o` in `resume_generator.py` — parameterize via `config.yaml` when extending.
