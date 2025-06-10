import openai
import os
import csv
import re

# Fetch OpenAI API key from environment variable
OPENAI_API_KEY = os.getenv("Auto_job_gen")

if not OPENAI_API_KEY:
    raise ValueError("OpenAI API key is missing. Please set the environment variable 'Auto_job_gen'.")


def load_master_resume_as_text(master_resume_file="master_resume.csv"):
    """Loads the master resume as raw text to send to OpenAI."""
    if not os.path.exists(master_resume_file):
        print("Master resume file not found.")
        return None

    with open(master_resume_file, "r", encoding="utf-8") as f:
        return f.read()  # ✅ Read entire file as raw text


def load_job_descriptions(job_desc_file="job_descriptions.txt"):
    """Loads job descriptions from a text file as raw text."""
    if not os.path.exists(job_desc_file):
        print("Job descriptions file not found.")
        return None

    with open(job_desc_file, "r", encoding="utf-8") as f:
        return f.read().strip()  # ✅ Read full text without analyzing


def generate_resume_with_openai(master_resume_text, job_descriptions_text):
    """Calls OpenAI API to generate a tailored resume that is fully ATS-optimized."""

    client = openai.OpenAI(api_key=OPENAI_API_KEY)

    prompt = f"""
    You are a professional resume writer specializing in ATS optimization.
    Your task is to modify the following master resume to make it **highly relevant** to the provided job descriptions while ensuring it passes ATS screening.

    **Instructions:**
    - Read and analyze the full job descriptions.
    - Modify the **Professional Summary, Skills, and Experience** to match the job descriptions.
    - If a required skill or experience is missing, **add it naturally** while keeping it realistic.
    - **Use measurable achievements** (e.g., "Reduced processing time by 30% using Apache Spark").
    - Maintain **chronological order** for experience (most recent job first).
    - Ensure all **job titles, company names, and dates** are clearly stated.
    - **Prioritize keywords** from the job descriptions, making sure they appear in **Skills, Experience, and Summary**.
    - **Never use tables, images, columns, or complex formatting**—keep it **text-based** for ATS.
    - Ensure the final resume is **realistic, professional, and ATS-friendly**.

    **Master Resume:**
    {master_resume_text}

    **Job Descriptions:**
    {job_descriptions_text}

    Generate the most optimized resume(s) based on the given information.
    """

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": "You are an expert resume writer specializing in ATS optimization."},
            {"role": "user", "content": prompt},
        ],
    )

    return response.choices[0].message.content



def recruiter_review_with_openai(custom_resume_text, job_descriptions_text):
    """Calls OpenAI API to act as a recruiter and evaluate the resume against job descriptions."""

    client = openai.OpenAI(api_key=OPENAI_API_KEY)

    prompt = f"""
    You are a recruiter evaluating a candidate's resume for the following job descriptions.

    **Instructions:**
    - Carefully compare the candidate's resume against the job descriptions.
    - Identify **any missing skills, experience, or certifications** that are required in the job but missing in the resume.
    - If there are missing details, create **a list of specific questions** the candidate should answer to improve the resume.
    - If the resume is already strong, provide **feedback on strengths**.
    - Format the response as:

    **Missing Skills/Experience:**
    - [List of missing skills or experience]

    **Suggested Questions for Resume Improvement:**
    - Question 1
    - Question 2
    - Question 3

    **Strengths in Resume:**
    - [List of strengths]

    **Candidate's Resume:**
    {custom_resume_text}

    **Job Descriptions:**
    {job_descriptions_text}

    Evaluate and generate feedback based on this information.
    """

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": "You are an expert recruiter evaluating resumes."},
            {"role": "user", "content": prompt},
        ],
    )

    return response.choices[0].message.content


def generate_resumes():
    """Handles resume generation while ensuring ATS optimization and recruiter review."""
    master_resume_text = load_master_resume_as_text()
    job_descriptions_text = load_job_descriptions()

    if not master_resume_text or not job_descriptions_text:
        print("Missing master resume or job descriptions.")
        return

    print("Generating ATS-optimized resume...")
    custom_resume_text = generate_resume_with_openai(master_resume_text, job_descriptions_text)

    # Save the ATS-optimized resume
    resume_filename = "custom_resume_ats_optimized.txt"
    with open(resume_filename, "w", encoding="utf-8") as f:
        f.write(custom_resume_text)

    print(f"Resume saved: {resume_filename}")

    # ✅ Second API call: Recruiter review
    print("Sending resume to recruiter evaluation...")
    recruiter_feedback = recruiter_review_with_openai(custom_resume_text, job_descriptions_text)

    # Save recruiter feedback
    feedback_filename = "recruiter_feedback.txt"
    with open(feedback_filename, "w", encoding="utf-8") as f:
        f.write(recruiter_feedback)

    print(f"Recruiter feedback saved: {feedback_filename}")


if __name__ == "__main__":
    generate_resumes()
