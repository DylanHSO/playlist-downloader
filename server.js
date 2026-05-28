const express = require('express');
const ytSearch = require('yt-search');
const ytDlp = require('yt-dlp-exec');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const path = require('path');
const fs = require('fs');
const os = require('os');
const { randomUUID } = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Basic Auth — only active when APP_PASSWORD is set (so local dev stays open)
const APP_PASSWORD = process.env.APP_PASSWORD;
const APP_USER = process.env.APP_USER || 'collega';

if (APP_PASSWORD) {
  app.use((req, res, next) => {
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
app.use(express.static(path.join(__dirname, 'public')));

// Search YouTube for multiple songs
app.post('/api/search', async (req, res) => {
  const { queries } = req.body;
  if (!Array.isArray(queries) || queries.length === 0) {
    return res.status(400).json({ error: 'Geen nummers opgegeven' });
  }

  const results = await Promise.all(
    queries.map(async (query) => {
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
app.post('/api/channel-search', async (req, res) => {
  const { channelName } = req.body;
  if (!channelName || typeof channelName !== 'string') {
    return res.status(400).json({ error: 'Geen kanaal-naam opgegeven' });
  }

  try {
    const r = await ytSearch(channelName);
    const positive = (n) => (typeof n === 'number' && n > 0 ? n : null);
    const channels = (r.channels || []).slice(0, 3).map((c) => ({
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
    res.status(500).json({ error: err.message || 'Onbekende fout' });
  }
});

// List all videos from a channel
app.post('/api/channel-videos', async (req, res) => {
  const { channelUrl } = req.body;
  if (!channelUrl || typeof channelUrl !== 'string') {
    return res.status(400).json({ error: 'Geen kanaal-url opgegeven' });
  }

  try {
    // yt-dlp-exec auto-parses JSON when stdout starts with `{`, so this is
    // already the parsed channel info — no JSON.parse needed.
    const data = await ytDlp(channelUrl, {
      flatPlaylist: true,
      dumpSingleJson: true,
      skipDownload: true,
      playlistEnd: 100,
    });

    if (typeof data !== 'object' || data === null) {
      throw new Error('Onverwacht antwoord van yt-dlp');
    }
    const entries = data.entries || [];
    const channelName = data.channel || data.uploader || '';

    const videos = entries
      .filter((e) => e.id)
      .map((e) => ({
        found: true,
        videoId: e.id,
        title: e.title || 'Onbekende titel',
        url: `https://www.youtube.com/watch?v=${e.id}`,
        duration: formatDuration(e.duration),
        thumbnail: `https://i.ytimg.com/vi/${e.id}/default.jpg`,
        channel: channelName,
        source: channelName ? `Uit kanaal: ${channelName}` : null,
      }));

    res.json({ videos, channel: { name: channelName, total: videos.length } });
  } catch (err) {
    console.error('Kanaal-video-fout:', err);
    res.status(500).json({ error: err.shortMessage || err.message || 'Onbekende fout' });
  }
});

function formatDuration(secs) {
  if (typeof secs !== 'number' || !isFinite(secs) || secs <= 0) return null;
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// In-memory job tracking
const jobs = new Map();

// Start a download job — returns jobId immediately
app.post('/api/download', (req, res) => {
  const { videoId } = req.body;
  if (!videoId) return res.status(400).json({ error: 'videoId ontbreekt' });

  const jobId = randomUUID();
  jobs.set(jobId, { status: 'pending', progress: 0, error: null, file: null, filename: null });
  res.json({ jobId });

  runDownload(videoId, jobId);
});

// Poll job status
app.get('/api/job/:id', (req, res) => {
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
app.get('/api/file/:id', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job || job.status !== 'done' || !job.file) {
    return res.status(404).json({ error: 'Bestand niet (meer) beschikbaar' });
  }

  const safeFilename = encodeURIComponent(job.filename);
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${safeFilename}`);
  res.setHeader('Content-Type', 'audio/mpeg');

  const stream = fs.createReadStream(job.file);
  stream.pipe(res);

  stream.on('close', () => {
    const jobDir = path.dirname(job.file);
    fs.rm(jobDir, { recursive: true, force: true }, () => {});
    jobs.delete(req.params.id);
  });

  stream.on('error', () => res.end());
});

async function runDownload(videoId, jobId) {
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const job = jobs.get(jobId);
  job.status = 'downloading';

  const jobDir = path.join(os.tmpdir(), jobId);
  fs.mkdirSync(jobDir, { recursive: true });

  try {
    const proc = ytDlp(url, {
      extractAudio: true,
      audioFormat: 'mp3',
      audioQuality: '192K',
      ffmpegLocation: ffmpegPath,
      output: path.join(jobDir, '%(title)s.%(ext)s'),
      noPlaylist: true,
      newline: true,
    });

    const parseProgress = (chunk) => {
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
    job.status = 'error';
    job.error = err.shortMessage || err.message;
    fs.rm(jobDir, { recursive: true, force: true }, () => {});
    console.error(`Download fout [${jobId}]:`, job.error);
  }
}

// Clean up temp files and jobs older than 1 hour
setInterval(() => {
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

app.listen(PORT, () => {
  console.log(`\nPlaylist Downloader → http://localhost:${PORT}\n`);
});
