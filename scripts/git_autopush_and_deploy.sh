#!/usr/bin/env bash
# ==============================================================================
# AIIA Sovereign MediKiosk & Hospital OS - Automated GitHub Push & Deploy Script
# Repository: sih-doctor (or sih-doctor-doctor)
# Triggers Coolify / Vercel / GitHub Actions Auto-Deploy Pipeline on Push
# ==============================================================================

set -e

REPO_NAME="${1:-sih-doctor}"
COMMIT_MSG="${2:-feat: sovereign hospital os production release with live 22-battery validation}"

echo "================================================================================"
echo "🚀 AIIA SOVEREIGN MEDIKIOSK (PS ID 26047) - GITHUB AUTOPUSH & DEPLOY"
echo "================================================================================"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# 1. Initialize Git Repository if not initialized
if [ ! -d ".git" ]; then
  echo "📦 Initializing local Git repository..."
  git init
  git branch -M main
fi

# 2. Check Git User Configuration
if [ -z "$(git config user.name)" ]; then
  git config user.name "Piyush Kumar"
  git config user.email "piyush@piyapi.cloud"
  echo "👤 Configured Git user: $(git config user.name) <$(git config user.email)>"
fi

# 3. Stage All Production Source Files (.gitignore protects >100MB CAD models & binaries)
echo "🔍 Staging production code, models, and test suites..."
git add .

# 4. Check if there are changes to commit
if git diff --cached --quiet; then
  echo "✨ Working tree is already clean. Nothing new to commit."
else
  echo "💾 Committing changes with message: '$COMMIT_MSG'"
  git commit -m "$COMMIT_MSG"
fi

# 5. Check / Create Remote Repository on GitHub using 'gh' CLI
echo "🌐 Checking GitHub remote configuration..."
if ! git remote get-url origin >/dev/null 2>&1; then
  echo "🔍 Checking if repository 'piyso/$REPO_NAME' exists on GitHub..."
  if gh repo view "piyso/$REPO_NAME" >/dev/null 2>&1; then
    echo "🔗 Linking existing repository: git@github.com:piyso/$REPO_NAME.git"
    git remote add origin "https://github.com/piyso/$REPO_NAME.git"
  else
    echo "✨ Creating new public repository 'piyso/$REPO_NAME' on GitHub..."
    gh repo create "$REPO_NAME" --public --source=. --remote=origin --description "AIIA Sovereign MediKiosk & Clinical AI Hospital OS (PS ID 26047)"
  fi
fi

# 6. Push to Main Branch
echo "⬆️ Pushing latest code to GitHub (origin/main)..."
git push -u origin main --force

echo ""
echo "================================================================================"
echo "✅ GITHUB AUTOPUSH COMPLETE!"
echo "📍 Repository: https://github.com/piyso/$REPO_NAME"
echo "⚡ CI/CD Status: https://github.com/piyso/$REPO_NAME/actions"
echo "🌐 Coolify Webhook: If configured, Coolify will now automatically pull and deploy!"
echo "================================================================================"
