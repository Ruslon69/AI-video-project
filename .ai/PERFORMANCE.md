# Performance

- Never block the React UI thread with media processing or heavy synchronous work.
- Use backend services for expensive media operations.
- Limit expensive frontend-triggered operations. Video preview requests are currently queued with a maximum of 2 concurrent preview jobs.
- Use `AbortController` for metadata and preview requests.
- Cancel pending and active work when a media item is removed or the media library is cleared.
- Ignore stale responses after removal, replacement, cancellation, or component unmount.
- Do not update state after a component or hook is unmounted.
- Revoke object URLs when media items are removed and when the media library hook is disposed.
- Avoid duplicating Base64 preview payloads in React state.
- Minimize unnecessary React rerenders by keeping callbacks and derived data stable where useful.
- Keep active video playback responsive while previews are generated.

## CPU, Memory, and Disk

- FFmpeg and ffprobe work should be bounded by timeouts.
- Do not launch unlimited FFmpeg jobs.
- Keep generated preview dimensions and count fixed.
- Clean temporary files and directories after processing.
- Avoid retaining temporary files outside the request lifecycle.

## Base64 Preview Debt

Base64 data URLs are acceptable for the first local version, but they increase payload size and memory pressure. Future work should move previews to cached files, object URLs, or a local preview storage endpoint.
