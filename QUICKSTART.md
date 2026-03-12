# Quick Start

## Install Once

Run this from the project root:

```bash
./bootstrap.sh
```

That installs:
- Node packages from `package.json`
- Python packages from `requirements.txt`
- everything needed to run the website locally

## Start The Website

This is the normal local flow:

```bash
calebbanks@local BearAdvisorAI-main % source ~/.zshrc
calebbanks@local BearAdvisorAI-main % cd /Users/calebbanks/cosc-490-senior-project-team-8-project-3
calebbanks@local cosc-490-senior-project-team-8-project-3 % npm run dev:all
```

## Open The App

- Frontend: `http://localhost:3000/advising`
- Backend health check: `http://localhost:3001/api/health`

## What Runs

- `npm run dev` starts the Vite frontend on port `3000`
- `npm run server` starts the Express backend on port `3001`
- `npm run dev:all` starts both together

## If The App Crashes

Run the same commands again:

```bash
source ~/.zshrc
cd /Users/calebbanks/cosc-490-senior-project-team-8-project-3
npm run dev:all
```

## Optional Separate Terminals

Terminal 1:

```bash
source ~/.zshrc
cd /Users/calebbanks/cosc-490-senior-project-team-8-project-3
npm run server
```

Terminal 2:

```bash
source ~/.zshrc
cd /Users/calebbanks/cosc-490-senior-project-team-8-project-3
npm run dev
```

## What The Website Does

- uploads a transcript PDF
- extracts Degree Works style text from the PDF
- classifies courses against the Morgan State CS B.S. seed
- detects completed, satisfied, in-progress, and eligible-option courses
- generates an AI summary and recommended course schedule

## Related Docs

- [README.md](README.md)
- [REQUIREMENTS.md](REQUIREMENTS.md)
- [INTEGRATION_GUIDE.md](INTEGRATION_GUIDE.md)
