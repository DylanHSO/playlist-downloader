# Agent Instructions

> Read by GitHub Copilot (via `.github/copilot-instructions.md`), Claude Code, and other AI assistants.
> The app UI and all user-facing text are in **Dutch** — keep new strings, labels, and error messages in Dutch to match.

Guidance for working in this repository. The app UI and all user-facing text are in **Dutch** — keep new strings, labels, and error messages in Dutch to match.

## What this is

A local YouTube → MP3 downloader. The user pastes a list of songs (or picks a channel / album / playlist), the app searches YouTube, downloads audio via `yt-dlp`, converts to MP3 via `ffmpeg`, and streams the file(s) back through the browser. Everything runs locally — no cloud, no account.

It ships two ways from **one codebase**:
- **Web app** — `npm run dev` (Vite + server with hot reload) for development; `npm start` builds and runs the production server on `http://localhost:3000`.
- **Desktop app** — Electron wraps the built server in a window; packaged as an NSIS `.exe` installer via electron-builder.

The stack is **TypeScript end-to-end**: a React + Vite frontend in [client/](client/) and an Express server in [server/](server/). Both compile into `dist/` (gitignored); the server serves the built frontend statically.

## Architecture

```
client/   React + TS frontend (Vite)        → builds to dist/client/
server/   Express server in TS              → builds to dist/server/
electron/ main.js loads ../dist/server/app  (Electron entry)
dist/     build output (gitignored): dist/client (Vite) + dist/server (tsc)
release/  electron-builder installer output (gitignored)
tests/    Vitest unit + supertest API tests
```

- **[server/app.ts](server/app.ts)** — exports `createApp()` (builds the Express app, used directly by the API tests), `start(port)` (listens on `127.0.0.1`, resolves the actual port; pass `0` to let the OS pick a free one), and the **pure helpers** (`normalizeBitrate`, `filterByDuration`, `formatDuration`, `mapEntriesToVideos`, `cleanDiscogsName`, `unpacked`) which are exported so the unit tests can cover them. Routes use `__dirname/../client` for static serving, which resolves to `dist/client` at runtime.
- **[server/index.ts](server/index.ts)** — CLI entry: calls `start()` and logs the URL. Run via `tsx` in dev, or as compiled `dist/server/index.js` in production. **Importing `app.ts` does not start listening** — that's why Electron requires `app`, not `index`.
- **[electron/main.js](electron/main.js)** — Electron entry (`main` in package.json), still plain JS. Requires the compiled `../dist/server/app`, calls `start(0)`, loads the chosen port into a `BrowserWindow`. Sets `APP_CONFIG_DIR` to Electron's `userData` dir before requiring the server. Single-instance lock; external links open in the system browser.
- **[client/src/](client/src/)** — `App.tsx` orchestrates the four tabs (**Songs**, **Kanaal**, **Album** via Discogs, **Playlist**), state, and pickers. [api.ts](client/src/api.ts) wraps all `fetch` calls; [useDownloads.ts](client/src/useDownloads.ts) owns the download/poll/concurrency/ZIP logic; [useTheme.ts](client/src/useTheme.ts) the light/dark toggle. Components in `client/src/components/`. Styles in [client/src/styles.css](client/src/styles.css) (CSS variables for theming).

In **dev**, Vite serves the client on `:5173` and proxies `/api` → Express on `:3000` (see [vite.config.ts](vite.config.ts)).

