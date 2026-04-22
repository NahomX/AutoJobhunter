"""
Score a job description against the candidate's master resume.

Scoring dimensions (weights come from config.yaml):
  skills_match        – programming languages / ML libraries overlap
  tools_match         – platforms / tools overlap
  domain_match        – industry keyword hits (config keyword_boosts)
  keywords_coverage   – broad keyword overlap across full resume text
  seniority_alignment – title level fit (penalises VP/Director/Principal)
"""

import re
from pathlib import Path

from src import config

ROOT = Path(__file__).parent.parent

# ---------------------------------------------------------------------------
# Skill / tool vocabulary extracted from the master resume
# ---------------------------------------------------------------------------

_SKILLS = {
    "python", "r", "sql", "usql", "spark", "dax", "t-sql", "tsql", "nosql",
    "cobol", "fortran", "pl/sql", "plsql", "java", "javascript", "html", "css",
}

_TOOLS = {
    "sql server", "ms sql", "excel", "jupyter", "rstudio", "tableau", "powerbi",
    "power bi", "azure data studio", "hadoop", "databricks", "docker", "postman",
    "anaconda", "pycharm", "azure devops", "jira", "oracle", "mysql",
    "postgresql", "mongodb", "azure data factory", "adf", "hdinsight",
    "azure synapse", "synapse", "aws redshift", "redshift", "s3", "blob storage",
    "azure machine learning", "sagemaker", "pandas", "numpy", "pyspark",
    "statsmodel", "matplotlib", "scikit-learn", "sklearn", "seaborn",
    "tensorflow", "keras", "prophet", "arima", "lstm", "randomforest",
    "random forest", "tidyverse", "ssrs", "rshiny", "plotly", "ggplot",
    "d3", "mulesoft", "sas", "primavera", "autocad", "matlab", "mlflow",
    "airflow", "kubernetes", "k8s", "spark", "kafka",
}

# Candidate's own seniority (mid-level: ~3 years experience)
_CANDIDATE_YOE = 3.5


def _tokens(text: str) -> set[str]:
    return set(re.findall(r"[a-z0-9][a-z0-9\-/\.]*", text.lower()))


def _phrase_hits(vocab: set[str], text: str) -> int:
    text_lower = text.lower()
    hits = 0
    for term in vocab:
        # Short tokens need word-boundary matching to avoid "r" matching "years"
        if len(term) <= 3:
            if re.search(r"\b" + re.escape(term) + r"\b", text_lower):
                hits += 1
        else:
            if term in text_lower:
                hits += 1
    return hits


def _skills_match(jd: str) -> float:
    # 3+ language matches against the candidate's skill set = full marks
    hits = _phrase_hits(_SKILLS, jd)
    return min(hits / 3.0, 1.0)


def _tools_match(jd: str) -> float:
    # 5+ tool/library matches = full marks
    hits = _phrase_hits(_TOOLS, jd)
    return min(hits / 5.0, 1.0)


def _domain_match(jd: str, industry: str, cfg: dict) -> float:
    boosts = cfg.get("scoring", {}).get("keyword_boosts", {})
    jd_lower = jd.lower()

    # Try the declared industry first; fall back to whichever industry scores highest
    candidates = [industry] if industry in boosts else list(boosts.keys())
    best = 0.0
    for ind in candidates:
        keywords = boosts.get(ind, [])
        if not keywords:
            continue
        hits = sum(1 for kw in keywords if kw.lower() in jd_lower)
        best = max(best, hits / len(keywords))
    return min(best, 1.0)


def _keywords_coverage(jd: str, resume_text: str) -> float:
    resume_tokens = _tokens(resume_text)
    jd_tokens = _tokens(jd)
    # Only count meaningful tokens (length > 2)
    meaningful = {t for t in jd_tokens if len(t) > 2}
    if not meaningful:
        return 0.0
    overlap = meaningful & resume_tokens
    return min(len(overlap) / len(meaningful), 1.0)


def _seniority_alignment(jd: str) -> float:
    """
    Estimate required years of experience from the JD, then score how
    well the candidate's ~3.5 YOE aligns. Defaults to 1.0 (good fit)
    when no clear signal is found.
    """
    # Look for explicit YOE requirements like "3+ years", "5-7 years", "at least 2 years"
    yoe_pattern = re.compile(r"(\d+)[\+\-–]?\s*(?:to\s*\d+\s*)?years?", re.IGNORECASE)
    matches = [int(m.group(1)) for m in yoe_pattern.finditer(jd)]
    if not matches:
        return 1.0  # no signal → assume good fit

    required_yoe = sum(matches) / len(matches)
    diff = abs(required_yoe - _CANDIDATE_YOE)
    # within 1 yr → 1.0, within 2 yr → 0.8, within 4 yr → 0.6, beyond → 0.4
    if diff <= 1:
        return 1.0
    if diff <= 2:
        return 0.8
    if diff <= 4:
        return 0.6
    return 0.4


def _load_resume() -> str:
    cfg = config.load()
    master_path = ROOT / cfg.get("resume", {}).get("master_path", "job-matcher-system/master_resume.csv")
    # Fall back to the CSV in job-matcher-system
    if not master_path.exists():
        master_path = ROOT / "job-matcher-system" / "master_resume.csv"
    return master_path.read_text(encoding="utf-8", errors="ignore")


def score(jd_text: str, title: str = "", industry: str = "") -> tuple[float, dict]:
    """
    Score a job description against the master resume.

    Returns:
        (overall_score_0_to_100, breakdown_dict)
    """
    cfg = config.load()
    weights = cfg.get("scoring", {}).get("weights", {})
    w_skills   = weights.get("skills_match", 0.35)
    w_tools    = weights.get("tools_match", 0.20)
    w_domain   = weights.get("domain_match", 0.20)
    w_keywords = weights.get("keywords_coverage", 0.15)
    w_seniority = weights.get("seniority_alignment", 0.10)

    resume_text = _load_resume()

    s_skills    = _skills_match(jd_text)
    s_tools     = _tools_match(jd_text)
    s_domain    = _domain_match(jd_text, industry, cfg)
    s_keywords  = _keywords_coverage(jd_text, resume_text)
    s_seniority = _seniority_alignment(jd_text)

    raw = (
        s_skills   * w_skills +
        s_tools    * w_tools +
        s_domain   * w_domain +
        s_keywords * w_keywords +
        s_seniority * w_seniority
    )
    overall = round(raw * 100, 1)

    breakdown = {
        "skills_match":       round(s_skills * 100, 1),
        "tools_match":        round(s_tools * 100, 1),
        "domain_match":       round(s_domain * 100, 1),
        "keywords_coverage":  round(s_keywords * 100, 1),
        "seniority_alignment": round(s_seniority * 100, 1),
    }
    return overall, breakdown


def passes_filters(title: str, score_val: float, cfg: dict | None = None) -> bool:
    """Return True if the job clears all hard filters in config.yaml."""
    if cfg is None:
        cfg = config.load()
    filters = cfg.get("filters", {})

    if score_val < filters.get("min_score", 70):
        return False

    title_lower = title.lower()
    include_kws = [k.lower() for k in filters.get("title_keywords_include", [])]
    exclude_kws = [k.lower() for k in filters.get("title_keywords_exclude", [])]

    if include_kws and not any(k in title_lower for k in include_kws):
        return False
    if any(k in title_lower for k in exclude_kws):
        return False

    return True
