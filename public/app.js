let results = [];

// Tabs
document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => switchTab(tab.dataset.tab));
});

function switchTab(name) {
  document.querySelectorAll('.tab').forEach((t) => {
    t.classList.toggle('tab-active', t.dataset.tab === name);
  });
  document.querySelectorAll('.tab-panel').forEach((p) => {
    p.classList.toggle('tab-panel-active', p.id === `tab-${name}`);
  });
  // Reset cross-tab UI: each tab is its own workflow
  resultsSection.hidden = true;
  resultsBar.hidden = true;
  channelPicker.hidden = true;
  albumPicker.hidden = true;
  clearStatus();
}

// Theme toggle (initial theme is set inline in <head> to avoid flash)
const themeToggle = document.getElementById('themeToggle');
function syncToggleIcon() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  themeToggle.textContent = isDark ? '☀️' : '\u{1F319}';
  themeToggle.setAttribute('aria-label', isDark ? 'Schakel naar licht thema' : 'Schakel naar donker thema');
}
syncToggleIcon();
themeToggle.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  syncToggleIcon();
});

const searchBtn = document.getElementById('searchBtn');
const downloadAllBtn = document.getElementById('downloadAllBtn');
const resultsBar = document.getElementById('resultsBar');
const songList = document.getElementById('songList');
const statusBar = document.getElementById('statusBar');
const resultsSection = document.getElementById('results');
const resultsList = document.getElementById('resultsList');
const channelInput = document.getElementById('channelInput');
const channelSearchBtn = document.getElementById('channelSearchBtn');
const channelPicker = document.getElementById('channelPicker');
const channelPickerList = document.getElementById('channelPickerList');
const albumInput = document.getElementById('albumInput');
const albumSearchBtn = document.getElementById('albumSearchBtn');
const albumPicker = document.getElementById('albumPicker');
const albumPickerList = document.getElementById('albumPickerList');
const playlistInput = document.getElementById('playlistInput');
const playlistSearchBtn = document.getElementById('playlistSearchBtn');
const selectAllCheckbox = document.getElementById('selectAllCheckbox');

searchBtn.addEventListener('click', searchSongs);
downloadAllBtn.addEventListener('click', downloadSelected);
channelSearchBtn.addEventListener('click', searchChannels);
channelInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') searchChannels(); });
albumSearchBtn.addEventListener('click', searchAlbums);
albumInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') searchAlbums(); });
playlistSearchBtn.addEventListener('click', loadPlaylist);
playlistInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') loadPlaylist(); });
selectAllCheckbox.addEventListener('change', toggleSelectAll);

albumPickerList.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-album-id]');
  if (btn) pickAlbum(btn.dataset.albumId);
});

resultsList.addEventListener('change', (e) => {
  if (e.target.classList.contains('result-checkbox')) {
    updateDownloadAllLabel();
    updateSelectAllState();
  }
});

channelPickerList.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-channel-url]');
  if (btn) pickChannel(btn.dataset.channelUrl);
});

async function searchSongs() {
  const raw = songList.value.trim();
  if (!raw) return;

  const queries = raw.split('\n').map(q => q.trim()).filter(Boolean);
  if (!queries.length) return;

  searchBtn.disabled = true;
  searchBtn.textContent = '⏳ Zoeken...';
  setStatus(`Zoeken naar ${queries.length} nummer${queries.length !== 1 ? 's' : ''}...`);
  resultsSection.hidden = true;
  channelPicker.hidden = true;
  albumPicker.hidden = true;
  resultsBar.hidden = true;

  try {
    const res = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queries }),
    });
    if (!res.ok) throw new Error(await res.text());
    results = await res.json();
    renderResults(results);
    clearStatus();
  } catch (err) {
    setStatus(`Fout bij zoeken: ${err.message}`);
  } finally {
    searchBtn.disabled = false;
    searchBtn.textContent = '🔍 Zoek nummer(s)';
  }
}

