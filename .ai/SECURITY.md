# Security

- Never trust uploaded filenames, MIME types, or extensions alone.
- Validate actual media streams with ffprobe before treating a file as a valid video.
- Validate duration and dimensions.
- Enforce configurable upload limits. Local development defaults to a 2 GB maximum upload size.
- Use temporary server-generated filenames. Do not use uploaded filenames as filesystem paths.
- Build FFmpeg and ffprobe calls as subprocess argument arrays.
- Use `shell=False`.
- Add timeouts to ffprobe and FFmpeg subprocesses.
- On timeout or controlled failure, return sanitized API errors.
- Do not expose internal filesystem paths, raw subprocess commands, subprocess output, stack traces, or sensitive backend details to clients.
- Keep CORS restricted to the existing local frontend origins. Do not use wildcard origins.
- Clean temporary files and directories in `finally` blocks or equivalent guaranteed cleanup.
- Do not log Base64 image data or full uploaded file contents.

## Future Hardening

Production deployments should add server or proxy-level request-size limits in addition to application-level upload checks.
