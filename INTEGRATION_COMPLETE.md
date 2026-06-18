# Integration Complete

## Install Once

```bash
./bootstrap.sh
```

## Start

```bash
source ~/.zshrc
cd /Users/calebbanks/cosc-490-senior-project-team-8-project-3
npm run dev:all
```

## Current Completed Features

- one-command dependency bootstrap
- frontend on `http://localhost:3000`
- backend on `http://localhost:3001`
- single submit route
- shared Morgan State curriculum seed
- Degree Works parser with:
  - row parsing
  - status parsing
  - section parsing
  - option-text parsing
  - OCR junk filtering by allowed department prefixes
- protected-course recommendation filtering
- results page integration for all of the above
