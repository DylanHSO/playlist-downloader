# GitHub Copilot Instructions

## Project overview
Local YouTube → MP3 downloader. Paste songs, or pick channel/album/playlist; app searches YouTube, downloads via `yt-dlp`, converts via `ffmpeg`, streams MP3s back through the browser. No cloud, no account.

Ships two ways from one codebase:
- **Web app**: `npm run dev` (Vite `:5173` + Express `:3000`) or `npm start` (production build)
- **Desktop app**: Electron wraps Express in a window; packaged as NSIS `.exe` via electron-builder

## Tech stack
- **Frontend**: React 19 + TypeScript + Vite → `client/`
- **Backend**: Express + TypeScript → `server/`
- **Desktop**: Electron (`electron/main.js`, plain JS)
- **Build output**: `dist/` (gitignored) — `dist/client/` (Vite) + `dist/server/` (tsc)
- **Tests**: Vitest + supertest → `tests/`

## Key files
| File | Role |
|------|------|
| `server/app.ts` | `createApp()`, `start(port)`, pure helpers (exported for tests) |
| `server/index.ts` | CLI entry — calls `start()`, does NOT export app |
| `electron/main.js` | Electron entry — `require('../dist/server/app')`, calls `start(0)` |
| `client/src/App.tsx` | Four tabs: Songs, Kanaal, Album, Playlist |
| `client/src/api.ts` | All `fetch` wrappers |
| `client/src/useDownloads.ts` | Download/poll/concurrency/ZIP logic |
| `client/src/components/` | `Pickers.tsx`, `ResultsSection.tsx`, `SettingsModal.tsx` |

## Commands
```
npm run dev        # primary dev loop (hot reload)
npm start          # build + run production server
npm run build      # tsc + vite into dist/
npm test           # Vitest once
npm run typecheck  # tsc --noEmit (client + server)
npm run electron:dev  # build + launch Electron
npm run dist       # build + Windows NSIS installer → release/
```

## Request flow
1. Frontend POSTs to search/enumerate endpoint → list of videos
2. `ResultsSection` shows rows with checkboxes (all selected by default)
3. `POST /api/download` → `jobId` immediately; download runs async
4. `useDownloads` polls `GET /api/job/:id` every 600ms for `NN.N%` progress
5. On `done`: `GET /api/file/:id` (single MP3) or `POST /api/zip` + `GET /api/zip-file/:id`

## Job lifecycle
- Jobs: in-memory `Map` in `server/app.ts` — lost on server restart
- Temp files: `os.tmpdir()/<jobId>/`
- **Files deleted after first stream** — no re-download from same job
- Sweep: 15-min interval removes jobs with files older than 1h

## Binaries
- `yt-dlp-exec` and `@ffmpeg-installer/ffmpeg` — npm packages, NOT system installs
- In Electron: unpacked from `app.asar` via `unpacked()` helper in `server/app.ts`
- Adding a binary? Add it to `asarUnpack` in `package.json`

## Discogs (Album tab)
- Token: `DISCOGS_TOKEN` env var (`.env`) > `config.json` in `APP_CONFIG_DIR`
- `APP_CONFIG_DIR`: Electron userData or `~/.playlist-downloader` (web)
- `/api/settings` reports status only — **never returns the token**

## Coding conventions
- **Dutch UI text everywhere** — error messages, labels, button text, API error strings
- **No `dangerouslySetInnerHTML`** — React escapes interpolated values automatically
- **Bitrate whitelist server-side**: `128K` / `192K` / `320K`, fallback `192K` — never trust client
- **Duration filter** (`filterByDuration`): skip <30s or >1h; unknown duration = keep
- **Download concurrency**: `DOWNLOAD_CONCURRENCY = 3` in `useDownloads.ts`
- `yt-dlp-exec` / Discogs response shapes typed `any` intentionally (untyped upstream)
- Basic Auth: only activates when `APP_PASSWORD` env var is set
- Build NOT code-signed (`signAndEditExecutable: false`)

## Tests
- **Unit** (`tests/helpers.test.ts`): pure helpers from `server/app.ts`
- **API** (`tests/api.test.ts`): supertest on `createApp()`, mocking `yt-search` + `fetch`
- **Setup** (`tests/setup.ts`): isolates `APP_CONFIG_DIR` + `DOTENV_CONFIG_PATH` — local `.env` does NOT affect tests
- Real yt-dlp/ffmpeg spawning is NOT tested — tests stop at job-creation boundary

## Git & release workflow
- Feature branches: `feature/<naam>` → PR to `main`
- Commit messages: **Dutch**, conventional prefixes (`feat:`, `refactor:`, `docs:`, `chore:`)
- Before pushing: `npm run typecheck` + `npm test` must be green
- Releases: bump `package.json` + `package-lock.json` version, `npm run dist`, tag `vX.Y.Z`, `gh release create`
- Latest release: **v0.3.0** — HANDLEIDING link points at `/releases/latest`

## Backlog
See `BACKLOG.md` for prioritized feature list. Feature IDs (QW1, OUT1, …) appear in code comments.
