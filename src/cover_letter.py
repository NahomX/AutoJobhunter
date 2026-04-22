"""Generate a tailored cover letter for a specific job using the OpenAI API."""

import os
from pathlib import Path

from src import config

ROOT = Path(__file__).parent.parent

_TEMPLATE_PATH = ROOT / "job-matcher-system" / "templates" / "cover_letter_template.txt"


def _api_key() -> str:
    key = os.getenv("Auto_job_gen")
    if not key:
        raise ValueError("Set the Auto_job_gen environment variable to your OpenAI API key.")
    return key


def _load_resume() -> str:
    cfg = config.load()
    master_path = ROOT / cfg.get("resume", {}).get("master_path", "job-matcher-system/master_resume.csv")
    if not master_path.exists():
        master_path = ROOT / "job-matcher-system" / "master_resume.csv"
    return master_path.read_text(encoding="utf-8", errors="ignore")


def _load_template() -> str:
    if _TEMPLATE_PATH.exists():
        return _TEMPLATE_PATH.read_text(encoding="utf-8")
    return ""


def generate(
    job_title: str,
    company: str,
    jd_text: str,
    output_path: str | Path | None = None,
) -> str:
    """
    Generate a cover letter and optionally save it to disk.

    Returns the generated text.
    """
    cfg = config.load()
    model = cfg.get("openai", {}).get("model", "gpt-4o")

    resume_text = _load_resume()
    template_hint = _load_template()
    template_section = (
        f"\n\nUse the following structural template as a guide:\n{template_hint}"
        if template_hint else ""
    )

    prompt = f"""You are an expert career coach writing a cover letter on behalf of a candidate.

**Instructions:**
- Write a professional, concise cover letter (3-4 paragraphs, under 400 words).
- Opening: express genuine interest in the role and company; name a specific detail from the job description.
- Body: highlight 2-3 concrete, quantified achievements from the resume that directly address the job's requirements.
- Closing: express enthusiasm for an interview and include a call to action.
- Tone: confident but not arrogant; personable and specific.
- Do NOT fabricate experiences not present in the resume.
- Do NOT use generic filler phrases like "I am writing to apply for..."
- Output only the cover letter text, no extra commentary.{template_section}

**Job Title:** {job_title}
**Company:** {company}

**Job Description:**
{jd_text}

**Candidate Resume:**
{resume_text}
"""

    try:
        import openai
    except ImportError as exc:
        raise ImportError("Install openai: pip install openai") from exc

    client = openai.OpenAI(api_key=_api_key())
    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": "You are an expert career coach and professional writer."},
            {"role": "user", "content": prompt},
        ],
    )
    letter = response.choices[0].message.content.strip()

    if output_path:
        Path(output_path).write_text(letter, encoding="utf-8")

    return letter
