import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import ytSearch from 'yt-search';
import ytDlpExec from 'yt-dlp-exec';
import archiver from 'archiver';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { randomUUID } from 'crypto';

// In een gebundelde Electron-app zitten binaries in app.asar (read-only) en
// worden ze door electron-builder uitgepakt naar app.asar.unpacked. Voor het
// uitvoeren moeten we dus naar dat uitgepakte pad wijzen.
export function unpacked(p: string | undefined): string | undefined {
  return p && p.includes(`app.asar${path.sep}`)
    ? p.replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`)
    : p;
}

const ffmpegPath = unpacked(require('@ffmpeg-installer/ffmpeg').path);
const ytDlpPath = unpacked(require('yt-dlp-exec/src/constants').YOUTUBE_DL_PATH);
const ytDlp = (ytDlpExec as unknown as { create: (p: string | undefined) => any }).create(ytDlpPath);

const DISCOGS_UA = 'PlaylistDownloader/0.2 (+local)';

// Instellingen-opslag. In de Electron-app zet main.js APP_CONFIG_DIR op de
// userData-map; daarbuiten (npm start) valt 'ie terug op de home-map.
const CONFIG_DIR = process.env.APP_CONFIG_DIR || path.join(os.homedir(), '.playlist-downloader');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

interface Config {
  discogsToken?: string;
}

function readConfig(): Config {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function writeConfig(patch: Config): Config {
  const next = { ...readConfig(), ...patch };
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(next, null, 2));
  return next;
}

// Token uit .env (dev) heeft voorrang, anders uit de opgeslagen config.
function getDiscogsToken(): string {
  return process.env.DISCOGS_TOKEN || readConfig().discogsToken || '';
}

function discogsError(r: globalThis.Response): Error {
  if (r.status === 429) {
    const retry = parseInt(r.headers.get('retry-after') || '60', 10);
    return new Error(`Discogs limiet bereikt. Probeer over ~${retry}s opnieuw.`);
  }
  if (r.status === 401 || r.status === 403) {
    return new Error('Discogs-token ongeldig of geweigerd. Controleer je token via ⚙️ Instellingen.');
  }
  return new Error(`Discogs gaf HTTP ${r.status}`);
}

// ── Pure helpers (geëxporteerd voor de unit-tests) ────────────────────────

export interface VideoEntry {
  id?: string;
  title?: string;
  duration?: number;
}

export interface Video {
  found: true;
  videoId: string;
  title: string;
  url: string;
  duration: string | null;
  thumbnail: string;
  channel: string;
  source: string | null;
}

// Duur-filter (QW4): sla shorts (<30s) en lange video's (>1u) over.
// Entries zonder bekende duur blijven behouden (we kunnen niet beoordelen).
export const MIN_DURATION_SECS = 30;
export const MAX_DURATION_SECS = 60 * 60;

export function filterByDuration(entries: VideoEntry[] | undefined): {
  kept: VideoEntry[];
  skipped: number;
} {
  const kept: VideoEntry[] = [];
  let skipped = 0;
  for (const e of entries || []) {
    const d = e.duration;
    if (typeof d === 'number' && isFinite(d) && (d < MIN_DURATION_SECS || d > MAX_DURATION_SECS)) {
      skipped++;
      continue;
    }
    kept.push(e);
  }
  return { kept, skipped };
}

export function formatDuration(secs: unknown): string | null {
  if (typeof secs !== 'number' || !isFinite(secs) || secs <= 0) return null;
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function mapEntriesToVideos(
  entries: VideoEntry[] | undefined,
  sourceName: string,
  sourceLabel: string
): Video[] {
  return (entries || [])
    .filter((e): e is VideoEntry & { id: string } => Boolean(e.id))
    .map((e) => ({
      found: true,
      videoId: e.id,
      title: e.title || 'Onbekende titel',
      url: `https://www.youtube.com/watch?v=${e.id}`,
      duration: formatDuration(e.duration),
      thumbnail: `https://i.ytimg.com/vi/${e.id}/default.jpg`,
      channel: sourceName,
      source: sourceName ? `${sourceLabel}: ${sourceName}` : null,
    }));
}

// Allowed MP3 bitrates (QW1). Falls back to 192K for anything unexpected.
const ALLOWED_BITRATES = new Set(['128K', '192K', '320K']);
export function normalizeBitrate(value: unknown): string {
  return typeof value === 'string' && ALLOWED_BITRATES.has(value) ? value : '192K';
}

