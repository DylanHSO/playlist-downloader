import { start } from './app';

// Direct via `node dist/server/index.js` (CLI-modus) of via tsx in dev:
// luister op de vaste poort en log de URL.
start().then(({ port }) => {
  console.log(`\nPlaylist Downloader → http://localhost:${port}\n`);
});

export { start };
