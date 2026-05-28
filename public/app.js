let results = [];

const searchBtn = document.getElementById('searchBtn');
const downloadAllBtn = document.getElementById('downloadAllBtn');
const songList = document.getElementById('songList');
const statusBar = document.getElementById('statusBar');
const resultsSection = document.getElementById('results');
const resultsList = document.getElementById('resultsList');

searchBtn.addEventListener('click', searchSongs);
downloadAllBtn.addEventListener('click', downloadAll);

async function searchSongs() {
  const raw = songList.value.trim();
  if (!raw) return;

  const queries = raw.split('\n').map(q => q.trim()).filter(Boolean);
  if (!queries.length) return;

  searchBtn.disabled = true;
  searchBtn.textContent = '⏳ Zoeken...';
  setStatus(`Zoeken naar ${queries.length} nummer${queries.length !== 1 ? 's' : ''}...`);
  resultsSection.hidden = true;
  downloadAllBtn.hidden = true;

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
    searchBtn.textContent = '🔍 Zoek nummers';
  }
}

function renderResults(data) {
  const found = data.filter(r => r.found).length;

  resultsList.innerHTML = data.map((r, i) => {
    if (!r.found) {
      return `
        <div class="result-card not-found">
          <div class="result-info">
            <div class="result-title">&#10060; Niet gevonden</div>
            <div class="result-query">${_esc(r.query)}</div>
          </div>
        </div>`;
    }
    return `
      <div class="result-card" data-index="${i}">
        <img class="thumbnail" src="${_esc(r.thumbnail)}" alt="" loading="lazy">
        <div class="result-info">
          <div class="result-title" title="${_esc(r.title)}">${_esc(r.title)}</div>
          <div class="result-meta">${_esc(r.channel || '')}${r.duration ? ' &middot; ' + _esc(r.duration) : ''}</div>
          <div class="result-query">&#128269; ${_esc(r.query)}</div>
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

  if (found > 0) {
    downloadAllBtn.hidden = false;
    downloadAllBtn.textContent = `⬇ Download alles (${found})`;
  }
}

// Returns true on success, false on error
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

    // Trigger browser download
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

async function downloadAll() {
  downloadAllBtn.disabled = true;
  const toDownload = results
    .map((r, i) => ({ ...r, index: i }))
    .filter(r => r.found);

  for (const r of toDownload) {
    const btn = document.getElementById(`dl-btn-${r.index}`);
    if (btn?.classList.contains('btn-done')) continue;
    await downloadSong(r.index);
  }

  downloadAllBtn.disabled = false;
  downloadAllBtn.textContent = '✓ Alles gedownload';
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