// Strip Discogs' disambiguation suffix like "Volbeat (2)" → "Volbeat"
export function cleanDiscogsName(name: string | undefined | null): string {
  return (name || '').replace(/\s*\(\d+\)\s*$/, '').trim();
}

// Een kanaal-root-URL (bijv. https://www.youtube.com/@Sefa of /channel/UC...)
// laat yt-dlp de *tabbladen* (Videos/Shorts/Live) als entries teruggeven i.p.v.
// de echte video's. Wijs daarom expliciet naar het Videos-tabblad, tenzij de
// URL al een tab/segment bevat dat we moeten respecteren.
const CHANNEL_TABS = new Set([
  'videos',
  'shorts',
  'streams',
  'live',
  'featured',
  'playlists',
  'community',
  'channels',
  'about',
  'releases',
  'podcasts',
  'store',
]);

export function channelVideosUrl(url: string): string {
  const trimmed = url.trim();
  // Splits eventuele query/hash eraf, normaliseer trailing slash.
  const [base, rest = ''] = trimmed.split(/(?=[?#])/, 2) as [string, string?];
  const clean = base.replace(/\/+$/, '');
  const lastSegment = clean.split('/').pop()?.toLowerCase() ?? '';
  if (CHANNEL_TABS.has(lastSegment)) return trimmed; // al een tab → laat staan
  return `${clean}/videos${rest}`;
}

// List all videos from a YouTube channel or playlist URL via yt-dlp flat-playlist.
async function enumerateYouTubeUrl(url: string): Promise<any> {
  // yt-dlp-exec auto-parses JSON when stdout starts with `{`.
  const data = await ytDlp(url, {
    flatPlaylist: true,
    dumpSingleJson: true,
    skipDownload: true,
  });
  if (typeof data !== 'object' || data === null) {
    throw new Error('Onverwacht antwoord van yt-dlp');
  }
  return data;
}

// ── Job-state ─────────────────────────────────────────────────────────────

interface Job {
  status: 'pending' | 'downloading' | 'done' | 'error';
  progress: number;
  error: string | null;
  file: string | null;
  filename: string | null;
}

// In-memory job tracking
const jobs = new Map<string, Job>();
// ZIP-bundels (OUT1)
const zips = new Map<string, { jobId: string; path: string; name: string }[]>();

async function runDownload(videoId: string, jobId: string, bitrate = '192K'): Promise<void> {
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const job = jobs.get(jobId);
  if (!job) return;
  job.status = 'downloading';

  const jobDir = path.join(os.tmpdir(), jobId);
  fs.mkdirSync(jobDir, { recursive: true });

  try {
    const proc = ytDlp(url, {
      extractAudio: true,
      audioFormat: 'mp3',
      audioQuality: bitrate,
      ffmpegLocation: ffmpegPath,
      output: path.join(jobDir, '%(title)s.%(ext)s'),
      noPlaylist: true,
      newline: true,
    });

    const parseProgress = (chunk: Buffer) => {
      const match = chunk.toString().match(/(\d+\.?\d*)%/);
      if (match) job.progress = parseFloat(match[1]);
    };

    proc.stdout?.on('data', parseProgress);
    proc.stderr?.on('data', parseProgress);

    await proc;

    const files = fs.readdirSync(jobDir);
    const mp3 = files.find((f) => f.endsWith('.mp3'));
    if (!mp3) throw new Error('MP3 niet gevonden na conversie');

    job.file = path.join(jobDir, mp3);
    job.filename = mp3;
    job.status = 'done';
    job.progress = 100;
  } catch (err) {
    const e = err as { shortMessage?: string; message?: string };
    job.status = 'error';
    job.error = e.shortMessage || e.message || 'Onbekende fout';
    fs.rm(jobDir, { recursive: true, force: true }, () => {});
    console.error(`Download fout [${jobId}]:`, job.error);
  }
}

// ── Express-app ─────────────────────────────────────────────────────────────

export function createApp() {
  const app = express();

  // Basic Auth — only active when APP_PASSWORD is set (so local dev stays open)
  const APP_PASSWORD = process.env.APP_PASSWORD;
  const APP_USER = process.env.APP_USER || 'collega';

  if (APP_PASSWORD) {
    app.use((req: Request, res: Response, next: NextFunction) => {
      const auth = req.headers.authorization;
      if (auth?.startsWith('Basic ')) {
        const [user, pass] = Buffer.from(auth.slice(6), 'base64').toString().split(':');
        if (user === APP_USER && pass === APP_PASSWORD) return next();
      }
      res.set('WWW-Authenticate', 'Basic realm="Playlist Downloader"');
      res.status(401).send('Authenticatie vereist');
    });
  }

  app.use(express.json());
  app.use(express.static(path.join(__dirname, '../client')));

  // Search YouTube for multiple songs
  app.post('/api/search', async (req: Request, res: Response) => {
    const { queries } = req.body;
    if (!Array.isArray(queries) || queries.length === 0) {
      return res.status(400).json({ error: 'Geen nummers opgegeven' });
    }

    const results = await Promise.all(
      queries.map(async (query: string) => {
        try {
          const r = await ytSearch(query);
          const v = r.videos[0];
          if (!v) return { query, found: false };
          return {
            query,
            found: true,
            videoId: v.videoId,
            title: v.title,
            url: v.url,
            duration: v.timestamp,
            thumbnail: v.thumbnail,
            channel: v.author?.name,
          };
        } catch {
          return { query, found: false, error: 'Zoekfout' };
        }
      })
    );

    res.json(results);
  });

  // Search YouTube for channels matching a name (top 3)
  app.post('/api/channel-search', async (req: Request, res: Response) => {
    const { channelName } = req.body;
    if (!channelName || typeof channelName !== 'string') {
      return res.status(400).json({ error: 'Geen kanaal-naam opgegeven' });
    }

    try {
      const r = await ytSearch(channelName);
      const positive = (n: unknown) => (typeof n === 'number' && n > 0 ? n : null);
      const channels = (r.channels || []).slice(0, 3).map((c: any) => ({
        name: c.name,
        url: c.url,
        subscribers: positive(c.subCount) || c.subscribers || null,
        videoCount: positive(c.videoCount),
        thumbnail: c.image || c.thumbnail || null,
        description: c.description || null,
      }));

      if (!channels.length) {
        return res.status(404).json({ error: 'Geen kanaal gevonden' });
      }

      res.json({ channels });
    } catch (err) {
      console.error('Kanaal-zoek fout:', err);
      res.status(500).json({ error: (err as Error).message || 'Onbekende fout' });
    }
  });

  // List videos from a channel
  app.post('/api/channel-videos', async (req: Request, res: Response) => {
    const { channelUrl } = req.body;
    if (!channelUrl || typeof channelUrl !== 'string') {
      return res.status(400).json({ error: 'Geen kanaal-url opgegeven' });
    }
    try {
      const data = await enumerateYouTubeUrl(channelVideosUrl(channelUrl));
      const sourceName = data.channel || data.uploader || '';
      const { kept, skipped } = filterByDuration(data.entries);
      const videos = mapEntriesToVideos(kept, sourceName, 'Uit kanaal');
      res.json({ videos, skipped, channel: { name: sourceName, total: videos.length } });
    } catch (err) {
      const e = err as { shortMessage?: string; message?: string };
      console.error('Kanaal-video-fout:', err);
      res.status(500).json({ error: e.shortMessage || e.message || 'Onbekende fout' });
    }
  });

  // List videos from a playlist URL
  app.post('/api/playlist-videos', async (req: Request, res: Response) => {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Geen playlist-url opgegeven' });
    }
    try {
      const data = await enumerateYouTubeUrl(url);
      const sourceName = data.title || data.uploader || '';
      const { kept, skipped } = filterByDuration(data.entries);
      const videos = mapEntriesToVideos(kept, sourceName, 'Uit playlist');
      if (!videos.length) {
        return res.status(404).json({ error: "Geen video's gevonden in deze URL" });
      }
      res.json({ videos, skipped, playlist: { name: sourceName, total: videos.length } });
    } catch (err) {
      const e = err as { shortMessage?: string; message?: string };
      console.error('Playlist-video-fout:', err);
      res.status(500).json({ error: e.shortMessage || e.message || 'Onbekende fout' });
    }
  });

  // Instellingen — lees status (lekt de token niet) en sla 'm op.
  app.get('/api/settings', (_req: Request, res: Response) => {
    res.json({
      discogsConfigured: !!getDiscogsToken(),
      // Token uit .env kan niet via de UI worden overschreven
      discogsLocked: !!process.env.DISCOGS_TOKEN,
    });
  });

  app.post('/api/settings', (req: Request, res: Response) => {
    if (process.env.DISCOGS_TOKEN) {
      return res
        .status(409)
        .json({ error: 'Token staat vast via .env en kan niet via de app worden gewijzigd.' });
    }
    const { discogsToken } = req.body;
    if (typeof discogsToken !== 'string') {
      return res.status(400).json({ error: 'discogsToken ontbreekt' });
    }
    try {
      writeConfig({ discogsToken: discogsToken.trim() });
      res.json({ discogsConfigured: !!discogsToken.trim() });
    } catch (err) {
      console.error('Instellingen opslaan mislukt:', err);
      res.status(500).json({ error: 'Kon instellingen niet opslaan' });
    }
  });

  // Discogs — search master releases by query
  app.post('/api/album-search', async (req: Request, res: Response) => {
    const token = getDiscogsToken();
    if (!token) {
      return res.status(503).json({
        error: 'Discogs is niet geconfigureerd. Voeg je token toe via ⚙️ Instellingen.',
      });
    }
    const { query } = req.body;
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Geen album-naam opgegeven' });
    }

    try {
      const url = new URL('https://api.discogs.com/database/search');
      url.searchParams.set('q', query);
      url.searchParams.set('type', 'master');
      url.searchParams.set('per_page', '5');
      url.searchParams.set('token', token);

      const r = await fetch(url, { headers: { 'User-Agent': DISCOGS_UA } });
      if (!r.ok) throw discogsError(r);
      const data: any = await r.json();

      const albums = (data.results || []).slice(0, 5).map((rel: any) => ({
        id: rel.master_id || rel.id,
        title: rel.title,
        year: rel.year || null,
        thumbnail: rel.cover_image || rel.thumb || null,
        format: Array.isArray(rel.format) ? rel.format.join(', ') : null,
      }));

      if (!albums.length) {
        return res.status(404).json({ error: 'Geen album gevonden op Discogs' });
      }

      res.json({ albums });
    } catch (err) {
      console.error('Discogs-zoek fout:', err);
      res.status(500).json({ error: (err as Error).message || 'Onbekende fout' });
    }
  });

  // Discogs — fetch tracklist for a master release
  app.post('/api/album-tracks', async (req: Request, res: Response) => {
    const token = getDiscogsToken();
    if (!token) {
      return res.status(503).json({ error: 'Discogs is niet geconfigureerd' });
    }
    const { albumId } = req.body;
    if (!albumId) return res.status(400).json({ error: 'albumId ontbreekt' });

    try {
      const url = `https://api.discogs.com/masters/${encodeURIComponent(albumId)}?token=${encodeURIComponent(token)}`;
      const r = await fetch(url, { headers: { 'User-Agent': DISCOGS_UA } });
      if (!r.ok) throw discogsError(r);
      const data: any = await r.json();

      const cleanArtist = cleanDiscogsName(data.artists && data.artists[0]?.name);

      const tracks = (data.tracklist || [])
        .filter((t: any) => t.type_ === 'track' || !t.type_)
        .filter((t: any) => t.title)
        .map((t: any) => ({
          artist: cleanDiscogsName(t.artists && t.artists[0]?.name) || cleanArtist,
          title: t.title,
          position: t.position || '',
          duration: t.duration || null,
        }));

      if (!tracks.length) {
        return res.status(404).json({ error: 'Geen tracks gevonden voor dit album' });
      }

      res.json({
        album: { title: data.title, artist: cleanArtist, year: data.year || null },
        tracks,
      });
    } catch (err) {
      console.error('Discogs-tracks fout:', err);
      res.status(500).json({ error: (err as Error).message || 'Onbekende fout' });
    }
  });

  // Start a download job — returns jobId immediately
  app.post('/api/download', (req: Request, res: Response) => {
    const { videoId, bitrate } = req.body;
    if (!videoId) return res.status(400).json({ error: 'videoId ontbreekt' });

    const jobId = randomUUID();
    jobs.set(jobId, { status: 'pending', progress: 0, error: null, file: null, filename: null });
    res.json({ jobId });

    runDownload(videoId, jobId, normalizeBitrate(bitrate));
  });

  // Poll job status
  app.get('/api/job/:id', (req: Request, res: Response) => {
    const job = jobs.get(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job niet gevonden' });
    res.json({
      status: job.status,
      progress: job.progress,
      error: job.error,
      filename: job.filename,
    });
  });

  // Stream the finished MP3 to the browser and clean up afterwards
  app.get('/api/file/:id', (req: Request, res: Response) => {
    const job = jobs.get(req.params.id);
    if (!job || job.status !== 'done' || !job.file) {
      return res.status(404).json({ error: 'Bestand niet (meer) beschikbaar' });
    }

    const safeFilename = encodeURIComponent(job.filename!);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${safeFilename}`);
    res.setHeader('Content-Type', 'audio/mpeg');

    const stream = fs.createReadStream(job.file);
    stream.pipe(res);

    stream.on('close', () => {
      const jobDir = path.dirname(job.file!);
      fs.rm(jobDir, { recursive: true, force: true }, () => {});
      jobs.delete(req.params.id);
    });

    stream.on('error', () => res.end());
  });

  // ZIP-download (OUT1): bundel meerdere afgeronde jobs in één archief.
  // De frontend downloadt elk nummer eerst los (met voortgang) en stuurt
  // daarna de verzamelde jobIds hierheen.
  app.post('/api/zip', (req: Request, res: Response) => {
    const { jobIds } = req.body;
    if (!Array.isArray(jobIds) || jobIds.length === 0) {
      return res.status(400).json({ error: 'Geen jobIds opgegeven' });
    }

    const files: { jobId: string; path: string; name: string }[] = [];
    const usedNames = new Set<string>();
    for (const id of jobIds) {
      const job = jobs.get(id);
      if (!job || job.status !== 'done' || !job.file) continue;
      // Voorkom dubbele namen in de ZIP
      let name = job.filename!;
      if (usedNames.has(name)) {
        const ext = path.extname(name);
        name = `${path.basename(name, ext)} (${usedNames.size})${ext}`;
      }
      usedNames.add(name);
      files.push({ jobId: id, path: job.file, name });
    }

    if (!files.length) {
      return res.status(404).json({ error: 'Geen downloadbare bestanden (meer) beschikbaar' });
    }

    const zipId = randomUUID();
    zips.set(zipId, files);
    res.json({ zipId, count: files.length });
  });

  app.get('/api/zip-file/:id', (req: Request, res: Response) => {
    const files = zips.get(req.params.id);
    if (!files) {
      return res.status(404).json({ error: 'ZIP niet (meer) beschikbaar' });
    }

    const stamp = new Date().toISOString().slice(0, 10);
    const zipName = encodeURIComponent(`playlist-${stamp}.zip`);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${zipName}`);
    res.setHeader('Content-Type', 'application/zip');

    const archive = archiver('zip', { zlib: { level: 0 } }); // MP3's zijn al gecomprimeerd
    archive.on('error', () => res.end());
    archive.pipe(res);

    for (const f of files) {
      if (fs.existsSync(f.path)) archive.file(f.path, { name: f.name });
    }
    archive.finalize();

    // Ruim de onderliggende jobs en deze ZIP-entry op zodra de stream klaar is
    res.on('close', () => {
      for (const f of files) {
        const job = jobs.get(f.jobId);
        if (job?.file) fs.rm(path.dirname(job.file), { recursive: true, force: true }, () => {});
        jobs.delete(f.jobId);
      }
      zips.delete(req.params.id);
    });
  });

  return app;
}

// Clean up temp files and jobs older than 1 hour
export function startCleanupTimer() {
  return setInterval(() => {
    const cutoff = Date.now() - 60 * 60 * 1000;
    for (const [jobId, job] of jobs) {
      if (job.file) {
        try {
          const { mtimeMs } = fs.statSync(job.file);
          if (mtimeMs < cutoff) {
            fs.rm(path.dirname(job.file), { recursive: true, force: true }, () => {});
            jobs.delete(jobId);
          }
        } catch {
          jobs.delete(jobId);
        }
      }
    }
  }, 15 * 60 * 1000);
}

const PORT = Number(process.env.PORT) || 3000;

// Start de HTTP-server. Met port 0 kiest het OS een vrije poort (handig voor
// de Electron-app); retourneert de daadwerkelijke poort.
export function start(port: number = PORT): Promise<{ server: import('http').Server; port: number }> {
  const app = createApp();
  startCleanupTimer();
  return new Promise((resolve, reject) => {
    const server = app.listen(port, '127.0.0.1', () => {
      const addr = server.address();
      const actualPort = typeof addr === 'object' && addr ? addr.port : port;
      resolve({ server, port: actualPort });
    });
    server.on('error', reject);
  });
}
