import { useCallback, useState } from 'react';
import type { AlbumHit, Bitrate, ChannelHit, Result, TabName } from './types';
import * as api from './api';
import { useTheme } from './useTheme';
import { useDownloads } from './useDownloads';
import { SettingsModal } from './components/SettingsModal';
import { AlbumPicker, ChannelPicker } from './components/Pickers';
import { ResultsSection } from './components/ResultsSection';

const TABS: { id: TabName; label: string }[] = [
  { id: 'songs', label: '🎵 Songs' },
  { id: 'channel', label: '📺 Kanaal' },
  { id: 'album', label: '💿 Album' },
  { id: 'playlist', label: '📋 Playlist' },
];

function foundMessage(count: number, skipped: number): string {
  let msg = `${count} video${count !== 1 ? "'s" : ''} gevonden. Vink uit wat je niet wil downloaden.`;
  if (skipped > 0) {
    msg += ` (${skipped} overgeslagen: korter dan 30s of langer dan 1u.)`;
  }
  return msg;
}

export default function App() {
  const { theme, toggle } = useTheme();
  const [tab, setTab] = useState<TabName>('songs');
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [songsText, setSongsText] = useState('');
  const [channelQuery, setChannelQuery] = useState('');
  const [albumQuery, setAlbumQuery] = useState('');
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const [busy, setBusy] = useState<TabName | null>(null);
  const [status, setStatus] = useState('');

  const [results, setResults] = useState<Result[]>([]);
  const [channels, setChannels] = useState<ChannelHit[] | null>(null);
  const [albums, setAlbums] = useState<AlbumHit[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const [bitrate, setBitrate] = useState<Bitrate>('320K'); // UX2: hoogste kwaliteit als default
  const [asZip, setAsZip] = useState(false); // UX1: ZIP standaard uit

  const downloads = useDownloads(results);

  // Verse resultaten: alles aanvinken en download-state wissen.
  const applyResults = useCallback(
    (data: Result[]) => {
      setResults(data);
      const found = data.map((r, i) => (r.found ? i : -1)).filter((i) => i >= 0);
      setSelected(new Set(found));
      downloads.reset();
    },
    [downloads]
  );

  // Wissel tab: elke tab is z'n eigen workflow → reset gedeelde UI.
  function switchTab(name: TabName) {
    setTab(name);
    setResults([]);
    setChannels(null);
    setAlbums(null);
    setStatus('');
  }

  function clearTransient() {
    setResults([]);
    setChannels(null);
    setAlbums(null);
  }

  async function searchSongs() {
    const queries = songsText
      .split('\n')
      .map((q) => q.trim())
      .filter(Boolean);
    if (!queries.length) return;

    setBusy('songs');
    clearTransient();
    setStatus(`Zoeken naar ${queries.length} nummer${queries.length !== 1 ? 's' : ''}...`);
    try {
      const data = await api.searchSongs(queries);
      applyResults(data);
      setStatus('');
    } catch (err) {
      setStatus(`Fout bij zoeken: ${(err as Error).message}`);
    } finally {
      setBusy(null);
    }
  }

  async function searchChannels() {
    const name = channelQuery.trim();
    if (!name) return;
    setBusy('channel');
    clearTransient();
    setStatus(`Zoeken naar kanaal "${name}"...`);
    try {
      const { channels } = await api.searchChannels(name);
      setChannels(channels);
      setStatus('');
    } catch (err) {
      setStatus(`Fout bij kanaal zoeken: ${(err as Error).message}`);
    } finally {
      setBusy(null);
    }
  }

  async function pickChannel(channelUrl: string) {
    setChannels(null);
    setStatus("Video's worden opgehaald van het kanaal — dit kan even duren bij grote kanalen...");
    try {
      const data = await api.channelVideos(channelUrl);
      if (!data.videos.length) {
        setStatus("Geen video's gevonden in dit kanaal.");
        return;
      }
      applyResults(data.videos);
      setStatus(foundMessage(data.videos.length, data.skipped));
    } catch (err) {
      setStatus(`Fout bij ophalen video's: ${(err as Error).message}`);
    }
  }

  async function searchAlbums() {
    const query = albumQuery.trim();
    if (!query) return;
    setBusy('album');
    clearTransient();
    setStatus(`Zoeken naar album "${query}" op Discogs...`);
    try {
      const { albums } = await api.searchAlbums(query);
      setAlbums(albums);
      setStatus('');
    } catch (err) {
      setStatus(`Fout bij album zoeken: ${(err as Error).message}`);
    } finally {
      setBusy(null);
    }
  }

  async function pickAlbum(albumId: string | number) {
    setAlbums(null);
    setStatus('Tracklist ophalen van Discogs...');
    try {
      const { tracks } = await api.albumTracks(albumId);
      const lines = tracks.map((t) => `${t.artist} - ${t.title}`).join('\n');
      setSongsText(lines);
      setTab('songs');
      setStatus('');
      // Zoek de tracklist meteen op.
      const queries = tracks.map((t) => `${t.artist} - ${t.title}`);
      setStatus(`Zoeken naar ${queries.length} nummer${queries.length !== 1 ? 's' : ''}...`);
      const data = await api.searchSongs(queries);
      applyResults(data);
      setStatus('');
    } catch (err) {
      setStatus(`Fout bij ophalen tracklist: ${(err as Error).message}`);
    }
  }

  async function loadPlaylist() {
    const url = playlistUrl.trim();
    if (!url) return;
    if (!/^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(url)) {
      setStatus('Geen geldige YouTube-URL. Verwacht: https://www.youtube.com/playlist?list=...');
      return;
    }
    setBusy('playlist');
    clearTransient();
    setStatus("Video's worden opgehaald van de playlist — dit kan even duren bij grote playlists...");
    try {
      const data = await api.playlistVideos(url);
      applyResults(data.videos);
      setStatus(foundMessage(data.videos.length, data.skipped));
    } catch (err) {
      setStatus(`Fout bij ophalen playlist: ${(err as Error).message}`);
    } finally {
      setBusy(null);
    }
  }

  // .txt droppen op de songs-tab (QW3).
  function handleDrop(e: React.DragEvent<HTMLTextAreaElement>) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    if (!/\.txt$/i.test(file.name) && file.type !== 'text/plain') {
      setStatus('Alleen .txt-bestanden worden ondersteund.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '').trim();
      setSongsText((prev) => (prev.trim() ? `${prev.trim()}\n${text}` : text));
      const count = text.split('\n').filter((l) => l.trim()).length;
      setStatus(`"${file.name}" ingeladen — ${count} regel${count !== 1 ? 's' : ''}.`);
    };
    reader.onerror = () => setStatus('Kon het bestand niet lezen.');
    reader.readAsText(file);
  }

  function toggleSelect(index: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function toggleSelectAll(checked: boolean) {
    if (!checked) {
      setSelected(new Set());
      return;
    }
    const found = results.map((r, i) => (r.found ? i : -1)).filter((i) => i >= 0);
    setSelected(new Set(found));
  }

  return (
    <>
      <header className="hero">
        <div className="hero-inner">
          <div className="hero-text">
            <h1>🎵 Playlist Downloader</h1>
            <p className="subtitle">Plak je nummers, zoek en download als MP3</p>
          </div>
          <div className="hero-actions">
            <button
              className="theme-toggle"
              aria-label="Instellingen"
              title="Instellingen"
              onClick={() => setSettingsOpen(true)}
            >
              ⚙️
            </button>
            <button
              className="theme-toggle"
              aria-label={theme === 'dark' ? 'Schakel naar licht thema' : 'Schakel naar donker thema'}
              onClick={toggle}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
          </div>
        </div>
      </header>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <div className="container">
        <nav className="tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`tab${tab === t.id ? ' tab-active' : ''}`}
              role="tab"
              onClick={() => switchTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {tab === 'songs' && (
          <div className="tab-panel tab-panel-active">
            <section className="input-section">
              <label htmlFor="songList">
                Nummers — één per regel, bijv. <em>Taylor Swift - Shake It Off</em>
                <span className="label-hint"> — of sleep een <code>.txt</code>-bestand hierin</span>
              </label>
              <textarea
                id="songList"
                className={dragOver ? 'drag-over' : undefined}
                placeholder={'Taylor Swift - Shake It Off\nEd Sheeran - Shape of You\nThe Weeknd - Blinding Lights'}
                rows={8}
                spellCheck={false}
                value={songsText}
                onChange={(e) => setSongsText(e.target.value)}
                onDragEnter={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
              />
              <div className="actions">
                <button className="btn btn-primary" disabled={busy === 'songs'} onClick={searchSongs}>
                  {busy === 'songs' ? '⏳ Zoeken...' : '🔍 Zoek nummer(s)'}
                </button>
              </div>
            </section>
          </div>
        )}

        {tab === 'channel' && (
          <div className="tab-panel tab-panel-active">
            <section className="input-section">
              <label htmlFor="channelInput">
                Naam van een YouTube-kanaal — download alle video's van het kanaal
              </label>
              <div className="actions">
                <input
                  id="channelInput"
                  type="text"
                  className="channel-input"
                  placeholder="bijv. Volbeat - Topic"
                  autoComplete="off"
                  value={channelQuery}
                  onChange={(e) => setChannelQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && searchChannels()}
                />
                <button className="btn btn-primary" disabled={busy === 'channel'} onClick={searchChannels}>
                  {busy === 'channel' ? '⏳ Zoeken...' : '🔍 Zoek kanaal'}
                </button>
              </div>
            </section>
          </div>
        )}

        {tab === 'album' && (
          <div className="tab-panel tab-panel-active">
            <section className="input-section">
              <label htmlFor="albumInput">
                Naam van een album — tracklist wordt opgehaald via Discogs en automatisch gezocht
              </label>
              <div className="actions">
                <input
                  id="albumInput"
                  type="text"
                  className="channel-input"
                  placeholder="bijv. Volbeat - Rewind, Replay, Rebound"
                  autoComplete="off"
                  value={albumQuery}
                  onChange={(e) => setAlbumQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && searchAlbums()}
                />
                <button className="btn btn-primary" disabled={busy === 'album'} onClick={searchAlbums}>
                  {busy === 'album' ? '⏳ Zoeken...' : '🔍 Zoek album'}
                </button>
              </div>
            </section>
          </div>
        )}

        {tab === 'playlist' && (
          <div className="tab-panel tab-panel-active">
            <section className="input-section">
              <label htmlFor="playlistInput">
                URL van een YouTube-playlist — download alle nummers eruit
              </label>
              <div className="actions">
                <input
                  id="playlistInput"
                  type="text"
                  className="channel-input"
                  placeholder="https://www.youtube.com/playlist?list=..."
                  autoComplete="off"
                  value={playlistUrl}
                  onChange={(e) => setPlaylistUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadPlaylist()}
                />
                <button className="btn btn-primary" disabled={busy === 'playlist'} onClick={loadPlaylist}>
                  {busy === 'playlist' ? '⏳ Ophalen...' : '📋 Haal playlist op'}
                </button>
              </div>
            </section>
          </div>
        )}

        {status && <div className="status-bar">{status}</div>}

        {channels && <ChannelPicker channels={channels} onPick={pickChannel} />}
        {albums && <AlbumPicker albums={albums} onPick={pickAlbum} />}

        {results.length > 0 && (
          <ResultsSection
            results={results}
            selected={selected}
            states={downloads.states}
            bitrate={bitrate}
            asZip={asZip}
            onToggle={toggleSelect}
            onToggleAll={toggleSelectAll}
            onBitrate={setBitrate}
            onAsZip={setAsZip}
            onDownloadOne={(i) => downloads.downloadOne(i, bitrate)}
            onDownloadSelected={() =>
              downloads.downloadSelected([...selected].sort((a, b) => a - b), bitrate, asZip, setStatus)
            }
          />
        )}

        <p className="footer-note">MP3's worden gedownload via je browser</p>
      </div>
    </>
  );
}
