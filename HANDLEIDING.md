# User & Developer Guide — Playlist Downloader

A local app that downloads a list of songs as MP3 files via YouTube. Everything runs on your own machine — no cloud, no account required.

There are two ways to use the app:

- **For end users** — install the ready-to-use app (`.exe`). No Node, no Python, nothing technical.
- **For developers** — run the source code with Node, or build a new `.exe` yourself.

---

## For end users — installing the app

### Installation (1 minute)

1. Go to the **[releases page](https://github.com/DylanHSO/playlist-downloader/releases/latest)** and download the installer **`Playlist-Downloader-Setup-x.x.x.exe`** under "Assets".
2. Double-click the file.
3. If you see a blue **"Windows protected your PC"** SmartScreen dialog — this appears because the app is not code-signed. Click **"More info"** → **"Run anyway"**.
4. Choose an installation folder if desired and click **Install**. Done — a **Playlist Downloader** shortcut will appear in your Start Menu and on your Desktop.

### Usage

1. Open **Playlist Downloader** (Start Menu or Desktop). A single window opens — no browser needed.
2. Paste your list into the text area, one track per line in the format `Artist - Title`. For example:
   ```
   Taylor Swift - Shake It Off
   Volbeat - Lola Montez
   Metallica - Nothing Else Matters
   ```
   You can also drag and drop a `.txt` file onto the text area.
3. Click **🔍 Search track(s)**.
4. Choose your quality (bitrate) and whether you want everything as a single **ZIP**. Click **⬇ MP3** per track, or **Download all** in one go.
5. Windows will ask where to save the file.

In addition to the songs list, there are tabs for an entire **channel**, an **album** (tracklist via Discogs), and a **YouTube playlist**.

### Enabling the Album tab (Discogs token)

The Album tab fetches tracklists via the Discogs API, which requires a free personal token:

1. Create a free account at **https://www.discogs.com/** (if you don't have one already).
2. Go to **https://www.discogs.com/settings/developers** → **"Generate new token"** and copy the string.
3. In the app, click **⚙️** (Settings) in the top-right corner, paste your token, and click **Save**.

The token is stored locally on your machine and persists across updates. Without a token the Songs, Channel, and Playlist tabs work fine; the Album tab will show a clear message instead.

---

## For developers

### Running from source

Requires **Node.js 18+** (https://nodejs.org/, LTS). The app is written in **TypeScript** with a **React + Vite** frontend and an **Express** server.

```
npm install
npm run dev
```

`npm run dev` starts Vite (frontend) on **http://localhost:5173** with hot reload and the server on port 3000; open **http://localhost:5173**. To run a production build as the end user would see it, `npm start` builds everything and serves it on **http://localhost:3000**.

In dev mode you can also set the Discogs token via a `.env` file (`DISCOGS_TOKEN=...`); this takes precedence and cannot be changed via the ⚙️ Settings UI.

Useful scripts:

| Script | Does |
|---|---|
| `npm run dev` | Vite + server with hot reload (dev loop). |
| `npm start` | Builds and runs the production server on port 3000. |
| `npm run build` | Compiles server (tsc) and frontend (vite) into `dist/`. |
| `npm test` | Runs the tests (Vitest unit + supertest API). |
| `npm run typecheck` | TypeScript type-check without building. |

### Building the `.exe`

```
npm install
npm run dist
```

The NSIS installer will be placed in the **`release/`** folder (`Playlist Downloader Setup x.x.x.exe`). yt-dlp and ffmpeg are bundled automatically — end users do not need to install anything extra.

> The build is not code-signed; end users will therefore see a one-time SmartScreen warning (see above). Code signing can be added later with a certificate.
>
> The build config sets `signAndEditExecutable: false`. This skips the `winCodeSign`/`rcedit` step (which fails on Windows without Developer Mode or admin rights due to symlink extraction). As a result the app currently uses the default Electron icon. To use a custom icon: place a `build/icon.ico` file, re-enable `signAndEditExecutable`, and build from a terminal with admin rights (or with Windows Developer Mode enabled).

---

## Troubleshooting

| Problem | Solution |
|---|---|
| "Windows protected your PC" when installing | Normal for an unsigned app. Click "More info" → "Run anyway". |
| App does not open / screen stays blank | Close it completely (including from the taskbar) and restart. |
| YouTube cannot find a track | Try a more specific search term, e.g. `Artist - Title (Official Audio)`. |
| "Sign in to confirm you're not a bot" | YouTube suspects a bot. Reach out to Dylan — he can help with a cookie file. |
| "Discogs is not configured" | Token is missing. Click ⚙️ and paste your Discogs token (see above). |
| (developer) `Cannot find module ...` | Run `npm install` again. |

Questions? Send Dylan a message.

