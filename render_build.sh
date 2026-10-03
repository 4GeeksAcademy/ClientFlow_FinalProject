#!/usr/bin/env bash
set -euo pipefail

export PIPENV_DONT_LOAD_ENV=1
export PIPENV_VENV_IN_PROJECT=1
export PIPENV_IGNORE_VIRTUALENVS=1

python3 -m venv /tmp/clientflow-pipenv-bootstrap
/tmp/clientflow-pipenv-bootstrap/bin/python -m pip install pipenv==2024.4.1
/tmp/clientflow-pipenv-bootstrap/bin/pipenv sync

npm ci
npm run build
