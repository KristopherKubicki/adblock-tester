#!/usr/bin/env bash
set -euo pipefail

# Ensure node_modules/.bin exists for stubbed commands
mkdir -p node_modules/.bin

# Provide a simple c8 replacement using Node's built-in test runner
cat > node_modules/.bin/c8 <<'EOS'
#!/usr/bin/env bash
# Lightweight c8 stub for offline environments
args=("$@")
if [ "${args[0]:-}" = "node" ]; then
    args=("${args[@]:1}")
fi
exec node --experimental-test-coverage "${args[@]}"
EOS
chmod +x node_modules/.bin/c8

# Pre-install Python requirements from local wheels if available
if [ -f requirements.txt ]; then
    if ls vendor/python/*.whl >/dev/null 2>&1; then
        pip install --no-index --find-links vendor/python -r requirements.txt
    fi
fi

