"""
Thin wrapper around the two-pass OpenAI resume workflow.
Accepts job description text and output path as parameters
rather than reading/writing fixed filenames.
"""

import os
from pathlib import Path

from src import config

ROOT = Path(__file__).parent.parent


def _api_key() -> str:
    key = os.getenv("Auto_job_gen")
    if not key:
        raise ValueError("Set the Auto_job_gen environment variable to your OpenAI API key.")
    return key


def _load_master_resume() -> str:
    cfg = config.load()
    path = ROOT / cfg.get("resume", {}).get("master_path", "job-matcher-system/master_resume.csv")
    if not path.exists():
        path = ROOT / "job-matcher-system" / "master_resume.csv"
    return path.read_text(encoding="utf-8", errors="ignore")


def _ats_resume(client, model: str, resume: str, jd: str) -> str:
    prompt = f"""You are a professional resume writer specialising in ATS optimisation.

**Instructions:**
- Modify the master resume to be highly relevant to the job description.
- Update Professional Summary, Skills, and Experience to match the JD.
- Use measurable achievements (e.g. "Reduced processing time by 30% using Apache Spark").
- Maintain chronological order (most recent first).
- Prioritise JD keywords in Skills, Experience, and Summary.
- Never use tables, images, columns, or complex formatting — plain text only.
- Do not fabricate experience not in the master resume.

**Master Resume:**
{resume}

**Job Description:**
{jd}

Output only the optimised resume text."""

    resp = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": "You are an expert ATS resume writer."},
            {"role": "user", "content": prompt},
        ],
    )
    return resp.choices[0].message.content.strip()


def _recruiter_review(client, model: str, resume: str, jd: str) -> str:
    prompt = f"""You are a recruiter evaluating a candidate's resume against a job description.

Identify:
1. Missing skills, experience, or certifications required by the JD.
2. Specific questions the candidate should answer to fill gaps.
3. Strengths already present.

Format:
**Missing Skills/Experience:** ...
**Suggested Questions:** ...
**Strengths:** ...

**Resume:**
{resume}

**Job Description:**
{jd}"""

    resp = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": "You are an expert recruiter."},
            {"role": "user", "content": prompt},
        ],
    )
    return resp.choices[0].message.content.strip()


def generate_resumes(
    job_descriptions_text: str | None = None,
    output_path: str | Path | None = None,
    feedback_path: str | Path | None = None,
) -> tuple[str, str]:
    """
    Run the two-pass ATS optimisation + recruiter review.

    Args:
        job_descriptions_text: Raw JD text. If None, reads from
            job-matcher-system/job_descriptions.txt.
        output_path: Where to write the generated resume. Defaults to
            job-matcher-system/custom_resume_ats_optimized.txt.
        feedback_path: Where to write recruiter feedback. Defaults to
            job-matcher-system/recruiter_feedback.txt.

    Returns:
        (resume_text, feedback_text)
    """
    cfg = config.load()
    model = cfg.get("openai", {}).get("model", "gpt-4o")
    jms = ROOT / "job-matcher-system"

    if not job_descriptions_text:
        jd_file = jms / "job_descriptions.txt"
        if not jd_file.exists():
            raise FileNotFoundError(f"Job descriptions file not found: {jd_file}")
        job_descriptions_text = jd_file.read_text(encoding="utf-8").strip()

    if not output_path:
        output_path = jms / "custom_resume_ats_optimized.txt"
    if not feedback_path:
        feedback_path = jms / "recruiter_feedback.txt"

    try:
        import openai
    except ImportError as exc:
        raise ImportError("Install openai: pip install openai") from exc

    master_resume = _load_master_resume()
    client = openai.OpenAI(api_key=_api_key())

    resume_text = _ats_resume(client, model, master_resume, job_descriptions_text)
    Path(output_path).write_text(resume_text, encoding="utf-8")

    feedback_text = _recruiter_review(client, model, resume_text, job_descriptions_text)
    Path(feedback_path).write_text(feedback_text, encoding="utf-8")

    return resume_text, feedback_text


if __name__ == "__main__":
    r, f = generate_resumes()
    print("Resume generated.")
    print("Recruiter feedback generated.")
