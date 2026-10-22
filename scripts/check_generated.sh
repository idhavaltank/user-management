#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TEMP_DIR"' EXIT

cd "$PROJECT_ROOT"

uvx --from datamodel-code-generator datamodel-codegen \
  --input docs/api/openapi.yaml \
  --input-file-type openapi \
  --output "$TEMP_DIR/schemas.py" \
  --output-model-type pydantic_v2.BaseModel \
  --use-annotated \
  --strict-refs \
  --formatters builtin
sed -i '/^#   timestamp:/d' "$TEMP_DIR/schemas.py"
sed -i '/^#   filename:/a # This file is generated from the OpenAPI contract; do not edit manually.' "$TEMP_DIR/schemas.py"
cmp --silent "$TEMP_DIR/schemas.py" apps/backend/app/generated/schemas.py

(cd apps/frontend && npx --no-install openapi-typescript ../../docs/api/openapi.yaml -o "$TEMP_DIR/api-types.ts")
cmp --silent "$TEMP_DIR/api-types.ts" apps/frontend/src/generated/api-types.ts

echo "Generated API artifacts are up to date."
