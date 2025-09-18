cd "$(dirname "$0")/.."

if [ -f backend/venv/bin/activate ]; then
    source backend/venv/bin/activate
fi

python -m backend.server