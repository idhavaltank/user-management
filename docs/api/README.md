# API contract workflow

The OpenAPI document is the source of truth:

- Contract: `docs/api/openapi.yaml`
- Generated TypeScript: `frontend/src/generated/api-types.ts`
- Generated Python: `backend/app/generated/schemas.py`

Validate the contract:

```bash
./scripts/validate_api_contract.sh
```

Regenerate Python schemas:

```bash
./scripts/generate_python_schemas.sh
```

Regenerate frontend types:

```bash
cd frontend
npm run generate:api-types
```

Generated files must not be edited manually. Changes should be made in the OpenAPI document and then regenerated.

CI drift check:

```bash
./scripts/check_generated.sh
```
