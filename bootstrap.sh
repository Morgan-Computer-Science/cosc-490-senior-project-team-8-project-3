#!/bin/bash

set -euo pipefail

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cd "$PROJECT_DIR"

echo "Installing Node dependencies..."
npm install

echo "Installing Python dependencies..."
npm run setup:venv

echo
echo "Bootstrap complete."
echo "Start the app with:"
echo "source ~/.zshrc"
echo "cd $PROJECT_DIR"
echo "npm run dev:all"