async function searchChannels() {
  const name = channelInput.value.trim();
  if (!name) return;

  channelSearchBtn.disabled = true;
  channelSearchBtn.textContent = '⏳ Zoeken...';
  channelPicker.hidden = true;
  albumPicker.hidden = true;
  resultsSection.hidden = true;
  resultsBar.hidden = true;
  setStatus(`Zoeken naar kanaal "${name}"...`);

  try {
    const res = await fetch('/api/channel-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelName: name }),
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.error || `HTTP ${res.status}`);
    }
    const { channels } = await res.json();
    renderChannelPicker(channels);
    clearStatus();
  } catch (err) {
    setStatus(`Fout bij kanaal zoeken: ${err.message}`);
  } finally {
    channelSearchBtn.disabled = false;
    channelSearchBtn.textContent = '🔍 Zoek kanaal';
  }
}

function renderChannelPicker(channels) {
  channelPickerList.innerHTML = channels.map((c) => `
    <div class="channel-card">
      ${c.thumbnail ? `<img class="channel-thumb" src="${_esc(c.thumbnail)}" alt="" loading="lazy">` : '<div class="channel-thumb channel-thumb-placeholder">📺</div>'}
      <div class="channel-info">
        <div class="channel-name">${_esc(c.name)}</div>
        <div class="channel-meta">
          ${c.subscribers ? `${_esc(String(c.subscribers))} abonnees` : ''}${c.subscribers && c.videoCount ? ' &middot; ' : ''}${c.videoCount ? `${_esc(String(c.videoCount))} video's` : ''}
        </div>
        ${c.description ? `<div class="channel-desc">${_esc(c.description)}</div>` : ''}
      </div>
      <button class="btn btn-primary btn-sm" data-channel-url="${_esc(c.url)}">Kies</button>
    </div>
  `).join('');
  channelPicker.hidden = false;
}

async function loadPlaylist() {
  const url = playlistInput.value.trim();
  if (!url) return;

  if (!/^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(url)) {
    setStatus('Geen geldige YouTube-URL. Verwacht: https://www.youtube.com/playlist?list=...');
    return;
  }

  playlistSearchBtn.disabled = true;
  playlistSearchBtn.textContent = '⏳ Ophalen...';
  resultsSection.hidden = true;
  resultsBar.hidden = true;
  channelPicker.hidden = true;
  albumPicker.hidden = true;
  setStatus("Video's worden opgehaald van de playlist — dit kan even duren bij grote playlists...");

  try {
    const res = await fetch('/api/playlist-videos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.error || `HTTP ${res.status}`);
    }
    const data = await res.json();
    results = data.videos;
    renderResults(results);
    setStatus(`${results.length} video's gevonden. Vink uit wat je niet wil downloaden.`);
  } catch (err) {
    setStatus(`Fout bij ophalen playlist: ${err.message}`);
  } finally {
    playlistSearchBtn.disabled = false;
    playlistSearchBtn.textContent = '📋 Haal playlist op';
  }
}

async function searchAlbums() {
  const query = albumInput.value.trim();
  if (!query) return;

  albumSearchBtn.disabled = true;
  albumSearchBtn.textContent = '⏳ Zoeken...';
  albumPicker.hidden = true;
  channelPicker.hidden = true;
  resultsSection.hidden = true;
  resultsBar.hidden = true;
  setStatus(`Zoeken naar album "${query}" op Discogs...`);

  try {
    const res = await fetch('/api/album-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.error || `HTTP ${res.status}`);
    }
    const { albums } = await res.json();
    renderAlbumPicker(albums);
    clearStatus();
  } catch (err) {
    setStatus(`Fout bij album zoeken: ${err.message}`);
  } finally {
    albumSearchBtn.disabled = false;
    albumSearchBtn.textContent = '🔍 Zoek album';
  }
}

