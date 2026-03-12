# Integration Guide

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

## Ports

- frontend: `3000`
- backend: `3001`

## Live Flow

1. The user fills out the advising form in the React frontend.
2. The frontend submits one request to `POST /api/submit`.
3. The backend extracts transcript text from the PDF.
4. The backend parses Degree Works rows, satisfied sections, in-progress sections, and still-needed option text.
5. The backend classifies each course against the Morgan State seed and Degree Works matches.
6. The backend generates:
   - grouped requirement data
   - parsed row data
   - eligible options
   - Groq summary
   - Groq recommended schedule
7. The frontend renders the results page.

## Main Files

- backend: [`server.js`](/Users/calebbanks/cosc-490-senior-project-team-8-project-3/server.js)
- frontend results page: [`src/pages/Results.jsx`](/Users/calebbanks/cosc-490-senior-project-team-8-project-3/src/pages/Results.jsx)
- shared parser: [`shared/morgan-state-cs-bs.js`](/Users/calebbanks/cosc-490-senior-project-team-8-project-3/shared/morgan-state-cs-bs.js)
- curriculum seed: [`shared/morgan-state-cs-bs.seed.json`](/Users/calebbanks/cosc-490-senior-project-team-8-project-3/shared/morgan-state-cs-bs.seed.json)
