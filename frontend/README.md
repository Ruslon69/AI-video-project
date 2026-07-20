# AI Video Director Frontend

React/Vite frontend for the local AI Video Director editor.

## Responsibilities

- Render the three-column editor workspace.
- Manage project, media, and AI suggestion review state.
- Display video preview, filmstrip, timeline tracks, and analysis summaries.
- Call the local FastAPI backend for metadata, previews, scene detection, and transcription.
- Keep AI suggestion review non-destructive.

## Commands

```bash
npm install
npm run dev
npm run lint
npm run build
npm run preview
```

## Source Layout

```text
src/
├── components/   # Editor UI grouped by feature area
├── data/         # Static data and mock AI suggestions
├── hooks/        # Reusable React state hooks
├── services/     # API client
├── utils/        # Shared helpers
├── App.tsx       # Top-level app state coordination
├── App.css       # Application styles
├── index.css     # Global tokens and base styles
└── types.ts      # Shared frontend domain types
```
