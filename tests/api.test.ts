import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

// yt-search wordt gemockt zodat /api/search geen echte netwerk-call doet.
vi.mock('yt-search', () => ({ default: vi.fn() }));

import ytSearch from 'yt-search';
import { createApp } from '../server/app';

const app = createApp();
const mockedYtSearch = ytSearch as unknown as ReturnType<typeof vi.fn>;

afterEach(() => {
  vi.restoreAllMocks();
  mockedYtSearch.mockReset();
});

describe('POST /api/search', () => {
  it('geeft 400 bij een lege lijst', async () => {
    const res = await request(app).post('/api/search').send({ queries: [] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Geen nummers/);
  });

  it('mapt het eerste YouTube-resultaat per query', async () => {
    mockedYtSearch.mockResolvedValue({
      videos: [
        {
          videoId: 'xyz',
          title: 'Shake It Off',
          url: 'https://youtu.be/xyz',
          timestamp: '3:39',
          thumbnail: 'thumb.jpg',
          author: { name: 'Taylor Swift' },
        },
      ],
    });
    const res = await request(app).post('/api/search').send({ queries: ['Taylor Swift - Shake It Off'] });
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ found: true, videoId: 'xyz', channel: 'Taylor Swift' });
  });

  it('markeert een query als niet gevonden bij geen resultaten', async () => {
    mockedYtSearch.mockResolvedValue({ videos: [] });
    const res = await request(app).post('/api/search').send({ queries: ['zzz onvindbaar'] });
    expect(res.body[0]).toEqual({ query: 'zzz onvindbaar', found: false });
  });
});

describe('POST /api/channel-search', () => {
  it('geeft 400 zonder kanaal-naam', async () => {
    const res = await request(app).post('/api/channel-search').send({});
    expect(res.status).toBe(400);
  });

  it('geeft de top-3 kanalen terug', async () => {
    mockedYtSearch.mockResolvedValue({
      channels: [
        { name: 'A', url: 'u1', subCount: 100 },
        { name: 'B', url: 'u2', subCount: 0 },
        { name: 'C', url: 'u3' },
        { name: 'D', url: 'u4' },
      ],
    });
    const res = await request(app).post('/api/channel-search').send({ channelName: 'test' });
    expect(res.status).toBe(200);
    expect(res.body.channels).toHaveLength(3);
    expect(res.body.channels[0]).toMatchObject({ name: 'A', subscribers: 100 });
  });
});

describe('GET /api/settings', () => {
  it('rapporteert niet-geconfigureerd zonder token (en lekt de token niet)', async () => {
    const res = await request(app).get('/api/settings');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ discogsConfigured: false, discogsLocked: false });
    expect(res.body).not.toHaveProperty('discogsToken');
  });
});

describe('Discogs endpoints zonder token', () => {
  it('album-search geeft 503', async () => {
    const res = await request(app).post('/api/album-search').send({ query: 'x' });
    expect(res.status).toBe(503);
  });

  it('album-tracks geeft 503', async () => {
    const res = await request(app).post('/api/album-tracks').send({ albumId: 1 });
    expect(res.status).toBe(503);
  });
});

describe('POST /api/album-search met token', () => {
  beforeEach(() => {
    process.env.DISCOGS_TOKEN = 'test-token';
  });
  afterEach(() => {
    delete process.env.DISCOGS_TOKEN;
  });

  it('mapt Discogs-zoekresultaten', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          results: [
            { master_id: 42, title: 'Rewind, Replay, Rebound', year: 2019, cover_image: 'c.jpg', format: ['CD', 'Album'] },
          ],
        }),
      }))
    );
    const res = await request(app).post('/api/album-search').send({ query: 'volbeat' });
    expect(res.status).toBe(200);
    expect(res.body.albums[0]).toMatchObject({ id: 42, title: 'Rewind, Replay, Rebound', format: 'CD, Album' });
  });
});

describe('download- en zip-validatie', () => {
  it('POST /api/download zonder videoId geeft 400', async () => {
    const res = await request(app).post('/api/download').send({});
    expect(res.status).toBe(400);
  });

  it('GET /api/job/:id geeft 404 voor een onbekende job', async () => {
    const res = await request(app).get('/api/job/onbekend');
    expect(res.status).toBe(404);
  });

  it('POST /api/zip zonder jobIds geeft 400', async () => {
    const res = await request(app).post('/api/zip').send({ jobIds: [] });
    expect(res.status).toBe(400);
  });

  it('GET /api/file/:id geeft 404 voor een onbekende job', async () => {
    const res = await request(app).get('/api/file/onbekend');
    expect(res.status).toBe(404);
  });
});
