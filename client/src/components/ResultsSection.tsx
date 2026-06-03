import { useEffect, useRef, useState } from 'react';
import type { Bitrate, DownloadState, Result } from '../types';
import { BATCH_SIZES, BATCH_UI_THRESHOLD, batchRanges } from '../batch';

interface Props {
  results: Result[];
  selected: Set<number>;
  states: Record<number, DownloadState>;
  bitrate: Bitrate;
  asZip: boolean;
  batchSize: number;
  onToggle: (index: number) => void;
  onToggleAll: (checked: boolean) => void;
  onBitrate: (b: Bitrate) => void;
  onAsZip: (v: boolean) => void;
  onBatchSize: (n: number) => void;
  onSelectRange: (from: number, to: number) => void;
  onChooseAlternative: (index: number, candidateIndex: number) => void;
  onDownloadOne: (index: number) => void;
  onDownloadSelected: () => void;
}

function ResultCard({
  r,
  index,
  checked,
  state,
  onToggle,
  onChooseAlternative,
  onDownloadOne,
}: {
  r: Result;
  index: number;
  checked: boolean;
  state: DownloadState | undefined;
  onToggle: (index: number) => void;
  onChooseAlternative: (index: number, candidateIndex: number) => void;
  onDownloadOne: (index: number) => void;
}) {
  const [showAlts, setShowAlts] = useState(false);
  if (!r.found) {
    return (
      <div className="result-card not-found">
        <div className="result-info">
          <div className="result-title">❌ Niet gevonden</div>
          <div className="result-query">{r.query || ''}</div>
        </div>
      </div>
    );
  }

  const status = state?.status ?? 'idle';
  const showProgress = status === 'downloading' || status === 'done';
  const pct = state?.progress ?? 0;

  // RB1: extra kandidaten om uit te kiezen (alleen zinvol vóór de download).
  const candidates = r.candidates;
  const hasAlts = !!candidates && candidates.length > 1;

  let btnClass = 'btn btn-sm btn-download';
  let btnLabel = '⇓ MP3';
  if (status === 'downloading') btnLabel = '⏳ Bezig...';
  else if (status === 'done') {
    btnClass = 'btn btn-sm btn-done';
    btnLabel = state?.label || '✓ Gedownload';
  } else if (status === 'error') {
    btnClass = 'btn btn-sm btn-error';
    btnLabel = state?.label || '✗ Fout';
  }

  return (
    <div className="result-card" style={{ '--i': index } as React.CSSProperties}>
      <input
        type="checkbox"
        className="result-checkbox"
        checked={checked}
        onChange={() => onToggle(index)}
        aria-label="Selecteer voor download"
      />
      <img className="thumbnail" src={r.thumbnail} alt="" loading="lazy" />
      <div className="result-info">
        <div className="result-title" title={r.title}>
          {r.title}
        </div>
        <div className="result-meta">
          {r.channel || ''}
          {r.duration ? ` · ${r.duration}` : ''}
        </div>
        {r.source ? (
          <div className="result-query">📺 {r.source}</div>
        ) : r.query ? (
          <div className="result-query">🔍 {r.query}</div>
        ) : null}
        <div className="result-actions">
          <a
            className="btn btn-sm btn-youtube"
            href={r.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            ▶ YouTube
          </a>
          <button
            className={btnClass}
            disabled={status === 'downloading' || status === 'done'}
            onClick={() => onDownloadOne(index)}
          >
            {btnLabel}
          </button>
          {hasAlts && (
            <button
              type="button"
              className="btn btn-sm btn-alt"
              disabled={status !== 'idle'}
              aria-expanded={showAlts}
              onClick={() => setShowAlts((v) => !v)}
            >
              🔄 Ander resultaat ({candidates!.length})
            </button>
          )}
        </div>
        {hasAlts && showAlts && (
          <div className="alternatives">
            {candidates!.map((c, ci) => (
              <button
                key={`${c.videoId}-${ci}`}
                type="button"
                className={`alt-option${ci === r.candidateIndex ? ' alt-option-active' : ''}`}
                onClick={() => {
                  onChooseAlternative(index, ci);
                  setShowAlts(false);
                }}
              >
                <span className="alt-mark">{ci === r.candidateIndex ? '●' : '○'}</span>
                <img className="alt-thumb" src={c.thumbnail} alt="" loading="lazy" />
                <span className="alt-info">
                  <span className="alt-title" title={c.title}>
                    {c.title}
                  </span>
                  <span className="alt-meta">
                    {c.channel}
                    {c.duration ? ` · ${c.duration}` : ''}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
        {showProgress && (
          <div className="progress-wrap">
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${pct}%` }} />
            </div>
            <span className="progress-pct">{Math.round(pct)}%</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function ResultsSection(props: Props) {
  const { results, selected, states } = props;
  const foundIndices = results.map((r, i) => (r.found ? i : -1)).filter((i) => i >= 0);
  const checkedCount = foundIndices.filter((i) => selected.has(i)).length;
  const allChecked = foundIndices.length > 0 && checkedCount === foundIndices.length;

  // Indeterminate-state van de "Alles"-checkbox.
  const selectAllRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = checkedCount > 0 && !allChecked;
    }
  }, [checkedCount, allChecked]);

  let downloadLabel = '⬇ Download alles';
  if (checkedCount === 0) downloadLabel = 'Niets geselecteerd';
  else if (checkedCount === foundIndices.length) downloadLabel = `⬇ Download alles (${checkedCount})`;
  else downloadLabel = `⬇ Download selectie (${checkedCount})`;

  // SEL1: batch-bereiken. Alleen tonen bij grote lijsten — kleine lijsten
  // (zoals de Album-tab die in de Songs-tab landt) blijven zo schoon.
  const showBatch = foundIndices.length > BATCH_UI_THRESHOLD;
  const ranges = batchRanges(foundIndices.length, props.batchSize);
  const rangeActive = (from: number, to: number) => {
    const slice = foundIndices.slice(from, to);
    return slice.length === checkedCount && slice.every((i) => selected.has(i));
  };

  return (
    <section className="results-section">
      {foundIndices.length > 0 && (
        <div className="results-bar">
          <label className="select-all-label">
            <input
              ref={selectAllRef}
              type="checkbox"
              checked={allChecked}
              onChange={(e) => props.onToggleAll(e.target.checked)}
            />
            <span>Alles</span>
          </label>
          <label className="bitrate-label" htmlFor="bitrateSelect">
            Kwaliteit
            <select
              id="bitrateSelect"
              className="bitrate-select"
              value={props.bitrate}
              onChange={(e) => props.onBitrate(e.target.value as Bitrate)}
            >
              <option value="128K">128 kbps</option>
              <option value="192K">192 kbps</option>
              <option value="320K">320 kbps</option>
            </select>
          </label>
          <label className="zip-label" title="Bundel de selectie in één ZIP-bestand">
            <input
              type="checkbox"
              checked={props.asZip}
              onChange={(e) => props.onAsZip(e.target.checked)}
            />
            <span>Als ZIP</span>
          </label>
          <button
            className="btn btn-success"
            disabled={checkedCount === 0}
            onClick={props.onDownloadSelected}
          >
            {downloadLabel}
          </button>
        </div>
      )}
      {showBatch && (
        <div className="batch-bar">
          <label className="batch-size-label" htmlFor="batchSizeSelect">
            Batchgrootte
            <select
              id="batchSizeSelect"
              className="bitrate-select"
              value={props.batchSize}
              onChange={(e) => props.onBatchSize(Number(e.target.value))}
            >
              {BATCH_SIZES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          {ranges.length > 1 && (
            <div className="batch-ranges">
              {ranges.map((r) => (
                <button
                  key={r.start}
                  type="button"
                  className={`btn btn-sm btn-batch${
                    rangeActive(r.start - 1, r.end) ? ' btn-batch-active' : ''
                  }`}
                  onClick={() => props.onSelectRange(r.start - 1, r.end)}
                >
                  {r.start}–{r.end}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <div>
        {results.map((r, i) => (
          <ResultCard
            key={i}
            r={r}
            index={i}
            checked={selected.has(i)}
            state={states[i]}
            onToggle={props.onToggle}
            onChooseAlternative={props.onChooseAlternative}
            onDownloadOne={props.onDownloadOne}
          />
        ))}
      </div>
    </section>
  );
}
