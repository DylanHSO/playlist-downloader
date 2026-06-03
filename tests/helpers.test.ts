import { describe, expect, it } from 'vitest';
import path from 'path';
import {
  cleanDiscogsName,
  filterByDuration,
  formatDuration,
  mapEntriesToVideos,
  normalizeBitrate,
  unpacked,
  MIN_DURATION_SECS,
  MAX_DURATION_SECS,
} from '../server/app';

describe('normalizeBitrate', () => {
  it('accepteert toegestane bitrates', () => {
    expect(normalizeBitrate('128K')).toBe('128K');
    expect(normalizeBitrate('192K')).toBe('192K');
    expect(normalizeBitrate('320K')).toBe('320K');
  });

  it('valt terug op 192K bij onverwachte invoer', () => {
    expect(normalizeBitrate('999K')).toBe('192K');
    expect(normalizeBitrate(undefined)).toBe('192K');
    expect(normalizeBitrate(256)).toBe('192K');
    expect(normalizeBitrate('')).toBe('192K');
  });
});

describe('filterByDuration', () => {
  it("verwijdert shorts (<30s) en lange video's (>1u)", () => {
    const { kept, skipped } = filterByDuration([
      { id: 'a', duration: 10 }, // te kort
      { id: 'b', duration: 200 }, // ok
      { id: 'c', duration: MAX_DURATION_SECS + 1 }, // te lang
    ]);
    expect(kept.map((e) => e.id)).toEqual(['b']);
    expect(skipped).toBe(2);
  });

  it('houdt grenswaarden en onbekende duur', () => {
    const { kept, skipped } = filterByDuration([
      { id: 'min', duration: MIN_DURATION_SECS },
      { id: 'max', duration: MAX_DURATION_SECS },
      { id: 'unknown' }, // geen duur → behouden
    ]);
    expect(kept).toHaveLength(3);
    expect(skipped).toBe(0);
  });

  it('verwerkt undefined zonder te crashen', () => {
    expect(filterByDuration(undefined)).toEqual({ kept: [], skipped: 0 });
  });
});

describe('formatDuration', () => {
  it('formatteert seconden als m:ss', () => {
    expect(formatDuration(0)).toBe(null); // <= 0 telt niet
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(600)).toBe('10:00');
    expect(formatDuration(9)).toBe('0:09');
  });

  it('geeft null bij ongeldige invoer', () => {
    expect(formatDuration(undefined)).toBe(null);
    expect(formatDuration(NaN)).toBe(null);
    expect(formatDuration(-5)).toBe(null);
    expect(formatDuration('120')).toBe(null);
  });
});

describe('mapEntriesToVideos', () => {
  it('mapt entries met id naar video-objecten', () => {
    const videos = mapEntriesToVideos(
      [
        { id: 'abc', title: 'Nummer', duration: 200 },
        { title: 'Geen id' }, // wordt overgeslagen
      ],
      'Volbeat',
      'Uit kanaal'
    );
    expect(videos).toHaveLength(1);
    expect(videos[0]).toMatchObject({
      found: true,
      videoId: 'abc',
      title: 'Nummer',
      url: 'https://www.youtube.com/watch?v=abc',
      duration: '3:20',
      channel: 'Volbeat',
      source: 'Uit kanaal: Volbeat',
    });
  });

  it('geeft titel-fallback en geen source zonder bronnaam', () => {
    const [video] = mapEntriesToVideos([{ id: 'x' }], '', 'Uit playlist');
    expect(video.title).toBe('Onbekende titel');
    expect(video.source).toBe(null);
  });
});

describe('cleanDiscogsName', () => {
  it('strip de Discogs-disambiguatie-suffix', () => {
    expect(cleanDiscogsName('Volbeat (2)')).toBe('Volbeat');
    expect(cleanDiscogsName('Nirvana')).toBe('Nirvana');
    expect(cleanDiscogsName('  Queen (12)  ')).toBe('Queen');
    expect(cleanDiscogsName(null)).toBe('');
    expect(cleanDiscogsName(undefined)).toBe('');
  });
});

describe('unpacked', () => {
  it('herschrijft een app.asar-pad naar app.asar.unpacked', () => {
    const input = `C:${path.sep}app${path.sep}app.asar${path.sep}node_modules${path.sep}bin`;
    expect(unpacked(input)).toContain(`app.asar.unpacked${path.sep}`);
  });

  it('laat paden zonder app.asar ongemoeid', () => {
    const input = `C:${path.sep}tools${path.sep}ffmpeg.exe`;
    expect(unpacked(input)).toBe(input);
    expect(unpacked(undefined)).toBe(undefined);
  });
});
