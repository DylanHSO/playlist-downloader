# Playlist Downloader

A local YouTube → MP3 downloader. Paste a list of songs, or pick a channel, album, or playlist — the app searches YouTube, downloads audio via `yt-dlp`, converts to MP3 via `ffmpeg`, and streams the files back through the browser. No cloud, no account required.

## Features

- **Songs tab** — paste one track per line (`Artist - Title`), or drag & drop a `.txt` file
- **Channel tab** — search for a YouTube channel and download all its videos as MP3
- **Album tab** — look up an album on Discogs and download the full tracklist (requires a free Discogs token)
- **Playlist tab** — paste a YouTube playlist URL and download every video
- Top-3 search alternatives per track with a one-click switch button
- Configurable bitrate (128 / 192 / 320 Kbps)
- Parallel downloads (3 at a time)
- Batch selection for large playlists (range buttons for 25/50/100 tracks at a time)
- ZIP download for downloading everything in one file
- ID3 tags + cover art embedded in MP3s (when album metadata is available)
- Light/dark theme toggle
- Ships as a Windows desktop app (`.exe`) via Electron, or as a local web app

## Installation

Download the latest installer from the [Releases page](https://github.com/DylanHSO/playlist-downloader/releases/latest).

> **Note:** The app is not code-signed. Windows will show a SmartScreen dialog on first run — click **"More info"** → **"Run anyway"**.

For full installation and usage instructions see [HANDLEIDING.md](HANDLEIDING.md).

## Running from source

Requires **Node.js 18+**.

```bash
npm install
npm run dev       # dev server: Vite on :5173, Express on :3000
npm start         # production build served on :3000
npm test          # run all tests
npm run typecheck # TypeScript type-check
```

To build the Windows installer:

```bash
npm run dist      # outputs release/Playlist Downloader Setup x.x.x.exe
```

## How it works

```
client/    React + TypeScript frontend (Vite)   → dist/client/
server/    Express API server (TypeScript)       → dist/server/
electron/  Electron entry — wraps the Express server in a window
tests/     Vitest unit tests + supertest API tests
```

1. The frontend POSTs a search query → Express searches YouTube via `yt-search`
2. Results are shown with checkboxes; the user selects tracks to download
3. `POST /api/download` returns a `jobId` immediately; the download runs asynchronously
4. The frontend polls `GET /api/job/:id` every 600 ms for progress
5. On completion: `GET /api/file/:id` streams the MP3, or `POST /api/zip` bundles multiple jobs into a ZIP

Downloaded files are stored in `os.tmpdir()` and deleted after being streamed once.

## Tech stack

- **Frontend:** React 19, TypeScript, Vite
- **Backend:** Express, TypeScript, `yt-dlp-exec`, `@ffmpeg-installer/ffmpeg`, `node-id3`, `archiver`
- **Desktop:** Electron (NSIS installer via electron-builder)
- **Tests:** Vitest, supertest

## Contributing

See [CLAUDE.md](CLAUDE.md) for development conventions, architecture details, and the git workflow.
