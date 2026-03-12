# Python Utilities

These Python files are still used for PDF text extraction and older validation helpers:

- [`test_transcript.py`](/Users/calebbanks/cosc-490-senior-project-team-8-project-3/test_transcript.py)
- [`extract_pdf_text.py`](/Users/calebbanks/cosc-490-senior-project-team-8-project-3/extract_pdf_text.py)
- [`course_validator.py`](/Users/calebbanks/cosc-490-senior-project-team-8-project-3/course_validator.py)
- [`course_reference.py`](/Users/calebbanks/cosc-490-senior-project-team-8-project-3/course_reference.py)

## Install Python Dependency

```bash
python3 -m pip install -r requirements.txt
```

## Extract PDF Text Manually

```bash
python3 extract_pdf_text.py <pdf-file>
```

## Run Legacy Transcript Validator

```bash
python3 test_transcript.py <pdf-file>
```

## Current Note

The live website now relies primarily on:
- `server.js`
- `shared/morgan-state-cs-bs.js`
- `shared/morgan-state-cs-bs.seed.json`

The Python files remain useful for extraction and debugging.
