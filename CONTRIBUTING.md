# Contributing

AI Video Director uses a sprint-based development workflow. Contributors should follow the `.ai` rules and should never bypass review.

## Environment Setup

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

The project expects local FFmpeg and ffprobe for media-processing features.

## Branch Strategy

- Keep one coherent sprint per branch or commit.
- Keep `main` stable and reviewed.
- Do not mix unrelated refactors with sprint work.

## Sprint Workflow

Follow the lifecycle in [Development Workflow](docs/DEVELOPMENT_WORKFLOW.md):

1. Sprint planning.
2. Implementation.
3. Self-review.
4. Fixes.
5. Verification.
6. Technical Lead review.
7. Commit approval.
8. Commit.
9. Push approval.
10. Push.

## Coding Rules

- Read `.ai/SESSION_START.md` before implementation work.
- Follow `.ai/MASTER_PROMPT.md`, `.ai/ARCHITECTURE.md`, `.ai/CODING_STANDARDS.md`, `.ai/PERFORMANCE.md`, `.ai/SECURITY.md`, and `.ai/TESTING.md`.
- Keep frontend and backend responsibilities separate.
- Keep routes thin and move backend logic into services.
- Use typed schemas and TypeScript types at API boundaries.
- Avoid modifying application behavior outside the sprint scope.

## Review Process

- Review against `.ai/REVIEW_CHECKLIST.md`.
- Fix real issues before asking for commit approval.
- Report remaining risks and technical debt.
- Do not bypass Technical Lead review.

## Testing Expectations

- Run all standard verification commands from `.ai/TESTING.md`.
- Add backend tests when backend domain logic, media processing, validation, error mapping, or timestamp logic changes.
- Add frontend tests when a frontend test framework exists or a sprint introduces one.
- For documentation-only changes, run `git diff --check`, `git status --short`, and any existing Markdown validation command.

## Commit Rules

- Commit only after explicit approval.
- Do not amend unless explicitly requested.
- Verify intended files before staging.
- Exclude secrets, environment files, generated media, temporary files, and unrelated changes.
- Use one coherent sprint per commit.
- Confirm the working tree is clean after commit.

## Push Rules

- Push only after explicit approval.
- Do not use force push.
- Verify the remote and branch before pushing.
- Report the push result, updated remote branch, latest commit, and final status.

## Documentation Expectations

- Keep current and future functionality clearly separated.
- Use relative Markdown links.
- Avoid duplicating large sections across documents.
- Update docs when a durable architecture decision, workflow rule, release milestone, or technical debt item changes.
