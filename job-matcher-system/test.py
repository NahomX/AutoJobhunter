import openai
import os

# Fetch OpenAI API key from environment variable
OPENAI_API_KEY = os.getenv("Auto_job_gen")

if not OPENAI_API_KEY:
    raise ValueError("OpenAI API key is missing. Please set the environment variable 'Auto_job_gen'.")

client = openai.OpenAI(api_key=OPENAI_API_KEY)

# List available models
models = client.models.list()

# Print available models
for model in models.data:
    print(model.id)
