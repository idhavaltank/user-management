#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

uvx --from datamodel-code-generator datamodel-codegen \
  --input docs/api/openapi.yaml \
  --input-file-type openapi \
  --output apps/backend/app/generated/schemas.py \
  --output-model-type pydantic_v2.BaseModel \
  --use-annotated \
  --strict-refs

# datamodel-code-generator includes the current timestamp in its header. Remove
# it so the generated file is reproducible when the contract has not changed.
sed -i '/^#   timestamp:/d' apps/backend/app/generated/schemas.py
# Keep a stable explanation next to the generated header so maintainers know
# why this file must be changed through the OpenAPI contract, not by hand.
sed -i '/^#   filename:/a # This file is generated from the OpenAPI contract; do not edit manually.' apps/backend/app/generated/schemas.py
