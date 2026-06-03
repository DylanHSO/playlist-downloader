import type { AlbumHit, ChannelHit } from '../types';

export function ChannelPicker({
  channels,
  onPick,
}: {
  channels: ChannelHit[];
  onPick: (url: string) => void;
}) {
  return (
    <section className="channel-picker-section">
      <h2 className="picker-title">Kies een kanaal</h2>
      <div>
        {channels.map((c) => (
          <div className="channel-card" key={c.url}>
            {c.thumbnail ? (
              <img className="channel-thumb" src={c.thumbnail} alt="" loading="lazy" />
            ) : (
              <div className="channel-thumb channel-thumb-placeholder">📺</div>
            )}
            <div className="channel-info">
              <div className="channel-name">{c.name}</div>
              <div className="channel-meta">
                {c.subscribers ? `${c.subscribers} abonnees` : ''}
                {c.subscribers && c.videoCount ? ' · ' : ''}
                {c.videoCount ? `${c.videoCount} video's` : ''}
              </div>
              {c.description && <div className="channel-desc">{c.description}</div>}
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => onPick(c.url)}>
              Kies
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

export function AlbumPicker({
  albums,
  onPick,
}: {
  albums: AlbumHit[];
  onPick: (hit: AlbumHit) => void;
}) {
  return (
    <section className="channel-picker-section">
      <h2 className="picker-title">Kies een album</h2>
      <div>
        {albums.map((a) => (
          <div className="channel-card" key={String(a.id)}>
            {a.thumbnail ? (
              <img className="album-thumb" src={a.thumbnail} alt="" loading="lazy" />
            ) : (
              <div className="album-thumb channel-thumb-placeholder">💿</div>
            )}
            <div className="channel-info">
              <div className="channel-name">{a.title}</div>
              <div className="channel-meta">
                {a.year ? String(a.year) : ''}
                {a.year && a.format ? ' · ' : ''}
                {a.format || ''}
              </div>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => onPick(a)}>
              Kies
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
