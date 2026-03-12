# Architecture

## Runtime

```text
Browser -> React frontend (localhost:3000) -> Express backend (localhost:3001)
```

## Request Flow

```text
AdvisingForm.jsx
  -> src/api/advising.js
  -> POST /api/submit
  -> server.js
  -> PDF text extraction
  -> Degree Works parsing
  -> curriculum classification
  -> Groq summary + schedule
  -> Results.jsx
```

## Core Files

- [`server.js`](/Users/calebbanks/cosc-490-senior-project-team-8-project-3/server.js)
- [`src/pages/AdvisingForm.jsx`](/Users/calebbanks/cosc-490-senior-project-team-8-project-3/src/pages/AdvisingForm.jsx)
- [`src/pages/Results.jsx`](/Users/calebbanks/cosc-490-senior-project-team-8-project-3/src/pages/Results.jsx)
- [`shared/morgan-state-cs-bs.js`](/Users/calebbanks/cosc-490-senior-project-team-8-project-3/shared/morgan-state-cs-bs.js)
- [`shared/morgan-state-cs-bs.seed.json`](/Users/calebbanks/cosc-490-senior-project-team-8-project-3/shared/morgan-state-cs-bs.seed.json)

## Install / Run

```bash
./bootstrap.sh
source ~/.zshrc
cd /Users/calebbanks/cosc-490-senior-project-team-8-project-3
npm run dev:all
```
