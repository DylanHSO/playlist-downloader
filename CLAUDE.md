# CLAUDE.md

Guidance for working in this repository. The UI and all user-facing text are in **Dutch** — keep new strings, labels, and error messages in Dutch to match.

## What this is

A local YouTube → MP3 downloader. The user pastes a list of songs (or picks a channel / album / playlist), the app searches YouTube, downloads audio via `yt-dlp`, converts to MP3 via `ffmpeg`, and streams the file(s) back through the browser. Everything runs locally — no cloud, no account.

It ships two ways from **one codebase**:
- **Web app** — `npm start` runs the Express server, open `http://localhost:3000`.
- **Desktop app** — Electron wraps the same server in a window; packaged as an NSIS `.exe` installer via electron-builder.

## Architecture

The whole backend is a single Express app in [server.js](server.js); the frontend is a single vanilla-JS file in [public/app.js](public/app.js). No framework, no build step for the web app.

- **[server.js](server.js)** — exports `{ app, start }`. `start(port)` listens on `127.0.0.1` and resolves the actual port (pass `0` to let the OS pick a free one). Running it directly (`node server.js`) listens on `PORT` (default 3000).
- **[electron/main.js](electron/main.js)** — Electron entry (`main` in package.json). Calls `start(0)`, then loads the chosen port into a `BrowserWindow`. Sets `APP_CONFIG_DIR` to Electron's `userData` dir before requiring the server. Single-instance lock; external links open in the system browser.
- **[public/](public/)** — `index.html`, `app.js`, `style.css`, served statically. Four tabs: **Songs**, **Kanaal** (channel), **Album** (via Discogs), **Playlist**.

### Request flow
1. Frontend POSTs to a search/enumerate endpoint → gets a list of videos.
2. `renderResults` shows them with checkboxes (all checked by default).
3. Per-song or "Download alles": `POST /api/download` returns a `jobId` immediately; the actual download runs async in `runDownload`.
4. Frontend polls `GET /api/job/:id` every 600ms for progress (parsed from yt-dlp's `NN.N%` stdout).
5. On `done`, frontend either triggers `GET /api/file/:id` (single MP3) or collects jobIds and POSTs to `/api/zip` → downloads `GET /api/zip-file/:id`.

### Job lifecycle (important)
- Jobs live in an **in-memory `Map`** (`jobs`); ZIP bundles in a separate `zips` Map. Nothing is persisted — a server restart loses all jobs.
- Each download writes to a temp dir `os.tmpdir()/<jobId>/`.
- **Files are deleted after they're streamed once.** `GET /api/file/:id` removes the job dir and deletes the job on stream close. ZIP downloads clean up all underlying jobs too. A 15-minute interval sweeps jobs whose files are older than 1 hour.
- Consequence: a downloaded file can't be re-downloaded from the same job. The frontend marks rows "✓ Gedownload" / "✓ Klaar" and won't re-run them.

### Binaries (yt-dlp + ffmpeg)
- Provided by npm packages `yt-dlp-exec` and `@ffmpeg-installer/ffmpeg` — **not** system installs.
- In a packaged Electron app these binaries are unpacked from `app.asar` to `app.asar.unpacked`. The `unpacked()` helper in server.js rewrites the path. This is why `asarUnpack` in package.json includes `yt-dlp-exec/bin` and `@ffmpeg-installer`. If you add another bundled binary, add it to `asarUnpack` too.

### Discogs (Album tab)
- Used only to fetch album tracklists. Requires a free personal token.
- Token resolution: `DISCOGS_TOKEN` env var (dev, via `.env`) takes precedence; otherwise the token saved via the in-app ⚙️ Settings, stored in `config.json` under `APP_CONFIG_DIR` (Electron userData, or `~/.playlist-downloader` for `npm start`).
- `/api/settings` reports configured/locked status but **never returns the token itself**. When the token is set via `.env` it's "locked" and can't be changed in the UI.

## Commands

```
npm install
npm start          # web server on http://localhost:3000
npm run electron:dev   # run the Electron app against the source
npm run dist       # build the Windows NSIS installer into dist/
```

There are **no tests** and no linter configured. Verify changes by running the app.

## Conventions & gotchas

- **Dutch UI text**, including error messages returned from the API (the frontend shows `err.message` directly).
- Frontend escapes all interpolated HTML via the `_esc()` helper — keep using it when building markup strings to avoid XSS from video/channel titles.
- Bitrate is whitelisted server-side (`128K`/`192K`/`320K`, fallback `192K`) — don't trust the client value.
- Duration filter (`filterByDuration`) skips entries <30s or >1h for channel/playlist enumeration; entries with unknown duration are kept.
- Frontend download concurrency is capped at `DOWNLOAD_CONCURRENCY = 3` in app.js.
- Basic Auth middleware activates **only** when `APP_PASSWORD` is set (keeps local dev open); intended for if the server is ever exposed.
- The build is **not** code-signed; `signAndEditExecutable: false` skips the rcedit/winCodeSign step (fails on Windows without admin/Developer Mode), so the packaged app uses the default Electron icon. See [HANDLEIDING.md](HANDLEIDING.md) for the full reasoning.

## Roadmap

Prioritized backlog lives in [BACKLOG.md](BACKLOG.md). Iteration 1 (configurable bitrate, parallel downloads, `.txt` drag-and-drop, duration filter, ZIP) and the Electron build (DST1) are done. Feature IDs (QW1, OUT1, …) appear in code comments to tie code back to backlog items.

## Docs

- [HANDLEIDING.md](HANDLEIDING.md) — Dutch end-user + developer manual (install, usage, troubleshooting, building the exe).
- The `.exe` is distributed via GitHub Releases, **not** committed to the repo.