### Request flow
1. Frontend POSTs to a search/enumerate endpoint → gets a list of videos (`api.ts`).
2. `ResultsSection` shows them with checkboxes (all found rows selected by default).
3. Per-song or "Download alles": `POST /api/download` returns a `jobId` immediately; the actual download runs async in `runDownload`.
4. `useDownloads` polls `GET /api/job/:id` every 600ms for progress (parsed from yt-dlp's `NN.N%` stdout).
5. On `done`, the frontend either triggers `GET /api/file/:id` (single MP3) or collects jobIds and POSTs to `/api/zip` → downloads `GET /api/zip-file/:id`.

### Job lifecycle (important)
- Jobs live in an **in-memory `Map`** (`jobs`); ZIP bundles in a separate `zips` Map. Nothing is persisted — a server restart loses all jobs.
- Each download writes to a temp dir `os.tmpdir()/<jobId>/`.
- **Files are deleted after they're streamed once.** `GET /api/file/:id` removes the job dir and deletes the job on stream close. ZIP downloads clean up all underlying jobs too. A 15-minute interval sweeps jobs whose files are older than 1 hour.
- Consequence: a downloaded file can't be re-downloaded from the same job. The frontend marks rows "✓ Gedownload" / "✓ Klaar" and won't re-run them.

### Binaries (yt-dlp + ffmpeg)
- Provided by npm packages `yt-dlp-exec` and `@ffmpeg-installer/ffmpeg` — **not** system installs.
- In a packaged Electron app these binaries are unpacked from `app.asar` to `app.asar.unpacked`. The `unpacked()` helper in [server/app.ts](server/app.ts) rewrites the path. This is why `asarUnpack` in package.json includes `yt-dlp-exec/bin` and `@ffmpeg-installer`. If you add another bundled binary, add it to `asarUnpack` too.

### Discogs (Album tab)
- Used only to fetch album tracklists. Requires a free personal token.
- Token resolution: `DISCOGS_TOKEN` env var (dev, via `.env`) takes precedence; otherwise the token saved via the in-app ⚙️ Settings, stored in `config.json` under `APP_CONFIG_DIR` (Electron userData, or `~/.playlist-downloader` for `npm start`).
- `/api/settings` reports configured/locked status but **never returns the token itself**. When the token is set via `.env` it's "locked" and can't be changed in the UI.

## Commands

```
npm install
npm run dev        # Vite (:5173) + server (:3000) with hot reload — primary dev loop
npm start          # build, then run the production server on http://localhost:3000
npm run build      # build:server (tsc) + build:client (vite) into dist/
npm test           # run Vitest once (unit + API). `npm run test:watch` to watch
npm run typecheck  # tsc --noEmit for both client and server
npm run electron:dev   # build, then launch the Electron app
npm run dist       # build, then the Windows NSIS installer into release/
```

## Tests

- **Unit** ([tests/helpers.test.ts](tests/helpers.test.ts)) — the pure helpers exported from `server/app.ts`.
- **API** ([tests/api.test.ts](tests/api.test.ts)) — supertest against `createApp()`, mocking `yt-search` and global `fetch` (Discogs). Covers validation paths, search/channel mapping, settings (and that the token never leaks), and download/zip 4xx cases.
- [tests/setup.ts](tests/setup.ts) isolates `APP_CONFIG_DIR` to a temp dir and points `DOTENV_CONFIG_PATH` at a nonexistent file so a local `.env` (with a real `DISCOGS_TOKEN`) can't influence tests. **Keep this in mind**: server config/token resolution reads env + `~/.playlist-downloader/config.json` at runtime.
- The download machinery (real yt-dlp/ffmpeg spawn) is intentionally **not** exercised — tests stop at the job-creation boundary.

## Conventions & gotchas

- **Dutch UI text**, including error messages returned from the API (the frontend surfaces `err.message` directly).
- React escapes interpolated values automatically, so the old `_esc()` helper is gone — don't reintroduce `dangerouslySetInnerHTML` for video/channel titles.
- Bitrate is whitelisted server-side (`128K`/`192K`/`320K`, fallback `192K`) — don't trust the client value.
- Duration filter (`filterByDuration`) skips entries <30s or >1h for channel/playlist enumeration; entries with unknown duration are kept.
- Frontend download concurrency is capped at `DOWNLOAD_CONCURRENCY = 3` in [useDownloads.ts](client/src/useDownloads.ts).
- A few `yt-dlp-exec` / Discogs response shapes are typed `any` on purpose (untyped/loose upstream data); pure helpers and the public surface are properly typed. Untyped packages are declared in [server/shims.d.ts](server/shims.d.ts).
- Basic Auth middleware activates **only** when `APP_PASSWORD` is set (keeps local dev open); intended for if the server is ever exposed.
- The build is **not** code-signed; `signAndEditExecutable: false` skips the rcedit/winCodeSign step (fails on Windows without admin/Developer Mode), so the packaged app uses the default Electron icon. See [GUIDE.md](GUIDE.md) for the full reasoning.

## Git & release workflow

- **Branching** — **Create the feature branch before writing any code**: `git checkout -b feature/<naam>`. All non-trivial code changes go on a feature branch; push and open a PR against `main` (`gh pr create`). Never implement changes on `main` first and move them to a branch afterwards. Small doc/backlog-only tweaks (no code changes) may go straight to `main`. Never commit build output (`dist/`, `release/` are gitignored).
- **Commits** — messages in Dutch with conventional prefixes (`feat:`, `refactor:`, `docs:`, `chore:`, …). Before pushing a code change: `npm run typecheck` + `npm test` green.
- **Releases (for user-facing/larger changes)** — the Windows `.exe` ships via **GitHub Releases**, never in the repo. Cut a release with:
  1. Bump `version` in **package.json** + **package-lock.json** (root entries only — lines 3 & 9; a version tag, once used, is taken).
  2. `npm run dist` → `release/Playlist Downloader Setup <versie>.exe` (NSIS, not code-signed).
  3. Commit the bump, tag `vX.Y.Z`, push `main` + the tag.
  4. `gh release create vX.Y.Z "release/Playlist Downloader Setup <versie>.exe" --title "vX.Y.Z" --notes "..." --latest`.
- Latest release at time of writing: **v0.3.0**. The guide download link points at `/releases/latest`, so it auto-tracks the newest release.

## Roadmap

Prioritized backlog lives in [BACKLOG.md](BACKLOG.md). All planned features are complete. Feature IDs (QW1, OUT1, …) appear in code comments to tie code back to backlog items.

## Docs

- [GUIDE.md](GUIDE.md) — End-user and developer guide (install, usage, troubleshooting, building the exe).
- The `.exe` is distributed via GitHub Releases, **not** committed to the repo.
