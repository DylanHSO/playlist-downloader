# Feature Backlog — YouTube Playlist Downloader

Geprioriteerde roadmap. Laatst bijgewerkt: **2026-06-03**. Iteratie 1 ✅ afgerond.

**Complexiteitsschaal:** `S` = paar uur · `M` = 1–2 dagen · `L` = meerdere dagen · `XL` = week+ en/of technisch risico.

**Status-legenda:** ⬜ todo · 🔄 bezig · ✅ klaar

---

## 🎯 Iteratie 1 — Quick wins + ZIP

| ID | Status | Feature | Compl. | Toelichting |
|----|:--:|---------|:--:|----|
| QW1 | ✅ | Configureerbare bitrate (128/192/320 dropdown) | S | Dropdown in de results-bar; `bitrate` doorgegeven aan `/api/download` (whitelist, fallback 192K). |
| QW2 | ✅ | Parallelle downloads (~3 tegelijk) | S–M | Concurrency-pool van 3 workers in `downloadSelected`. |
| QW3 | ✅ | `.txt` droppen op songs-tab (drag & drop) | S | Drop-handlers op de textarea; leest `.txt` in en voegt regels toe. |
| QW4 | ✅ | Duur-filter channel/playlist (skip 1h+ / <30s) | S | `filterByDuration` op channel- en playlist-entries; toont aantal overgeslagen. |
| OUT1 | ✅ | ZIP-download bij "Download alles" | M | `POST /api/zip` + `GET /api/zip-file/:id` met `archiver` v7; "Als ZIP"-toggle in de UI. |

## 🎯 Iteratie 2 — Trefzekerheid

| ID | Status | Feature | Compl. | Toelichting |
|----|:--:|---------|:--:|----|
| RB1 | ⬜ | Top-3 alternatieven + wisselknop | M | Tegen lyric-/sped-up-/nightcore-hits. Search meerdere resultaten teruggeven + UI om te kiezen. |
| RB2 | ⬜ | Auto-retry met andere zoekterm | M | Bij fail of <30s; sluit Shorts uit. Logica in search/download. |

## 🎯 Iteratie 3 — Bulk-download

| ID | Status | Feature | Compl. | Toelichting |
|----|:--:|---------|:--:|----|
| SEL1 | ⬜ | Batch-selectie met bereik-knoppen | S–M | Download grote lijsten in batches i.p.v. alles tegelijk. **Instelbare batchgrootte** (25/50/100, default 50). **Bereik-knoppen** (`1–50`, `51–100`, …) die de selectie precies op die batch zetten. Geldt voor de tabs **Songs**, **Kanaal** en **Playlist** (niet Album — die zijn klein). Bouwt voort op de bestaande checkbox-selectie + `DOWNLOAD_CONCURRENCY`; werkt samen met de "Alles"-checkbox en de ZIP-toggle. |

## 🔧 Kleine verbeteringen (quick fixes)

| ID | Status | Verbetering | Compl. | Toelichting |
|----|:--:|---------|:--:|----|
| UX1 | ⬜ | ZIP-download standaard uitgevinkt | S | `asZip` in [useDownloads/App] nu default `true` → zet naar `false` (en de checkbox in de results-bar). |
| UX2 | ⬜ | Default bitrate = hoogste (320K) | S | Default staat nu op 192K (`bitrate`-state + `selected` option). Zet de standaard op **320 kbps**. |

## 📋 Backlog — later, volgorde nog te bepalen

| ID | Status | Feature | Compl. | Toelichting |
|----|:--:|---------|:--:|----|
| OUT2 | ⬜ | ID3-tags + cover art in MP3 | M | Titel/artiest/album/jaar/cover via `node-id3`. Bij Album-tab is de info er al (Discogs); grootste winst daar. |
| IN1 | ⬜ | Discogs releases tonen (niet alleen masters) | S–M | Voor compilations/live-albums zonder master. Uitbreiding bestaande Discogs-calls. |
| IN2 | ⬜ | Spotify-playlist-URL → YouTube-audio | M–L | Spotify API (client-credentials, dev-app + secret nodig). Tracklist ophalen, bestaande search hergebruiken. |
| IN3 | ⬜ | Foto-upload → tracklist herkennen (vision) | L | Foto van hoes/tracklist → tekst via vision → matchen op YouTube. Nieuwe pipeline + AI-kosten. "Lijstfoto" past hier ook in. |
| IN4 | ⬜ | Instagram koppelen & uitlezen | XL | Platen-posts → nummers. Geen vriendelijke officiële API; scrapen fragiel + ToS-risico. Bouwt op IN3 voor herkenning. |
| IN5 | ⬜ | Diepe zoekmachine (auteur/label) | L–XL | Web afstruinen → tekstresultaat → doorklik naar YouTube-lookup. Scope kan uitlopen. |
| DST1 | ✅ | Electron-bundel (.exe) | L | NSIS-installer via electron-builder; yt-dlp + ffmpeg meegebundeld (asarUnpack). Discogs-token via in-app ⚙️ Instellingen i.p.v. `.env`. |

---

## Notities & afhankelijkheden

- **IN3 ↔ IN4:** Instagram-posts uitlezen leunt op dezelfde vision-/herkenningsstap als foto-upload. Doe IN3 eerst; IN4 wordt dan "haal de afbeelding uit een IG-post en gooi 'm door IN3".
- **OUT2** profiteert het meest bij de Album-tab, waar de metadata (artiest/album/jaar/cover) al via Discogs binnenkomt.
- **IN4 / IN5 / DST1** zijn elk een mini-project op zich — bewust naar achteren geschoven.
