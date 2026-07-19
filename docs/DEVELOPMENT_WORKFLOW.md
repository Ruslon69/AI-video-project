# Development Workflow

AI Video Director uses a Technical Lead and implementation engineer workflow. Codex acts as the implementation engineer unless the project owner explicitly assigns a different role.

## Roles

### Technical Lead / Architect

- Defines sprint scope.
- Protects architecture.
- Evaluates technical debt.
- Reviews sprint results.
- Approves commit readiness.
- Plans the next sprint.

### Implementation Engineer / Codex

- Reads `.ai/SESSION_START.md`.
- Implements the sprint.
- Follows `.ai` rules.
- Performs self-review.
- Fixes real issues found.
- Runs all verification commands.
- Does not commit unless explicitly instructed.
- Does not push unless explicitly instructed.

## Sprint Lifecycle

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

## Mandatory End-of-Sprint Checklist

- Review implementation against `.ai` rules.
- Fix all real issues.
- Run backend tests.
- Run backend compile checks.
- Run backend import check.
- Run frontend lint.
- Run frontend build.
- Run `git diff --check`.
- Run `git status --short`.
- Report remaining risks.
- Report technical debt.
- Do not create a commit automatically.

## Commit Safety Rules

- No amend unless explicitly requested.
- Verify intended files before staging.
- Exclude secrets, environment files, generated media, temporary files, and unrelated changes.
- Use one coherent sprint per commit.
- Confirm the working tree is clean after commit.

## Push Safety Rules

- Push only after explicit approval.
- No force push.
- Verify the remote and branch before pushing.
- Report the push result, remote branch updated, latest commit, and final status.