function renderAlbumPicker(albums) {
  albumPickerList.innerHTML = albums.map((a) => `
    <div class="channel-card">
      ${a.thumbnail ? `<img class="album-thumb" src="${_esc(a.thumbnail)}" alt="" loading="lazy">` : '<div class="album-thumb channel-thumb-placeholder">💿</div>'}
      <div class="channel-info">
        <div class="channel-name">${_esc(a.title)}</div>
        <div class="channel-meta">
          ${a.year ? _esc(String(a.year)) : ''}${a.year && a.format ? ' &middot; ' : ''}${a.format ? _esc(a.format) : ''}
        </div>
      </div>
      <button class="btn btn-primary btn-sm" data-album-id="${_esc(String(a.id))}">Kies</button>
    </div>
  `).join('');
  albumPicker.hidden = false;
}

async function pickAlbum(albumId) {
  albumPicker.hidden = true;
  setStatus('Tracklist ophalen van Discogs...');

  try {
    const res = await fetch('/api/album-tracks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ albumId }),
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.error || `HTTP ${res.status}`);
    }
    const { tracks } = await res.json();

    const lines = tracks
      .map(t => `${t.artist} - ${t.title}`)
      .join('\n');
    songList.value = lines;
    switchTab('songs');
    clearStatus();
    await searchSongs();
  } catch (err) {
    setStatus(`Fout bij ophalen tracklist: ${err.message}`);
  }
}

async function pickChannel(channelUrl) {
  channelPicker.hidden = true;
  setStatus("Video's worden opgehaald van het kanaal — dit kan even duren bij grote kanalen...");

  try {
    const res = await fetch('/api/channel-videos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelUrl }),
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.error || `HTTP ${res.status}`);
    }
    const data = await res.json();
    results = data.videos;
    if (!results.length) {
      setStatus("Geen video's gevonden in dit kanaal.");
      return;
    }
    renderResults(results);
    setStatus(`${results.length} video's gevonden. Vink uit wat je niet wil downloaden.`);
  } catch (err) {
    setStatus(`Fout bij ophalen video's: ${err.message}`);
  }
}

function renderResults(data) {
  resultsList.innerHTML = data.map((r, i) => {
    if (!r.found) {
      return `
        <div class="result-card not-found">
          <div class="result-info">
            <div class="result-title">&#10060; Niet gevonden</div>
            <div class="result-query">${_esc(r.query || '')}</div>
          </div>
        </div>`;
    }
    const sourceLine = r.source
      ? `<div class="result-query">&#128250; ${_esc(r.source)}</div>`
      : r.query ? `<div class="result-query">&#128269; ${_esc(r.query)}</div>` : '';
    return `
      <div class="result-card" data-index="${i}" style="--i:${i}">
        <input type="checkbox" class="result-checkbox" id="check-${i}" data-index="${i}" checked aria-label="Selecteer voor download">
        <img class="thumbnail" src="${_esc(r.thumbnail)}" alt="" loading="lazy">
        <div class="result-info">
          <div class="result-title" title="${_esc(r.title)}">${_esc(r.title)}</div>
          <div class="result-meta">${_esc(r.channel || '')}${r.duration ? ' &middot; ' + _esc(r.duration) : ''}</div>
          ${sourceLine}
          <div class="result-actions">
            <a class="btn btn-sm btn-youtube" href="${_esc(r.url)}" target="_blank" rel="noopener noreferrer">&#9654; YouTube</a>
            <button class="btn btn-sm btn-download" id="dl-btn-${i}" onclick="downloadSong(${i})">&#8659; MP3</button>
          </div>
          <div class="progress-wrap" id="progress-wrap-${i}" hidden>
            <div class="progress-bar"><div class="progress-fill" id="progress-fill-${i}"></div></div>
            <span class="progress-pct" id="progress-pct-${i}">0%</span>
          </div>
        </div>
      </div>`;
  }).join('');

  resultsSection.hidden = false;

  const foundCount = data.filter(r => r.found).length;
  if (foundCount > 0) {
    resultsBar.hidden = false;
    selectAllCheckbox.checked = true;
    selectAllCheckbox.indeterminate = false;
    updateDownloadAllLabel();
  } else {
    resultsBar.hidden = true;
  }
}

