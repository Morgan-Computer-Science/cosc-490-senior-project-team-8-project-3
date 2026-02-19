# Project Architecture: Node.js Gateway + Python Backend

[![Open in Visual Studio Code](https://classroom.github.com/assets/open-in-vscode-2e0aaae1b6195c2367325f4f02e2d04e9abb55f0b24a779b69b11b9e10269abc.svg)](https://classroom.github.com/online_ide?assignment_repo_id=22437363&assignment_repo_type=AssignmentRepo)

## Overview

This project uses a two-tier architecture:
- **Node.js Gateway** (Port 3000): Express server for HTTP routing and request handling
- **Python Backend** (Port 8000): FastAPI server for processing, AI agents, and business logic

## Prerequisites

### Node.js Side
- **Node.js 18+** (20 recommended)
- Check your version: `node --version`
- Use `.nvmrc` for version management: `nvm use`

### Python Side
- **Python 3.10+** (3.11 preferred)
- Check your version: `python --version`
- Virtual environment recommended

## Quick Start

### 1. Node.js Setup (Gateway)

```bash
# Navigate to project root
cd /home/calebbanks393/cosc-490-senior-project-team-8-project-3

# Use correct Node version (if using nvm)
nvm use

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Start the gateway
npm start        # Production
npm run dev      # Development (with auto-reload)
```

Gateway will run on `http://localhost:3000`

### 2. Python Setup (Backend)

```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
source venv/bin/activate        # macOS/Linux
# or: venv\Scripts\activate     # Windows

# Install dependencies
pip install -r requirements.txt

# Copy environment template
cp .env.example .env

# Start the FastAPI server
uvicorn main:app --reload --port 8000
```

Backend will run on `http://localhost:8000`

## Dependencies

### Node.js Dependencies
- **express**: Web framework for HTTP routing
- **dotenv**: Environment variable management
- **nodemon** (dev): Auto-restart during development

### Python Dependencies

**Core (Always Needed)**
- `fastapi`: Modern API framework
- `uvicorn[standard]`: ASGI server
- `pydantic`: Data validation
- `python-multipart`: File upload handling
- `python-dotenv`: Environment variable management
- `requests`: HTTP client for external APIs
- `loguru`: Structured logging

**Optional (Add as Needed)**
- `pandas`: CSV/data handling
- `beautifulsoup4`: HTML parsing
- `textblob`: Sentiment analysis
- `PyPDF2`: PDF parsing

To add optional dependencies:
```bash
pip install pandas beautifulsoup4 textblob PyPDF2
```

## Project Structure

```
.
├── .nvmrc                    # Node version specification
├── package.json              # Node dependencies
├── requirements.txt          # Python dependencies
├── .env.example              # Environment variables template
├── .gitignore               # Git ignore rules
├── README.md                # This file
├── venv/                    # Python virtual environment (git-ignored)
└── node_modules/            # Node dependencies (git-ignored)
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

```env
# Node.js Gateway
NODE_ENV=development
GATEWAY_PORT=3000

# Python Backend
PYTHON_BACKEND_URL=http://localhost:8000

# External APIs
# LLM_API_KEY=your_key_here
# EXTERNAL_API_URL=https://api.example.com

# Logging
LOG_LEVEL=info
```

## Running Both Services

**Terminal 1 - Node Gateway:**
```bash
npm run dev
```

**Terminal 2 - Python Backend:**
```bash
source venv/bin/activate
uvicorn main:app --reload --port 8000
```

Both servers should start without conflicts.

## API Flow

```
User Request
    ↓
Node.js Gateway (Port 3000)
    ↓
Routes to Python Backend (Port 8000) via requests
    ↓
Python Processing (FastAPI)
    ↓
Response back through Gateway
    ↓
User Response (JSON)
```

## Development

### Adding Python Packages
```bash
source venv/bin/activate
pip install package_name
pip freeze > requirements.txt  # Update requirements.txt
```

### Adding Node Packages
```bash
npm install package_name
```

### Linting & Testing (Future)
Will be added as project grows.

## Troubleshooting

### Port Already in Use
```bash
# Node (3000)
lsof -i :3000
kill -9 <PID>

# Python (8000)
lsof -i :8000
kill -9 <PID>
```

### Virtual Environment Issues
```bash
# Deactivate current venv
deactivate

# Remove and recreate
rm -rf venv
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## Next Steps

1. ✅ Set up dependencies and configuration files
2. Create Entry points (`index.js` for Node, `main.py` for Python)
3. Implement basic request/response routing
4. Add processing logic and integrations
5. Add error handling and logging
6. Implement tests

## Notes

- Never commit `.env` file (use `.env.example` as template)
- Keep `node_modules/` and `venv/` out of git (included in `.gitignore`)
- Use `python-dotenv` in Python code: `from dotenv import load_dotenv`
- Use `dotenv` in Node.js early: `import dotenv from 'dotenv'; dotenv.config();`
