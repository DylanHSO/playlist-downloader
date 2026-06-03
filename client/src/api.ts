import type { Result, ChannelHit, AlbumHit, Settings, Bitrate, TrackMeta } from './types';

// Kleine fetch-helper: POST JSON, gooi de server-foutmelding door als Error.
async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export function searchSongs(queries: string[]): Promise<Result[]> {
  return postJson('/api/search', { queries });
}

export function searchChannels(channelName: string): Promise<{ channels: ChannelHit[] }> {
  return postJson('/api/channel-search', { channelName });
}

export function channelVideos(
  channelUrl: string
): Promise<{ videos: Result[]; skipped: number; channel: { name: string; total: number } }> {
  return postJson('/api/channel-videos', { channelUrl });
}

export function playlistVideos(
  url: string
): Promise<{ videos: Result[]; skipped: number; playlist: { name: string; total: number } }> {
  return postJson('/api/playlist-videos', { url });
}

export function searchAlbums(query: string): Promise<{ albums: AlbumHit[] }> {
  return postJson('/api/album-search', { query });
}

export function albumTracks(
  albumId: string | number,
  releaseType: 'master' | 'release' = 'master'
): Promise<{ album: { title: string; artist: string; year: number | null }; tracks: { artist: string; title: string }[] }> {
  return postJson('/api/album-tracks', { albumId, releaseType });
}

export async function getSettings(): Promise<Settings> {
  const res = await fetch('/api/settings');
  return res.json();
}

export function saveSettings(discogsToken: string): Promise<{ discogsConfigured: boolean }> {
  return postJson('/api/settings', { discogsToken });
}

export function startDownload(videoId: string, bitrate: Bitrate, meta?: TrackMeta, title?: string): Promise<{ jobId: string }> {
  return postJson('/api/download', { videoId, bitrate, meta, title });
}

export interface JobStatus {
  status: 'pending' | 'downloading' | 'done' | 'error';
  progress: number;
  error: string | null;
  filename: string | null;
}

export async function getJob(jobId: string): Promise<JobStatus> {
  const res = await fetch(`/api/job/${jobId}`);
  return res.json();
}

export function createZip(jobIds: string[]): Promise<{ zipId: string; count: number }> {
  return postJson('/api/zip', { jobIds });
}

// Trigger een browser-download zonder navigatie.
export function triggerDownload(url: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => a.remove(), 1000);
}
