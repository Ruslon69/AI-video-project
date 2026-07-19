# UX Guidelines

- Keep the interface responsive and smooth while background processing runs.
- Never freeze active video playback because metadata, preview, or future AI work is running.
- Show clear loading, empty, ready, and error states.
- Make preview failures non-blocking when the underlying video remains usable.
- Use understandable error messages. Avoid exposing backend internals.
- Prefer progressive disclosure: show essential state first, then details where useful.
- Keep interaction patterns consistent across media library, workspace, and future timeline tools.
- Use accessible controls with labels, keyboard focus states, and semantic elements.
- Ensure text fits on mobile and desktop.
- Design mobile layouts so controls remain reachable and media remains inspectable.
- Use subtle animations only when they do not hurt performance or distract from editing work.
