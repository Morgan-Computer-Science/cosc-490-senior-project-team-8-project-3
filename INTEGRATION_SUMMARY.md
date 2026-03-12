# Integration Summary

## Current State

The app now runs as a single React + Express project with one user submission path.

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

## What Is Integrated

- transcript PDF ingestion
- Degree Works row parsing
- Degree Works satisfied-block parsing
- still-needed option parsing
- Morgan State CS B.S. curriculum seed classification
- protected-course filtering for recommendations
- Groq summary generation
- Groq schedule recommendation generation

## Main Output Areas

- parsed Degree Works rows
- curriculum matching
- supporting/math/gen-ed/free-elective grouping
- eligible options from unmet requirements
- unclassified courses
- AI summary
- recommended course schedule