function updateDownloadAllLabel() {
  const checkedCount = document.querySelectorAll('.result-checkbox:checked').length;
  const totalFound = results.filter(r => r.found).length;

  if (checkedCount === 0) {
    downloadAllBtn.textContent = 'Niets geselecteerd';
    downloadAllBtn.disabled = true;
  } else if (checkedCount === totalFound) {
    downloadAllBtn.textContent = `⬇ Download alles (${checkedCount})`;
    downloadAllBtn.disabled = false;
  } else {
    downloadAllBtn.textContent = `⬇ Download selectie (${checkedCount})`;
    downloadAllBtn.disabled = false;
  }
}

function updateSelectAllState() {
  const all = document.querySelectorAll('.result-checkbox');
  const checked = document.querySelectorAll('.result-checkbox:checked');
  if (checked.length === 0) {
    selectAllCheckbox.checked = false;
    selectAllCheckbox.indeterminate = false;
  } else if (checked.length === all.length) {
    selectAllCheckbox.checked = true;
    selectAllCheckbox.indeterminate = false;
  } else {
    selectAllCheckbox.checked = false;
    selectAllCheckbox.indeterminate = true;
  }
}

function toggleSelectAll() {
  const checked = selectAllCheckbox.checked;
  document.querySelectorAll('.result-checkbox').forEach(cb => { cb.checked = checked; });
  selectAllCheckbox.indeterminate = false;
  updateDownloadAllLabel();
}

async function downloadSong(index) {
  const r = results[index];
  if (!r?.found) return false;

  const btn = document.getElementById(`dl-btn-${index}`);
  const wrap = document.getElementById(`progress-wrap-${index}`);
  const fill = document.getElementById(`progress-fill-${index}`);
  const pct = document.getElementById(`progress-pct-${index}`);

  if (btn.classList.contains('btn-done')) return true;

  btn.disabled = true;
  btn.textContent = '⏳ Bezig...';
  wrap.hidden = false;

  try {
    const res = await fetch('/api/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId: r.videoId }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    const jobId = await pollJob(data.jobId, fill, pct);

    triggerDownload(`/api/file/${jobId}`);

    btn.textContent = '✓ Gedownload';
    btn.classList.remove('btn-download');
    btn.classList.add('btn-done');
    return true;
  } catch (err) {
    btn.textContent = '✗ Fout';
    btn.classList.add('btn-error');
    btn.disabled = false;
    console.error('Download fout:', err);
    return false;
  }
}

function pollJob(jobId, fill, pct) {
  return new Promise((resolve, reject) => {
    const iv = setInterval(async () => {
      try {
        const res = await fetch(`/api/job/${jobId}`);
        const job = await res.json();

        fill.style.width = job.progress + '%';
        pct.textContent = Math.round(job.progress) + '%';

        if (job.status === 'done') {
          clearInterval(iv);
          resolve(jobId);
        } else if (job.status === 'error') {
          clearInterval(iv);
          reject(new Error(job.error || 'Onbekende fout'));
        }
      } catch (err) {
        clearInterval(iv);
        reject(err);
      }
    }, 600);
  });
}

function triggerDownload(url) {
  const a = document.createElement('a');
  a.href = url;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => a.remove(), 1000);
}

async function downloadSelected() {
  downloadAllBtn.disabled = true;
  const toDownload = results
    .map((r, i) => ({ ...r, index: i }))
    .filter(r => r.found)
    .filter(r => document.getElementById(`check-${r.index}`)?.checked);

  for (const r of toDownload) {
    const btn = document.getElementById(`dl-btn-${r.index}`);
    if (btn?.classList.contains('btn-done')) continue;
    await downloadSong(r.index);
  }

  updateDownloadAllLabel();
}

function setStatus(msg) {
  statusBar.textContent = msg;
  statusBar.hidden = false;
}

function clearStatus() {
  statusBar.hidden = true;
}

function _esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
