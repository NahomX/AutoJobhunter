"""
AutoJobhunter CLI

Usage:
    python -m src.cli daily [--dry-run] [--headless]
    python -m src.cli weekly
    python -m src.cli feedback --id <job_id> --resume <1-5> --selection <1-5> [--notes "..."]
    python -m src.cli jobs [--min-score 70] [--status new]
"""

import argparse
import logging
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

from src import config, database, matcher, resume_generator
from src import cover_letter as cl

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger(__name__)


def _init():
    database.init()


# ---------------------------------------------------------------------------
# daily
# ---------------------------------------------------------------------------

def cmd_daily(args):
    cfg = config.load()
    filters = cfg.get("filters", {})
    max_jobs = filters.get("max_per_day", 50)

    _init()

    logger.info("Starting daily scrape…")
    try:
        from src.scraper import LinkedInJobScraper
    except ImportError as exc:
        logger.error("Scraper unavailable: %s", exc)
        sys.exit(1)

    title_kws = filters.get("title_keywords_include", ["Data Scientist"])
    location = ", ".join(filters.get("locations_priority", ["United States"])[:1])

    scraper = LinkedInJobScraper(
        job_titles=title_kws,
        location=location,
        max_jobs=max_jobs,
        headless=args.headless,
    )

    import pandas as pd
    frames = []
    try:
        for title in title_kws:
            scraper.search_jobs(title)
            df = scraper.scrape_jobs()
            if not df.empty:
                frames.append(df)
    finally:
        scraper.close()

    all_jobs = pd.concat(frames, ignore_index=True) if frames else pd.DataFrame()

    if all_jobs.empty:
        logger.warning("No jobs scraped.")
        return

    logger.info("Scraped %d listings — scoring…", len(all_jobs))

    saved = 0
    generated = 0
    out_dir = ROOT / cfg.get("resume", {}).get("output_dir", "resumes")

    for _, row in all_jobs.iterrows():
        title   = row.get("Title", "")
        company = row.get("Company", "")
        url     = row.get("Link", "") or f"unknown:{title}:{company}"
        jd_text = row.get("Description") or f"{title} at {company}"

        job_score, breakdown = matcher.score(jd_text, title=title)
        passes = matcher.passes_filters(title, job_score, cfg)

        if args.dry_run:
            flag = "PASS" if passes else "skip"
            print(f"  [{flag}] {title:35s} @ {company:25s}  score={job_score}")
            continue

        job_id = database.upsert_job(
            url=url, title=title, company=company,
            score=job_score, score_breakdown=breakdown, source="linkedin",
        )
        saved += 1

        if not passes:
            database.update_status(job_id, "skipped")
            logger.info("  skipped  %s @ %s (score=%.1f)", title, company, job_score)
            continue

        logger.info("  generating docs: %s @ %s (score=%.1f)", title, company, job_score)
        out_dir.mkdir(parents=True, exist_ok=True)
        safe = "".join(c if c.isalnum() else "_" for c in f"{company}_{title}")[:60]

        resume_path = out_dir / f"{safe}_resume.txt"
        resume_generator.generate_resumes(
            job_descriptions_text=jd_text,
            output_path=resume_path,
            feedback_path=out_dir / f"{safe}_recruiter_notes.txt",
        )
        database.add_generated_doc(job_id, "resume", str(resume_path))

        letter_path = out_dir / f"{safe}_cover.txt"
        cl.generate(title, company, jd_text, output_path=letter_path)
        database.add_generated_doc(job_id, "cover_letter", str(letter_path))

        database.update_status(job_id, "docs_ready")
        generated += 1

    if not args.dry_run:
        print(f"\nDone. Stored {saved} jobs; generated docs for {generated}.")


# ---------------------------------------------------------------------------
# weekly
# ---------------------------------------------------------------------------

def cmd_weekly(_args):
    _init()
    s = database.weekly_summary()
    print("\n── Weekly Rollup ──────────────────────────────")
    print(f"  Jobs found this week : {s['jobs_found']}")
    print(f"  Applied              : {s['applied']}")
    print(f"  Skipped (low score)  : {s['skipped']}")
    print(f"  Avg score            : {s['avg_score']}")
    print(f"  Top score            : {s['max_score']}")
    print(f"  Avg resume quality   : {s['avg_resume_quality']}")
    print(f"  Avg selection quality: {s['avg_selection_quality']}")
    print("───────────────────────────────────────────────\n")


# ---------------------------------------------------------------------------
# feedback
# ---------------------------------------------------------------------------

def cmd_feedback(args):
    _init()
    job = database.get_job(args.id)
    if not job:
        print(f"No job found with id={args.id}", file=sys.stderr)
        sys.exit(1)
    database.add_feedback(
        job_id=args.id,
        resume_quality=args.resume,
        selection_quality=args.selection,
        notes=args.notes or "",
    )
    database.update_status(args.id, "applied")
    print(f"Feedback logged for job {args.id}: {job['title']} @ {job['company']}")


# ---------------------------------------------------------------------------
# jobs (list)
# ---------------------------------------------------------------------------

def cmd_jobs(args):
    _init()
    rows = database.list_jobs(min_score=args.min_score, status=args.status)
    if not rows:
        print("No jobs found.")
        return
    print(f"\n{'ID':>4}  {'Score':>6}  {'Status':<12}  {'Title':<35}  Company")
    print("-" * 90)
    for r in rows:
        print(f"{r['id']:>4}  {r['score']:>6.1f}  {r['status']:<12}  {r['title']:<35}  {r['company']}")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(prog="src.cli", description="AutoJobhunter CLI")
    sub = parser.add_subparsers(dest="command", required=True)

    p_daily = sub.add_parser("daily", help="Scrape, score, and generate docs")
    p_daily.add_argument("--dry-run", action="store_true")
    p_daily.add_argument("--headless", action="store_true")

    sub.add_parser("weekly", help="Print weekly rollup summary")

    p_fb = sub.add_parser("feedback", help="Log application outcome")
    p_fb.add_argument("--id", type=int, required=True)
    p_fb.add_argument("--resume", type=int, required=True, choices=range(1, 6), metavar="1-5")
    p_fb.add_argument("--selection", type=int, required=True, choices=range(1, 6), metavar="1-5")
    p_fb.add_argument("--notes", type=str, default="")

    p_jobs = sub.add_parser("jobs", help="List stored jobs")
    p_jobs.add_argument("--min-score", type=float, default=0)
    p_jobs.add_argument("--status", type=str, default=None)

    args = parser.parse_args()
    {"daily": cmd_daily, "weekly": cmd_weekly, "feedback": cmd_feedback, "jobs": cmd_jobs}[
        args.command
    ](args)


if __name__ == "__main__":
    main()
