# Feature Backlog — YouTube Playlist Downloader

Prioritized roadmap. Last updated: **2026-06-03**. All planned iterations complete — backlog is empty.

**Complexity scale:** `S` = a few hours · `M` = 1–2 days · `L` = multiple days · `XL` = week+ and/or technical risk.

**Status legend:** ✅ done

---

## Iteration 1 — Quick wins + ZIP

| ID | Status | Feature | Compl. | Notes |
|----|:--:|---------|:--:|----|
| QW1 | ✅ | Configurable bitrate (128/192/320 dropdown) | S | Dropdown in results bar; `bitrate` passed to `/api/download` (whitelist, fallback 192K). |
| QW2 | ✅ | Parallel downloads (~3 at a time) | S–M | Concurrency pool of 3 workers in `downloadSelected`. |
| QW3 | ✅ | `.txt` drag & drop on songs tab | S | Drop handlers on the textarea; reads `.txt` and appends lines. |
| QW4 | ✅ | Duration filter for channel/playlist (skip >1h / <30s) | S | `filterByDuration` on channel and playlist entries; shows count of skipped. |
| OUT1 | ✅ | ZIP download for "Download all" | M | `POST /api/zip` + `GET /api-zip-file/:id` with `archiver` v7; "As ZIP" toggle in UI. |

## Iteration 2 — Search accuracy

| ID | Status | Feature | Compl. | Notes |
|----|:--:|---------|:--:|----|
| RB1 | ✅ | Top-3 alternatives + switch button | M | `/api/search` returns top-3 candidates per track (`pickCandidates`, tested). "🔄 Other result" button expands a list with thumbnail/title ([ResultsSection.tsx](client/src/components/ResultsSection.tsx)); picking one swaps the row and `videoId` for the download (`chooseAlternative` in [App.tsx](client/src/App.tsx)). |
| RB2 | ✅ | Auto-retry with different search term | M | Shorts (<30s) filtered out in `pickCandidates`; if first search yields nothing, one auto-retry with a more specific term (`retryQuery` → "… official audio", tested). Logic in `/api/search`. |

## Iteration 3 — Bulk download

| ID | Status | Feature | Compl. | Notes |
|----|:--:|---------|:--:|----|
| SEL1 | ✅ | Batch selection with range buttons | S–M | Configurable batch size (25/50/100, default 50) + range buttons (`1–50`, `51–100`, …) that set the selection to exactly that batch. Pure helper in [client/src/batch.ts](client/src/batch.ts) (`batchRanges`, tested); batch bar in [ResultsSection.tsx](client/src/components/ResultsSection.tsx). Only shown when >25 results found, so small lists stay clean. Works with the "All" checkbox and ZIP toggle. |

## Small improvements

| ID | Status | Improvement | Compl. | Notes |
|----|:--:|---------|:--:|----|
| UX1 | ✅ | ZIP download unchecked by default | S | `asZip` state in `App.tsx` defaults to `false`. |
| UX2 | ✅ | Default bitrate = highest (320K) | S | `bitrate` state in `App.tsx` defaults to `320K`; results bar select follows that state. |

## Additional features

| ID | Status | Feature | Compl. | Notes |
|----|:--:|---------|:--:|----|
| OUT2 | ✅ | ID3 tags + cover art in MP3 | M | Title/artist/album/year/cover via `node-id3`. `TrackMeta` on `Result` in client; Album tab attaches Discogs metadata (incl. album art) to each result; server validates meta and writes tags after conversion. |
| IN1 | ✅ | Show Discogs releases (not only masters) | S–M | For compilations/live albums without a master. `/api/album-search` falls back to `type=release` when no masters are found. `AlbumHit.releaseType` ('master'\|'release') determines whether `/api/album-tracks` calls `/masters/:id` or `/releases/:id`. |
| DST1 | ✅ | Electron bundle (.exe) | L | NSIS installer via electron-builder; yt-dlp + ffmpeg bundled (asarUnpack). Discogs token via in-app ⚙️ Settings instead of `.env`. |
