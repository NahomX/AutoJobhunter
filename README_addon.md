
## AutoJobhunter — Quick Start

```bash
# 1) Create a venv and install deps
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# 2) Configure priorities and weights
cp config.yaml.example config.yaml
# or edit config.yaml directly

# 3) Run a daily discovery (dry-run)
python -m src.cli daily --dry-run

# 4) Generate a weekly rollup for weekend review
python -m src.cli weekly

# 5) Log feedback after applying
python -m src.cli feedback --id <job_id> --resume 4 --selection 5 --notes "Great alignment"
```
