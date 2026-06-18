#!/bin/bash

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENV_DIR="$PROJECT_DIR/.venv"

cd "$PROJECT_DIR"

if [ ! -d "$VENV_DIR" ]; then
  echo "Creating Python virtual environment at $VENV_DIR"
  python3 -m venv "$VENV_DIR"
fi

echo "Upgrading pip in .venv"
"$VENV_DIR/bin/python" -m pip install --upgrade pip

echo "Installing Python dependencies into .venv"
"$VENV_DIR/bin/python" -m pip install -r requirements.txt

echo
echo "Python venv ready."
echo "Activate it with:"
echo "source .venv/bin/activate"
