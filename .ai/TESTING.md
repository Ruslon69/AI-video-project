# Testing

## Standard Verification Commands

Backend:

```bash
PYTHONPATH=backend backend/.venv/bin/python -m unittest discover backend/tests
PYTHONPATH=backend backend/.venv/bin/python -m compileall backend/app
PYTHONPATH=backend backend/.venv/bin/python -c "from app.main import app; print('backend import ok')"
```

Frontend:

```bash
cd frontend
npm run lint
npm run build
```

## Expectations

- Add backend tests when changing domain logic, validation, API response mapping, media probing, subprocess behavior, timestamp calculation, or preview generation.
- Add frontend tests when a frontend test framework exists or a sprint introduces one.
- Do not introduce a large frontend testing stack unless explicitly requested or justified by risk.
- Run regression checks around affected workflows, especially media upload, metadata loading, preview generation, cancellation, and item removal.
- Validate backend startup/import after backend changes.
- Report any failed, skipped, or sandbox-blocked verification clearly in the final sprint report.
