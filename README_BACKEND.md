# Backend Overview

## Main Entry Point

[`server.js`](/Users/calebbanks/cosc-490-senior-project-team-8-project-3/server.js) is the backend.

It is responsible for:
- receiving transcript PDF submissions
- extracting PDF text
- parsing Degree Works style course rows
- parsing satisfied blocks and still-needed option text
- classifying courses against the Morgan CS seed
- generating AI summaries and recommendations

## Start Backend Only

```bash
source ~/.zshrc
cd /Users/calebbanks/cosc-490-senior-project-team-8-project-3
npm run server
```

Backend URL:

```text
http://localhost:3001
```

## Main Route

- `POST /api/submit`

This route returns:
- transcript validation data
- parsed Degree Works rows
- classified courses
- eligible requirement options
- AI summary
- recommended course schedule

## Health Check

- `GET /api/health`

## Shared Parsing Logic

The backend uses:

- [`shared/morgan-state-cs-bs.seed.json`](/Users/calebbanks/cosc-490-senior-project-team-8-project-3/shared/morgan-state-cs-bs.seed.json)
- [`shared/morgan-state-cs-bs.js`](/Users/calebbanks/cosc-490-senior-project-team-8-project-3/shared/morgan-state-cs-bs.js)

## Install

```bash
./bootstrap.sh
```
