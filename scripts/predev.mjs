/**
 * predev.mjs — wordt gerund vóór `npm run dev`.
 * Maakt poorten 3000 en 5173 vrij zodat crash-restanten geen blokkade vormen.
 * De Vite dep-cache staat in os.tmpdir() (zie vite.config.ts) zodat OneDrive
 * hem nooit kan vergrendelen — cache hoeft hier dus niet gewist te worden.
 */

import { execSync } from 'child_process';

const PORTS = [3000, 5173];

for (const port of PORTS) {
  try {
    const out = execSync(
      `netstat -ano | findstr ":${port} " | findstr LISTENING`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }
    );
    const pids = [...new Set(
      out.trim().split('\n')
        .map(line => line.trim().split(/\s+/).at(-1))
        .filter(Boolean)
    )];
    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
        console.log(`[predev] poort ${port} vrijgemaakt (PID ${pid})`);
      } catch { /* al weg */ }
    }
  } catch { /* poort was vrij */ }
}
