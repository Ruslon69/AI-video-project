# AI Engineering Rules

This directory contains persistent engineering guidance for the AI Video Director repository. It is the project-specific rulebook for Codex sessions, sprint planning, implementation reviews, and future architecture decisions.

Codex should use these files before making code changes:

- Read `SESSION_START.md` at the beginning of a session.
- Treat `MASTER_PROMPT.md` as the permanent engineering baseline.
- Use the topic files for implementation details: architecture, coding standards, performance, security, UX, testing, review, roadmap, and sprint planning.

To start a new developer session, paste or reference the contents of `SESSION_START.md`, then provide the sprint description. Codex should inspect the current repository state before coding because these docs describe intent, while the codebase remains the source of truth.

Update these documents when an architectural decision becomes durable, a verification command changes, a major capability lands, or a repeated review finding should become a rule. Keep updates concise and practical. Do not duplicate details already covered in a more specific `.ai` file; link or reference that file instead.
