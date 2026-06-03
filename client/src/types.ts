export type TabName = 'songs' | 'channel' | 'album' | 'playlist';

// Eén zoekresultaat of opgehaalde video (de twee bronnen delen deze vorm).
export interface Result {
  found: boolean;
  query?: string;
  videoId?: string;
  title?: string;
  url?: string;
  duration?: string | null;
  thumbnail?: string;
  channel?: string;
  source?: string | null;
  error?: string;
}

export interface ChannelHit {
  name: string;
  url: string;
  subscribers: number | string | null;
  videoCount: number | null;
  thumbnail: string | null;
  description: string | null;
}

export interface AlbumHit {
  id: string | number;
  title: string;
  year: number | null;
  thumbnail: string | null;
  format: string | null;
}

export interface Settings {
  discogsConfigured: boolean;
  discogsLocked: boolean;
}

export type DownloadStatus = 'idle' | 'downloading' | 'done' | 'error';

export interface DownloadState {
  status: DownloadStatus;
  progress: number;
  label?: string;
}

export type Bitrate = '128K' | '192K' | '320K';
