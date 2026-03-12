# BearAdvisorAI

Transcript ingestion and Degree Works parsing for the Morgan State University Computer Science B.S. degree audit flow.

## Install

```bash
./bootstrap.sh
```

## Run

```bash
source ~/.zshrc
cd /Users/calebbanks/cosc-490-senior-project-team-8-project-3
npm run dev:all
```

## Local URLs

- Frontend: `http://localhost:3000/advising`
- Backend: `http://localhost:3001`
- Health check: `http://localhost:3001/api/health`

## Current Architecture

- React frontend in [`src/`](/Users/calebbanks/cosc-490-senior-project-team-8-project-3/src)
- Express backend in [`server.js`](/Users/calebbanks/cosc-490-senior-project-team-8-project-3/server.js)
- shared Morgan curriculum and Degree Works parser in [`shared/`](/Users/calebbanks/cosc-490-senior-project-team-8-project-3/shared)
- Python PDF extraction helpers in [`test_transcript.py`](/Users/calebbanks/cosc-490-senior-project-team-8-project-3/test_transcript.py) and [`extract_pdf_text.py`](/Users/calebbanks/cosc-490-senior-project-team-8-project-3/extract_pdf_text.py)

## Main Behavior

- one frontend submit action
- one backend submission route: `POST /api/submit`
- Degree Works row parsing
- curriculum seed classification
- course status tracking:
  - `COMPLETED`
  - `SATISFIED`
  - `IN_PROGRESS`
  - `AVAILABLE_OPTION`
  - `UNCLASSIFIED`
- Groq transcript summary
- Groq recommended course schedule with protected-course filtering

## Docs

- [QUICKSTART.md](QUICKSTART.md)
- [REQUIREMENTS.md](REQUIREMENTS.md)
- [INTEGRATION_GUIDE.md](INTEGRATION_GUIDE.md)
- [README_BACKEND.md](README_BACKEND.md)
