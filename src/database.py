"""SQLite persistence layer. All paths are relative to the project root."""

import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

from src import config

ROOT = Path(__file__).parent.parent


def _db_path() -> Path:
    cfg = config.load()
    tracker = cfg.get("output", {}).get("tracker_path", "results.csv")
    # Store DB alongside the tracker CSV, same directory
    return ROOT / Path(tracker).with_suffix(".db")


@contextmanager
def _conn():
    db = _db_path()
    db.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(db)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA journal_mode=WAL")
    con.execute("PRAGMA foreign_keys=ON")
    try:
        yield con
        con.commit()
    finally:
        con.close()


def init():
    """Create tables if they don't exist."""
    with _conn() as con:
        con.executescript("""
            CREATE TABLE IF NOT EXISTS jobs (
                id              INTEGER PRIMARY KEY,
                url             TEXT    UNIQUE NOT NULL,
                title           TEXT,
                company         TEXT,
                location        TEXT,
                industry        TEXT,
                source          TEXT,
                salary          TEXT,
                post_date       TEXT,
                date_found      TEXT    NOT NULL,
                score           REAL,
                score_breakdown TEXT,
                status          TEXT    NOT NULL DEFAULT 'new'
            );

            CREATE TABLE IF NOT EXISTS generated_docs (
                id           INTEGER PRIMARY KEY,
                job_id       INTEGER NOT NULL REFERENCES jobs(id),
                doc_type     TEXT    NOT NULL,
                path         TEXT    NOT NULL,
                generated_at TEXT    NOT NULL
            );

            CREATE TABLE IF NOT EXISTS feedback (
                id               INTEGER PRIMARY KEY,
                job_id           INTEGER NOT NULL REFERENCES jobs(id),
                resume_quality   INTEGER,
                selection_quality INTEGER,
                notes            TEXT,
                logged_at        TEXT    NOT NULL
            );
        """)


def upsert_job(
    url: str,
    title: str,
    company: str,
    location: str = "",
    industry: str = "",
    source: str = "",
    salary: str = "",
    post_date: str = "",
    score: float | None = None,
    score_breakdown: dict | None = None,
) -> int:
    """Insert a new job or update score if it already exists. Returns the row id."""
    now = datetime.now(timezone.utc).isoformat()
    breakdown_json = json.dumps(score_breakdown) if score_breakdown else None
    with _conn() as con:
        cur = con.execute(
            """
            INSERT INTO jobs (url, title, company, location, industry, source,
                              salary, post_date, date_found, score, score_breakdown)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(url) DO UPDATE SET
                score           = excluded.score,
                score_breakdown = excluded.score_breakdown
            RETURNING id
            """,
            (url, title, company, location, industry, source,
             salary, post_date, now, score, breakdown_json),
        )
        return cur.fetchone()["id"]


def get_job(job_id: int) -> sqlite3.Row | None:
    with _conn() as con:
        return con.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()


def list_jobs(min_score: float = 0, status: str | None = None) -> list[sqlite3.Row]:
    query = "SELECT * FROM jobs WHERE score >= ?"
    params: list = [min_score]
    if status:
        query += " AND status = ?"
        params.append(status)
    query += " ORDER BY score DESC"
    with _conn() as con:
        return con.execute(query, params).fetchall()


def update_status(job_id: int, status: str):
    with _conn() as con:
        con.execute("UPDATE jobs SET status = ? WHERE id = ?", (status, job_id))


def add_generated_doc(job_id: int, doc_type: str, path: str):
    now = datetime.now(timezone.utc).isoformat()
    with _conn() as con:
        con.execute(
            "INSERT INTO generated_docs (job_id, doc_type, path, generated_at) VALUES (?, ?, ?, ?)",
            (job_id, doc_type, path, now),
        )


def add_feedback(job_id: int, resume_quality: int, selection_quality: int, notes: str = ""):
    now = datetime.now(timezone.utc).isoformat()
    with _conn() as con:
        con.execute(
            """
            INSERT INTO feedback (job_id, resume_quality, selection_quality, notes, logged_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (job_id, resume_quality, selection_quality, notes, now),
        )


def weekly_summary() -> dict:
    """Return counts and averages for the past 7 days."""
    with _conn() as con:
        row = con.execute("""
            SELECT
                COUNT(*)                                          AS total,
                COUNT(CASE WHEN status = 'applied' THEN 1 END)   AS applied,
                COUNT(CASE WHEN status = 'skipped' THEN 1 END)   AS skipped,
                ROUND(AVG(score), 1)                             AS avg_score,
                ROUND(MAX(score), 1)                             AS max_score
            FROM jobs
            WHERE date_found >= datetime('now', '-7 days')
        """).fetchone()
        feedback_row = con.execute("""
            SELECT
                ROUND(AVG(resume_quality), 2)    AS avg_resume_q,
                ROUND(AVG(selection_quality), 2) AS avg_selection_q
            FROM feedback
            WHERE logged_at >= datetime('now', '-7 days')
        """).fetchone()
    return {
        "jobs_found": row["total"],
        "applied": row["applied"],
        "skipped": row["skipped"],
        "avg_score": row["avg_score"],
        "max_score": row["max_score"],
        "avg_resume_quality": feedback_row["avg_resume_q"],
        "avg_selection_quality": feedback_row["avg_selection_q"],
    }
