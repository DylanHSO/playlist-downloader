export type TabName = 'songs' | 'channel' | 'album' | 'playlist';

// Eén YouTube-kandidaat (RB1). De Songs-tab levert er meerdere per nummer.
export interface Candidate {
  videoId: string;
  title: string;
  url: string;
  duration: string | null;
  thumbnail: string;
  channel: string;
}

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
  // RB1: extra kandidaten uit /api/search (Shorts al weggefilterd).
  alternatives?: Candidate[];
  // Frontend-only: de volledige keuzelijst (primair eerst) + de actieve keuze.
  candidates?: Candidate[];
  candidateIndex?: number;
  // OUT2: ID3-metadata voor de download (Album-tab levert dit via Discogs).
  meta?: TrackMeta;
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
  // IN1: onderscheid tussen master en release voor compilations/live-albums zonder master.
  releaseType: 'master' | 'release';
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

// OUT2: metadata voor ID3-tags
export interface TrackMeta {
  title?: string;
  artist?: string;
  album?: string;
  year?: number;
  coverUrl?: string;
}
