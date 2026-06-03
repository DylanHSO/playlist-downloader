import { useCallback, useRef, useState } from 'react';
import type { Bitrate, DownloadState, Result } from './types';
import { createZip, getJob, startDownload, triggerDownload } from './api';

// Max. aantal gelijktijdige downloads (QW2).
const DOWNLOAD_CONCURRENCY = 3;

function pollJob(
  jobId: string,
  onProgress: (pct: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const iv = setInterval(async () => {
      try {
        const job = await getJob(jobId);
        onProgress(job.progress);
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

export function useDownloads(results: Result[]) {
  const [states, setStates] = useState<Record<number, DownloadState>>({});
  // Altijd de actuele states kunnen lezen vanuit async loops.
  const statesRef = useRef(states);
  statesRef.current = states;

  const update = useCallback((index: number, patch: Partial<DownloadState>) => {
    setStates((prev) => {
      const current: DownloadState = prev[index] ?? { status: 'idle', progress: 0 };
      return { ...prev, [index]: { ...current, ...patch } };
    });
  }, []);

  const reset = useCallback(() => setStates({}), []);

  // Voert de downloadjob uit en pollt de voortgang. Retourneert de jobId of
  // null bij een fout. Triggert zélf geen browser-download.
  const runJob = useCallback(
    async (index: number, bitrate: Bitrate): Promise<string | null> => {
      const r = results[index];
      if (!r?.found || !r.videoId) return null;

      update(index, { status: 'downloading', progress: 0 });
      try {
        const { jobId } = await startDownload(r.videoId, bitrate);
        const done = await pollJob(jobId, (pct) => update(index, { progress: pct }));
        return done;
      } catch (err) {
        update(index, { status: 'error', label: '✗ Fout' });
        console.error('Download fout:', err);
        return null;
      }
    },
    [results, update]
  );

  // Losse download via de knop per regel.
  const downloadOne = useCallback(
    async (index: number, bitrate: Bitrate): Promise<void> => {
      if (statesRef.current[index]?.status === 'done') return;
      const jobId = await runJob(index, bitrate);
      if (!jobId) return;
      triggerDownload(`/api/file/${jobId}`);
      update(index, { status: 'done', label: '✓ Gedownload' });
    },
    [runJob, update]
  );

  // Download de selectie met een concurrency-pool; optioneel als ZIP (OUT1).
  const downloadSelected = useCallback(
    async (
      indices: number[],
      bitrate: Bitrate,
      asZip: boolean,
      onStatus: (msg: string) => void
    ): Promise<void> => {
      const toDownload = indices.filter(
        (i) => results[i]?.found && statesRef.current[i]?.status !== 'done'
      );
      if (!toDownload.length) return;

      const completed: string[] = [];
      let cursor = 0;

      async function worker() {
        while (cursor < toDownload.length) {
          const index = toDownload[cursor++];
          const jobId = await runJob(index, bitrate);
          if (!jobId) continue;
          completed.push(jobId);
          if (asZip) {
            update(index, { status: 'done', label: '✓ Klaar' });
          } else {
            triggerDownload(`/api/file/${jobId}`);
            update(index, { status: 'done', label: '✓ Gedownload' });
          }
        }
      }

      const workers = Array.from(
        { length: Math.min(DOWNLOAD_CONCURRENCY, toDownload.length) },
        worker
      );
      await Promise.all(workers);

      if (asZip && completed.length) {
        const n = completed.length;
        onStatus(`${n} nummer${n !== 1 ? 's' : ''} inpakken in ZIP...`);
        try {
          const { zipId, count } = await createZip(completed);
          triggerDownload(`/api/zip-file/${zipId}`);
          onStatus(`ZIP met ${count} nummer${count !== 1 ? 's' : ''} wordt gedownload.`);
        } catch (err) {
          onStatus(`Fout bij ZIP maken: ${(err as Error).message}`);
        }
      }
    },
    [results, runJob, update]
  );

  return { states, reset, downloadOne, downloadSelected };
}
