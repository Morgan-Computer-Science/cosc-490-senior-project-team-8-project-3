# Requirements

## Runtime Requirements

- macOS with `zsh`
- Node.js with `npm`
- Python 3
- `nvm` available in `~/.zshrc`

## One Install Command

From the repo root:

```bash
./bootstrap.sh
```

That command:
- loads `nvm`
- installs Node dependencies
- installs Python dependencies from `requirements.txt`

## Python Dependency Source

Python packages are defined in:

```text
requirements.txt
```

Current contents:

```text
PyMuPDF
```

## Start Command

After install:

```bash
source ~/.zshrc
cd /Users/calebbanks/cosc-490-senior-project-team-8-project-3
npm run dev:all
```

## Verification

Check the running services:

- frontend: `http://localhost:3000`
- backend: `http://localhost:3001/api/health`

## Troubleshooting

If `npm` is missing:

```bash
source ~/.zshrc
```

If Python dependencies are missing:

```bash
python3 -m pip install -r requirements.txt
```

If port `3000` or `3001` is already in use:

```bash
lsof -iTCP:3000 -sTCP:LISTEN -n -P
lsof -iTCP:3001 -sTCP:LISTEN -n -P
```
